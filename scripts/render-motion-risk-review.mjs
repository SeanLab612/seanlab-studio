import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { motionRiskRanges } from "./operations/motion-risk-ranges.mjs";

const config = JSON.parse(await readFile(resolve(process.argv[2]), "utf8"));
const workspace = resolve(config.editDir);
const output = resolve(config.motionRiskReviewFile);
const reportPath = resolve(config.motionRiskReviewReportFile);
const temporaryDir = resolve(workspace, `.motion-risk-review-${process.pid}-${Date.now()}`);
const temporaryProps = resolve(temporaryDir, "props.json");
const paddingSeconds = 0.75;
const fps = 30;

const run = (command, args, label) =>
  new Promise((done, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "inherit", "inherit"] });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) done();
      else reject(new Error(`${label} exited with ${code ?? signal}`));
    });
  });

const hashFile = (path) =>
  new Promise((done, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(path);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => done(hash.digest("hex")));
  });

const workspaceRelative = (path) => relative(workspace, path).split(sep).join("/");

await mkdir(temporaryDir, { recursive: true });
try {
  const reviewProps = JSON.parse(await readFile(resolve(config.reviewPropsFile), "utf8"));
  const maximumEndSeconds = Math.max(
    0,
    ...(reviewProps.captions ?? []).map((cue) => Number(cue.end)).filter(Number.isFinite),
    ...(reviewProps.animationCues ?? []).map((cue) => Number(cue.end)).filter(Number.isFinite),
  );
  const ranges = motionRiskRanges({
    cues: reviewProps.animationCues ?? [],
    paddingSeconds,
    maximumEndSeconds,
  });
  const report = {
    schemaVersion: "1.0",
    kind: "motion-risk-review",
    generatedAt: new Date().toISOString(),
    mode: "conditional-excerpts",
    status: ranges.length ? "rendered" : "not-required",
    reason: ranges.length
      ? "Confirmed animation cues require continuous motion review."
      : "No confirmed time-sensitive animation cues are present.",
    review: { width: 960, height: 540, fps, paddingSeconds },
    excerpts: ranges.map((range, index) => ({
      id: `motion-risk-${String(index + 1).padStart(2, "0")}`,
      cueIds: range.cueIds,
      start: range.start,
      end: range.end,
      durationSeconds: range.end - range.start,
    })),
  };
  if (ranges.length) {
    reviewProps.outputFps = fps;
    await writeFile(temporaryProps, `${JSON.stringify(reviewProps)}\n`);
    const clips = [];
    for (const [index, range] of ranges.entries()) {
      const clip = resolve(temporaryDir, `clip-${String(index + 1).padStart(2, "0")}.mp4`);
      const startFrame = Math.floor(range.start * fps);
      const endFrame = Math.max(startFrame + 1, Math.ceil(range.end * fps) - 1);
      await run(
        "npx",
        [
          "remotion",
          "render",
          "src/index.ts",
          "GeneratedWorkflowReview",
          clip,
          `--props=${temporaryProps}`,
          `--frames=${startFrame}-${endFrame}`,
          "--scale=0.5",
          "--codec=h264",
          "--crf=28",
          "--pixel-format=yuv420p",
        ],
        "Remotion motion-risk excerpt",
      );
      clips.push(clip);
    }
    const concatList = resolve(temporaryDir, "concat.txt");
    await writeFile(concatList, clips.map((clip) => `file '${clip.replaceAll("'", "'\\''")}'`).join("\n"));
    const temporaryOutput = resolve(temporaryDir, "motion-risk-review.mp4");
    await run(
      "ffmpeg",
      ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", concatList, "-c", "copy", temporaryOutput],
      "ffmpeg motion-risk concat",
    );
    await mkdir(dirname(output), { recursive: true });
    await rename(temporaryOutput, output);
    const info = await stat(output);
    report.preview = {
      path: workspaceRelative(output),
      bytes: info.size,
      sha256: await hashFile(output),
      durationSeconds: ranges.reduce((total, range) => total + range.end - range.start, 0),
    };
  } else {
    await rm(output, { force: true });
  }
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    ranges.length
      ? `${output}: ${ranges.length} motion-risk excerpt group(s) at 540p30`
      : `${reportPath}: no time-sensitive animation excerpt required`,
  );
} finally {
  await rm(temporaryDir, { recursive: true, force: true });
}
