import { writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { animationTemplateIds } from "../../src/animation-system/template-registry.ts";
import {
  composeNarrationScript,
  sha256Text,
  validateNarrationScriptPackage,
} from "../../src/creator-workflow/contract.ts";
import { narrationStoryboardSections } from "../../src/creator-workflow/storyboard-sections.ts";
import { recommendPrimaryVisualType } from "../../src/visual-production/recommendation.ts";
import { validateArtifactSchema } from "../operations/artifact-schema.mjs";
import { createManifest, writeManifest } from "../workflow/manifest.mjs";
import { assertNarrationMaterialCoverage, loadNarration, saveNarrationDraft } from "./narration.mjs";
import {
  loadCreatorProject,
  projectDir,
  resolveCreatorAsset,
  saveCreatorProject,
  validateCreatorAssetKind,
  writeJsonAtomic,
} from "./project-store.mjs";
import { loadVisualStoryboard } from "./visual-storyboard.mjs";
import { getPromotedImageAsset, resolveImageAssetPreview } from "./generated-assets.mjs";
import { loadMaterialUnderstanding } from "./material-understanding.mjs";

const anchorText = (text, fromEnd = false) => {
  const compact = text.replace(/\s+/g, "").trim();
  return fromEnd ? compact.slice(-42) : compact.slice(0, 42);
};

const authoredMediaKinds = new Set(["screenshot", "screen-recording"]);

const resolvedStoryboardMode = (review, section) => {
  if (review.mode !== "auto") return review.mode;
  if (review.animationIntent) return "animation";
  if (review.materialId) return "material";
  if (review.componentId || review.form) return "information";
  const primaryVisualType = recommendPrimaryVisualType(section);
  if (primaryVisualType === "component") return "information";
  if (["image", "screen-demo"].includes(primaryVisualType)) return "material";
  return primaryVisualType;
};

export const bindAuthoredMediaToNarration = (project, narration, { lockedMaterialIds = new Set() } = {}) => {
  let changed = false;
  const requiredMaterialIds = new Set(
    project.materials.filter((item) => item.required && authoredMediaKinds.has(item.kind)).map((item) => item.id),
  );
  for (const materialId of lockedMaterialIds) requiredMaterialIds.add(materialId);
  for (const section of narration.sections) {
    for (const materialId of section.materialIds) {
      const material = project.materials.find((item) => item.id === materialId);
      if (!material?.assetId) throw new Error(`Section ${section.id} references an unavailable material`);
      if (!authoredMediaKinds.has(material.kind))
        throw new Error(`Section ${section.id} references a non-visual material`);
      if (!requiredMaterialIds.has(material.id))
        throw new Error(`Section ${section.id} references an excluded material: ${material.id}`);
    }
  }
  for (const material of project.materials.filter((item) => authoredMediaKinds.has(item.kind))) {
    const boundSections = narration.sections.filter((section) => section.materialIds.includes(material.id));
    if (material.required && boundSections.length !== 1)
      throw new Error(`Required material ${material.id} must bind exactly one narration section`);
    if (material.kind !== "screenshot") continue;
    const nextAnchors = boundSections.map((section) => anchorText(section.narration));
    if (boundSections.some((_section, index) => !nextAnchors[index]))
      throw new Error(`Screenshot section requires spoken narration for its evidence anchor`);
    const nextAnchor = nextAnchors[0];
    if (material.anchorText !== nextAnchor) {
      if (nextAnchor) material.anchorText = nextAnchor;
      else delete material.anchorText;
      changed = true;
    }
    if (JSON.stringify(material.anchorTexts ?? []) !== JSON.stringify(nextAnchors)) {
      if (nextAnchors.length) material.anchorTexts = nextAnchors;
      else delete material.anchorTexts;
      changed = true;
    }
  }
  return changed;
};

export const bindScreenshotEvidenceToNarration = bindAuthoredMediaToNarration;

export const imageEvidenceProtectedAnchor = (material, text = material.anchorText, suffix = "") => ({
  id: `image-${material.assetId}${suffix}`,
  text,
  paddingBeforeSeconds: 0.2,
  paddingAfterSeconds: 0.35,
});

export const updateNarration = async (projectId, input) => {
  input.fullScript = composeNarrationScript(input);
  return saveNarrationDraft(projectId, validateNarrationScriptPackage(input));
};

export const lockNarration = async (projectId, input) => {
  const narration = input ? await updateNarration(projectId, input) : await loadNarration(projectId);
  const project = await loadCreatorProject(projectId);
  assertNarrationMaterialCoverage(narration, project);
  bindAuthoredMediaToNarration(project, narration);
  const scenes = [];
  const authoringDir = resolve(projectDir(projectId), "authoring");
  const finalPath = resolve(authoringDir, "final-script.md");
  const scenePath = resolve(authoringDir, "authored-scene-plan.json");
  const authoredVisualPath = resolve(authoringDir, "authored-visual-plan.json");
  const finalScriptSha256 = sha256Text(narration.fullScript);
  for (const section of narration.sections) {
    const recordings = section.materialIds
      .map((materialId) => project.materials.find((item) => item.id === materialId))
      .filter((material) => material?.required && material.kind === "screen-recording" && material.assetId);
    const sentences = [...section.narration.matchAll(/[^。！？!?]+[。！？!?]?/gu)]
      .map((match) => match[0].trim())
      .filter(Boolean);
    recordings.forEach((material, index) => {
      const spokenQuote = sentences[Math.min(index, Math.max(0, sentences.length - 1))] ?? section.narration;
      const exactAnchor = anchorText(spokenQuote);
      scenes.push({
        id: `scene-${material.id}`,
        type: "screen-evidence",
        assetId: material.assetId,
        startAnchor: { text: exactAnchor },
        endAnchor: { text: exactAnchor },
        required: true,
        executionPolicy: "locked",
        speakerPip: {
          shape: "circle",
          preferredPosition: "bottom-left",
          size: 360,
          objectPosition: "50% 38%",
        },
      });
    });
  }
  await writeFile(finalPath, `# ${narration.title}\n\n${narration.fullScript}\n`);
  await writeJsonAtomic(scenePath, { schemaVersion: "1.0", scenes });
  const authoredVisualPlan = {
    schemaVersion: "1.0",
    visualPlanContractVersion: "4.0",
    finalScriptSha256,
    sections: [],
    beats: [],
    annotations: [],
  };
  await validateArtifactSchema({
    schemaPath: "schemas/authored-visual-plan.schema.json",
    artifact: authoredVisualPlan,
    label: "Authored visual plan",
  });
  await writeJsonAtomic(authoredVisualPath, authoredVisualPlan);
  project.authoring = {
    ...project.authoring,
    state: "locked",
    finalScript: "authoring/final-script.md",
    authoredScenePlan: "authoring/authored-scene-plan.json",
    authoredVisualPlan: "authoring/authored-visual-plan.json",
    lockedAt: new Date().toISOString(),
    finalScriptSha256,
    lockedAttemptId: project.authoring.currentAttemptId,
    lockedAttemptSha256: project.authoring.currentAttemptSha256,
  };
  project.project.status = "awaiting-media";
  await saveCreatorProject(project);
  return { narration, scenes, finalScriptSha256: project.authoring.finalScriptSha256 };
};

export const createVideoHandoff = async (projectId, { speakerAssetId }) => {
  let project = await loadCreatorProject(projectId);
  if (project.authoring.state !== "locked") throw new Error("Lock the final narration before creating a video handoff");
  // The storyboard remains editable after the narration is locked. Rebuild the
  // deterministic authored plans at handoff time so a later confirmed visual
  // change cannot leave the video workflow reading a stale (or empty) plan.
  await lockNarration(projectId);
  project = await loadCreatorProject(projectId);
  const narration = await loadNarration(projectId);
  const storyboard = await loadVisualStoryboard(projectId, narration);
  const materialUnderstanding = await loadMaterialUnderstanding(projectId, project, { verifyContentHash: true });
  const understoodMaterials = new Map((materialUnderstanding.materials ?? []).map((item) => [item.materialId, item]));
  if (bindAuthoredMediaToNarration(project, narration)) await saveCreatorProject(project);
  const storyboardNarrationSections = narrationStoryboardSections(narration);
  const sourceMaterial = project.materials.find(
    (item) => item.assetId === speakerAssetId && item.kind === "speaker-video",
  );
  if (!sourceMaterial) throw new Error("A registered speaker-video asset is required");
  const source = await resolveCreatorAsset(projectId, speakerAssetId);
  validateCreatorAssetKind(source, "speaker-video");
  const videoProjectId = `${projectId}-video`.slice(0, 63);
  const outputPath = resolve(projectDir(projectId), "video", "project.json");
  const manifest = createManifest({
    id: videoProjectId,
    title: project.project.title,
    source,
    outputPath,
    agentId: project.agent.id,
    agentModel: project.agent.model,
    translationProvider: project.agent.id,
  });
  manifest.policies.typography = project.typography ?? { version: "typography-2.0", mode: "system-only" };
  manifest.policies.animation = { mode: "per-cue", allowedTemplateIds: animationTemplateIds };
  manifest.policies.visualDirection.minimumVisualCoverageRatio = 0.8;
  manifest.policies.visualDirection.maximumVisualCoverageRatio = 1;
  manifest.policies.visualDirection.maximumAnimationCoverageRatio = 0.25;
  manifest.paths.referenceScript = relative(
    dirname(outputPath),
    resolve(projectDir(projectId), project.authoring.finalScript),
  );
  const supplemental = [];
  const imageEvidence = [];
  const animationAssetBindings = new Map();
  for (const section of storyboardNarrationSections) {
    const review = storyboard.sections[section.id];
    const intents = [
      ...(review?.animationIntent ? [{ intent: review.animationIntent, executionPolicy: "reference" }] : []),
      ...(review?.beats ?? [])
        .filter((beat) => beat.status === "confirmed" && beat.primaryVisualType === "animation" && beat.animationIntent)
        .map((beat) => ({ intent: beat.animationIntent, executionPolicy: "reference" })),
    ];
    for (const { intent, executionPolicy } of intents)
      for (const stage of intent.stages)
        if (stage.imageAssetId && !animationAssetBindings.has(stage.imageAssetId))
          animationAssetBindings.set(stage.imageAssetId, { stage, executionPolicy });
  }
  for (const [libraryAssetId, { stage, executionPolicy }] of animationAssetBindings) {
    let asset;
    let preview;
    try {
      [asset, preview] = await Promise.all([
        getPromotedImageAsset(libraryAssetId),
        resolveImageAssetPreview({ assetId: libraryAssetId }),
      ]);
    } catch {
      continue;
    }
    imageEvidence.push({
      id: `animation-${sha256Text(libraryAssetId).slice(0, 16)}`,
      path: preview.path,
      role: "other",
      description: asset.description?.trim() || asset.subject || asset.id,
      sourceLabel: `动画素材库 · ${libraryAssetId}`,
      anchorText: stage.spokenQuote,
      required: executionPolicy === "locked",
      fit: "contain",
      focalPoint: { x: 0.5, y: 0.5 },
    });
  }
  for (const material of project.materials.filter((item) => item.assetId && item.kind !== "speaker-video")) {
    const understood = understoodMaterials.get(material.id);
    const productionDescription = [
      understood?.summary,
      understood?.suggestedUse,
      material.productionNote,
      material.description,
      material.label,
    ]
      .map((item) => item?.trim())
      .filter(Boolean)
      .filter((item, index, all) => all.indexOf(item) === index)
      .join("；")
      .slice(0, 1000);
    let resolvedMaterialPath;
    try {
      resolvedMaterialPath = await resolveCreatorAsset(projectId, material.assetId);
    } catch {
      continue;
    }
    if (material.kind === "screenshot") {
      const boundBeats = storyboardNarrationSections.flatMap((section) => {
        const review = storyboard.sections[section.id];
        return (review?.beats ?? [])
          .filter(
            (beat) =>
              beat.status === "confirmed" &&
              beat.primaryVisualType === "image" &&
              [...(beat.materialIds ?? []), ...(beat.materialId ? [beat.materialId] : [])].includes(material.id),
          )
          .map((beat) => ({ section, beat }));
      });
      const boundSections = storyboardNarrationSections
        .filter((section) => {
          const review = storyboard.sections[section.id];
          return (
            section.materialIds.includes(material.id) ||
            (review?.status === "confirmed" &&
              resolvedStoryboardMode(review, section) === "material" &&
              review.materialId === material.id)
          );
        })
        .map((section) => ({ id: section.id, narration: section.narration, materialIds: section.materialIds }));
      const path = relative(dirname(outputPath), resolvedMaterialPath);
      for (const { beat } of boundBeats) {
        const executionPolicy = material.required ? "locked" : "reference";
        const evidenceId = `${material.assetId}-${beat.id}`;
        imageEvidence.push({
          id: evidenceId,
          path,
          role: material.evidenceRole ?? "interface",
          description: productionDescription,
          sourceLabel: material.sourceLabel?.trim() || material.label,
          anchorText: beat.exactSpokenQuote,
          required: material.required,
          fit: material.fit ?? "contain",
          focalPoint: material.focalPoint ?? { x: 0.5, y: 0.5 },
        });
        if (executionPolicy === "locked")
          manifest.policies.edit.protectedAnchors.push(
            imageEvidenceProtectedAnchor(material, beat.exactSpokenQuote, `-${beat.id}`),
          );
      }
      for (const section of boundSections) {
        const repeated = boundSections.length > 1;
        const evidenceId = repeated ? `${material.assetId}-${section.id}` : material.assetId;
        const spokenAnchor = anchorText(section.narration);
        const executionPolicy = material.required ? "locked" : "reference";
        imageEvidence.push({
          id: evidenceId,
          path,
          role: material.evidenceRole ?? "interface",
          description: productionDescription,
          sourceLabel: material.sourceLabel?.trim() || material.label,
          anchorText: spokenAnchor,
          required: material.required,
          fit: material.fit ?? "contain",
          focalPoint: material.focalPoint ?? { x: 0.5, y: 0.5 },
        });
        if (executionPolicy === "locked")
          manifest.policies.edit.protectedAnchors.push(
            imageEvidenceProtectedAnchor(material, spokenAnchor, repeated ? `-${section.id}` : ""),
          );
      }
      if (!boundBeats.length && !boundSections.length) {
        imageEvidence.push({
          id: material.assetId,
          path,
          role: material.evidenceRole ?? "interface",
          description: productionDescription,
          sourceLabel: material.sourceLabel?.trim() || material.label,
          required: material.required,
          fit: material.fit ?? "contain",
          focalPoint: material.focalPoint ?? { x: 0.5, y: 0.5 },
        });
      }
      continue;
    }
    supplemental.push({
      id: material.assetId,
      path: relative(dirname(outputPath), resolvedMaterialPath),
      role: material.kind === "screen-recording" ? "screen-evidence" : "result-showcase",
      orientation: "any",
      required: material.required,
      audioPolicy: "mute",
      description: productionDescription,
      productionTreatment: material.productionTreatment ?? "direct",
    });
  }
  if (imageEvidence.length) manifest.imageEvidence = { version: "1.0", assets: imageEvidence };
  if (supplemental.length) {
    manifest.paths.authoredScenePlan = relative(
      dirname(outputPath),
      resolve(projectDir(projectId), project.authoring.authoredScenePlan),
    );
    manifest.supplementalMedia = { version: "1.0", assets: supplemental };
  }
  manifest.paths.authoredVisualPlan = relative(
    dirname(outputPath),
    resolve(projectDir(projectId), project.authoring.authoredVisualPlan),
  );
  // The open-source edition never injects a creator-specific bumper. Projects may
  // add their own branding in a downstream fork without changing narration truth.
  delete manifest.brand;
  await writeManifest(manifest, outputPath);
  const handoff = {
    schemaVersion: "1.0",
    creatorProjectId: projectId,
    videoProjectId,
    agent: project.agent,
    finalScriptSha256: project.authoring.finalScriptSha256,
    videoManifest: outputPath,
    createdAt: new Date().toISOString(),
  };
  await writeJsonAtomic(resolve(projectDir(projectId), "authoring/handoff.json"), handoff);
  project.authoring.handoff = "authoring/handoff.json";
  project.video = { projectId: videoProjectId, manifest: outputPath, sourceAssetId: speakerAssetId };
  project.project.status = "video-ready";
  await saveCreatorProject(project);
  return handoff;
};
