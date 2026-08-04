import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { approvedComponentRegistry } from "../../src/components/library/registry.ts";
import {
  narrationStoryboardSection,
  narrationStoryboardSections,
} from "../../src/creator-workflow/storyboard-sections.ts";
import { NARRATION_VISUAL_FORM_IDS, NARRATION_VISUAL_FORMS } from "../../src/creator-workflow/visual-authoring.ts";
import { planVisualBeats } from "../../src/creator-workflow/visual-beat-planner.ts";
import {
  validateAnimationIntent,
  validateTextAnnotations,
  validateVisualBeats,
} from "../../src/visual-production/contract.ts";
import { loadCreatorProject, projectDir, resolveCreatorAsset, writeJsonAtomic } from "./project-store.mjs";
import { planAnimationAssets } from "./animation-asset-planner.mjs";

const execFileAsync = promisify(execFile);

const modes = new Set(["auto", "speaker", "speaker-only", "material", "information", "animation"]);
const statuses = new Set(["suggested", "confirmed"]);
const materialDisplays = new Set(["full", "crop", "annotate"]);
const executionPolicies = new Set(["reference", "locked"]);
const materialKinds = new Set(["screenshot", "screen-recording"]);
const forms = new Set(NARRATION_VISUAL_FORM_IDS);
const componentIds = new Set(Object.keys(approvedComponentRegistry));
const compatibleComponents = new Map(NARRATION_VISUAL_FORMS.map((form) => [form.id, new Set(form.componentCoverage)]));

export const visualStoryboardFile = (projectId) => resolve(projectDir(projectId), "authoring/visual-storyboard.json");

export const emptyVisualStoryboard = () => ({ schemaVersion: "3.0", sections: {} });

export const suggestedVisualStoryboard = (narration, previous = emptyVisualStoryboard(), materials = []) => ({
  schemaVersion: "3.0",
  sections: Object.fromEntries(
    narrationStoryboardSections(narration).map((section) => [
      section.id,
      (() => {
        const prior = previous.sections?.[section.id];
        const beats =
          prior?.beats?.length && prior.status === "confirmed" ? prior.beats : planVisualBeats(section, materials);
        return {
          ...(prior ?? { mode: "auto", status: "suggested" }),
          status: prior?.status ?? "suggested",
          beats,
        };
      })(),
    ]),
  ),
});

const migrateLegacyBeats = (review, spokenText) => {
  if (!Array.isArray(review.beats)) return { review, annotations: review.annotations };
  const legacy = validateVisualBeats(review.beats, spokenText ?? "");
  const animation = legacy.find((beat) => beat.primaryVisualType === "animation" && beat.animationIntent);
  const annotations = legacy
    .filter((beat) => beat.primaryVisualType === "component" && beat.semanticForm === "text-emphasis")
    .map((beat) => ({
      id: beat.id,
      exactSpokenQuote: beat.exactSpokenQuote,
      ...(beat.quoteOccurrence ? { quoteOccurrence: beat.quoteOccurrence } : {}),
      status: beat.status,
      origin: "agent",
      executionPolicy: "reference",
      effect: "circle",
    }));
  return {
    review: {
      ...review,
      ...(animation ? { mode: "animation", animationIntent: animation.animationIntent } : {}),
    },
    annotations,
  };
};

export const validateVisualStoryboard = (input, narration) => {
  if (!["1.0", "2.0", "3.0"].includes(input?.schemaVersion) || !input.sections || Array.isArray(input.sections))
    throw new Error("Visual storyboard must use a supported schemaVersion and a sections object");
  const sectionIds = new Set(narration ? narrationStoryboardSections(narration).map((section) => section.id) : []);
  const sections = {};
  for (const [sectionId, rawReview] of Object.entries(input.sections)) {
    if (sectionIds.size && !sectionIds.has(sectionId)) continue;
    const spokenText = narration ? narrationStoryboardSection(narration, sectionId)?.narration : undefined;
    const migrated = input.schemaVersion === "1.0" ? migrateLegacyBeats(rawReview, spokenText) : { review: rawReview };
    const review = migrated.review;
    if (!review) throw new Error(`Missing storyboard review for ${sectionId}`);
    if (!statuses.has(review.status)) throw new Error(`Unsupported storyboard status for ${sectionId}`);
    if (!modes.has(review.mode)) throw new Error(`Unsupported storyboard mode for ${sectionId}`);
    if (review.executionPolicy !== undefined && !executionPolicies.has(review.executionPolicy))
      throw new Error(`Unsupported storyboard execution policy for ${sectionId}`);
    if (review.form && !forms.has(review.form)) throw new Error(`Unsupported storyboard form for ${sectionId}`);
    if (review.componentId && !componentIds.has(review.componentId))
      throw new Error(`Unsupported storyboard component for ${sectionId}`);
    if (review.componentId && (!review.form || !compatibleComponents.get(review.form)?.has(review.componentId)))
      throw new Error(
        `Storyboard component ${review.componentId} is incompatible with ${review.form ?? "missing form"}`,
      );
    if (review.materialDisplay && !materialDisplays.has(review.materialDisplay))
      throw new Error(`Unsupported material display for ${sectionId}`);
    if (review.materialKind && !materialKinds.has(review.materialKind))
      throw new Error(`Unsupported material kind for ${sectionId}`);
    const animationIntent = review.animationIntent
      ? validateAnimationIntent(review.animationIntent, spokenText ?? "")
      : undefined;
    if (review.mode === "animation" && !animationIntent)
      throw new Error(`Animation storyboard section ${sectionId} requires animation intent`);
    if (review.mode !== "animation" && animationIntent)
      throw new Error(`Non-animation storyboard section ${sectionId} cannot contain animation intent`);
    const rawAnnotations = review.annotations ?? migrated.annotations;
    const classifiedAnnotations = rawAnnotations?.map((annotation) => ({
      ...annotation,
      // Older annotations in the editor were created by a person selecting
      // narration text. Preserve that intent while classifying Agent migration.
      origin: annotation.origin ?? "user",
      executionPolicy: annotation.executionPolicy ?? (annotation.origin === "agent" ? "reference" : "locked"),
    }));
    const annotations =
      classifiedAnnotations === undefined
        ? undefined
        : validateTextAnnotations(classifiedAnnotations, spokenText ?? "");
    const beats = review.beats === undefined ? undefined : validateVisualBeats(review.beats, spokenText ?? "");
    sections[sectionId] = {
      mode: review.mode,
      status: review.status,
      executionPolicy: review.executionPolicy ?? "reference",
      ...(review.form ? { form: review.form } : {}),
      ...(review.componentId ? { componentId: review.componentId } : {}),
      ...(review.materialId ? { materialId: review.materialId } : {}),
      ...(review.materialKind ? { materialKind: review.materialKind } : {}),
      ...(review.materialDisplay ? { materialDisplay: review.materialDisplay } : {}),
      ...(animationIntent ? { animationIntent } : {}),
      ...(beats?.length ? { beats } : {}),
      ...(annotations?.length ? { annotations } : {}),
    };
  }
  for (const section of narration ? narrationStoryboardSections(narration) : []) {
    if (!section.narration?.trim() || sections[section.id]) continue;
    sections[section.id] = {
      mode: "auto",
      status: "suggested",
      beats: planVisualBeats(section, []),
    };
  }
  return { schemaVersion: "3.0", sections };
};

export const loadVisualStoryboard = async (projectId, narration) => {
  try {
    return validateVisualStoryboard(JSON.parse(await readFile(visualStoryboardFile(projectId), "utf8")), narration);
  } catch (error) {
    if (error?.code === "ENOENT") return emptyVisualStoryboard();
    throw error;
  }
};

export const saveVisualStoryboard = async (projectId, input, narration) => {
  const value = validateVisualStoryboard(input, narration);
  await writeJsonAtomic(visualStoryboardFile(projectId), value);
  return value;
};

export const seedVisualStoryboard = async (projectId, narration) => {
  const project = await loadCreatorProject(projectId);
  const materials = await Promise.all(
    project.materials.map(async (material) => {
      if (material.kind !== "screen-recording" || !material.assetId) return material;
      try {
        const assetPath = await resolveCreatorAsset(projectId, material.assetId);
        const { stdout } = await execFileAsync(
          "ffprobe",
          ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", assetPath],
          { timeout: 10_000 },
        );
        const durationSeconds = Number(stdout.trim());
        return Number.isFinite(durationSeconds) ? { ...material, durationSeconds } : material;
      } catch {
        return material;
      }
    }),
  );
  const suggested = validateVisualStoryboard(
    suggestedVisualStoryboard(narration, emptyVisualStoryboard(), materials),
    narration,
  );
  const value = validateVisualStoryboard(await planAnimationAssets({ project, storyboard: suggested }), narration);
  await writeJsonAtomic(visualStoryboardFile(projectId), value);
  return value;
};
