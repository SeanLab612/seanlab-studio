import { writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { animationTemplateIds } from "../../src/animation-system/template-registry.ts";
import {
  composeNarrationScript,
  sha256Text,
  validateNarrationScriptPackage,
} from "../../src/creator-workflow/contract.ts";
import {
  narrationStoryboardSection,
  narrationStoryboardSections,
} from "../../src/creator-workflow/storyboard-sections.ts";
import {
  resolveTextAnnotationQuoteRange,
  resolveVisualBeatQuoteRange,
  sha256VisualText,
} from "../../src/visual-production/contract.ts";
import { recommendAnimationIntent, recommendPrimaryVisualType } from "../../src/visual-production/recommendation.ts";
import { validateArtifactSchema } from "../operations/artifact-schema.mjs";
import { createManifest, writeManifest } from "../workflow/manifest.mjs";
import { loadNarration, saveNarrationDraft } from "./narration.mjs";
import {
  loadCreatorProject,
  projectDir,
  resolveCreatorAsset,
  saveCreatorProject,
  validateCreatorAssetKind,
  writeJsonAtomic,
} from "./project-store.mjs";
import { loadVisualStoryboard, saveVisualStoryboard } from "./visual-storyboard.mjs";
import { getPromotedImageAsset, resolveImageAssetPreview } from "./generated-assets.mjs";

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
  for (const section of narration.sections) {
    const lockedIds = section.materialIds.filter((materialId) => lockedMaterialIds.has(materialId));
    if (!lockedIds.length) continue;
    if (lockedIds.length !== 1)
      throw new Error(`Locked section ${section.id} must reference exactly one material before locking`);
    const material = project.materials.find((item) => item.id === lockedIds[0]);
    if (!material?.assetId) throw new Error(`Section ${section.id} references an unavailable material`);
    if (!authoredMediaKinds.has(material.kind) || material.kind !== section.visualIntent)
      throw new Error(`Section ${section.id} must bind a ${section.visualIntent} material`);
  }
  for (const material of project.materials.filter((item) => authoredMediaKinds.has(item.kind))) {
    const boundSections = narration.sections.filter(
      (section) => section.visualIntent === material.kind && section.materialIds.includes(material.id),
    );
    const nextRequired = lockedMaterialIds.has(material.id);
    if (material.required !== nextRequired) {
      material.required = nextRequired;
      changed = true;
    }
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
  const storyboard = await loadVisualStoryboard(projectId, narration);
  const storyboardNarrationSections = narrationStoryboardSections(narration);
  for (const sectionId of storyboardNarrationSections.map((section) => section.id)) {
    const review = storyboard.sections[sectionId] ?? { mode: "auto", status: "suggested" };
    storyboard.sections[sectionId] = {
      ...review,
      status: "confirmed",
      ...(review.beats?.length ? { beats: review.beats.map((beat) => ({ ...beat, status: "confirmed" })) } : {}),
      ...(review.annotations?.length
        ? { annotations: review.annotations.map((annotation) => ({ ...annotation, status: "confirmed" })) }
        : {}),
    };
  }
  // Version 4 gives downstream production full freedom over every visual and
  // material. Only explicit user text annotations become execution locks.
  bindAuthoredMediaToNarration(project, narration);
  await saveVisualStoryboard(projectId, storyboard, narration);
  const confirmedAnnotationEntries = Object.entries(storyboard.sections).flatMap(([sectionId, review]) => {
    const spokenText = narrationStoryboardSection(narration, sectionId)?.narration;
    if (!spokenText?.trim()) return [];
    return (review.annotations ?? [])
      .filter((annotation) => annotation.status === "confirmed")
      .map((annotation) => ({ sectionId, spokenText, annotation }));
  });
  const scenes = [];
  const authoringDir = resolve(projectDir(projectId), "authoring");
  const finalPath = resolve(authoringDir, "final-script.md");
  const scenePath = resolve(authoringDir, "authored-scene-plan.json");
  const authoredVisualPath = resolve(authoringDir, "authored-visual-plan.json");
  const authoredVisualSections = Object.entries(storyboard.sections)
    .filter(([, review]) => review.status === "confirmed" && !review.beats?.length)
    .map(([sectionId, review]) => {
      const spokenText = narrationStoryboardSection(narration, sectionId)?.narration;
      if (!spokenText?.trim()) throw new Error(`Confirmed storyboard section ${sectionId} has no spoken anchor`);
      const narrationSection = narrationStoryboardSection(narration, sectionId);
      const mode = resolvedStoryboardMode(review, narrationSection);
      const animationIntent =
        mode === "animation" ? (review.animationIntent ?? recommendAnimationIntent(narrationSection)) : undefined;
      if (mode === "animation" && !animationIntent)
        throw new Error(`Confirmed animation section ${sectionId} has no deterministic animation intent`);
      return {
        sectionId,
        executionPolicy: "reference",
        anchorText: anchorText(spokenText),
        endAnchorText: anchorText(spokenText, true),
        mode,
        ...(review.form ? { form: review.form } : {}),
        ...(review.componentId ? { componentId: review.componentId } : {}),
        ...(review.materialId ? { materialId: review.materialId } : {}),
        ...(review.materialDisplay ? { materialDisplay: review.materialDisplay } : {}),
        ...(animationIntent
          ? {
              animationAnchorText: animationIntent.stages[0].spokenQuote,
              animationEndAnchorText: animationIntent.stages.at(-1).spokenQuote,
              animationIntent,
            }
          : {}),
      };
    });
  const finalScriptSha256 = sha256Text(narration.fullScript);
  const authoredVisualBeats = Object.entries(storyboard.sections).flatMap(([sectionId, review]) => {
    const spokenText = narrationStoryboardSection(narration, sectionId)?.narration;
    if (!spokenText?.trim()) return [];
    return (review.beats ?? [])
      .filter((beat) => beat.status === "confirmed")
      .map((beat) => {
        const executionPolicy = "reference";
        const quoteRange = resolveVisualBeatQuoteRange(beat, spokenText);
        const materialIds = [...new Set([...(beat.materialIds ?? []), ...(beat.materialId ? [beat.materialId] : [])])];
        const boundMaterials = materialIds.flatMap((materialId) => {
          const material = project.materials.find((item) => item.id === materialId);
          if (!material?.assetId) return [];
          if (beat.primaryVisualType === "image" && material.kind !== "screenshot") return [];
          if (beat.primaryVisualType === "screen-demo" && material.kind !== "screen-recording") return [];
          return [material];
        });
        if (beat.primaryVisualType === "screen-demo" && boundMaterials[0]) {
          scenes.push({
            id: `scene-${beat.id}`,
            type: "screen-evidence",
            assetId: boundMaterials[0].assetId,
            startAnchor: {
              text: beat.exactSpokenQuote,
              ...(beat.quoteOccurrence ? { occurrence: beat.quoteOccurrence } : {}),
            },
            endAnchor: {
              text: beat.exactSpokenQuote,
              ...(beat.quoteOccurrence ? { occurrence: beat.quoteOccurrence } : {}),
            },
            required: false,
            executionPolicy: "reference",
            visualBeatId: beat.id,
            speakerPip: {
              shape: "circle",
              preferredPosition: "bottom-left",
              size: 360,
              objectPosition: "50% 38%",
            },
          });
        }
        return {
          ...beat,
          executionPolicy,
          sectionId,
          quoteStart: quoteRange.start,
          quoteEnd: quoteRange.end,
          ...(boundMaterials[0] ? { materialAssetId: boundMaterials[0].assetId } : {}),
          ...(boundMaterials.length ? { materialAssetIds: boundMaterials.map((item) => item.assetId) } : {}),
          exactSpokenQuoteSha256: sha256VisualText(beat.exactSpokenQuote),
          finalScriptSha256,
        };
      });
  });
  const authoredTextAnnotations = confirmedAnnotationEntries.map(({ sectionId, spokenText, annotation }) => {
    const quoteRange = resolveTextAnnotationQuoteRange(annotation, spokenText);
    const origin = annotation.origin ?? "user";
    return {
      ...annotation,
      origin,
      executionPolicy: origin === "user" ? "locked" : "reference",
      sectionId,
      quoteStart: quoteRange.start,
      quoteEnd: quoteRange.end,
      exactSpokenQuoteSha256: sha256VisualText(annotation.exactSpokenQuote),
      finalScriptSha256,
    };
  });
  await writeFile(finalPath, `# ${narration.title}\n\n${narration.fullScript}\n`);
  await writeJsonAtomic(scenePath, { schemaVersion: "1.0", scenes });
  const authoredVisualPlan = {
    schemaVersion: "1.0",
    visualPlanContractVersion: "4.0",
    finalScriptSha256,
    sections: authoredVisualSections,
    beats: authoredVisualBeats,
    annotations: authoredTextAnnotations,
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
        const executionPolicy = "reference";
        const evidenceId = `${material.assetId}-${beat.id}`;
        imageEvidence.push({
          id: evidenceId,
          path,
          role: material.evidenceRole ?? "interface",
          description: material.description?.trim() || material.label,
          sourceLabel: material.sourceLabel?.trim() || material.label,
          anchorText: beat.exactSpokenQuote,
          required: executionPolicy === "locked",
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
        const executionPolicy = "reference";
        imageEvidence.push({
          id: evidenceId,
          path,
          role: material.evidenceRole ?? "interface",
          description: material.description?.trim() || material.label,
          sourceLabel: material.sourceLabel?.trim() || material.label,
          anchorText: spokenAnchor,
          required: executionPolicy === "locked",
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
          description: material.description?.trim() || material.label,
          sourceLabel: material.sourceLabel?.trim() || material.label,
          required: false,
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
      description: material.label,
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
