import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { evaluateRequiredImageEvidenceCoverage } from "../src/semantic-planning/image-evidence-coverage.ts";
// This workflow script runs directly in Node. Import only the data/planning modules here;
// the public barrel also exports a React TSX renderer that Node cannot load without bundling.
import { defaultSoundPolicy, planSoundEvents } from "../src/sound-design/plan.ts";
import { soundAssetRegistry } from "../src/sound-design/registry.ts";
import { suppressCandidatesForAuthoredScenes } from "../src/supplemental-media/alignment.ts";
import {
  directVisualPacing,
  planWholeVideoTitleCues,
  summarizeVisualDirection,
} from "../src/visual-direction/index.ts";
import { planEditorialCoverageFill } from "../src/visual-direction/editorial-coverage-fill.ts";
import { applyEditorialStatementPolicy } from "../src/visual-direction/editorial-statement-policy.ts";
import {
  animationPrototypeRegistry,
  applyAnimationStyleProfile,
  authoredVisualEntryIsLocked,
  bindFrozenAnimationImageAssets,
  dedupeAgentRoughAnnotations,
  resolvedAnimationCues,
  resolveLockedSectionAnimationTimeline,
  resolveLockedTextAnnotationTimeline,
  resolveLockedVisualBeatTimeline,
  summarizeVisualCoverage,
  suppressCandidatesForPrimaryVisualIntervals,
} from "../src/visual-production/index.ts";

const config = JSON.parse(await readFile(resolve(process.argv[2]), "utf8"));
const readImageEvidenceAssets = async () => {
  if (!config.imageEvidenceManifestFile) return [];
  try {
    return JSON.parse(await readFile(resolve(config.imageEvidenceManifestFile), "utf8")).assets ?? [];
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
};
const bundle = JSON.parse(await readFile(resolve(config.componentCandidatesFile), "utf8"));
if (bundle.schemaVersion !== "1.0" || !Array.isArray(bundle.candidates))
  throw new Error("component candidate bundle must use schemaVersion 1.0");
const captions = JSON.parse(await readFile(resolve(config.semanticCaptionsFile), "utf8"));
const layoutManifest = JSON.parse(await readFile(resolve(config.editDir, "layout-manifest.json"), "utf8"));
const authoredVisualPlan = config.authoredVisualPlanFile
  ? JSON.parse(await readFile(resolve(config.authoredVisualPlanFile), "utf8"))
  : { sections: [], annotations: [] };
const semanticNarrativePlan = JSON.parse(await readFile(resolve(config.semanticNarrativePlanFile), "utf8"));
const materialAssignmentSlots = (() => {
  const groups = new Map();
  for (const assignment of semanticNarrativePlan.materialAssignments ?? []) {
    const key = `${assignment.startCue}-${assignment.endCue}`;
    groups.set(key, [...(groups.get(key) ?? []), assignment]);
  }
  const slots = new Map();
  for (const assignments of groups.values()) {
    const ordered = [...assignments].sort((left, right) => left.order - right.order);
    const start = captions[ordered[0].startCue]?.start;
    const end = captions[ordered[0].endCue]?.end;
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
      throw new Error(`Production Agent material assignment ${ordered[0].assetId} has invalid timing`);
    const slotSeconds = (end - start) / ordered.length;
    ordered.forEach((assignment, index) => {
      slots.set(assignment.assetId, {
        ...assignment,
        start: start + slotSeconds * index,
        end: index === ordered.length - 1 ? end : start + slotSeconds * (index + 1),
      });
    });
  }
  return slots;
})();
const visualDecisions = bundle.plan.visualDecisions ?? [];
const usedReferenceBeatIds = new Set(
  visualDecisions.filter((decision) => decision.action === "use").map((decision) => decision.beatId),
);
for (const annotation of authoredVisualPlan.annotations ?? []) {
  if (!authoredVisualEntryIsLocked(authoredVisualPlan, annotation, "annotation")) continue;
  const quoteSha256 = createHash("sha256").update(annotation.exactSpokenQuote).digest("hex");
  if (annotation.exactSpokenQuoteSha256 && annotation.exactSpokenQuoteSha256 !== quoteSha256)
    throw new Error(`Text annotation ${annotation.id} exact-spoken-quote hash binding is stale`);
}
for (const beat of authoredVisualPlan.beats ?? []) {
  if (!authoredVisualEntryIsLocked(authoredVisualPlan, beat) && !usedReferenceBeatIds.has(beat.id)) continue;
  const quoteSha256 = createHash("sha256").update(beat.exactSpokenQuote).digest("hex");
  if (beat.exactSpokenQuoteSha256 && beat.exactSpokenQuoteSha256 !== quoteSha256)
    throw new Error(`Visual beat ${beat.id} exact-spoken-quote hash binding is stale`);
}
const legacyVisualBeatIntervals = resolveLockedVisualBeatTimeline({
  plan: authoredVisualPlan,
  captions,
  visualDecisions,
});
const plannedAnimationCues = [
  ...resolveLockedSectionAnimationTimeline({ plan: authoredVisualPlan, captions }),
  ...resolvedAnimationCues(legacyVisualBeatIntervals),
  ...(semanticNarrativePlan.segments ?? []).flatMap((segment, index) => {
    if (!segment.animationIntent) return [];
    const start = captions[segment.startCue]?.start;
    const end = captions[segment.endCue]?.end;
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
      throw new Error(`Production Agent animation segment ${index} has invalid timing`);
    return [
      {
        id: `agent-animation-${index + 1}`,
        sectionId: `semantic-segment-${index + 1}`,
        startCue: segment.startCue,
        endCue: segment.endCue,
        start,
        end,
        primaryVisualType: "animation",
        takeover: "full",
        speakerPresence: "circle-pip",
        animationIntent: segment.animationIntent,
        styleProfileId: segment.animationIntent.styleProfileId,
      },
    ];
  }),
];
const styledAnimationCues = (
  config.animationTemplateId
    ? applyAnimationStyleProfile(plannedAnimationCues, config.animationTemplateId)
    : plannedAnimationCues
).sort((left, right) => left.start - right.start || left.end - right.end);
const imageEvidenceAssets = await readImageEvidenceAssets();
const animationCues = bindFrozenAnimationImageAssets(styledAnimationCues, imageEvidenceAssets);
const annotationCues = resolveLockedTextAnnotationTimeline({ plan: authoredVisualPlan, captions });
const unapprovedAnimationCues = animationCues.filter(
  (cue) => animationPrototypeRegistry[cue.animationIntent.prototypeId].rendererStatus !== "approved",
);
const approvedAnimationCues = animationCues.filter((cue) => !unapprovedAnimationCues.includes(cue));
const legacyImageCues = legacyVisualBeatIntervals.flatMap((interval) => {
  if (interval.primaryVisualType !== "image") return [];
  const assetIds = interval.materialAssetIds?.length
    ? interval.materialAssetIds
    : interval.materialAssetId
      ? [interval.materialAssetId]
      : [];
  const assets = assetIds.map((assetId) =>
    imageEvidenceAssets.find((item) => item.id === assetId || item.id.startsWith(`${assetId}-`)),
  );
  if (!assets.length || assets.some((asset) => !asset?.publicSrc))
    throw new Error(`Confirmed image beat ${interval.id} has no frozen public image evidence`);
  return [
    {
      id: interval.id,
      start: interval.start,
      end: interval.end,
      assetId: assets[0].id,
      src: assets[0].publicSrc,
      sources: assets.map((asset) => ({
        assetId: asset.id,
        src: asset.publicSrc,
        fit: asset.fit ?? "contain",
        label: asset.description ?? asset.sourceLabel ?? interval.id,
      })),
      fit: assets[0].fit ?? "contain",
      label: assets[0].description ?? assets[0].sourceLabel ?? interval.id,
      speakerPresence: interval.speakerPresence === "hidden" ? "hidden" : "circle-pip",
    },
  ];
});
const assignedImageCues = [...materialAssignmentSlots.values()].flatMap((assignment) => {
  if (assignment.kind !== "image") return [];
  const asset = imageEvidenceAssets.find((item) => item.id === assignment.assetId);
  if (!asset?.publicSrc) throw new Error(`Production Agent image assignment ${assignment.assetId} is not registered`);
  return [
    {
      id: `agent-image-${assignment.order}`,
      start: assignment.start,
      end: assignment.end,
      assetId: asset.id,
      src: asset.publicSrc,
      sources: [
        {
          assetId: asset.id,
          src: asset.publicSrc,
          fit: asset.fit ?? "contain",
          label: asset.description ?? asset.sourceLabel ?? asset.id,
        },
      ],
      fit: asset.fit ?? "contain",
      label: asset.description ?? asset.sourceLabel ?? asset.id,
      speakerPresence: "circle-pip",
    },
  ];
});
const imageCues = [...legacyImageCues, ...assignedImageCues].sort(
  (left, right) => left.start - right.start || left.end - right.end,
);
const primaryVisualIntervals = [
  ...legacyVisualBeatIntervals.filter(
    (interval) => interval.primaryVisualType !== "animation" && interval.primaryVisualType !== "image",
  ),
  ...animationCues,
  ...imageCues.map((cue) => ({
    ...cue,
    primaryVisualType: "image",
    takeover: "full",
  })),
].sort((left, right) => left.start - right.start || left.end - right.end);
const authoredTimeline = JSON.parse(await readFile(resolve(config.resolvedSceneTimelineFile), "utf8"));
if (authoredTimeline.status === "blocked") throw new Error("Required authored recording scenes remain unresolved");
const screenScenes = (authoredTimeline.scenes ?? [])
  .filter(
    (scene) =>
      scene.executionPolicy !== "reference" ||
      usedReferenceBeatIds.has(scene.visualBeatId ?? scene.id.replace(/^scene-/, "")),
  )
  .map((scene) => {
    const assignment = materialAssignmentSlots.get(scene.assetId);
    if (assignment?.kind !== "screen-demo") return scene;
    const availableSourceSeconds = Math.max(0, Number(scene.sourceEnd ?? 0) - Number(scene.sourceStart ?? 0));
    const duration = Math.min(
      assignment.end - assignment.start,
      availableSourceSeconds || assignment.end - assignment.start,
    );
    return {
      ...scene,
      start: assignment.start,
      end: assignment.start + duration,
      startCue: assignment.startCue,
      endCue: assignment.endCue,
      sourceEnd: Number(scene.sourceStart ?? 0) + duration,
      placementSource: "production-agent-material-assignment",
    };
  })
  .sort((left, right) => left.start - right.start || left.end - right.end);
const unresolvedScreenAssignments = [...materialAssignmentSlots.values()].filter(
  (assignment) =>
    assignment.kind === "screen-demo" && !screenScenes.some((scene) => scene.assetId === assignment.assetId),
);
if (unresolvedScreenAssignments.length)
  throw new Error(
    `Production Agent screen assignments have no registered scene: ${unresolvedScreenAssignments
      .map((assignment) => assignment.assetId)
      .join(", ")}`,
  );
const brandTimeline = config.brandEnabled
  ? JSON.parse(await readFile(resolve(config.brandTimelineFile), "utf8"))
  : { schemaVersion: "1.0", status: "disabled", totalInsertedSeconds: 0 };
const brandScene =
  brandTimeline.status === "resolved"
    ? {
        id: "brand-bumper",
        start: brandTimeline.presentationTimeSeconds,
        end: brandTimeline.presentationTimeSeconds + brandTimeline.durationSeconds,
      }
    : null;
const visualExclusions = brandScene ? [...screenScenes, brandScene] : screenScenes;
const titleVisualExclusions = [...visualExclusions, ...primaryVisualIntervals];
const candidates = suppressCandidatesForPrimaryVisualIntervals(
  suppressCandidatesForAuthoredScenes(bundle.candidates, visualExclusions),
  primaryVisualIntervals,
);
const durationSeconds = captions.at(-1)?.end ?? 0;
const directionPlan = directVisualPacing({
  candidates,
  durationSeconds,
  policy: config.visualDirection,
});
const directionReport = summarizeVisualDirection(directionPlan);
const titleCues = bundle.plan.videoIdentity
  ? planWholeVideoTitleCues({
      identity: bundle.plan.videoIdentity,
      decisions: directionPlan.decisions,
      screenScenes: titleVisualExclusions,
      durationSeconds,
    })
  : [];
directionPlan.titleCues = titleCues;
directionReport.summary.titleContinuityCues = titleCues.length;
directionReport.summary.titleContinuitySeconds = Number(
  titleCues.reduce((total, cue) => total + cue.end - cue.start, 0).toFixed(3),
);
const selected = new Map(
  directionPlan.decisions
    .filter((decision) => decision.action === "show")
    .map((decision) => [decision.candidateId, decision]),
);
const selectedOverlayCues = bundle.candidates.flatMap((candidate) => {
  const decision = selected.get(candidate.id);
  if (!decision || !candidate.overlayCue || decision.displayStart === null || decision.displayEnd === null) return [];
  return [
    {
      ...candidate.overlayCue,
      start: decision.displayStart,
      end: decision.displayEnd,
      visualImportance: decision.importance,
      chapterId: decision.chapterId,
      generatedVisual: {
        ...candidate.overlayCue.generatedVisual,
        segment: {
          ...candidate.overlayCue.generatedVisual.segment,
          start: decision.displayStart,
          end: decision.displayEnd,
        },
      },
    },
  ];
});
const nonComponentResetIntervals = [...primaryVisualIntervals, ...screenScenes, ...annotationCues, ...titleCues];
const initialEditorialStatementPolicy = applyEditorialStatementPolicy(selectedOverlayCues, durationSeconds, {
  resetIntervals: nonComponentResetIntervals,
});
const initialAnnotationDedupe = dedupeAgentRoughAnnotations({
  overlayCues: initialEditorialStatementPolicy.cues,
  userAnnotations: annotationCues,
});
const buildCoverageIntervals = (componentCues) => {
  const intervals = [...primaryVisualIntervals];
  const overlaps = (start, end) => intervals.some((item) => start < item.end && end > item.start);
  for (const scene of screenScenes) {
    if (overlaps(scene.start, scene.end)) continue;
    intervals.push({
      id: scene.id,
      start: scene.start,
      end: scene.end,
      primaryVisualType: "screen-demo",
      takeover: "full",
      speakerPresence: "circle-pip",
    });
  }
  for (const cue of componentCues) {
    if (overlaps(cue.start, cue.end)) continue;
    intervals.push({
      id: `component-${cue.generatedVisual.segment.id}`,
      start: cue.start,
      end: cue.end,
      primaryVisualType:
        cue.generatedVisual.component.id === "image-evidence-inset"
          ? "image"
          : cue.generatedVisual.component.id === "rough-annotation"
            ? "annotation"
            : "component",
      takeover: "partial",
      speakerPresence: "full",
    });
  }
  for (const cue of annotationCues) {
    if (overlaps(cue.start, cue.end)) continue;
    intervals.push({
      id: `annotation-${cue.id}`,
      start: cue.start,
      end: cue.end,
      primaryVisualType: "annotation",
      takeover: "partial",
      speakerPresence: "full",
    });
  }
  for (const cue of titleCues) {
    if (overlaps(cue.start, cue.end)) continue;
    intervals.push({
      id: cue.id,
      start: cue.start,
      end: cue.end,
      primaryVisualType: "annotation",
      takeover: "partial",
      speakerPresence: "full",
    });
  }
  return intervals.sort((left, right) => left.start - right.start || left.end - right.end);
};
const minimumVisualCoverageRatio = Number(config.visualDirection?.minimumVisualCoverageRatio ?? 0);
const initialCoverageIntervals = buildCoverageIntervals(initialAnnotationDedupe.overlayCues);
const editorialCoverageFill = planEditorialCoverageFill({
  captions,
  coveredIntervals: initialCoverageIntervals,
  existingEditorialCues: initialAnnotationDedupe.overlayCues.filter(
    (cue) => cue.generatedVisual?.component?.id === "editorial-statement",
  ),
  durationSeconds,
  minimumCoverageRatio: minimumVisualCoverageRatio,
  maximumEditorialCoverageRatio: 1,
  maximumConsecutive: 2,
  faceCenterX: Number(layoutManifest.faceCenterX ?? 0.5),
});
const combinedOverlayCues = [...initialAnnotationDedupe.overlayCues, ...editorialCoverageFill.cues].sort(
  (left, right) => left.start - right.start || left.end - right.end,
);
const editorialStatementPolicy = applyEditorialStatementPolicy(combinedOverlayCues, durationSeconds, {
  resetIntervals: nonComponentResetIntervals,
});
const annotationDedupe = dedupeAgentRoughAnnotations({
  overlayCues: editorialStatementPolicy.cues,
  userAnnotations: annotationCues,
});
const overlayCues = annotationDedupe.overlayCues;
const appliedCoverageFillCues = overlayCues.filter((cue) => cue.coverageFill === true);
const appliedCoverageFillSeconds = appliedCoverageFillCues.reduce(
  (total, cue) => total + Math.max(0, cue.end - cue.start),
  0,
);
const appliedCoverageFillReport = {
  ...editorialCoverageFill.report,
  status:
    editorialCoverageFill.report.deficitSeconds <= 0.001
      ? "not-needed"
      : editorialCoverageFill.report.existingCoveredSeconds + appliedCoverageFillSeconds + 0.001 >=
          editorialCoverageFill.report.targetSeconds
        ? "filled"
        : "partially-filled",
  plannedSeconds: Number(appliedCoverageFillSeconds.toFixed(3)),
  predictedCoveredSeconds: Number(
    Math.min(durationSeconds, editorialCoverageFill.report.existingCoveredSeconds + appliedCoverageFillSeconds).toFixed(
      3,
    ),
  ),
  remainingSeconds: Number(
    Math.max(
      0,
      editorialCoverageFill.report.targetSeconds -
        editorialCoverageFill.report.existingCoveredSeconds -
        appliedCoverageFillSeconds,
    ).toFixed(3),
  ),
  cueIds: appliedCoverageFillCues.map((cue) => cue.generatedVisual.segment.id),
};
directionPlan.coverageFillCues = appliedCoverageFillCues.map((cue) => ({
  id: cue.generatedVisual.segment.id,
  start: cue.start,
  end: cue.end,
  componentId: "editorial-statement",
  source: "deterministic-caption-gap-fill",
}));
directionReport.annotationDedupe = {
  userAnnotationCount: annotationCues.length,
  removedAgentItemCount: annotationDedupe.removedItemCount,
  removedAgentCueCount: annotationDedupe.removedCueCount,
};
directionReport.editorialStatement = {
  maximumCoverageRatio: 1,
  maximumConsecutive: 2,
  coverageSeconds: editorialStatementPolicy.coverageSeconds,
  coverageRatio: editorialStatementPolicy.coverageRatio,
  suppressedCueIds: editorialStatementPolicy.suppressedCueIds,
};
directionReport.editorialCoverageFill = appliedCoverageFillReport;
directionReport.requiredImageEvidence = evaluateRequiredImageEvidenceCoverage(
  imageEvidenceAssets,
  overlayCues,
  imageCues,
  animationCues,
);
const coverageIntervals = buildCoverageIntervals(overlayCues);
directionReport.visualTypeCoverage = summarizeVisualCoverage({ intervals: coverageIntervals, durationSeconds });
directionReport.summary.componentVisualCoverageRatio = directionReport.summary.visualCoverageRatio;
directionReport.summary.visualCoverageRatio = Number(
  (1 - directionReport.visualTypeCoverage.ratioByType.speaker).toFixed(4),
);
directionReport.summary.coverageFillCount = appliedCoverageFillCues.length;
directionReport.summary.effectiveSelectedComponentCount = overlayCues.length;
directionReport.summary.effectiveVisualsPerMinute = Number(((overlayCues.length * 60) / durationSeconds).toFixed(3));
directionReport.executionDecisions = {
  source: "production-agent",
  decisions: visualDecisions,
  usedReferenceBeatIds: [...usedReferenceBeatIds],
};
const maximumAnimationCoverageRatio = Number(config.visualDirection?.maximumAnimationCoverageRatio ?? 0.25);
if (
  minimumVisualCoverageRatio > 0 &&
  directionReport.summary.visualCoverageRatio + 0.0001 < minimumVisualCoverageRatio
) {
  await writeFile(
    `${resolve(config.visualDirectionReportFile)}.coverage-failed.json`,
    `${JSON.stringify(directionReport, null, 2)}\n`,
  );
  throw new Error(
    `Effective visual coverage ${(directionReport.summary.visualCoverageRatio * 100).toFixed(1)}% is below the required ${(minimumVisualCoverageRatio * 100).toFixed(1)}%`,
  );
}
if (directionReport.visualTypeCoverage.ratioByType.animation > maximumAnimationCoverageRatio + 0.0001) {
  await writeFile(
    `${resolve(config.visualDirectionReportFile)}.animation-balance-failed.json`,
    `${JSON.stringify(directionReport, null, 2)}\n`,
  );
  throw new Error(
    `Effective animation coverage ${(directionReport.visualTypeCoverage.ratioByType.animation * 100).toFixed(1)}% exceeds the auxiliary limit ${(maximumAnimationCoverageRatio * 100).toFixed(1)}%`,
  );
}
directionReport.animationRenderer = {
  status: unapprovedAnimationCues.length ? "candidate-blocked" : animationCues.length ? "approved" : "not-used",
  cueCount: animationCues.length,
  blockedCueIds: unapprovedAnimationCues.map((cue) => cue.id),
};
const configuredSoundPolicy = {
  ...defaultSoundPolicy,
  ...(config.brand?.soundPolicy ?? {}),
};
const soundPlan = planSoundEvents({
  durationSeconds,
  overlayCues,
  screenScenes,
  brandTimeline,
  policy: configuredSoundPolicy,
});
const withDirectedCues = (value, includeCandidateAnimations = false) => ({
  ...value,
  overlayCues,
  screenScenes,
  titleCues,
  ...(annotationCues.length ? { annotationCues } : {}),
  ...(imageCues.length ? { imageCues } : {}),
  ...((includeCandidateAnimations ? animationCues : approvedAnimationCues).length
    ? { animationCues: includeCandidateAnimations ? animationCues : approvedAnimationCues }
    : {}),
  ...(config.brandEnabled ? { brandTimeline, soundEvents: soundPlan.events } : {}),
});
const plan = {
  ...bundle.plan,
  visualDirectionPlan: config.visualDirectionPlanFile,
  overlayCues,
  screenScenes,
  titleCues,
  imageCues,
  animationCues,
  annotationCues,
  ...(config.brandEnabled ? { brandTimeline: config.brandTimelineFile, soundPlan: config.soundPlanFile } : {}),
};
const escapeXml = (value) =>
  String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const timelineSvg = (() => {
  const width = 1600;
  const height = 390;
  const left = 90;
  const right = 40;
  const plotWidth = width - left - right;
  const x = (seconds) => left + (Math.max(0, seconds) / Math.max(1, directionPlan.durationSeconds)) * plotWidth;
  const rows = { hero: 150, support: 215, accent: 280, none: 335 };
  const colors = { hero: "#F3B545", support: "#6EA8FF", accent: "#59D98E", none: "#D8D7D2" };
  const ticks = [];
  for (let second = 0; second <= directionPlan.durationSeconds; second += 30)
    ticks.push(
      `<line x1="${x(second)}" y1="95" x2="${x(second)}" y2="350" stroke="#263241" stroke-width="1"/><text x="${x(second)}" y="82" fill="#91a0b5" font-size="14" text-anchor="middle">${second}s</text>`,
    );
  const chapterRects = directionPlan.chapters.map((chapter, index) => {
    const chapterDecisions = directionPlan.decisions.filter((decision) => decision.chapterId === chapter.id);
    const start = Math.min(...chapterDecisions.map((decision) => decision.sourceStart));
    const end = Math.max(...chapterDecisions.map((decision) => decision.sourceEnd));
    return `<rect x="${x(start)}" y="30" width="${Math.max(2, x(end) - x(start))}" height="28" rx="8" fill="${index % 2 ? "#26384b" : "#203248"}"/><text x="${x(start) + 8}" y="49" fill="#dce8f7" font-size="13">${escapeXml(chapter.label.slice(0, 24))}</text>`;
  });
  const decisionRects = directionPlan.decisions.map((decision) => {
    const y = rows[decision.importance];
    if (decision.action === "skip")
      return `<circle cx="${x(decision.sourceStart)}" cy="${y}" r="5" fill="${colors.none}"/><text x="${x(decision.sourceStart) + 9}" y="${y + 5}" fill="#7d8998" font-size="12">skip ${escapeXml(decision.candidateId)}</text>`;
    const start = decision.displayStart ?? decision.sourceStart;
    const end = decision.displayEnd ?? decision.sourceEnd;
    return `<rect x="${x(start)}" y="${y - 18}" width="${Math.max(3, x(end) - x(start))}" height="36" rx="9" fill="${colors[decision.importance]}" fill-opacity="0.9"/><text x="${x(start) + 7}" y="${y + 5}" fill="#08111d" font-size="12" font-weight="700">${escapeXml((decision.componentId ?? decision.candidateId).slice(0, 24))}</text>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#090B0F"/><text x="40" y="25" fill="#F5F2EA" font-size="18" font-weight="700">Whole-video visual direction</text>${chapterRects.join("")}${ticks.join("")}<text x="20" y="155" fill="#F3B545" font-size="13">HERO</text><text x="20" y="220" fill="#6EA8FF" font-size="13">SUPPORT</text><text x="20" y="285" fill="#59D98E" font-size="13">ACCENT</text><text x="20" y="340" fill="#D8D7D2" font-size="13">SKIP</text>${decisionRects.join("")}</svg>`;
})();
const soundTimelineSvg = (() => {
  const width = 1600;
  const height = 230;
  const left = 90;
  const right = 40;
  const plotWidth = width - left - right;
  const x = (seconds) => left + (Math.max(0, seconds) / Math.max(1, durationSeconds)) * plotWidth;
  const colors = {
    "brand-signature": "#F5F2EA",
    "scene-transition": "#6EA8FF",
    "hero-entry": "#F3B545",
    "item-step": "#59D98E",
    settle: "#B392F0",
    warning: "#FF6B6B",
    "component-exit": "#A7B0BE",
  };
  const ticks = [];
  for (let second = 0; second <= durationSeconds; second += 30)
    ticks.push(
      `<line x1="${x(second)}" y1="60" x2="${x(second)}" y2="185" stroke="#263241"/><text x="${x(second)}" y="48" fill="#91a0b5" font-size="13" text-anchor="middle">${second}s</text>`,
    );
  const events = soundPlan.events.map(
    (event, index) =>
      `<line x1="${x(event.at)}" y1="78" x2="${x(event.at)}" y2="172" stroke="${colors[event.role]}" stroke-width="4"/><circle cx="${x(event.at)}" cy="${105 + (index % 3) * 26}" r="7" fill="${colors[event.role]}"/><text x="${x(event.at) + 10}" y="${110 + (index % 3) * 26}" fill="#dce8f7" font-size="12">${escapeXml(event.role)}</text>`,
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#0d1520"/><text x="40" y="27" fill="#f4f7fb" font-size="18" font-weight="700">SeanLab sound-event timeline</text>${ticks.join("")}${events.join("")}</svg>`;
})();
const markdown = [
  "# Whole-video direction review",
  "",
  `- Candidates: ${directionReport.summary.candidateCount}`,
  `- Selected: ${directionReport.summary.selectedCount}`,
  `- Skipped: ${directionReport.summary.skippedCount}`,
  `- Chapters: ${directionReport.summary.chapterCount}`,
  `- Visual coverage: ${(directionReport.summary.visualCoverageRatio * 100).toFixed(1)}%`,
  `- Visuals per minute: ${directionReport.summary.visualsPerMinute}`,
  `- Effective selected components: ${directionReport.summary.effectiveSelectedComponentCount}`,
  `- Deterministic coverage fillers: ${directionReport.summary.coverageFillCount}`,
  `- Authored recording scenes: ${screenScenes.length}`,
  `- Automatic or manually selected animation sections: ${animationCues.length}`,
  `- Creator text annotations: ${annotationCues.length}`,
  `- Duplicate Agent annotations removed: ${annotationDedupe.removedItemCount} items / ${annotationDedupe.removedCueCount} cues`,
  `- Animation renderer gate: ${directionReport.animationRenderer.status}`,
  `- Required screenshots: ${directionReport.requiredImageEvidence.selectedRequiredCount}/${directionReport.requiredImageEvidence.requiredCount} shown`,
  `- Whole-video title continuity cues: ${titleCues.length}`,
  ...(config.brandEnabled
    ? [
        `- Legacy project bumper: ${brandTimeline.status === "resolved" ? `${brandTimeline.presentationTimeSeconds.toFixed(1)}-${(brandTimeline.presentationTimeSeconds + brandTimeline.durationSeconds).toFixed(1)}s` : "disabled"}`,
        `- Sound events: ${soundPlan.summary.eventCount} selected / ${soundPlan.summary.suppressedCount} suppressed`,
      ]
    : []),
  "",
  "## Visual type coverage",
  "",
  `- Component: ${(directionReport.visualTypeCoverage.componentCoverage * 100).toFixed(1)}%`,
  `- Real material: ${(directionReport.visualTypeCoverage.realMaterialCoverage * 100).toFixed(1)}%`,
  `- Animation: ${(directionReport.visualTypeCoverage.animationCoverage * 100).toFixed(1)}%`,
  `- Full-screen takeover: ${(directionReport.visualTypeCoverage.fullScreenTakeoverRatio * 100).toFixed(1)}%`,
  `- Speaker visible (full or PIP): ${(directionReport.visualTypeCoverage.speakerVisibleRatio * 100).toFixed(1)}%`,
  "",
  "## Required screenshot evidence",
  "",
  `- Status: ${directionReport.requiredImageEvidence.status}`,
  `- Missing required asset ids: ${directionReport.requiredImageEvidence.missingRequiredAssetIds.join(", ") || "none"}`,
  "",
  "## Deterministic coverage fill",
  "",
  `- Status: ${directionReport.editorialCoverageFill.status}`,
  `- Added: ${directionReport.editorialCoverageFill.plannedSeconds.toFixed(1)}s across ${directionReport.editorialCoverageFill.cueIds.length} editorial-statement cues`,
  `- Remaining deficit: ${directionReport.editorialCoverageFill.remainingSeconds.toFixed(1)}s`,
  "",
  "## Chapters",
  "",
  "| Chapter | Caption range | Candidates |",
  "| --- | ---: | ---: |",
  ...directionPlan.chapters.map(
    (chapter) => `| ${chapter.label} | ${chapter.startCue}-${chapter.endCue} | ${chapter.candidateIds.length} |`,
  ),
  "",
  "## Decisions",
  "",
  "| Candidate | Action | Importance | Time | Component | Boundary / adjustment | Reason |",
  "| --- | --- | --- | ---: | --- | --- | --- |",
  ...directionPlan.decisions.map(
    (decision) =>
      `| ${decision.candidateId} | ${decision.action} | ${decision.importance} | ${decision.displayStart === null ? "speaker-only" : `${decision.displayStart.toFixed(1)}-${decision.displayEnd?.toFixed(1)}s`} | ${decision.componentId ?? "-"} | ${[...decision.boundaryActions, ...decision.adjustments].join(", ")} | ${decision.reasons.join(" / ").replaceAll("|", "\\|") || "-"} |`,
  ),
  "",
  "## Whole-video title continuity",
  "",
  "| Cue | Time | Title | Evidence | Reason |",
  "| --- | ---: | --- | ---: | --- |",
  ...titleCues.map(
    (cue) =>
      `| ${cue.id} | ${cue.start.toFixed(1)}-${cue.end.toFixed(1)}s | ${cue.title} | ${cue.sourceStartCue}-${cue.sourceEndCue} | ${cue.placementReason.replaceAll("|", "\\|")} |`,
  ),
  "",
].join("\n");
const outputs = [
  [config.planningFile, plan],
  [config.reviewPropsFile, withDirectedCues(bundle.reviewProps, true)],
  [config.finalPropsFile, withDirectedCues(bundle.deliveryProps, false)],
  [config.visualDirectionPlanFile, directionPlan],
  [config.visualDirectionReportFile, directionReport],
  ...(config.brandEnabled
    ? [
        [config.soundPlanFile, soundPlan],
        [
          config.soundReportFile,
          {
            schemaVersion: "1.0",
            kind: "sound-design-report",
            status: "passed",
            profileId: soundPlan.profileId,
            policy: soundPlan.policy,
            summary: soundPlan.summary,
            assets: soundAssetRegistry,
            findings: [],
          },
        ],
      ]
    : []),
];
for (const [path, value] of outputs) {
  const absolute = resolve(path);
  await mkdir(dirname(absolute), { recursive: true });
  await writeFile(absolute, `${JSON.stringify(value, null, 2)}\n`);
}
await writeFile(resolve(config.visualDirectionReviewFile), `${markdown}\n`);
await writeFile(resolve(config.visualDirectionTimelineFile), `${timelineSvg}\n`);
if (config.brandEnabled) await writeFile(resolve(config.soundTimelineFile), `${soundTimelineSvg}\n`);
console.log(
  `${config.visualDirectionPlanFile}: ${overlayCues.length}/${bundle.candidates.length} visuals selected, ${screenScenes.length} authored recording scenes preserved`,
);
