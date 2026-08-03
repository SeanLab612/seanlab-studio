import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { PIP_BOTTOM_SAFE_OFFSET } from "../src/supplemental-media/types.ts";
import { validateArtifactSchema } from "./operations/artifact-schema.mjs";

const execFileAsync = promisify(execFile);
const configPath = resolve(process.argv[2] ?? "config/workflow-test.json");
const config = JSON.parse(await readFile(configPath, "utf8"));
const qaDir = resolve(config.visualQa?.outputDir ?? `${config.editDir}/visual-qa`);
const planningPath = resolve(config.planningFile ?? "planning/visual-brief.json");
const framesManifestPath = resolve(qaDir, "frames-manifest.json");
const contractsPath = resolve(qaDir, "qa-contracts.json");
const metricsPath = resolve(qaDir, "image-metrics.json");
const contactSheetPath = resolve(qaDir, "contact-sheet.png");
const reportPath = resolve(config.visualQa?.reportFile ?? `${qaDir}/qa-report.json`);
const baselinePath = resolve(
  config.visualQa?.baselineFile ?? `visual-baselines/16x9/${config.projectId ?? "workflow-test"}.json`,
);
const reviewOutput = resolve(config.reviewOutputFile ?? `${config.editDir}/review-1080p.mp4`);
const plan = JSON.parse(await readFile(planningPath, "utf8"));
const reviewProps = JSON.parse(
  await readFile(resolve(config.reviewPropsFile ?? `${config.editDir}/review-props.json`), "utf8"),
);
const overlayScale = Number(reviewProps.overlayScale ?? 1);
const contracts = JSON.parse(await readFile(contractsPath, "utf8"));
const framesManifest = JSON.parse(await readFile(framesManifestPath, "utf8"));
await execFileAsync("python3", [
  "scripts/visual_qa_images.py",
  framesManifestPath,
  contractsPath,
  metricsPath,
  contactSheetPath,
]);
const metrics = JSON.parse(await readFile(metricsPath, "utf8"));
const packageManifest = JSON.parse(await readFile(resolve("package.json"), "utf8"));
let ffmpegVersion = "unavailable";
try {
  const { stdout } = await execFileAsync("ffmpeg", ["-version"]);
  ffmpegVersion = stdout.split("\n")[0].trim();
} catch {}
const dependencies = {
  node: process.version,
  remotion: packageManifest.dependencies?.remotion ?? "unknown",
  ffmpeg: ffmpegVersion,
  opencv: metrics.dependencies?.opencv ?? "unknown",
};
const componentContracts = new Map(contracts.components.map((item) => [item.componentId, item]));
const layoutContracts = new Map(contracts.layouts.map((item) => [item.layoutId, item]));
const metricByKey = new Map(metrics.frames.map((item) => [`${item.cueId}:${item.phase}`, item]));
const findings = [];
let findingIndex = 0;
const addFinding = (finding) => findings.push({ id: `QA-${String(++findingIndex).padStart(4, "0")}`, ...finding });
const overlap = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
const insideCanvas = (rect) =>
  rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= 1920 && rect.y + rect.height <= 1080;
const hamming = (left, right) => {
  const value = BigInt(`0x${left}`) ^ BigInt(`0x${right}`);
  return value.toString(2).replaceAll("0", "").length;
};

let baseline = null;
try {
  baseline = JSON.parse(await readFile(baselinePath, "utf8"));
} catch {}
const baselineEntries = new Map((baseline?.entries ?? []).map((item) => [`${item.cueId}:${item.componentId}`, item]));
const policy = {
  minimumFontPx: Number(config.visualQa?.minimumFontPx ?? 12),
  baselineHammingThreshold: Number(config.visualQa?.baselineHammingThreshold ?? 10),
  maximumCropLoss: Number(config.visualQa?.maximumCropLoss ?? 0.45),
};

const probeMedia = async (src) => {
  const path = resolve("public", src);
  try {
    await access(path);
    const { stdout } = await execFileAsync("ffprobe", [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height",
      "-of",
      "json",
      path,
    ]);
    const stream = JSON.parse(stdout).streams?.[0];
    return stream ? { path, width: stream.width, height: stream.height } : { path, missing: true };
  } catch {
    return { path, missing: true };
  }
};

for (const [cueIndex, cue] of plan.overlayCues.entries()) {
  const cueId = cue.generatedVisual.segment?.id ?? `cue-${String(cueIndex + 1).padStart(2, "0")}`;
  const componentId = cue.generatedVisual.component.id;
  const layoutId = cue.layoutTemplateId ?? plan.layout.layoutTemplateId;
  const cueScale = Number(cue.contentScale ?? overlayScale);
  const component = componentContracts.get(componentId);
  const layout = layoutContracts.get(layoutId);
  if (!component || !layout) {
    addFinding({
      severity: "error",
      rule: "contract.missing",
      message: "Missing component or layout QA contract.",
      cueId,
      componentId,
      layoutId,
    });
    continue;
  }
  const offsetX = (layout.contentBounds[0]?.x ?? 68) - 68;
  const content = {
    x: offsetX + component.contentBounds.x * cueScale,
    y: component.contentBounds.y * cueScale,
    width: component.contentBounds.width * cueScale,
    height: component.contentBounds.height * cueScale,
  };
  const stableMetric = metricByKey.get(`${cueId}:stable`);
  const baseFinding = {
    cueId,
    componentId,
    layoutId,
    phase: "stable",
    frame: stableMetric?.frame,
    timeSeconds: stableMetric?.timeSeconds,
    screenshot: stableMetric?.file,
  };
  if (!insideCanvas(content))
    addFinding({
      ...baseFinding,
      severity: "error",
      rule: "canvas.overflow",
      message: `Content bounds exceed 1920x1080: ${JSON.stringify(content)}`,
    });
  if (overlap(content, layout.faceBounds))
    addFinding({
      ...baseFinding,
      severity: "error",
      rule: "collision.face",
      message: "Component contract overlaps the protected face zone.",
    });
  if (overlap(content, layout.subtitleBounds))
    addFinding({
      ...baseFinding,
      severity: "error",
      rule: "collision.subtitle",
      message: "Component contract overlaps the bilingual subtitle zone.",
    });
  if (overlap(content, layout.titleBounds))
    addFinding({
      ...baseFinding,
      severity: "error",
      rule: "collision.title",
      message: "Component contract overlaps the title zone.",
    });
  if (component.minimumFontPx < policy.minimumFontPx)
    addFinding({
      ...baseFinding,
      severity: "warning",
      rule: "font.minimum",
      message: `Component allows ${component.minimumFontPx}px text; policy minimum is ${policy.minimumFontPx}px.`,
    });

  const props = cue.generatedVisual.props ?? {};
  const mediaSources = [
    props.imageSrc,
    props.portraitSrc,
    ...(Array.isArray(props.items) ? props.items.map((item) => item?.imageSrc) : []),
  ].filter((value) => typeof value === "string" && value.length > 0);
  if (component.mediaPolicy.startsWith("required-") && mediaSources.length === 0)
    addFinding({
      ...baseFinding,
      severity: "error",
      rule: "media.required",
      message: "This component requires one locally materialized media source.",
    });
  for (const source of mediaSources) {
    const media = await probeMedia(source);
    if (media.missing) {
      addFinding({
        ...baseFinding,
        severity: "error",
        rule: "media.missing",
        message: `Referenced media is missing: ${source}`,
      });
      continue;
    }
    const targetAspect = componentId === "quote-source-card" ? 250 / 260 : 340 / 210;
    const sourceAspect = media.width / media.height;
    const cropLoss = 1 - Math.min(sourceAspect / targetAspect, targetAspect / sourceAspect);
    if (component.mediaPolicy.endsWith("cover") && cropLoss > policy.maximumCropLoss)
      addFinding({
        ...baseFinding,
        severity: "warning",
        rule: "media.crop",
        message: `Cover crop may discard ${(cropLoss * 100).toFixed(1)}% of one dimension for ${source}.`,
      });
  }

  for (const phase of ["entry", "transition", "stable", "exit-risk"]) {
    const metric = metricByKey.get(`${cueId}:${phase}`);
    if (!metric || metric.missing) {
      addFinding({
        ...baseFinding,
        severity: "error",
        rule: "frame.missing",
        message: `QA frame is missing for ${phase}.`,
        phase,
      });
      continue;
    }
    if (componentId === "image-evidence-inset" && phase === "stable" && metric.laplacianVariance < 18)
      addFinding({
        ...baseFinding,
        severity: "warning",
        rule: "media.sharpness",
        message: "The stable image-evidence frame appears soft; inspect source resolution and scaling.",
        phase,
      });
    if (metric.width !== 1920 || metric.height !== 1080)
      addFinding({
        ...baseFinding,
        severity: "error",
        rule: "frame.dimensions",
        message: `Expected 1920x1080, received ${metric.width}x${metric.height}.`,
        phase,
        frame: metric.frame,
        timeSeconds: metric.timeSeconds,
        screenshot: metric.file,
      });
    if (phase === "exit-risk" && component.expectedEndState === "visible" && metric.edgeDensity < 0.002)
      addFinding({
        ...baseFinding,
        severity: "error",
        rule: "end-state.empty",
        message: "Exit-risk frame appears to leave an empty component region.",
        phase,
        frame: metric.frame,
        timeSeconds: metric.timeSeconds,
        screenshot: metric.file,
      });
  }

  const stable = metricByKey.get(`${cueId}:stable`);
  const approved = baselineEntries.get(`${cueId}:${componentId}`);
  if (stable && approved) {
    const distance = hamming(stable.dhash, approved.dhash);
    if (distance > policy.baselineHammingThreshold)
      addFinding({
        ...baseFinding,
        severity: "warning",
        rule: "baseline.changed",
        message: `Perceptual hash differs from approved baseline by ${distance} bits.`,
        phase: "stable",
        frame: stable.frame,
        timeSeconds: stable.timeSeconds,
        screenshot: stable.file,
      });
  }
}

for (const scene of plan.screenScenes ?? []) {
  const timelineDuration = Number(reviewProps.subtitleCues?.at(-1)?.end ?? Number.POSITIVE_INFINITY);
  const phases = [
    "screen-entry",
    "screen-transition",
    "screen-stable",
    "screen-exit-risk",
    ...(scene.end + 0.12 < timelineDuration ? ["speaker-return"] : []),
  ];
  const size = scene.speakerPip.size ?? (scene.speakerPip.shape === "circle" ? 340 : 380);
  const pip = {
    x: scene.speakerPip.preferredPosition.endsWith("left") ? 56 : 1920 - 56 - size,
    y: scene.speakerPip.preferredPosition.startsWith("top")
      ? 52
      : 1080 - PIP_BOTTOM_SAFE_OFFSET - (scene.speakerPip.shape === "circle" ? size : Math.round(size * 0.78)),
    width: size,
    height: scene.speakerPip.shape === "circle" ? size : Math.round(size * 0.78),
  };
  if (!insideCanvas(pip))
    addFinding({ severity: "error", rule: "pip.canvas", message: "Speaker PIP exceeds the canvas.", cueId: scene.id });
  const subtitleSafe = { x: 300, y: 820, width: 1320, height: 230 };
  if (overlap(pip, subtitleSafe))
    addFinding({
      severity: "error",
      rule: "pip.subtitle",
      message: "Speaker PIP overlaps the subtitle safe area.",
      cueId: scene.id,
    });
  for (const phase of phases) {
    const metric = metricByKey.get(`${scene.id}:${phase}`);
    if (!metric || metric.missing) {
      addFinding({
        severity: "error",
        rule: "screen.frame.missing",
        message: `Recording-scene QA frame is missing for ${phase}.`,
        cueId: scene.id,
        phase,
      });
      continue;
    }
    if (metric.width !== 1920 || metric.height !== 1080)
      addFinding({
        severity: "error",
        rule: "screen.frame.dimensions",
        message: `Expected 1920x1080, received ${metric.width}x${metric.height}.`,
        cueId: scene.id,
        phase,
        screenshot: metric.file,
      });
    if (phase === "screen-stable" && metric.edgeDensity < 0.002)
      addFinding({
        severity: "error",
        rule: "screen.frame.black",
        message: "Stable recording frame appears empty or black.",
        cueId: scene.id,
        phase,
        screenshot: metric.file,
      });
  }
}

for (const cue of plan.imageCues ?? []) {
  for (const phase of ["image-entry", "image-transition", "image-stable", "image-exit-risk"]) {
    const metric = metricByKey.get(`${cue.id}:${phase}`);
    if (!metric || metric.missing)
      addFinding({
        severity: "error",
        rule: "image.frame.missing",
        message: `Authored image QA frame is missing for ${phase}.`,
        cueId: cue.id,
        phase,
      });
    else if (metric.width !== 1920 || metric.height !== 1080)
      addFinding({
        severity: "error",
        rule: "image.frame.dimensions",
        message: `Expected 1920x1080, received ${metric.width}x${metric.height}.`,
        cueId: cue.id,
        phase,
        screenshot: metric.file,
      });
    else if (phase === "image-stable" && metric.edgeDensity < 0.002)
      addFinding({
        severity: "error",
        rule: "image.frame.black",
        message: "Stable authored image frame appears empty or black.",
        cueId: cue.id,
        phase,
        screenshot: metric.file,
      });
  }
}

for (const cue of plan.animationCues ?? []) {
  for (const phase of ["animation-entry", "animation-build", "animation-stable", "animation-exit-risk"]) {
    const metric = metricByKey.get(`${cue.id}:${phase}`);
    if (!metric || metric.missing)
      addFinding({
        severity: "error",
        rule: "animation.frame.missing",
        message: `Animation QA frame is missing for ${phase}.`,
        cueId: cue.id,
        phase,
      });
    else if (metric.width !== 1920 || metric.height !== 1080)
      addFinding({
        severity: "error",
        rule: "animation.frame.dimensions",
        message: `Expected 1920x1080, received ${metric.width}x${metric.height}.`,
        cueId: cue.id,
        phase,
        screenshot: metric.file,
      });
    else if (phase === "animation-stable" && metric.edgeDensity < 0.002)
      addFinding({
        severity: "error",
        rule: "animation.frame.black",
        message: "Stable animation frame appears empty or black.",
        cueId: cue.id,
        phase,
        screenshot: metric.file,
      });
  }
}

for (const cue of plan.annotationCues ?? []) {
  for (const phase of ["annotation-entry", "annotation-stable", "annotation-exit-risk"]) {
    const metric = metricByKey.get(`${cue.id}:${phase}`);
    if (!metric || metric.missing)
      addFinding({
        severity: "error",
        rule: "annotation.frame.missing",
        message: `Text annotation QA frame is missing for ${phase}.`,
        cueId: cue.id,
        phase,
      });
    else if (metric.width !== 1920 || metric.height !== 1080)
      addFinding({
        severity: "error",
        rule: "annotation.frame.dimensions",
        message: `Expected 1920x1080, received ${metric.width}x${metric.height}.`,
        cueId: cue.id,
        phase,
        screenshot: metric.file,
      });
    else if (phase === "annotation-stable" && metric.edgeDensity < 0.002)
      addFinding({
        severity: "error",
        rule: "annotation.frame.black",
        message: "Stable text annotation frame appears empty or black.",
        cueId: cue.id,
        phase,
        screenshot: metric.file,
      });
  }
}

for (const cue of plan.titleCues ?? []) {
  if (
    (plan.screenScenes ?? []).some((scene) =>
      overlap(
        { x: cue.start, y: 0, width: cue.end - cue.start, height: 1 },
        { x: scene.start, y: 0, width: scene.end - scene.start, height: 1 },
      ),
    )
  )
    addFinding({
      severity: "error",
      rule: "title.screen-overlap",
      message: "Title continuity overlaps authored screen evidence.",
      cueId: cue.id,
    });
  if ((plan.overlayCues ?? []).some((overlay) => cue.start < overlay.end && cue.end > overlay.start))
    addFinding({
      severity: "error",
      rule: "title.component-overlap",
      message: "Title continuity overlaps a semantic component.",
      cueId: cue.id,
    });
  if (
    [...(plan.imageCues ?? []), ...(plan.animationCues ?? [])].some(
      (item) => cue.start < item.end && cue.end > item.start,
    )
  )
    addFinding({
      severity: "error",
      rule: "title.primary-visual-overlap",
      message: "Title continuity overlaps an authored image or animation scene.",
      cueId: cue.id,
    });
  for (const phase of ["title-entry", "title-stable", "title-exit"]) {
    const metric = metricByKey.get(`${cue.id}:${phase}`);
    if (!metric || metric.missing)
      addFinding({
        severity: "error",
        rule: "title.frame.missing",
        message: `Title QA frame is missing for ${phase}.`,
        cueId: cue.id,
        phase,
      });
    else if (metric.width !== 1920 || metric.height !== 1080)
      addFinding({
        severity: "error",
        rule: "title.frame.dimensions",
        message: `Expected 1920x1080, received ${metric.width}x${metric.height}.`,
        cueId: cue.id,
        phase,
        screenshot: metric.file,
      });
  }
}

let renderMetrics = null;
if (config.reviewMode === "full-video") {
  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "stream=codec_name,width,height,r_frame_rate:format=duration,size",
      "-of",
      "json",
      reviewOutput,
    ]);
    renderMetrics = JSON.parse(stdout);
  } catch {}
}

const summary = {
  cues: plan.overlayCues.length,
  semanticCues: plan.overlayCues.length,
  authoredScreenScenes: plan.screenScenes?.length ?? 0,
  authoredImageScenes: plan.imageCues?.length ?? 0,
  animationScenes: plan.animationCues?.length ?? 0,
  textAnnotationCues: plan.annotationCues?.length ?? 0,
  titleContinuityCues: plan.titleCues?.length ?? 0,
  visualGroups:
    plan.overlayCues.length +
    (plan.screenScenes?.length ?? 0) +
    (plan.imageCues?.length ?? 0) +
    (plan.animationCues?.length ?? 0) +
    (plan.annotationCues?.length ?? 0) +
    (plan.titleCues?.length ?? 0),
  frames: framesManifest.frames.length,
  speakerOnlyFrames: framesManifest.frames.filter((frame) => frame.phase === "speaker-only").length,
  errors: findings.filter((item) => item.severity === "error").length,
  warnings: findings.filter((item) => item.severity === "warning").length,
  infos: findings.filter((item) => item.severity === "info").length,
};
const report = {
  schemaVersion: "1.0",
  projectId: config.projectId ?? "workflow-test",
  reviewMode: config.reviewMode ?? "full-video",
  generatedAt: new Date().toISOString(),
  canvas: { width: 1920, height: 1080 },
  status: summary.errors ? "failed" : summary.warnings ? "warning" : "passed",
  summary,
  policy,
  renderContext: { overlayScale },
  dependencies,
  baseline: { path: baselinePath, status: baseline ? "compared" : "missing" },
  regressionProfile: config.regression
    ? {
        profileId: config.regression.profileId,
        enabled: config.regression.enabled,
        fixtureId: config.regression.fixtureId,
      }
    : undefined,
  artifacts: {
    framePlan: resolve(qaDir, "frame-plan.json"),
    framesManifest: framesManifestPath,
    imageMetrics: metricsPath,
    contactSheet: contactSheetPath,
    titleContinuityContactSheet: resolve(qaDir, "title-continuity-contact-sheet.png"),
    reviewVideo: config.reviewMode === "full-video" ? reviewOutput : undefined,
  },
  renderMetrics,
  findings,
};
const reportSha256 = createHash("sha256").update(JSON.stringify(report)).digest("hex");
report.reportSha256 = reportSha256;
await validateArtifactSchema({
  schemaPath: "schemas/visual-qa-report.schema.json",
  artifact: report,
  label: "Visual QA report",
});
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`${reportPath}: ${report.status}, ${summary.errors} errors, ${summary.warnings} warnings`);
if (summary.errors && config.visualQa?.failOnError !== false) process.exitCode = 2;
