import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { OperationalError } from "./operations/errors.mjs";
import { resolveAuthoredScenes } from "../src/supplemental-media/alignment.ts";
import {
  resolveLockedSectionAnimationTimeline,
  resolveLockedTextAnnotationTimeline,
  resolveLockedVisualBeatTimeline,
} from "../src/visual-production/timeline.ts";

const config = JSON.parse(await readFile(resolve(process.argv[2]), "utf8"));
const captions = JSON.parse(await readFile(resolve(config.semanticCaptionSourceFile), "utf8"));
const report = { schemaVersion: "1.0", kind: "visual-input-preflight", status: "passed", checks: [] };
const optionalJson = async (path, fallback) => {
  if (!path) return fallback;
  try {
    return JSON.parse(await readFile(resolve(path), "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
};

const scenePlan = await optionalJson(config.authoredScenePlanFile, { schemaVersion: "1.0", scenes: [] });
const supplemental = await optionalJson(config.supplementalMediaManifestFile, { schemaVersion: "1.0", assets: [] });
const sceneTimeline = resolveAuthoredScenes({ plan: scenePlan, captions, assets: supplemental.assets ?? [] });
if (sceneTimeline.status === "blocked") {
  const required = sceneTimeline.unresolved.filter((item) => item.required);
  const durationUnsafe = required.some((item) => /playback rate|safety limit/i.test(item.reason));
  throw new OperationalError(
    durationUnsafe ? "INPUT_SCENE_DURATION_UNSAFE" : "BINDING_ANCHOR_NOT_FOUND",
    `Recording scene preflight failed: ${required.map((item) => `${item.sceneId}: ${item.reason}`).join("; ")}`,
    { details: { unresolved: required } },
  );
}
report.checks.push({ id: "recording-scenes", status: "passed", resolved: sceneTimeline.scenes.length });

const visualPlan = await optionalJson(config.authoredVisualPlanFile, {
  schemaVersion: "1.0",
  sections: [],
  beats: [],
  annotations: [],
});
try {
  const beats = resolveLockedVisualBeatTimeline({ plan: visualPlan, captions });
  const animations = resolveLockedSectionAnimationTimeline({ plan: visualPlan, captions });
  const annotations = resolveLockedTextAnnotationTimeline({ plan: visualPlan, captions });
  report.checks.push({
    id: "visual-anchors",
    status: "passed",
    beats: beats.length,
    animations: animations.length,
    annotations: annotations.length,
  });
} catch (error) {
  throw new OperationalError("BINDING_ANCHOR_NOT_FOUND", error.message, { cause: error });
}

const output = resolve(config.editDir, "visual-input-preflight.json");
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(`${output}: visual inputs passed deterministic preflight`);
