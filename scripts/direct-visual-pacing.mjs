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
import {
  animationPrototypeRegistry,
  applyAnimationStyleProfile,
  bindFrozenAnimationImageAssets,
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
const authoredVisualPlan = config.authoredVisualPlanFile
  ? JSON.parse(await readFile(resolve(config.authoredVisualPlanFile), "utf8"))
  : { sections: [], annotations: [] };
for (const annotation of authoredVisualPlan.annotations ?? []) {
  const quoteSha256 = createHash("sha256").update(annotation.exactSpokenQuote).digest("hex");
  if (annotation.exactSpokenQuoteSha256 && annotation.exactSpokenQuoteSha256 !== quoteSha256)
    throw new Error(`Text annotation ${annotation.id} exact-spoken-quote hash binding is stale`);
}
for (const beat of authoredVisualPlan.beats ?? []) {
  const quoteSha256 = createHash("sha256").update(beat.exactSpokenQuote).digest("hex");
  if (beat.exactSpokenQuoteSha256 && beat.exactSpokenQuoteSha256 !== quoteSha256)
    throw new Error(`Visual beat ${beat.id} exact-spoken-quote hash binding is stale`);
}
const legacyVisualBeatIntervals = resolveLockedVisualBeatTimeline({ plan: authoredVisualPlan, captions });
const plannedAnimationCues = [
  ...resolveLockedSectionAnimationTimeline({ plan: authoredVisualPlan, captions }),
  ...resolvedAnimationCues(legacyVisualBeatIntervals),
];
const styledAnimationCues = (
  config.animationTemplateId
    ? applyAnimationStyleProfile(plannedAnimationCues, config.animationTemplateId)
    : plannedAnimationCues
).sort((left, right) => left.start - right.start || left.end - right.end);
const imageEvidenceAssets = await readImageEvidenceAssets();
const animationCues = bindFrozenAnimationImageAssets(styledAnimationCues, imageEvidenceAssets);
const annotationCues = resolveLockedTextAnnotationTimeline({ plan: authoredVisualPlan, captions });
const primaryVisualIntervals = [
  ...legacyVisualBeatIntervals.filter((interval) => interval.primaryVisualType !== "animation"),
  ...animationCues,
].sort((left, right) => left.start - right.start || left.end - right.end);
const unapprovedAnimationCues = animationCues.filter(
  (cue) => animationPrototypeRegistry[cue.animationIntent.prototypeId].rendererStatus !== "approved",
);
const approvedAnimationCues = animationCues.filter((cue) => !unapprovedAnimationCues.includes(cue));
const imageCues = legacyVisualBeatIntervals.flatMap((interval) => {
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
const authoredTimeline = JSON.parse(await readFile(resolve(config.resolvedSceneTimelineFile), "utf8"));
if (authoredTimeline.status === "blocked") throw new Error("Required authored recording scenes remain unresolved");
const screenScenes = authoredTimeline.scenes ?? [];
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
const overlayCues = bundle.candidates.flatMap((candidate) => {
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
directionReport.requiredImageEvidence = evaluateRequiredImageEvidenceCoverage(
  imageEvidenceAssets,
  overlayCues,
  imageCues,
  animationCues,
);
const coverageIntervals = [...primaryVisualIntervals];
const overlapsCoverage = (start, end) => coverageIntervals.some((item) => start < item.end && end > item.start);
for (const scene of screenScenes) {
  if (overlapsCoverage(scene.start, scene.end)) continue;
  coverageIntervals.push({
    id: scene.id,
    start: scene.start,
    end: scene.end,
    primaryVisualType: "screen-demo",
    takeover: "full",
    speakerPresence: "circle-pip",
  });
}
for (const cue of overlayCues) {
  if (overlapsCoverage(cue.start, cue.end)) continue;
  coverageIntervals.push({
    id: `component-${cue.generatedVisual.segment.id}`,
    start: cue.start,
    end: cue.end,
    primaryVisualType: cue.generatedVisual.component.id === "image-evidence-inset" ? "image" : "component",
    takeover: "partial",
    speakerPresence: "full",
  });
}
directionReport.visualTypeCoverage = summarizeVisualCoverage({ intervals: coverageIntervals, durationSeconds });
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
  `- Authored recording scenes: ${screenScenes.length}`,
  `- Automatic or manually selected animation sections: ${animationCues.length}`,
  `- Creator text annotations: ${annotationCues.length}`,
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
