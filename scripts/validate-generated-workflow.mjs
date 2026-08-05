import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { layoutTemplateRegistry } from "../src/layout-templates/registry.ts";
import { approvedMotionRecipeRegistry } from "../src/motion-recipes/registry.ts";
import {
  assertRequiredImageEvidenceCoverage,
  validateMaterializedBriefContent,
} from "../src/semantic-planning/index.ts";
import { APPROVED_COMPONENT_IDS } from "../src/visual-brief/types.ts";
import { assertVisualDirectionQuality, validateVisualDirectionPlan } from "../src/visual-direction/index.ts";
import { correctTerminology, mapKeptWords, stripDisplayPunctuation } from "../src/workflow/captions.ts";
import { conformEnglishTermsToLockedScript } from "../src/workflow/transcript-conformance.ts";

const config = JSON.parse(await readFile(resolve(process.argv[2] ?? "config/workflow-test.json"), "utf8"));
const readImageEvidenceAssets = async () => {
  if (!config.imageEvidenceManifestFile) return [];
  try {
    return JSON.parse(await readFile(resolve(config.imageEvidenceManifestFile), "utf8")).assets ?? [];
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
};
const transcript = JSON.parse(await readFile(resolve(config.transcript), "utf8"));
let lockedScript;
if (config.referenceScript) {
  try {
    lockedScript = await readFile(resolve(config.referenceScript), "utf8");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}
const captionTranscript = conformEnglishTermsToLockedScript(transcript.words, lockedScript);
const edl = JSON.parse(await readFile(resolve(config.editDir, "edl.json"), "utf8"));
const captions = JSON.parse(await readFile(resolve(config.editDir, "captions-verbatim.json"), "utf8"));
let semanticCaptions;
try {
  semanticCaptions = JSON.parse(
    await readFile(resolve(config.semanticCaptionsFile ?? `${config.editDir}/captions-semantic.json`), "utf8"),
  );
} catch (error) {
  const isLegacySingleChannel =
    error?.code === "ENOENT" &&
    !config.semanticCaptionsFile &&
    !config.semanticPlanning &&
    (config.captionDisplayPunctuation ?? "source") === "source";
  if (!isLegacySingleChannel) throw error;
  semanticCaptions = captions;
}
const plan = JSON.parse(await readFile(resolve(config.planningFile ?? "planning/visual-brief.json"), "utf8"));
const manifest = JSON.parse(await readFile(resolve(config.editDir, "media-manifest.json"), "utf8"));
const brandTimeline = config.brandEnabled
  ? JSON.parse(await readFile(resolve(config.brandTimelineFile), "utf8"))
  : { totalInsertedSeconds: 0 };
const presentationDurationS = edl.totalDurationS + Number(brandTimeline.totalInsertedSeconds ?? 0);
const terminologyProfile = config.terminologyProfileFile
  ? JSON.parse(await readFile(resolve(config.terminologyProfileFile), "utf8"))
  : undefined;
const captionDisplayPunctuation = config.captionDisplayPunctuation ?? "source";
const imageEvidenceAssets = await readImageEvidenceAssets();

assert.ok(manifest.width > 0 && manifest.height > 0);
assert.ok(manifest.fps > 0);
assert.ok(edl.totalDurationS <= manifest.durationSeconds);
assert.ok(edl.ranges.every((range, index) => index === 0 || range.outputStart >= edl.ranges[index - 1].outputEnd));
assert.ok(captions.every((cue) => cue.role === "caption" && cue.zh && cue.en));
assert.ok(semanticCaptions.every((cue) => cue.role === "caption" && cue.zh && cue.en));
assert.deepEqual(
  captions.map(({ start, end }) => ({ start, end })),
  semanticCaptions.map(({ start, end }) => ({ start, end })),
  "Semantic and display caption channels must preserve identical cue timing.",
);
const expectedSource = correctTerminology(
  mapKeptWords(captionTranscript.words, edl.ranges)
    .map((word) => word.text)
    .join(""),
  terminologyProfile,
);
const actual = correctTerminology(captions.map((cue) => cue.zh).join(""), terminologyProfile);
const semanticActual = correctTerminology(semanticCaptions.map((cue) => cue.zh).join(""), terminologyProfile);
assert.equal(semanticActual, expectedSource, "Semantic captions must preserve source punctuation for understanding.");
const expected = captionDisplayPunctuation === "source" ? expectedSource : stripDisplayPunctuation(expectedSource);
assert.equal(actual, expected, "Captions must contain every kept spoken word exactly once.");
if (captionDisplayPunctuation !== "source") {
  assert.ok(
    captions.every((cue) => cue.zh === stripDisplayPunctuation(cue.zh) && cue.en === stripDisplayPunctuation(cue.en)),
    "Displayed bilingual captions must omit sentence punctuation.",
  );
}
assert.ok(plan.overlayCues.every((cue) => APPROVED_COMPONENT_IDS.includes(cue.generatedVisual.component.id)));
assert.ok(plan.overlayCues.every((cue) => cue.end > cue.start && cue.end <= presentationDurationS));
const requiredImageEvidence = assertRequiredImageEvidenceCoverage(
  imageEvidenceAssets,
  plan.overlayCues,
  plan.imageCues ?? [],
  plan.animationCues ?? [],
);
const screenScenes = plan.screenScenes ?? [];
assert.ok(screenScenes.every((scene) => scene.end > scene.start && scene.end <= presentationDurationS));
assert.ok(
  screenScenes.every((scene) => scene.playbackRate >= 0.8 && scene.playbackRate <= 1),
  "Authored recording playback rate must stay inside the approved 0.8-1.0 range.",
);
assert.ok(
  screenScenes.every((scene, index) => index === 0 || scene.start >= screenScenes[index - 1].end),
  "Authored screen scenes must be ordered and non-overlapping.",
);
assert.ok(
  plan.overlayCues.every((cue) => screenScenes.every((scene) => cue.end <= scene.start || cue.start >= scene.end)),
  "Semantic components must not overlap authored recording scenes.",
);
if (config.resolvedSceneTimelineFile) {
  const resolved = JSON.parse(await readFile(resolve(config.resolvedSceneTimelineFile), "utf8"));
  assert.notEqual(resolved.status, "blocked", "Required authored scenes must resolve before validation.");
  assert.equal(screenScenes.length, resolved.scenes.length, "Render props must include every resolved authored scene.");
}
for (const title of plan.titleCues ?? []) {
  assert.ok(
    !screenScenes.some((scene) => title.start < scene.end && title.end > scene.start),
    "Whole-video title continuity must not overlap authored screen evidence.",
  );
}
if (config.semanticPlanning?.provider === "mimo") {
  assert.ok(
    plan.overlayCues.every(
      (cue) =>
        cue.generatedVisual.textRoles?.segmentText === "caption" &&
        cue.generatedVisual.textRoles?.narrative === "display-copy" &&
        cue.generatedVisual.textRoles?.labels === "design-label",
    ),
    "Generated briefs must preserve explicit text roles.",
  );
}
if (["codex-cli", "claude-code"].includes(config.semanticPlanning?.provider)) {
  const productionAgentVisualCount =
    plan.overlayCues.length + (plan.animationCues?.length ?? 0) + (plan.imageCues?.length ?? 0) + screenScenes.length;
  assert.ok(
    productionAgentVisualCount > 0,
    "Production Agent planning must produce at least one qualified component, animation, image, or recording cue.",
  );
  for (const cue of plan.overlayCues) {
    validateMaterializedBriefContent(cue.generatedVisual);
    assert.ok(cue.contentScale >= 0.82 && cue.contentScale <= 1, "Every Codex cue must persist a safe content scale.");
  }
  const directionPlan = JSON.parse(await readFile(resolve(config.visualDirectionPlanFile), "utf8"));
  validateVisualDirectionPlan(directionPlan);
  assertVisualDirectionQuality({
    plan: directionPlan,
    screenScenes,
    captions: semanticCaptions,
    primaryVisualIntervals: [...(plan.animationCues ?? []), ...(plan.imageCues ?? [])],
    // The production contract measures total temporal coverage across all visual types.
    // Component-candidate materialization is no longer a separate blocking quota.
    minimumMaterializationRatio: 0,
  });
  assert.equal(
    directionPlan.decisions.filter((decision) => decision.action === "show").length,
    plan.overlayCues.length,
    "Directed show decisions must match final overlay cues.",
  );
}
assert.ok(
  plan.overlayCues.every(
    (cue) => cue.layoutTemplateId && layoutTemplateRegistry.some((template) => template.id === cue.layoutTemplateId),
  ),
  "Every visual cue must select a registered layout template.",
);
assert.ok(
  plan.overlayCues.every(
    (cue) =>
      cue.generatedVisual.motion &&
      approvedMotionRecipeRegistry.some((recipe) => recipe.id === cue.generatedVisual.motion.recipeId),
  ),
  "Every production cue must resolve to an approved motion recipe.",
);
if (plan.layout?.layoutTemplateId) {
  assert.ok(
    layoutTemplateRegistry.some((template) => template.id === plan.layout.layoutTemplateId),
    `Unknown layout template: ${plan.layout.layoutTemplateId}`,
  );
}
const report = {
  valid: true,
  checkedAt: new Date().toISOString(),
  ranges: edl.ranges.length,
  captions: captions.length,
  briefs: plan.overlayCues.length,
  authoredScreenScenes: screenScenes.length,
  requiredImageEvidence,
  terminologyEntries: terminologyProfile?.entries.length ?? 0,
  displayPunctuation: captionDisplayPunctuation,
  visualDirection: ["codex-cli", "claude-code"].includes(config.semanticPlanning?.provider)
    ? { plan: config.visualDirectionPlanFile, report: config.visualDirectionReportFile }
    : undefined,
};
if (config.validationReportFile)
  await import("node:fs/promises").then(({ writeFile }) =>
    writeFile(resolve(config.validationReportFile), `${JSON.stringify(report, null, 2)}\n`),
  );
console.log(
  `e2e workflow valid: ${report.ranges} ranges, ${report.captions} verbatim bilingual captions, ${report.briefs} briefs`,
);
