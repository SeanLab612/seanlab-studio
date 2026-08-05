import type { SemanticNarrativeSegment } from "./types.ts";

export type SemanticTimingCaption = { start: number; end: number; zh?: string };

const orderedRhetorics = new Set([
  "comparison",
  "factor-sequence",
  "process-steps",
  "causal-chain",
  "historical-timeline",
  "rough-annotation",
  "editorial-statement",
]);

const boundedCue = (value: number | undefined, fallback: number, minimum: number, maximum: number) =>
  Number.isInteger(value) ? Math.max(minimum, Math.min(maximum, Number(value))) : fallback;

const inferredCue = (intent: SemanticNarrativeSegment, index: number) => {
  if (intent.items.length <= 1) return intent.startCue;
  const span = intent.endCue - intent.startCue;
  return Math.round(intent.startCue + (span * index) / (intent.items.length - 1));
};

export const itemEvidenceCue = (intent: SemanticNarrativeSegment, index: number) => {
  const item = intent.items[index];
  return boundedCue(item?.startCue, inferredCue(intent, index), intent.startCue, intent.endCue);
};

const targetCue = (intent: SemanticNarrativeSegment, captions: readonly SemanticTimingCaption[], target: string) => {
  const normalized = target.replace(/\s+/g, "").toLocaleLowerCase();
  if (!normalized) return undefined;
  for (let cue = intent.startCue; cue <= intent.endCue; cue += 1) {
    const text = (captions[cue]?.zh ?? "").replace(/\s+/g, "").toLocaleLowerCase();
    if (text.includes(normalized)) return cue;
  }
  return undefined;
};

export const semanticEvidenceStartSeconds = (
  intent: SemanticNarrativeSegment,
  captions: readonly SemanticTimingCaption[],
  fallback: number,
) => {
  if (intent.roughAnnotation?.targets.length) {
    const cue = targetCue(intent, captions, intent.roughAnnotation.targets[0]);
    if (cue !== undefined) return captions[cue]?.start ?? fallback;
  }
  const starts = intent.items
    .map((_, index) => captions[itemEvidenceCue(intent, index)]?.start)
    .filter(Number.isFinite);
  return starts.length ? Math.min(...(starts as number[])) : fallback;
};

export const activeIndexTimelineFor = (
  intent: SemanticNarrativeSegment,
  captions: readonly SemanticTimingCaption[],
  originSeconds: number,
) => {
  if (!orderedRhetorics.has(intent.rhetoric) || intent.items.length < 2) return undefined;
  const points: Array<{ at: number; index: number }> = [];
  for (const [index] of intent.items.entries()) {
    const roughTarget = intent.roughAnnotation?.targets[index];
    const cue = roughTarget
      ? (targetCue(intent, captions, roughTarget) ?? itemEvidenceCue(intent, index))
      : itemEvidenceCue(intent, index);
    const caption = captions[cue];
    const evidenceAt = Math.max(0, (caption?.start ?? originSeconds) - originSeconds);
    const priorAt = points.at(-1)?.at ?? -0.65;
    const latestSafeAt = Math.max(evidenceAt, (caption?.end ?? originSeconds) - originSeconds - 0.2);
    points.push({ at: Math.min(Math.max(evidenceAt, priorAt + 0.65), latestSafeAt), index });
  }
  return points;
};
