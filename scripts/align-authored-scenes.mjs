import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { resolveAuthoredScenes } from "../src/supplemental-media/alignment.ts";

const config = JSON.parse(await readFile(resolve(process.argv[2]), "utf8"));
const captions = JSON.parse(await readFile(resolve(config.semanticCaptionsFile), "utf8"));
const media = JSON.parse(await readFile(resolve(config.supplementalMediaManifestFile), "utf8"));
let layout = {};
try {
  layout = JSON.parse(await readFile(resolve(config.editDir, "layout-manifest.json"), "utf8"));
} catch {}
let plan = { schemaVersion: "1.0", scenes: [] };
if (config.authoredScenePlanFile) plan = JSON.parse(await readFile(resolve(config.authoredScenePlanFile), "utf8"));
if (plan.schemaVersion !== "1.0" || !Array.isArray(plan.scenes))
  throw new Error("authored scene plan must use schemaVersion 1.0");
const faceCenterX = Number(layout.faceCenterX);
const timeline = resolveAuthoredScenes({
  plan,
  captions,
  assets: media.assets,
  speakerFaceCenterX: Number.isFinite(faceCenterX) ? faceCenterX : undefined,
});
if (timeline.status === "blocked") {
  const details = timeline.unresolved
    .filter((item) => item.required)
    .map((item) => `${item.sceneId}: ${item.reason}`)
    .join("; ");
  throw new Error(`Required authored scenes could not be resolved: ${details}`);
}
const output = resolve(config.resolvedSceneTimelineFile);
const report = resolve(config.sceneAlignmentReportFile);
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(timeline, null, 2)}\n`);
await writeFile(
  report,
  [
    "# Authored scene alignment",
    "",
    `- Authored: ${timeline.summary.authored}`,
    `- Resolved: ${timeline.summary.resolved}`,
    `- Required unresolved: ${timeline.summary.requiredUnresolved}`,
    "",
    "| Scene | Asset | Captions | Timeline | Playback | Confidence | PIP |",
    "| --- | --- | ---: | ---: | ---: | ---: | --- |",
    ...timeline.scenes.map(
      (scene) =>
        `| ${scene.id} | ${scene.assetId} | ${scene.startCue}-${scene.endCue} | ${scene.start.toFixed(2)}-${scene.end.toFixed(2)}s | ${scene.playbackRate.toFixed(3)}x | ${scene.confidence.toFixed(2)} | ${scene.speakerPip.shape} / ${scene.speakerPip.preferredPosition} |`,
    ),
    "",
  ].join("\n"),
);
console.log(`${output}: ${timeline.scenes.length} authored scenes resolved`);
