import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { readManifest, toRuntimeConfig } from "./workflow/manifest.mjs";

const values = process.argv.slice(2);
const option = (name) => {
  const index = values.indexOf(name);
  return index >= 0 ? values[index + 1] : undefined;
};
const manifestPath = option("--project");
if (!manifestPath) throw new Error("Usage: node scripts/render-animation-repair.mjs --project <project.json>");

const context = await readManifest(resolve(manifestPath));
const config = toRuntimeConfig(context);
const media = JSON.parse(await readFile(resolve(config.editDir, "media-manifest.json"), "utf8"));
const reviewProps = JSON.parse(await readFile(resolve(config.reviewPropsFile), "utf8"));
const directionReport = JSON.parse(await readFile(resolve(config.visualDirectionReportFile), "utf8"));
const animationCues = reviewProps.animationCues ?? [];
const blockedCueIds = directionReport.animationRenderer?.blockedCueIds ?? [];

if (!animationCues.length) throw new Error("Animation repair requires reviewed animation cues");
if (directionReport.animationRenderer?.status !== "candidate-blocked")
  throw new Error("Animation repair is only for explicitly accepted candidate-blocked project animations");
if (animationCues.some((cue) => !blockedCueIds.includes(cue.id)))
  throw new Error("Animation repair cue set does not match the current visual-direction report");

const publicRoot = resolve("public");
const baseVideo = resolve(config.publicDeliveryFile);
const publicVideoSrc = relative(publicRoot, baseVideo);
if (!publicVideoSrc || publicVideoSrc === ".." || publicVideoSrc.startsWith(`..${sep}`))
  throw new Error("Animation repair base video must be inside the public directory");
await stat(baseVideo);

const output = resolve(config.editDir, "delivery-source-resolution-with-animations.mp4");
const temporaryOutput = `${output}.${process.pid}.tmp.mp4`;
const temporaryProps = resolve(config.editDir, `.animation-repair-props.${process.pid}.json`);
const reportPath = resolve(config.editDir, "animation-repair-report.json");
const props = {
  ...reviewProps,
  videoSrc: publicVideoSrc.split(sep).join("/"),
  outputFps: media.fps,
};
const scale = media.width / config.reviewWidth;
if (!(Number.isFinite(scale) && scale > 0)) throw new Error("Animation repair scale is invalid");
if (values.includes("--dry-run")) {
  console.log(
    JSON.stringify({
      event: "animation-repair.planned",
      projectId: context.manifest.project.id,
      animationCueIds: animationCues.map((cue) => cue.id),
      input: baseVideo,
      output,
      width: media.width,
      height: media.height,
      fps: media.fps,
      scale,
      concurrency: 4,
    }),
  );
  process.exit(0);
}

const run = (command, args) =>
  new Promise((done, reject) => {
    const child = spawn(command, args, { cwd: process.cwd(), stdio: ["ignore", "inherit", "inherit"] });
    child.on("error", reject);
    child.on("close", (code, signal) => {
      if (code === 0) done();
      else reject(new Error(`Animation repair render exited with ${code ?? signal}`));
    });
  });

const hashFile = async (path) => {
  const hash = createHash("sha256");
  const { createReadStream } = await import("node:fs");
  await new Promise((done, reject) => {
    const stream = createReadStream(path);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", done);
  });
  return hash.digest("hex");
};

await mkdir(dirname(output), { recursive: true });
await writeFile(temporaryProps, `${JSON.stringify(props, null, 2)}\n`);
await rm(temporaryOutput, { force: true });
try {
  console.log(
    JSON.stringify({
      event: "animation-repair.started",
      projectId: context.manifest.project.id,
      animationCues: animationCues.length,
      output,
    }),
  );
  await run("npx", [
    "remotion",
    "render",
    "src/index.ts",
    "GeneratedWorkflowReview",
    temporaryOutput,
    `--props=${temporaryProps}`,
    `--scale=${scale}`,
    "--codec=h264",
    `--crf=${config.delivery?.crf ?? 18}`,
    "--concurrency=4",
  ]);
  await rename(temporaryOutput, output);
  console.log(JSON.stringify({ event: "animation-repair.validating", projectId: context.manifest.project.id }));
  execFileSync("ffmpeg", ["-v", "error", "-i", output, "-map", "0:v:0", "-map", "0:a:0", "-f", "null", "-"], {
    stdio: "inherit",
  });
  const probe = JSON.parse(
    execFileSync(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration,size",
        "-show_entries",
        "stream=codec_type,codec_name,width,height,r_frame_rate,nb_frames,sample_rate,channels",
        "-of",
        "json",
        output,
      ],
      { encoding: "utf8" },
    ),
  );
  const info = await stat(output);
  const report = {
    schemaVersion: "1.0",
    kind: "animation-repair-report",
    generatedAt: new Date().toISOString(),
    projectId: context.manifest.project.id,
    reviewBypass: true,
    animationCueIds: animationCues.map((cue) => cue.id),
    input: { path: baseVideo },
    output: { path: output, bytes: info.size, sha256: await hashFile(output) },
    media: probe,
    decode: { status: "passed" },
  };
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ event: "animation-repair.completed", projectId: context.manifest.project.id, report }));
} finally {
  await rm(temporaryProps, { force: true });
  await rm(temporaryOutput, { force: true });
}
