import { animationPrototypeRegistry } from "./animation-registry.ts";
import type {
  AnimationIntent,
  AnimationStyleProfileId,
  PrimaryVisualType,
  ResolvedTextAnnotation,
  SpeakerPresenceMode,
  TakeoverMode,
  TextAnnotationEffect,
  VisualInterval,
} from "./types.ts";

type SemanticCaption = { start: number; end: number; zh: string };
type LockedVisualBeat = {
  id: string;
  sectionId: string;
  exactSpokenQuote: string;
  status: "suggested" | "confirmed";
  executionPolicy?: "reference" | "locked";
  primaryVisualType: PrimaryVisualType;
  takeover: TakeoverMode;
  speakerPresence: SpeakerPresenceMode;
  animationIntent?: AnimationIntent;
  materialAssetId?: string;
  materialAssetIds?: string[];
  quoteOccurrence?: number;
  exactSpokenQuoteSha256?: string;
  finalScriptSha256?: string;
};

type LockedTextAnnotation = {
  id: string;
  sectionId: string;
  exactSpokenQuote: string;
  quoteOccurrence?: number;
  status: "suggested" | "confirmed";
  origin?: "user" | "agent";
  executionPolicy?: "reference" | "locked";
  effect: TextAnnotationEffect;
  exactSpokenQuoteSha256?: string;
  finalScriptSha256?: string;
};

type LockedAnimationSection = {
  sectionId: string;
  mode: string;
  executionPolicy?: "reference" | "locked";
  anchorText: string;
  endAnchorText: string;
  animationAnchorText?: string;
  animationEndAnchorText?: string;
  animationIntent?: AnimationIntent;
};

type AuthoredVisualPlanVersion = { visualPlanContractVersion?: string };
export const authoredVisualEntryIsLocked = (
  plan: AuthoredVisualPlanVersion,
  entry: { origin?: "user" | "agent"; executionPolicy?: "reference" | "locked" },
  kind: "visual" | "annotation" = "visual",
) => {
  if (plan.visualPlanContractVersion === "4.0")
    return kind === "annotation" && entry.origin === "user" && entry.executionPolicy === "locked";
  return entry.executionPolicy === "locked" || entry.executionPolicy === undefined;
};

const normalizeSpokenText = (value: string) =>
  value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]/gu, "");

export const resolveExactSpokenQuoteCaptionRange = (quote: string, occurrence: number, captions: SemanticCaption[]) => {
  const cueByCharacter: number[] = [];
  let joined = "";
  captions.forEach((caption, cueIndex) => {
    const normalized = normalizeSpokenText(caption.zh);
    joined += normalized;
    cueByCharacter.push(...Array.from({ length: normalized.length }, () => cueIndex));
  });
  const needle = normalizeSpokenText(quote);
  if (!needle) return undefined;
  let from = 0;
  let startCharacter = -1;
  for (let index = 0; index < occurrence; index += 1) {
    startCharacter = joined.indexOf(needle, from);
    if (startCharacter < 0) return undefined;
    from = startCharacter + needle.length;
  }
  return {
    startCue: cueByCharacter[startCharacter],
    endCue: cueByCharacter[startCharacter + needle.length - 1],
  };
};

export type ResolvedAnimationCue = VisualInterval & {
  primaryVisualType: "animation";
  sectionId: string;
  startCue: number;
  endCue: number;
  animationIntent: AnimationIntent;
  styleProfileId: AnimationStyleProfileId;
};

export const resolveLockedVisualBeatTimeline = ({
  plan,
  captions,
}: {
  plan: AuthoredVisualPlanVersion & { beats?: LockedVisualBeat[]; finalScriptSha256?: string };
  captions: SemanticCaption[];
}) => {
  const intervals = (plan.beats ?? [])
    .filter((beat) => beat.status === "confirmed" && authoredVisualEntryIsLocked(plan, beat))
    .map((beat) => {
      if (plan.finalScriptSha256 && beat.finalScriptSha256 !== plan.finalScriptSha256)
        throw new Error(`Visual beat ${beat.id} final-script hash binding is stale`);
      const resolved = resolveExactSpokenQuoteCaptionRange(beat.exactSpokenQuote, beat.quoteOccurrence ?? 1, captions);
      if (!resolved) throw new Error(`Confirmed visual beat anchor was not found in semantic captions: ${beat.id}`);
      const start = captions[resolved.startCue]?.start;
      const end = captions[resolved.endCue]?.end;
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
        throw new Error(`Confirmed visual beat ${beat.id} resolved to invalid timing`);
      return {
        id: beat.id,
        sectionId: beat.sectionId,
        startCue: resolved.startCue,
        endCue: resolved.endCue,
        start,
        end,
        primaryVisualType: beat.primaryVisualType,
        takeover: beat.takeover,
        speakerPresence: beat.speakerPresence,
        ...(beat.materialAssetId ? { materialAssetId: beat.materialAssetId } : {}),
        ...(beat.materialAssetIds?.length ? { materialAssetIds: beat.materialAssetIds } : {}),
        ...(beat.animationIntent ? { animationIntent: beat.animationIntent } : {}),
      };
    })
    .sort((left, right) => left.start - right.start || left.end - right.end);
  for (let index = 1; index < intervals.length; index += 1) {
    if (intervals[index].start < intervals[index - 1].end - 0.001)
      throw new Error(`Resolved visual beats ${intervals[index - 1].id} and ${intervals[index].id} overlap`);
  }
  return intervals;
};

export const resolvedAnimationCues = (intervals: ReturnType<typeof resolveLockedVisualBeatTimeline>) =>
  intervals.flatMap((interval): ResolvedAnimationCue[] => {
    if (interval.primaryVisualType !== "animation" || !interval.animationIntent) return [];
    return [
      {
        ...interval,
        primaryVisualType: "animation",
        animationIntent: interval.animationIntent,
        styleProfileId: interval.animationIntent.styleProfileId,
      },
    ];
  });

export const applyAnimationStyleProfile = (
  cues: ResolvedAnimationCue[],
  styleProfileId: AnimationStyleProfileId,
): ResolvedAnimationCue[] =>
  cues.map((cue) => {
    if (!animationPrototypeRegistry[cue.animationIntent.prototypeId].compatibleStyleIds.includes(styleProfileId))
      throw new Error(`Animation style ${styleProfileId} is incompatible with ${cue.animationIntent.prototypeId}`);
    return {
      ...cue,
      styleProfileId,
      animationIntent: {
        ...cue.animationIntent,
        styleProfileId,
      },
    };
  });

export const resolveLockedTextAnnotationTimeline = ({
  plan,
  captions,
}: {
  plan: AuthoredVisualPlanVersion & { annotations?: LockedTextAnnotation[]; finalScriptSha256?: string };
  captions: SemanticCaption[];
}): ResolvedTextAnnotation[] =>
  (plan.annotations ?? [])
    .filter(
      (annotation) => annotation.status === "confirmed" && authoredVisualEntryIsLocked(plan, annotation, "annotation"),
    )
    .map((annotation) => {
      if (plan.finalScriptSha256 && annotation.finalScriptSha256 !== plan.finalScriptSha256)
        throw new Error(`Text annotation ${annotation.id} final-script hash binding is stale`);
      const resolved = resolveExactSpokenQuoteCaptionRange(
        annotation.exactSpokenQuote,
        annotation.quoteOccurrence ?? 1,
        captions,
      );
      if (!resolved) throw new Error(`Confirmed text annotation anchor was not found: ${annotation.id}`);
      const start = captions[resolved.startCue]?.start;
      const end = captions[resolved.endCue]?.end;
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
        throw new Error(`Confirmed text annotation ${annotation.id} resolved to invalid timing`);
      return {
        ...annotation,
        start,
        end,
        startCue: resolved.startCue,
        endCue: resolved.endCue,
      };
    })
    .sort((left, right) => left.start - right.start || left.end - right.end);

export const resolveLockedSectionAnimationTimeline = ({
  plan,
  captions,
}: {
  plan: AuthoredVisualPlanVersion & { sections?: LockedAnimationSection[] };
  captions: SemanticCaption[];
}): ResolvedAnimationCue[] =>
  (plan.sections ?? []).flatMap((section) => {
    if (section.mode !== "animation" || !section.animationIntent || !authoredVisualEntryIsLocked(plan, section))
      return [];
    const firstStageQuote = section.animationIntent.stages[0]?.spokenQuote;
    const lastStageQuote = section.animationIntent.stages.at(-1)?.spokenQuote;
    const startAnchor = section.animationAnchorText ?? firstStageQuote ?? section.anchorText;
    const endAnchor = section.animationEndAnchorText ?? lastStageQuote ?? section.endAnchorText;
    const startRange = resolveExactSpokenQuoteCaptionRange(startAnchor, 1, captions);
    const endRange = resolveExactSpokenQuoteCaptionRange(endAnchor, 1, captions);
    if (!startRange || !endRange)
      throw new Error(`Confirmed animation section anchor was not found: ${section.sectionId}`);
    const startCue = Math.min(startRange.startCue, endRange.startCue);
    const endCue = Math.max(startRange.endCue, endRange.endCue);
    const start = captions[startCue]?.start;
    const end = captions[endCue]?.end;
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
      throw new Error(`Confirmed animation section ${section.sectionId} resolved to invalid timing`);
    return [
      {
        id: `animation-${section.sectionId}`,
        sectionId: section.sectionId,
        startCue,
        endCue,
        start,
        end,
        primaryVisualType: "animation" as const,
        takeover: "full" as const,
        speakerPresence: "circle-pip" as const,
        animationIntent: section.animationIntent,
        styleProfileId: section.animationIntent.styleProfileId,
      },
    ];
  });

export const suppressCandidatesForPrimaryVisualIntervals = <
  Candidate extends {
    start: number;
    end: number;
    materializationStatus: string;
    materializationReason?: string;
    creatorConstraint?: { visualBeatId?: string };
  },
>(
  candidates: Candidate[],
  intervals: VisualInterval[],
) =>
  candidates.map((candidate) => {
    const owner = intervals.find(
      (interval) =>
        interval.start < candidate.end &&
        interval.end > candidate.start &&
        !(interval.primaryVisualType === "component" && candidate.creatorConstraint?.visualBeatId === interval.id),
    );
    if (!owner) return candidate;
    return {
      ...candidate,
      materializationStatus: "skipped",
      materializationReason: `Primary visual beat ${owner.id} reserves this interval for ${owner.primaryVisualType}.`,
      overlayCue: undefined,
    };
  });
