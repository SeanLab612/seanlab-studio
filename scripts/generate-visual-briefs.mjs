import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import {
  deriveNamedItemCountEvidence,
  evaluateSourceGrounding,
  semanticSegmentClaimText,
  semanticVideoIdentityClaimText,
} from "../src/agents/conformance.ts";
import { resolveAuthoredVisualRange } from "../src/creator-workflow/authored-visual-alignment.ts";
import {
  resolveAuthoredVisualConstraint,
  selectInformationConstraintOwners,
} from "../src/creator-workflow/authored-visual-routing.ts";
import { NARRATION_VISUAL_FORMS } from "../src/creator-workflow/visual-authoring.ts";
import { workflowTestOverlayCues } from "../src/data/workflow-test-props.ts";
import { selectContentScale, selectLayoutTemplate } from "../src/layout-templates/selector.ts";
import { resolveMotionSelection } from "../src/motion-recipes/selector.ts";
import {
  boundImageEvidenceIntentToCaptions,
  boundSemanticIntentItems,
  materializeSemanticIntent,
  normalizeRoutingIntent,
  parseSemanticNarrativePlan,
  resolveSpeakerRoughAnnotationPlan,
  semanticEvidenceStartSeconds,
  withConfirmedComparisonItems,
  withLocalRoughAnnotationPlan,
} from "../src/semantic-planning/index.ts";
import { visualRhetoricByComponent } from "../src/visual-brief/component-rhetoric.ts";
import { generateVisualBrief, validateComponentProps } from "../src/visual-brief/generator.ts";
import { authoredVisualEntryIsLocked, resolveExactSpokenQuoteCaptionRange } from "../src/visual-production/timeline.ts";
import { createMimoJsonAdapter, groupCaptionSegments } from "./workflow/mimo-adapter.mjs";

const config = JSON.parse(await readFile(resolve(process.argv[2] ?? "config/workflow-test.json"), "utf8"));
const execFileAsync = promisify(execFile);
const edl = JSON.parse(await readFile(resolve(config.editDir, "edl.json"), "utf8"));
const captions = JSON.parse(await readFile(resolve(config.editDir, "captions-verbatim.json"), "utf8"));
const semanticCaptions = JSON.parse(
  await readFile(resolve(config.semanticCaptionsFile ?? `${config.editDir}/captions-semantic.json`), "utf8"),
);
const layout = JSON.parse(await readFile(resolve(config.editDir, "layout-manifest.json"), "utf8"));
const terminologyProfile = config.terminologyProfileFile
  ? JSON.parse(await readFile(resolve(config.terminologyProfileFile), "utf8"))
  : undefined;
const imageEvidence = config.imageEvidenceManifestFile
  ? (JSON.parse(await readFile(resolve(config.imageEvidenceManifestFile), "utf8")).assets ?? [])
  : [];
const authoredVisualPlan = config.authoredVisualPlanFile
  ? JSON.parse(await readFile(resolve(config.authoredVisualPlanFile), "utf8"))
  : { schemaVersion: "1.0", sections: [] };
let lockedNarrationForRanges;
if (config.authoredVisualPlanFile) {
  try {
    lockedNarrationForRanges = JSON.parse(
      await readFile(resolve(dirname(config.authoredVisualPlanFile), "narration-package.json"), "utf8"),
    );
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}
for (const beat of authoredVisualPlan.beats ?? []) {
  if (!authoredVisualEntryIsLocked(authoredVisualPlan, beat)) continue;
  const quoteSha256 = createHash("sha256").update(beat.exactSpokenQuote).digest("hex");
  if (beat.exactSpokenQuoteSha256 && beat.exactSpokenQuoteSha256 !== quoteSha256)
    throw new Error(`Visual beat ${beat.id} exact-spoken-quote hash binding is stale`);
  if (authoredVisualPlan.finalScriptSha256 && beat.finalScriptSha256 !== authoredVisualPlan.finalScriptSha256)
    throw new Error(`Visual beat ${beat.id} final-script hash binding is stale`);
}
const endAnchorForLegacyConstraint = (constraint) => {
  if (constraint.endAnchorText?.trim()) return constraint.endAnchorText;
  const spokenText =
    constraint.sectionId === "overview"
      ? lockedNarrationForRanges?.overview
      : lockedNarrationForRanges?.sections?.find((section) => section.id === constraint.sectionId)?.narration;
  return typeof spokenText === "string" ? spokenText.replace(/\s+/g, "").trim().slice(-42) : undefined;
};
const legacyAuthoredVisualConstraints = (authoredVisualPlan.sections ?? []).filter((section) =>
  authoredVisualEntryIsLocked(authoredVisualPlan, section),
);
// Exact Visual Beats are materialized separately from the section fallback.
// Feeding them into the legacy segment router would replace an entire semantic
// segment merely because one exact phrase overlaps it.
const componentVisualBeats = (authoredVisualPlan.beats ?? []).filter(
  (beat) =>
    beat.status === "confirmed" &&
    beat.primaryVisualType === "component" &&
    authoredVisualEntryIsLocked(authoredVisualPlan, beat),
);
const authoredVisualConstraints = legacyAuthoredVisualConstraints.map((constraint) => {
  const resolved = resolveAuthoredVisualRange(
    { anchorText: constraint.anchorText, endAnchorText: endAnchorForLegacyConstraint(constraint) },
    semanticCaptions,
  );
  if (!resolved)
    throw new Error(`Confirmed visual storyboard anchor was not found in semantic captions: ${constraint.sectionId}`);
  return { ...constraint, startCue: resolved.startCue, endCue: resolved.endCue, anchorScore: resolved.score };
});
const consumedVisualConstraints = new Set();
const visualConstraintFailures = new Map();
let informationConstraintOwners = new Map();
const semanticTextForIntent = (intent) =>
  semanticCaptions
    .slice(intent.startCue, intent.endCue + 1)
    .map((caption) => caption.zh ?? "")
    .join("");
const matchesConstraintRhetoric = (constraint, intent) =>
  constraint.mode === "information" &&
  (constraint.componentId
    ? visualRhetoricByComponent[constraint.componentId] ===
      normalizeRoutingIntent(intent, semanticTextForIntent(intent)).rhetoric
    : NARRATION_VISUAL_FORMS.find((form) => form.id === constraint.form)?.componentCoverage.some(
        (componentId) =>
          visualRhetoricByComponent[componentId] ===
          normalizeRoutingIntent(intent, semanticTextForIntent(intent)).rhetoric,
      ));
const semanticItemKey = (item) =>
  [item.label, item.detail, item.displayValue, item.timeLabel, item.entityId]
    .map((value) => String(value ?? ""))
    .join("|");

const aggregateConstraintIntent = (constraint, intents, owner) => {
  const related = intents.filter(
    (intent) => constraint.startCue <= intent.endCue && constraint.endCue >= intent.startCue,
  );
  const aggregatedItems = [];
  const seen = new Set();
  for (const item of related.flatMap((intent) => intent.items)) {
    const key = semanticItemKey(item);
    if (!item.label?.trim() || seen.has(key)) continue;
    seen.add(key);
    aggregatedItems.push(item);
  }
  const supportingNarratives = related
    .filter((intent) => intent !== owner && intent.narrative.title?.trim())
    .map((intent) => ({
      title: intent.narrative.title.trim(),
      startCue: intent.startCue,
      endCue: intent.endCue,
    }));
  const ownerItems = owner.items.map((item, index) => ({
    ...item,
    detail: item.detail?.trim() || supportingNarratives[index]?.title || item.label,
    ...(item.detail?.trim() || !supportingNarratives[index]
      ? {}
      : { startCue: supportingNarratives[index].startCue, endCue: supportingNarratives[index].endCue }),
  }));
  return {
    ...owner,
    visualPriority: "high",
    confidence: Math.max(owner.confidence, ...related.map((intent) => intent.confidence)),
    rhetoric: visualRhetoricByComponent[constraint.componentId],
    items: ownerItems.length ? ownerItems : aggregatedItems,
  };
};

const sourceToOutput = (seconds) => {
  const range = edl.ranges.find((item) => seconds >= item.start && seconds <= item.end);
  if (range) return seconds - range.start + range.outputStart;
  const next = edl.ranges.find((item) => item.start > seconds);
  return next ? next.outputStart : edl.totalDurationS;
};
const withLayoutTemplate = (cue) => {
  const generatedVisual = cue.generatedVisual;
  const layoutTemplateId = selectLayoutTemplate({
    componentId: generatedVisual.component.id,
    componentProps: generatedVisual.props,
    faceCenterX: layout.faceCenterX,
  });
  return {
    ...cue,
    generatedVisual: {
      ...generatedVisual,
      motion:
        generatedVisual.motion ??
        resolveMotionSelection({
          componentId: generatedVisual.component.id,
          allowCandidates: false,
        }),
    },
    layoutTemplateId,
    contentScale: selectContentScale({ componentId: generatedVisual.component.id, layoutTemplateId }),
  };
};
const semanticConfig = config.semanticPlanning ?? { provider: "fixture" };
let overlayCues;
let videoIdentity;
const directionCandidates = [];
if (semanticConfig.provider === "fixture") {
  overlayCues = workflowTestOverlayCues.map((cue) => {
    validateComponentProps(cue.generatedVisual.component.id, cue.generatedVisual.props);
    const start = sourceToOutput(cue.start);
    const end = sourceToOutput(cue.end);
    return withLayoutTemplate({
      ...cue,
      start,
      end,
      generatedVisual: { ...cue.generatedVisual, segment: { ...cue.generatedVisual.segment, start, end } },
    });
  });
} else if (semanticConfig.provider === "mimo") {
  const adapter = createMimoJsonAdapter({ config: semanticConfig });
  const segments = groupCaptionSegments(semanticCaptions, semanticConfig);
  overlayCues = [];
  for (const segment of segments) {
    const generatedVisual = await generateVisualBrief(segment, adapter, "production", terminologyProfile);
    if (generatedVisual.analysis.visualPriority === "skip") {
      console.log(`skipped visual ${segment.id}: low semantic value`);
      continue;
    }
    const minimumVisibleSeconds = config.visualDirection?.minimumVisibleSeconds ?? 2.2;
    const inset = Math.min(0.35, Math.max(0, (segment.end - segment.start - minimumVisibleSeconds) / 2));
    overlayCues.push(
      withLayoutTemplate({
        start: segment.start + inset,
        end: segment.end - inset,
        eyebrow: generatedVisual.narrative.eyebrow,
        title: generatedVisual.narrative.title,
        subtitle: generatedVisual.narrative.subtitleZh,
        subtitleEn: generatedVisual.narrative.subtitleEn,
        accent: "#6EA8FF",
        generatedVisual,
      }),
    );
    console.log(`planned ${overlayCues.length}/${segments.length}: ${generatedVisual.component.id}`);
  }
} else if (["codex-cli", "claude-code"].includes(semanticConfig.provider)) {
  const rawPlan = JSON.parse(
    await readFile(
      resolve(config.semanticNarrativePlanFile ?? `${config.editDir}/semantic-narrative-plan.json`),
      "utf8",
    ),
  );
  const narrativePlan = parseSemanticNarrativePlan(rawPlan, semanticCaptions);
  informationConstraintOwners = selectInformationConstraintOwners({
    constraints: authoredVisualConstraints,
    intents: narrativePlan.segments,
    matchesRhetoric: matchesConstraintRhetoric,
  });
  const globalSemanticSource = [
    ...semanticCaptions.flatMap((cue) => [cue.zh, cue.en]),
    ...imageEvidence.flatMap((asset) => [asset.description, asset.sourceLabel, asset.anchorText]),
  ]
    .filter((value) => typeof value === "string" && value.trim())
    .join("\n");
  const identityGrounding = evaluateSourceGrounding({
    outputText: semanticVideoIdentityClaimText(narrativePlan),
    sourceText: globalSemanticSource,
  });
  if (identityGrounding.unsupportedSourceTerms.length)
    throw new Error(
      `Semantic video identity contains unsupported source facts: ${identityGrounding.unsupportedSourceTerms.join(", ")}`,
    );
  videoIdentity = narrativePlan.videoIdentity;
  overlayCues = [];
  let previousPersonId;
  for (const [index, intent] of narrativePlan.segments.entries()) {
    const authoredConstraint = resolveAuthoredVisualConstraint({
      constraints: authoredVisualConstraints,
      intent,
      semanticIndex: index,
      informationOwners: informationConstraintOwners,
      matchesRhetoric: matchesConstraintRhetoric,
    });
    if (authoredConstraint?.mode === "speaker-only") {
      consumedVisualConstraints.add(authoredConstraint.sectionId);
      directionCandidates.push({
        id: `segment-${index + 1}`,
        semanticIndex: index,
        startCue: intent.startCue,
        endCue: intent.endCue,
        start: semanticCaptions[intent.startCue].start,
        end: semanticCaptions[intent.endCue].end,
        visualPriority: intent.visualPriority,
        confidence: intent.confidence,
        rhetoric: intent.rhetoric,
        reason: intent.reason,
        materializationStatus: "skipped",
        materializationReason: "Confirmed creator storyboard requires speaker-only video (strict).",
      });
      continue;
    }
    const sourceIntent =
      authoredConstraint?.mode === "information"
        ? aggregateConstraintIntent(authoredConstraint, narrativePlan.segments, intent)
        : intent;
    const constrainedSourceIntent = sourceIntent;
    const evidenceBounds = boundImageEvidenceIntentToCaptions(
      constrainedSourceIntent,
      semanticCaptions,
      imageEvidence,
      `segment-${index + 1}`,
    );
    if (evidenceBounds.status === "blocked") {
      directionCandidates.push({
        id: `segment-${index + 1}`,
        semanticIndex: index,
        startCue: intent.startCue,
        endCue: intent.endCue,
        start: semanticCaptions[intent.startCue].start,
        end: semanticCaptions[intent.endCue].end,
        visualPriority: intent.visualPriority,
        confidence: intent.confidence,
        rhetoric: intent.rhetoric,
        reason: intent.reason,
        materializationStatus: "blocked",
        materializationReason: evidenceBounds.reason,
      });
      console.log(`blocked visual segment-${index + 1}: ${evidenceBounds.reason}`);
      continue;
    }
    const boundedIntent = evidenceBounds.intent;
    const segment = evidenceBounds.segment;
    const creatorRoutedIntent =
      authoredConstraint?.mode === "information" && authoredConstraint.componentId
        ? {
            ...normalizeRoutingIntent(
              { ...boundedIntent, rhetoric: visualRhetoricByComponent[authoredConstraint.componentId] },
              segment.text,
            ),
            rhetoric: visualRhetoricByComponent[authoredConstraint.componentId],
          }
        : boundedIntent;
    let locallyRoutedIntent =
      authoredConstraint?.mode === "information"
        ? creatorRoutedIntent
        : normalizeRoutingIntent(creatorRoutedIntent, segment.text);
    if (authoredConstraint?.mode === "speaker") consumedVisualConstraints.add(authoredConstraint.sectionId);
    const referencedImage = boundedIntent.imageEvidence
      ? imageEvidence.find((asset) => asset.id === boundedIntent.imageEvidence.assetId)
      : undefined;
    const refersToAntecedent = /(?:它们|这些|上述|两者)/.test(segment.text);
    const antecedentIntent = refersToAntecedent ? narrativePlan.segments[index - 1] : undefined;
    const groundingCaptionStart = antecedentIntent ? antecedentIntent.startCue : boundedIntent.startCue;
    const groundingCaptionText = semanticCaptions
      .slice(groundingCaptionStart, boundedIntent.endCue + 1)
      .map((caption) => caption.zh ?? "")
      .join("");
    const groundingIntent = antecedentIntent ?? boundedIntent;
    const itemCountEvidence =
      deriveNamedItemCountEvidence({
        labels: groundingIntent.items.map((item) => item.label),
        sourceText: groundingCaptionText,
      }) ??
      (groundingIntent.items.length > 1 &&
      groundingIntent.items.every(
        (item) =>
          Number.isInteger(item.startCue) &&
          Number.isInteger(item.endCue) &&
          item.startCue >= groundingCaptionStart &&
          item.endCue <= boundedIntent.endCue,
      )
        ? `${groundingIntent.items.length}项`
        : undefined);
    const segmentGrounding = evaluateSourceGrounding({
      outputText: locallyRoutedIntent.roughAnnotation?.targets.length
        ? locallyRoutedIntent.roughAnnotation.targets.join("\n")
        : semanticSegmentClaimText(locallyRoutedIntent),
      sourceText: [
        segment.text,
        segment.subtitleEn,
        referencedImage?.description,
        referencedImage?.sourceLabel,
        referencedImage?.anchorText,
        itemCountEvidence,
      ]
        .filter((value) => typeof value === "string" && value.trim())
        .join("\n"),
    });
    if (segmentGrounding.unsupportedSourceTerms.length) {
      directionCandidates.push({
        id: segment.id,
        semanticIndex: index,
        startCue: boundedIntent.startCue,
        endCue: boundedIntent.endCue,
        start: segment.start,
        end: segment.end,
        visualPriority: boundedIntent.visualPriority,
        confidence: boundedIntent.confidence,
        rhetoric: boundedIntent.rhetoric,
        reason: boundedIntent.reason,
        materializationStatus: "blocked",
        materializationReason: `Unsupported source facts: ${segmentGrounding.unsupportedSourceTerms.join(", ")}`,
      });
      console.log(
        `blocked visual ${segment.id}: unsupported source facts ${segmentGrounding.unsupportedSourceTerms.join(", ")}`,
      );
      continue;
    }
    const minimumVisibleSeconds = config.visualDirection?.minimumVisibleSeconds ?? 2.2;
    const inset = Math.min(0.35, Math.max(0, (segment.end - segment.start - minimumVisibleSeconds) / 2));
    const antecedentTargets = antecedentIntent?.items.map((item) => item.label).filter(Boolean) ?? [];
    const crossOutAntecedent =
      refersToAntecedent && /划掉/.test(segment.text) && antecedentTargets.length
        ? {
            ...creatorRoutedIntent,
            rhetoric: "rough-annotation",
            roughAnnotation: { intent: "negation", targets: antecedentTargets },
          }
        : creatorRoutedIntent;
    locallyRoutedIntent =
      authoredConstraint?.mode === "information"
        ? creatorRoutedIntent
        : authoredConstraint?.mode === "speaker"
          ? locallyRoutedIntent
          : normalizeRoutingIntent(crossOutAntecedent, segment.text);
    const evidenceStart = semanticEvidenceStartSeconds(locallyRoutedIntent, semanticCaptions, segment.start);
    // Preserve evidence-timed structured components inside reviewed “人物” sections.
    // Only a later fallback annotation starts at the segment boundary to fill an
    // otherwise empty speaker interval.
    let overlayStart =
      authoredConstraint?.mode === "information" || authoredConstraint?.mode === "speaker"
        ? segment.start + inset
        : Math.min(segment.end - inset, Math.max(segment.start + inset, evidenceStart));
    let materialized = materializeSemanticIntent(segment, locallyRoutedIntent, terminologyProfile, imageEvidence, {
      captions: semanticCaptions,
      originSeconds: overlayStart,
    });
    if (
      materialized.status === "skipped" &&
      (!authoredConstraint || authoredConstraint.mode === "auto" || authoredConstraint.mode === "speaker")
    ) {
      const annotation = resolveSpeakerRoughAnnotationPlan(segment.text, locallyRoutedIntent);
      if (annotation) {
        overlayStart = segment.start + inset;
        materialized = materializeSemanticIntent(
          segment,
          withLocalRoughAnnotationPlan(locallyRoutedIntent, annotation),
          terminologyProfile,
          imageEvidence,
          { captions: semanticCaptions, originSeconds: overlayStart },
        );
      }
    }
    const candidateBase = {
      id: segment.id,
      semanticIndex: index,
      startCue: boundedIntent.startCue,
      endCue: boundedIntent.endCue,
      start: segment.start,
      end: segment.end,
      visualPriority: boundedIntent.visualPriority,
      confidence: boundedIntent.confidence,
      rhetoric: boundedIntent.rhetoric,
      reason: boundedIntent.reason,
      creatorConstraint: authoredConstraint
        ? {
            sectionId: authoredConstraint.sectionId,
            mode: authoredConstraint.mode,
            ...(authoredConstraint.visualBeatId ? { visualBeatId: authoredConstraint.visualBeatId } : {}),
          }
        : undefined,
    };
    if (materialized.status === "skipped") {
      if (authoredConstraint?.mode === "information")
        visualConstraintFailures.set(authoredConstraint.sectionId, materialized.reason);
      directionCandidates.push({
        ...candidateBase,
        materializationStatus: "skipped",
        materializationReason: materialized.reason,
      });
      console.log(`skipped visual ${segment.id}: ${materialized.reason}`);
      continue;
    }
    const generatedVisual = materialized.brief;
    if (authoredConstraint?.mode === "material" && authoredConstraint.visualBeatId) {
      const assetId = generatedVisual.props?.assetId;
      if (
        generatedVisual.component.id !== "image-evidence-inset" ||
        !authoredConstraint.materialAssetId ||
        typeof assetId !== "string" ||
        !assetId.startsWith(authoredConstraint.materialAssetId)
      ) {
        visualConstraintFailures.set(
          authoredConstraint.sectionId,
          `expected bound image evidence ${authoredConstraint.materialAssetId ?? "unknown"}`,
        );
        directionCandidates.push({
          ...candidateBase,
          materializationStatus: "skipped",
          materializationReason: `Confirmed image beat requires its bound local evidence; ${generatedVisual.component.id} was not substituted.`,
        });
        continue;
      }
      consumedVisualConstraints.add(authoredConstraint.sectionId);
    }
    if (authoredConstraint?.mode === "information") {
      if (generatedVisual.component.id !== authoredConstraint.componentId) {
        visualConstraintFailures.set(
          authoredConstraint.sectionId,
          `deterministic evidence routing produced ${generatedVisual.component.id}`,
        );
        directionCandidates.push({
          ...candidateBase,
          materializationStatus: "skipped",
          materializationReason:
            `Confirmed creator storyboard reserves this passage for ${authoredConstraint.componentId}; ` +
            `${generatedVisual.component.id} was not substituted.`,
        });
        continue;
      }
      consumedVisualConstraints.add(authoredConstraint.sectionId);
    }
    const personId = generatedVisual.analysis.mediaIntents?.find((item) => item.kind === "person")?.entityId;
    if (generatedVisual.component.id === "person-evidence-card" && personId && personId === previousPersonId) {
      directionCandidates.push({
        ...candidateBase,
        materializationStatus: "skipped",
        materializationReason: `Consecutive person evidence for ${personId}`,
      });
      console.log(`skipped visual ${segment.id}: consecutive person evidence for ${personId}`);
      continue;
    }
    previousPersonId = generatedVisual.component.id === "person-evidence-card" ? personId : undefined;
    const overlayCue = withLayoutTemplate({
      start: overlayStart,
      end: segment.end - inset,
      eyebrow: generatedVisual.narrative.eyebrow,
      title: generatedVisual.narrative.title,
      subtitle: generatedVisual.narrative.subtitleZh,
      subtitleEn: generatedVisual.narrative.subtitleEn,
      accent: "#6EA8FF",
      generatedVisual,
    });
    overlayCues.push(overlayCue);
    directionCandidates.push({ ...candidateBase, materializationStatus: "planned", overlayCue });
    console.log(`planned ${overlayCues.length}/${narrativePlan.segments.length}: ${generatedVisual.component.id}`);
  }

  for (const beat of componentVisualBeats) {
    const resolved = resolveExactSpokenQuoteCaptionRange(
      beat.exactSpokenQuote,
      beat.quoteOccurrence ?? 1,
      semanticCaptions,
    );
    if (!resolved) throw new Error(`Confirmed component beat anchor was not found: ${beat.id}`);
    const form = NARRATION_VISUAL_FORMS.find((item) => item.id === beat.semanticForm);
    const componentIds = beat.componentId ? [beat.componentId] : [...(form?.componentCoverage ?? [])];
    if (!form || componentIds.length === 0)
      throw new Error(`Confirmed component beat ${beat.id} has no supported component form`);
    const owners = narrativePlan.segments
      .map((intent, semanticIndex) => ({ intent, semanticIndex }))
      .filter(({ intent }) => resolved.startCue <= intent.endCue && resolved.endCue >= intent.startCue)
      .sort((left, right) => {
        const leftOverlap =
          Math.min(resolved.endCue, left.intent.endCue) - Math.max(resolved.startCue, left.intent.startCue) + 1;
        const rightOverlap =
          Math.min(resolved.endCue, right.intent.endCue) - Math.max(resolved.startCue, right.intent.startCue) + 1;
        return rightOverlap - leftOverlap || right.intent.confidence - left.intent.confidence;
      });
    const owner =
      owners[0] ??
      (beat.semanticForm === "text-emphasis"
        ? {
            semanticIndex: -1,
            intent: {
              startCue: resolved.startCue,
              endCue: resolved.endCue,
              visualPriority: "high",
              rhetoric: "none",
              motionIntent: "emphasize",
              reason: "Creator-confirmed exact text emphasis.",
              confidence: 1,
              narrative: {
                eyebrow: "[KEY POINT]",
                title: beat.exactSpokenQuote,
                subtitleZh: beat.exactSpokenQuote,
                subtitleEn: "",
                takeaway: beat.exactSpokenQuote,
              },
              items: [],
              timeSeries: [],
              matrix: {
                rows: [],
                columns: [],
                values: [],
                states: [],
                xLabel: "",
                yLabel: "",
              },
              quote: { text: "", sourceName: "", sourceRole: "" },
              mediaIntents: [],
              imageEvidence: null,
            },
          }
        : undefined);
    if (!owner) throw new Error(`Confirmed component beat ${beat.id} has no overlapping semantic evidence`);
    const start = semanticCaptions[resolved.startCue]?.start;
    const end = semanticCaptions[resolved.endCue]?.end;
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
      throw new Error(`Confirmed component beat ${beat.id} resolved to invalid timing`);
    const text = semanticCaptions
      .slice(resolved.startCue, resolved.endCue + 1)
      .map((caption) => caption.zh ?? "")
      .join("");
    const subtitleEn = semanticCaptions
      .slice(resolved.startCue, resolved.endCue + 1)
      .map((caption) => caption.en ?? "")
      .join(" ")
      .trim();
    const segment = {
      id: `visual-beat-${beat.id}`,
      start,
      end,
      text,
      ...(subtitleEn ? { subtitleEn } : {}),
    };
    const baseIntent = {
      ...boundSemanticIntentItems(owner.intent, resolved.startCue, resolved.endCue),
      visualPriority: "high",
      confidence: Math.max(0.9, owner.intent.confidence),
    };
    const target = beat.exactSpokenQuote
      .trim()
      .replace(/^[“《〈『「"']+|[”》〉』」"'。，；！？,.!?;]+$/g, "")
      .trim();
    const constraintId = `${beat.sectionId}:${beat.id}`;
    const attempts = componentIds.flatMap((componentId) => {
      const boundedComponentIntent =
        componentId === "binary-versus"
          ? withConfirmedComparisonItems(baseIntent, text, resolved.startCue, resolved.endCue)
          : baseIntent;
      const componentIntents = [boundedComponentIntent];
      if (
        ["decision-matrix", "tradeoff-scale"].includes(componentId) &&
        baseIntent.items.length < owner.intent.items.length
      )
        componentIntents.push({
          ...owner.intent,
          startCue: resolved.startCue,
          endCue: resolved.endCue,
          visualPriority: "high",
          confidence: Math.max(0.9, owner.intent.confidence),
        });
      return componentIntents.map((componentBaseIntent) => {
        const routedIntent =
          beat.semanticForm === "text-emphasis"
            ? withLocalRoughAnnotationPlan(componentBaseIntent, {
                intent: "focus-concept",
                targets: [target],
                annotations: [{ target, intent: "focus-concept" }],
              })
            : {
                ...componentBaseIntent,
                rhetoric: visualRhetoricByComponent[componentId],
              };
        let materialized;
        try {
          materialized = materializeSemanticIntent(segment, routedIntent, terminologyProfile, imageEvidence, {
            captions: semanticCaptions,
            originSeconds: start,
            preserveExplicitRhetoric: true,
          });
        } catch (error) {
          materialized = {
            status: "skipped",
            reason: `Invalid component candidate: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
        return { componentId, routedIntent, materialized };
      });
    });
    const selectedAttempt = attempts.find(
      (attempt) =>
        attempt.materialized.status === "planned" && attempt.materialized.brief.component.id === attempt.componentId,
    );
    if (!selectedAttempt) {
      const reasons = attempts
        .map((attempt) =>
          attempt.materialized.status === "skipped"
            ? `${attempt.componentId}: ${attempt.materialized.reason}`
            : `${attempt.componentId}: received ${attempt.materialized.brief.component.id}`,
        )
        .join("; ");
      throw new Error(`Confirmed component beat ${constraintId} could not be materialized: ${reasons}`);
    }
    const { componentId, routedIntent } = selectedAttempt;
    const materialized = selectedAttempt.materialized;
    if (materialized.status !== "planned") throw new Error(`Confirmed component beat ${constraintId} is invalid`);
    const overlayCue = withLayoutTemplate({
      start,
      end,
      eyebrow: materialized.brief.narrative.eyebrow,
      title: materialized.brief.narrative.title,
      subtitle: materialized.brief.narrative.subtitleZh,
      subtitleEn: materialized.brief.narrative.subtitleEn,
      accent: "#6EA8FF",
      generatedVisual: materialized.brief,
    });
    overlayCues.push(overlayCue);
    directionCandidates.push({
      id: `visual-beat-${beat.id}`,
      semanticIndex: owner.semanticIndex,
      startCue: resolved.startCue,
      endCue: resolved.endCue,
      start,
      end,
      visualPriority: "high",
      confidence: Math.max(0.9, owner.intent.confidence),
      rhetoric: routedIntent.rhetoric,
      reason: `Creator-confirmed exact component Beat: ${beat.exactSpokenQuote}`,
      creatorConstraint: { sectionId: beat.sectionId, mode: "information", visualBeatId: beat.id },
      materializationStatus: "planned",
      overlayCue,
    });
    consumedVisualConstraints.add(constraintId);
    console.log(`planned exact component beat ${beat.id}: ${componentId}`);
  }
} else {
  throw new Error(`Unsupported semantic planning provider: ${semanticConfig.provider}`);
}
for (const constraint of authoredVisualConstraints.filter((item) => item.mode === "information")) {
  if (!consumedVisualConstraints.has(constraint.sectionId))
    throw new Error(
      `Confirmed visual storyboard was not applied: ${constraint.sectionId}. ` +
        `${visualConstraintFailures.get(constraint.sectionId) ?? "No compatible semantic evidence was found."}`,
    );
}
const plan = {
  schemaVersion: "1.0",
  status: "review",
  source: config.source,
  edl: `${config.editDir}/edl.json`,
  captions: `${config.editDir}/captions-verbatim.json`,
  semanticCaptions: config.semanticCaptionsFile ?? `${config.editDir}/captions-semantic.json`,
  semanticNarrativePlan: ["codex-cli", "claude-code"].includes(semanticConfig.provider)
    ? (config.semanticNarrativePlanFile ?? `${config.editDir}/semantic-narrative-plan.json`)
    : undefined,
  layout,
  assetProfile: config.assetProfile,
  terminology: terminologyProfile
    ? {
        schemaVersion: terminologyProfile.schemaVersion,
        domains: terminologyProfile.domains,
        entryCount: terminologyProfile.entries.length,
      }
    : undefined,
  videoIdentity,
  overlayCues,
};
const planPath = resolve(config.planningFile ?? "planning/visual-brief.json");
const reviewProps = {
  headline: "中小实验室 AI 工作台",
  chapter: "WORKFLOW TEST",
  speaker: "",
  subtitle: "",
  subtitleEn: "",
  timelineLabel: "",
  cards: [],
  keywords: [],
  videoSrc: config.reviewVideoSrc ?? "test/review-cut-1080p.mp4",
  overlayCues,
  titleCues: [],
  subtitleCues: captions,
  overlayScale: layout.overlayScale,
  overlaySide: layout.overlaySide,
  layoutTemplateId: layout.layoutTemplateId,
  typography: config.typographyPolicy ?? { version: "typography-2.0", mode: "system-only" },
};
const deliveryProps = {
  headline: "中小实验室 AI 工作台",
  chapter: "WORKFLOW TEST",
  speaker: "",
  subtitle: "",
  subtitleEn: "",
  timelineLabel: "",
  cards: [],
  keywords: [],
  videoSrc: config.deliveryVideoSrc ?? "test/final-cut-4k.mp4",
  overlayCues,
  titleCues: [],
  subtitleCues: captions,
  overlayScale: layout.overlayScale,
  overlaySide: layout.overlaySide,
  layoutTemplateId: layout.layoutTemplateId,
  typography: config.typographyPolicy ?? { version: "typography-2.0", mode: "system-only" },
};
if (config.componentCandidatesFile) {
  const candidatesPath = resolve(config.componentCandidatesFile);
  await mkdir(dirname(candidatesPath), { recursive: true });
  await writeFile(
    candidatesPath,
    `${JSON.stringify(
      {
        schemaVersion: "1.0",
        plan,
        reviewProps,
        deliveryProps,
        candidates: directionCandidates,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`${candidatesPath}: ${directionCandidates.length} direction candidates`);
  process.exit(0);
}
await mkdir(dirname(planPath), { recursive: true });
await writeFile(planPath, `${JSON.stringify(plan, null, 2)}\n`);
await writeFile(
  resolve(config.reviewPropsFile ?? `${config.editDir}/review-props.json`),
  `${JSON.stringify(reviewProps, null, 2)}\n`,
);
if (!config.reviewPropsFile) {
  const generatedPropsPath = resolve("src/data/generated-workflow-props.ts");
  const propsSource = `import type {OverlayProps} from "./sample-props";\n\nexport const generatedWorkflowProps = ${JSON.stringify(reviewProps, null, 2)} satisfies OverlayProps;\n`;
  await writeFile(generatedPropsPath, propsSource);
  await execFileAsync(resolve("node_modules/.bin/biome"), ["format", "--write", generatedPropsPath]);
}
await writeFile(
  resolve(config.finalPropsFile ?? `${config.editDir}/final-4k-props.json`),
  JSON.stringify(deliveryProps, null, 2),
);
console.log(`${planPath}: ${overlayCues.length} validated briefs`);
