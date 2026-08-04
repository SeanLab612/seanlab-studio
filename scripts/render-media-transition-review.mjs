import { spawn } from "node:child_process";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const config = JSON.parse(await readFile(resolve(process.argv[2]), "utf8"));
const props = JSON.parse(await readFile(resolve(config.reviewPropsFile), "utf8"));
const media = JSON.parse(await readFile(resolve(config.editDir, "media-manifest.json"), "utf8"));
const fps = Number(media.fps ?? 30);

const imageCues = (props.overlayCues ?? [])
  .filter((cue) => cue.generatedVisual?.component?.id === "image-evidence-inset")
  .map((cue) => ({
    id: cue.generatedVisual?.props?.assetId ?? cue.generatedVisual?.segment?.id,
    type: "image",
    start: cue.start,
    end: cue.end,
  }));
const screenCues = (props.screenScenes ?? []).map((scene) => ({
  id: scene.id,
  type: "screen-recording",
  start: scene.start,
  end: scene.end,
}));
const target = [...imageCues, ...screenCues]
  .filter((cue) => Number.isFinite(cue.start) && Number.isFinite(cue.end) && cue.end > cue.start)
  .sort((left, right) => left.start - right.start)[0];
if (!target) {
  await rm(resolve(config.mediaTransitionEntryPreviewFile), { force: true });
  await rm(resolve(config.mediaTransitionExitPreviewFile), { force: true });
  await mkdir(dirname(resolve(config.mediaTransitionReviewFile)), { recursive: true });
  await writeFile(
    resolve(config.mediaTransitionReviewFile),
    `${JSON.stringify(
      {
        schemaVersion: "1.0",
        kind: "media-transition-review",
        status: "not-applicable",
        reason: "No registered screenshot or authored recording was selected for the current visual plan",
        findings: [],
      },
      null,
      2,
    )}\n`,
  );
  console.log(`${config.mediaTransitionReviewFile}: not-applicable`);
  process.exit(0);
}

const run = (command, args, captureOutput = false) =>
  new Promise((done, reject) => {
    const child = spawn(command, args, {
      stdio: captureOutput ? ["ignore", "pipe", "pipe"] : ["ignore", "inherit", "inherit"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => (stdout += chunk));
    child.stderr?.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) done({ stdout, stderr });
      else reject(new Error(`${command} exited with ${code ?? signal}: ${(stderr || stdout).slice(-2000)}`));
    });
  });

const renderExcerpt = async (output, centerSeconds) => {
  const startFrame = Math.max(0, Math.floor((centerSeconds - 0.7) * fps));
  const endFrame = Math.max(startFrame + 1, Math.ceil((centerSeconds + 0.9) * fps));
  const absolute = resolve(output);
  const candidate = `${absolute}.candidate.mp4`;
  await mkdir(dirname(absolute), { recursive: true });
  await rm(candidate, { force: true });
  await run("npx", [
    "remotion",
    "render",
    "src/index.ts",
    "GeneratedWorkflowReview",
    candidate,
    `--props=${resolve(config.reviewPropsFile)}`,
    `--frames=${startFrame}-${endFrame}`,
    "--codec=h264",
    "--crf=18",
  ]);
  await rename(candidate, absolute);
  const volume = await run("ffmpeg", ["-hide_banner", "-i", absolute, "-af", "volumedetect", "-f", "null", "-"], true);
  return {
    file: output,
    startFrame,
    endFrame,
    meanVolumeDb: Number(volume.stderr.match(/mean_volume:\s*(-?[\d.]+) dB/)?.[1]),
    peakDbfs: Number(volume.stderr.match(/max_volume:\s*(-?[\d.]+) dB/)?.[1]),
  };
};

const entry = await renderExcerpt(config.mediaTransitionEntryPreviewFile, target.start);
const exit = await renderExcerpt(config.mediaTransitionExitPreviewFile, target.end);
const soundEvents = (props.soundEvents ?? []).filter(
  (event) => Math.abs(event.at - target.start) <= 0.75 || Math.abs(event.at - target.end) <= 0.75,
);
const findings = [entry, exit].flatMap((clip) =>
  Number.isFinite(clip.peakDbfs) && clip.peakDbfs > -1
    ? [{ severity: "warning", code: "limited-headroom", message: `${clip.file} peak is ${clip.peakDbfs} dBFS` }]
    : [],
);
const report = {
  schemaVersion: "1.0",
  kind: "media-transition-review",
  status: findings.some((item) => item.severity === "error") ? "failed" : "passed",
  target,
  entry,
  exit,
  soundEvents,
  findings,
};
await mkdir(dirname(resolve(config.mediaTransitionReviewFile)), { recursive: true });
await writeFile(resolve(config.mediaTransitionReviewFile), `${JSON.stringify(report, null, 2)}\n`);
console.log(`${config.mediaTransitionReviewFile}: ${report.status}, ${target.type} ${target.id}`);
