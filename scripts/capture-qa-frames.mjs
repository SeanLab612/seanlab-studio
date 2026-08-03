import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { componentQaContracts, layoutQaContracts, textAnnotationQaComponentId } from "../src/visual-qa/contracts.ts";
import { createQaFramePlan } from "../src/visual-qa/frame-plan.ts";
import { createQaFrameCacheWriter, parseQaFrameCache, qaFrameCacheKey } from "./workflow/qa-frame-cache.mjs";
import { hashFile } from "./workflow/state.mjs";

const execFileAsync = promisify(execFile);
const configPath = resolve(process.argv[2] ?? "config/workflow-test.json");
const planOnly = process.argv.includes("--plan-only");
const config = JSON.parse(await readFile(configPath, "utf8"));
const planningPath = resolve(config.planningFile ?? "planning/visual-brief.json");
const propsPath = resolve(config.reviewPropsFile ?? `${config.editDir}/review-props.json`);
const plan = JSON.parse(await readFile(planningPath, "utf8"));
const reviewProps = JSON.parse(await readFile(propsPath, "utf8"));
const timelineDuration = Number(reviewProps.subtitleCues?.at(-1)?.end ?? Number.POSITIVE_INFINITY);
let detectedFps;
try {
  const mediaManifest = JSON.parse(await readFile(resolve(config.editDir, "media-manifest.json"), "utf8"));
  detectedFps = Number(mediaManifest.fps);
} catch {
  detectedFps = undefined;
}
const fps = Number(config.reviewFps ?? detectedFps ?? 30);
if (!Number.isFinite(fps) || fps <= 0) throw new Error(`Invalid QA capture fps: ${fps}`);
const qaDir = resolve(config.visualQa?.outputDir ?? `${config.editDir}/visual-qa`);
const framesDir = resolve(qaDir, "frames");
const framePlanPath = resolve(qaDir, "frame-plan.json");
const framesManifestPath = resolve(qaDir, "frames-manifest.json");
const contractsPath = resolve(qaDir, "qa-contracts.json");
const captureSignaturePath = resolve(qaDir, "capture-input.sha256");
const frameCachePath = resolve(qaDir, "frame-cache.json");
await mkdir(framesDir, { recursive: true });

let plannedFrames = createQaFramePlan(plan.overlayCues, fps).map((frame) => ({
  ...frame,
  visualCategory: "semantic-component",
}));
for (const [sceneIndex, scene] of (plan.screenScenes ?? []).entries()) {
  const duration = scene.end - scene.start;
  const times = {
    "screen-entry": scene.start + Math.min(0.04, duration * 0.02),
    "screen-transition": scene.start + Math.min(0.24, duration * 0.12),
    "screen-stable": scene.start + duration * 0.55,
    "screen-exit-risk": scene.end - Math.min(0.12, duration * 0.03),
    ...(scene.end + 0.12 < timelineDuration ? { "speaker-return": scene.end + 0.12 } : {}),
  };
  for (const [phase, timeSeconds] of Object.entries(times))
    plannedFrames.push({
      cueIndex: plan.overlayCues.length + sceneIndex,
      cueId: scene.id,
      componentId: "authored-screen-scene",
      layoutId: plan.layout.layoutTemplateId,
      phase,
      timeSeconds,
      frame: Math.max(0, Math.round(timeSeconds * fps)),
      assetId: scene.assetId,
      pipShape: scene.speakerPip.shape,
      pipPosition: scene.speakerPip.preferredPosition,
      visualCategory: "authored-screen",
    });
}
const screenOffset = plan.overlayCues.length + (plan.screenScenes?.length ?? 0);
for (const [imageIndex, cue] of (plan.imageCues ?? []).entries()) {
  const duration = cue.end - cue.start;
  for (const [phase, timeSeconds] of Object.entries({
    "image-entry": cue.start + Math.min(0.06, duration * 0.03),
    "image-transition": cue.start + Math.min(0.28, duration * 0.14),
    "image-stable": cue.start + duration * 0.55,
    "image-exit-risk": cue.end - Math.min(0.12, duration * 0.04),
  }))
    plannedFrames.push({
      cueIndex: screenOffset + imageIndex,
      cueId: cue.id,
      componentId: "authored-image-scene",
      layoutId: plan.layout.layoutTemplateId,
      phase,
      timeSeconds,
      frame: Math.max(0, Math.round(timeSeconds * fps)),
      assetId: cue.assetId,
      pipShape: cue.speakerPresence === "circle-pip" ? "circle" : undefined,
      pipPosition: cue.speakerPresence === "circle-pip" ? "top-right" : undefined,
      visualCategory: "authored-image",
    });
}
const imageOffset = screenOffset + (plan.imageCues?.length ?? 0);
for (const [animationIndex, cue] of (plan.animationCues ?? []).entries()) {
  const duration = cue.end - cue.start;
  for (const [phase, timeSeconds] of Object.entries({
    "animation-entry": cue.start + Math.min(0.08, duration * 0.03),
    "animation-build": cue.start + duration * 0.38,
    "animation-stable": cue.start + duration * 0.72,
    "animation-exit-risk": cue.end - Math.min(0.14, duration * 0.04),
  }))
    plannedFrames.push({
      cueIndex: imageOffset + animationIndex,
      cueId: cue.id,
      componentId: `animation-${cue.animationIntent.prototypeId}`,
      layoutId: plan.layout.layoutTemplateId,
      phase,
      timeSeconds,
      frame: Math.max(0, Math.round(timeSeconds * fps)),
      pipShape: "circle",
      pipPosition: "top-right",
      visualCategory: "animation",
    });
}
const animationOffset = imageOffset + (plan.animationCues?.length ?? 0);
for (const [annotationIndex, cue] of (plan.annotationCues ?? []).entries()) {
  const duration = cue.end - cue.start;
  for (const [phase, timeSeconds] of Object.entries({
    "annotation-entry": cue.start + Math.min(0.06, duration * 0.08),
    "annotation-stable": cue.start + duration * 0.58,
    "annotation-exit-risk": cue.end - Math.min(0.08, duration * 0.08),
  }))
    plannedFrames.push({
      cueIndex: animationOffset + annotationIndex,
      cueId: cue.id,
      componentId: textAnnotationQaComponentId,
      layoutId: plan.layout.layoutTemplateId,
      phase,
      timeSeconds,
      frame: Math.max(0, Math.round(timeSeconds * fps)),
      visualCategory: "text-annotation",
    });
}
const annotationOffset = animationOffset + (plan.annotationCues?.length ?? 0);
for (const [titleIndex, cue] of (plan.titleCues ?? []).entries()) {
  const duration = cue.end - cue.start;
  for (const [phase, timeSeconds] of Object.entries({
    "title-entry": cue.start + Math.min(0.08, duration * 0.03),
    "title-stable": cue.start + duration * 0.5,
    "title-exit": cue.end - Math.min(0.12, duration * 0.04),
  }))
    plannedFrames.push({
      cueIndex: annotationOffset + titleIndex,
      cueId: cue.id,
      componentId: "whole-video-title",
      layoutId: plan.layout.layoutTemplateId,
      phase,
      timeSeconds,
      frame: Math.max(0, Math.round(timeSeconds * fps)),
      visualCategory: "title-continuity",
    });
}
try {
  const direction = JSON.parse(await readFile(resolve(config.visualDirectionPlanFile), "utf8"));
  const speakerOnlyFrames = direction.decisions
    .filter((decision) => decision.action === "skip")
    .map((decision) => {
      const timeSeconds = (decision.sourceStart + decision.sourceEnd) / 2;
      return {
        cueIndex: plan.overlayCues.length,
        cueId: decision.candidateId,
        componentId: "speaker-only",
        layoutId: plan.layout.layoutTemplateId,
        phase: "speaker-only",
        timeSeconds,
        frame: Math.max(0, Math.round(timeSeconds * fps)),
        skipReason: decision.reasons.at(-1),
        visualCategory: "speaker-only",
      };
    })
    .filter(
      (frame) =>
        !(plan.screenScenes ?? []).some((scene) => frame.timeSeconds >= scene.start && frame.timeSeconds < scene.end),
    )
    .filter(
      (frame) => !(plan.titleCues ?? []).some((cue) => frame.timeSeconds >= cue.start && frame.timeSeconds < cue.end),
    )
    .filter(
      (frame) => !(plan.imageCues ?? []).some((cue) => frame.timeSeconds >= cue.start && frame.timeSeconds < cue.end),
    )
    .filter(
      (frame) =>
        !(plan.animationCues ?? []).some((cue) => frame.timeSeconds >= cue.start && frame.timeSeconds < cue.end),
    )
    .filter(
      (frame) =>
        !(plan.annotationCues ?? []).some((cue) => frame.timeSeconds >= cue.start && frame.timeSeconds < cue.end),
    )
    .map((frame, index) => ({
      ...frame,
      cueIndex: annotationOffset + (plan.titleCues?.length ?? 0) + index,
    }));
  plannedFrames = [...plannedFrames, ...speakerOnlyFrames];
} catch {}
const frames = plannedFrames.map((item) => {
  const layoutId = item.layoutId ?? plan.layout.layoutTemplateId;
  const file = resolve(
    framesDir,
    `${String(item.cueIndex + 1).padStart(2, "0")}-${item.componentId}-${item.phase}-${item.frame}.png`,
  );
  return { ...item, layoutId, file };
});

const sourceFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const path = resolve(directory, entry.name);
      return entry.isDirectory() ? sourceFiles(path) : [path];
    }),
  );
  return files.flat().filter((file) => /\.(?:css|json|ts|tsx)$/.test(file));
};
const rendererHash = createHash("sha256");
for (const file of (await sourceFiles(resolve("src"))).sort()) {
  rendererHash.update(file);
  rendererHash.update(await readFile(file));
}
const rendererSha256 = rendererHash.digest("hex");
const baseVideoSha256 = await hashFile(resolve(config.publicReviewFile));
const frameCache = await readFile(frameCachePath, "utf8")
  .then((value) => parseQaFrameCache(JSON.parse(value)))
  .catch(() => parseQaFrameCache(undefined));
const frameCacheWriter = createQaFrameCacheWriter(frameCachePath);
const frameCacheKeys = new Map(
  frames.map((frame) => [frame.file, qaFrameCacheKey({ frame, plan, reviewProps, rendererSha256, baseVideoSha256 })]),
);
const captureHash = createHash("sha256");
captureHash.update(rendererSha256);
captureHash.update(baseVideoSha256);
for (const key of frameCacheKeys.values()) captureHash.update(key);
const captureSignature = captureHash.digest("hex");
await writeFile(captureSignaturePath, `${captureSignature}\n`);

await writeFile(
  framePlanPath,
  `${JSON.stringify(
    {
      schemaVersion: "1.0",
      reviewMode: config.reviewMode ?? "full-video",
      captureSignature,
      canvas: { width: 1920, height: 1080, fps },
      summary: {
        semanticComponents: plan.overlayCues.length,
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
        riskFrames: frames.length,
        speakerOnlyFrames: frames.filter((frame) => frame.phase === "speaker-only").length,
      },
      frames,
    },
    null,
    2,
  )}\n`,
);
await writeFile(
  contractsPath,
  `${JSON.stringify({ schemaVersion: "1.0", components: componentQaContracts, layouts: layoutQaContracts }, null, 2)}\n`,
);

if (!planOnly) {
  let cursor = 0;
  const concurrency = Math.max(1, Math.min(4, Number(config.visualQa?.captureConcurrency ?? 3)));
  const hasCompleteFrame = async (file) => {
    try {
      return (await stat(file)).size > 1024;
    } catch {
      return false;
    }
  };
  const reusableFrame = async (item) => {
    const entry = frameCache.entries[item.file];
    if (!entry || entry.inputSignature !== frameCacheKeys.get(item.file) || !(await hasCompleteFrame(item.file)))
      return false;
    return (await hashFile(item.file)) === entry.outputSha256;
  };
  const renderFrame = async (item) => {
    if (await reusableFrame(item)) return "cached";
    let lastError;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        await rm(item.file, { force: true });
        await execFileAsync(
          "npx",
          [
            "remotion",
            "still",
            "src/index.ts",
            "GeneratedWorkflowReview",
            item.file,
            "--frame",
            String(item.frame),
            "--props",
            propsPath,
          ],
          { maxBuffer: 30 * 1024 * 1024, timeout: 90_000 },
        );
        if (!(await hasCompleteFrame(item.file))) throw new Error(`Remotion returned without writing ${item.file}`);
        frameCache.entries[item.file] = {
          inputSignature: frameCacheKeys.get(item.file),
          outputSha256: await hashFile(item.file),
          updatedAt: new Date().toISOString(),
        };
        await frameCacheWriter.save(frameCache);
        return attempt === 1 ? "rendered" : "retried";
      } catch (error) {
        lastError = error;
        await rm(item.file, { force: true });
      }
    }
    throw lastError;
  };
  const worker = async () => {
    while (cursor < frames.length) {
      const index = cursor++;
      const item = frames[index];
      const result = await renderFrame(item);
      console.log(`${index + 1}/${frames.length} ${item.cueId} ${item.phase} ${result}`);
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  await frameCacheWriter.flush();
}

await mkdir(dirname(framesManifestPath), { recursive: true });
await writeFile(
  framesManifestPath,
  `${JSON.stringify(
    {
      schemaVersion: "1.0",
      planningPath,
      propsPath,
      framePlanPath,
      captureSignature,
      summary: {
        semanticComponents: plan.overlayCues.length,
        authoredScreenScenes: plan.screenScenes?.length ?? 0,
        authoredImageScenes: plan.imageCues?.length ?? 0,
        animationScenes: plan.animationCues?.length ?? 0,
        textAnnotationCues: plan.annotationCues?.length ?? 0,
        titleContinuityCues: plan.titleCues?.length ?? 0,
        speakerOnlyGaps: frames.filter((frame) => frame.visualCategory === "speaker-only").length,
        riskFrames: frames.length,
      },
      frames,
    },
    null,
    2,
  )}\n`,
);
console.log(framesManifestPath);
