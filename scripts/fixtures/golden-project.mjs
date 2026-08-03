import { execFileSync } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateGoldenProject } from "../../src/regression-fixtures/golden-project.ts";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};
const manifestPath = resolve(rootDir, option("--manifest", "regression-fixtures/golden/img2threejs/manifest.json"));
const outputDir = resolve(rootDir, option("--output", "out/golden-project/img2threejs"));
const skipRender = args.includes("--skip-render");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

const base = validateGoldenProject(manifest, { rootDir });
if (base.status !== "passed") throw new Error(`Golden project contract failed: ${JSON.stringify(base.findings)}`);

const injected = [
  {
    id: "missing-source",
    ruleId: "golden.source-missing",
    mutate: (candidate) => {
      candidate.sources[0].path = "public/fixtures/golden-img2threejs/missing.mp4";
    },
  },
  {
    id: "stale-plan",
    ruleId: "golden.plan-stale",
    mutate: (candidate) => {
      candidate.visualPlan[0].end = 2.2;
    },
  },
  {
    id: "unsupported-animation-style",
    ruleId: "golden.animation-style-unsupported",
    mutate: (candidate) => {
      candidate.visualPlan.find((beat) => beat.type === "animation").animationStyleId = "unknown-style";
    },
  },
  {
    id: "rejected-terminology",
    ruleId: "golden.terminology-rejected",
    mutate: (candidate) => {
      candidate.terminology.sampleCaptionText += " Mixure";
    },
  },
].map(({ id, ruleId, mutate }) => {
  const candidate = structuredClone(manifest);
  mutate(candidate);
  const result = validateGoldenProject(candidate, { rootDir });
  const detected = result.findings.some((finding) => finding.ruleId === ruleId);
  if (!detected) throw new Error(`Fault injection ${id} did not trigger ${ruleId}`);
  return { id, expectedRuleId: ruleId, detected };
});

const artifacts = {};
let media = { status: skipRender ? "skipped" : "pending" };

if (!skipRender) {
  await mkdir(resolve(outputDir, "frames"), { recursive: true });
  await mkdir(resolve(outputDir, "mobile-viewport"), { recursive: true });
  const reviewPath = resolve(outputDir, "golden-img2threejs-review-720p.mp4");
  execFileSync(
    "npx",
    [
      "remotion",
      "render",
      "src/index.ts",
      manifest.composition.id,
      reviewPath,
      "--scale=0.6666666666666666",
      "--codec=h264",
      "--crf=24",
    ],
    { cwd: rootDir, stdio: "inherit" },
  );

  const probe = JSON.parse(
    execFileSync("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", reviewPath], {
      encoding: "utf8",
    }),
  );
  const video = probe.streams.find((stream) => stream.codec_type === "video");
  const audio = probe.streams.find((stream) => stream.codec_type === "audio");
  const [rateNumerator, rateDenominator] = String(video?.avg_frame_rate ?? "0/1")
    .split("/")
    .map(Number);
  const fps = rateDenominator ? rateNumerator / rateDenominator : 0;
  const duration = Number(probe.format?.duration ?? video?.duration);
  const mediaFindings = [];
  if (video?.width !== manifest.composition.width || video?.height !== manifest.composition.height)
    mediaFindings.push(`Expected ${manifest.composition.width}x${manifest.composition.height}`);
  if (Math.abs(fps - manifest.composition.fps) > 0.01)
    mediaFindings.push(`Expected ${manifest.composition.fps}fps, received ${fps}`);
  if (video?.codec_name !== "h264") mediaFindings.push(`Expected h264 video, received ${video?.codec_name}`);
  if (audio?.codec_name !== "aac") mediaFindings.push(`Expected aac audio, received ${audio?.codec_name}`);
  if (Math.abs(duration - manifest.composition.durationSeconds) > 0.1)
    mediaFindings.push(`Expected ${manifest.composition.durationSeconds}s, received ${duration}s`);

  execFileSync("ffmpeg", ["-v", "error", "-i", reviewPath, "-f", "null", "-"], { stdio: "inherit" });
  execFileSync("ffmpeg", ["-v", "error", "-sseof", "-1", "-i", reviewPath, "-t", "1", "-f", "null", "-"], {
    stdio: "inherit",
  });

  const frameTimes = [
    ["component", 1.2],
    ["image", 3.6],
    ["screen-demo", 6],
    ["animation", 8.4],
    ["speaker", 10.8],
  ];
  const frames = [];
  const mobileViewportFrames = [];
  for (const [name, seconds] of frameTimes) {
    const framePath = resolve(outputDir, "frames", `${name}.png`);
    execFileSync(
      "ffmpeg",
      ["-v", "error", "-ss", String(seconds), "-i", reviewPath, "-frames:v", "1", "-y", framePath],
      { stdio: "inherit" },
    );
    if ((await stat(framePath)).size === 0) throw new Error(`Empty review frame: ${framePath}`);
    frames.push(framePath);
    const mobileViewportPath = resolve(outputDir, "mobile-viewport", `${name}.png`);
    execFileSync(
      "ffmpeg",
      [
        "-v",
        "error",
        "-i",
        framePath,
        "-vf",
        "scale=590:332,pad=590:1280:0:333:color=0x17191d",
        "-frames:v",
        "1",
        "-y",
        mobileViewportPath,
      ],
      { stdio: "inherit" },
    );
    if ((await stat(mobileViewportPath)).size === 0)
      throw new Error(`Empty mobile viewport review frame: ${mobileViewportPath}`);
    mobileViewportFrames.push(mobileViewportPath);
  }

  media = {
    status: mediaFindings.length === 0 ? "passed" : "failed",
    findings: mediaFindings,
    probe: {
      width: video?.width,
      height: video?.height,
      fps,
      duration,
      videoCodec: video?.codec_name,
      audioCodec: audio?.codec_name,
    },
  };
  artifacts.reviewVideo = reviewPath;
  artifacts.frames = frames;
  artifacts.mobileViewportFrames = mobileViewportFrames;
  if (media.status !== "passed") throw new Error(`Golden review media failed: ${mediaFindings.join("; ")}`);
}

const report = {
  schemaVersion: "1.0",
  fixtureId: manifest.fixtureId,
  status: base.status === "passed" && media.status !== "failed" ? "passed" : "failed",
  contract: base,
  faultInjections: injected,
  media,
  artifacts,
};
await mkdir(outputDir, { recursive: true });
const reportPath = resolve(outputDir, "acceptance-report.json");
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ event: "golden-project.acceptance", status: report.status, reportPath, artifacts }));
