import { selectContentScale, selectLayoutTemplate } from "../layout-templates/selector.ts";
import { resolveMotionSelection } from "../motion-recipes/selector.ts";
import { compactComponentProps } from "../visual-brief/generator.ts";
import type { GeneratedVisualBrief } from "../visual-brief/types.ts";

type TimedInterval = { start: number; end: number };
type SemanticCaption = { start: number; end: number; zh: string; en?: string };

export type EditorialCoverageFillCue = {
  start: number;
  end: number;
  eyebrow: string;
  title: string;
  subtitle: string;
  subtitleEn: string;
  accent: string;
  generatedVisual: GeneratedVisualBrief;
  layoutTemplateId: ReturnType<typeof selectLayoutTemplate>;
  contentScale: number;
  coverageFill: true;
};

export type EditorialCoverageFillReport = {
  status: "not-needed" | "filled" | "partially-filled";
  targetSeconds: number;
  existingCoveredSeconds: number;
  deficitSeconds: number;
  longGapFillSeconds: number;
  planningTargetSeconds: number;
  editorialBudgetSeconds: number;
  plannedSeconds: number;
  predictedCoveredSeconds: number;
  remainingSeconds: number;
  remainingPlanningSeconds: number;
  cueIds: string[];
};

const rounded = (value: number) => Number(value.toFixed(3));

const mergeIntervals = (input: readonly TimedInterval[], durationSeconds: number) => {
  const ordered = input
    .map((interval) => ({
      start: Math.max(0, Math.min(durationSeconds, interval.start)),
      end: Math.max(0, Math.min(durationSeconds, interval.end)),
    }))
    .filter((interval) => interval.end > interval.start)
    .sort((left, right) => left.start - right.start || left.end - right.end);
  const merged: TimedInterval[] = [];
  for (const interval of ordered) {
    const prior = merged.at(-1);
    if (!prior || interval.start > prior.end + 0.001) merged.push({ ...interval });
    else prior.end = Math.max(prior.end, interval.end);
  }
  return merged;
};

const uncoveredIntervals = (covered: readonly TimedInterval[], durationSeconds: number) => {
  const gaps: TimedInterval[] = [];
  let cursor = 0;
  for (const interval of covered) {
    if (interval.start > cursor + 0.001) gaps.push({ start: cursor, end: interval.start });
    cursor = Math.max(cursor, interval.end);
  }
  if (cursor < durationSeconds - 0.001) gaps.push({ start: cursor, end: durationSeconds });
  return gaps;
};

const exactCaptionText = (captions: readonly SemanticCaption[], startCue: number, endCue: number) =>
  captions
    .slice(startCue, endCue + 1)
    .map((caption) => caption.zh.trim())
    .filter(Boolean)
    .join("");

const exactEnglishText = (captions: readonly SemanticCaption[], startCue: number, endCue: number) =>
  captions
    .slice(startCue, endCue + 1)
    .map((caption) => caption.en?.trim() ?? "")
    .filter(Boolean)
    .join(" ");

export const planEditorialCoverageFill = ({
  captions,
  coveredIntervals,
  existingEditorialCues = [],
  durationSeconds,
  minimumCoverageRatio,
  maximumEditorialCoverageRatio = 1,
  minimumDurationSeconds = 4,
  maximumDurationSeconds = 8,
  maximumConsecutive = 2,
  maximumSpeakerOnlyGapSeconds = Number.POSITIVE_INFINITY,
  faceCenterX = 0.5,
}: {
  captions: readonly SemanticCaption[];
  coveredIntervals: readonly TimedInterval[];
  existingEditorialCues?: readonly TimedInterval[];
  durationSeconds: number;
  minimumCoverageRatio: number;
  maximumEditorialCoverageRatio?: number;
  minimumDurationSeconds?: number;
  maximumDurationSeconds?: number;
  maximumConsecutive?: number;
  maximumSpeakerOnlyGapSeconds?: number;
  faceCenterX?: number;
}): { cues: EditorialCoverageFillCue[]; report: EditorialCoverageFillReport } => {
  const covered = mergeIntervals(coveredIntervals, durationSeconds);
  const existingCoveredSeconds = covered.reduce((total, interval) => total + interval.end - interval.start, 0);
  const targetSeconds = Math.max(0, durationSeconds * minimumCoverageRatio);
  const deficitSeconds = Math.max(0, targetSeconds - existingCoveredSeconds);
  const gaps = uncoveredIntervals(covered, durationSeconds);
  const longGapFillSeconds = Number.isFinite(maximumSpeakerOnlyGapSeconds)
    ? gaps.reduce((total, gap) => total + Math.max(0, gap.end - gap.start - maximumSpeakerOnlyGapSeconds), 0)
    : 0;
  const planningTargetSeconds = Math.max(deficitSeconds, longGapFillSeconds);
  const existingEditorialSeconds = mergeIntervals(existingEditorialCues, durationSeconds).reduce(
    (total, interval) => total + interval.end - interval.start,
    0,
  );
  const editorialBudgetSeconds = Math.max(
    0,
    durationSeconds * maximumEditorialCoverageRatio - existingEditorialSeconds,
  );
  const potentialCues: EditorialCoverageFillCue[] = [];

  if (planningTargetSeconds > 0.001 && editorialBudgetSeconds >= minimumDurationSeconds) {
    for (const gap of gaps) {
      let consecutive = 0;
      const eligible = captions
        .map((caption, index) => ({ ...caption, index }))
        .filter(
          (caption) =>
            caption.zh.trim() &&
            caption.start >= gap.start - 0.001 &&
            caption.end <= gap.end + 0.001 &&
            caption.end - caption.start >= 0.4,
        );
      let cursor = 0;
      while (
        cursor < eligible.length &&
        consecutive < maximumConsecutive &&
        editorialBudgetSeconds >= minimumDurationSeconds
      ) {
        const first = eligible[cursor];
        let last = first;
        let next = cursor + 1;
        while (
          last.end - first.start < minimumDurationSeconds &&
          next < eligible.length &&
          eligible[next].index === last.index + 1 &&
          eligible[next].end - first.start <= maximumDurationSeconds + 0.001
        ) {
          last = eligible[next];
          next += 1;
        }
        const available = maximumDurationSeconds;
        const end = Math.min(last.end, first.start + available);
        if (end - first.start < minimumDurationSeconds - 0.001) {
          cursor += 1;
          continue;
        }
        const text = exactCaptionText(captions, first.index, last.index);
        const subtitleEn = exactEnglishText(captions, first.index, last.index);
        if (!text) {
          cursor = next;
          continue;
        }
        const props = compactComponentProps("editorial-statement", {
          leadIn: "这一段的重点",
          emphasis: text,
          support: text,
        });
        const layoutTemplateId = selectLayoutTemplate({
          componentId: "editorial-statement",
          faceCenterX,
          componentProps: props,
        });
        const id = `coverage-fill-${potentialCues.length + 1}`;
        potentialCues.push({
          start: first.start,
          end,
          eyebrow: "CORE IDEA",
          title: String(props.emphasis),
          subtitle: String(props.support),
          subtitleEn,
          accent: "#6EA8FF",
          layoutTemplateId,
          contentScale: selectContentScale({ componentId: "editorial-statement", layoutTemplateId }),
          coverageFill: true,
          generatedVisual: {
            schemaVersion: "1.0",
            segment: { id, start: first.start, end, text, ...(subtitleEn ? { subtitleEn } : {}) },
            analysis: {
              rhetoric: "editorial-statement",
              visualPriority: "normal",
              motionIntent: "emphasize",
              mediaIntents: [],
            },
            component: {
              id: "editorial-statement",
              status: "approved",
              selectionReason: "Deterministic coverage filler for an otherwise speaker-only caption passage.",
            },
            motion: resolveMotionSelection({ componentId: "editorial-statement", intent: "emphasize" }),
            narrative: {
              eyebrow: "CORE IDEA",
              title: String(props.emphasis),
              subtitleZh: String(props.support),
              subtitleEn,
              takeaway: text,
            },
            textRoles: { segmentText: "caption", narrative: "display-copy", labels: "design-label" },
            props,
          },
        });
        consecutive += 1;
        cursor = Math.max(next, cursor + 1);
      }
    }
  }

  const editorialOverlap = (interval: TimedInterval) =>
    existingEditorialCues.some((cue) => interval.start < cue.end && interval.end > cue.start);
  const events = [
    ...covered
      .filter((interval) => !editorialOverlap(interval))
      .map((interval) => ({ kind: "reset" as const, interval })),
    ...existingEditorialCues.map((interval) => ({ kind: "existing" as const, interval })),
    ...potentialCues.map((cue) => ({ kind: "candidate" as const, interval: cue, cue })),
  ].sort(
    (left, right) =>
      left.interval.start - right.interval.start ||
      { reset: 0, existing: 1, candidate: 2 }[left.kind] - { reset: 0, existing: 1, candidate: 2 }[right.kind],
  );
  const cues: EditorialCoverageFillCue[] = [];
  let plannedSeconds = 0;
  let consecutive = 0;
  for (const event of events) {
    if (event.kind === "reset") {
      consecutive = 0;
      continue;
    }
    if (event.kind === "existing") {
      consecutive += 1;
      continue;
    }
    if (
      consecutive >= maximumConsecutive ||
      plannedSeconds + minimumDurationSeconds > editorialBudgetSeconds ||
      plannedSeconds + 0.001 >= planningTargetSeconds
    )
      continue;
    const acceptedDuration = Math.min(
      event.cue.end - event.cue.start,
      editorialBudgetSeconds - plannedSeconds,
      Math.max(minimumDurationSeconds, planningTargetSeconds - plannedSeconds),
    );
    if (acceptedDuration < minimumDurationSeconds - 0.001) continue;
    const accepted = {
      ...event.cue,
      end: event.cue.start + acceptedDuration,
      generatedVisual: {
        ...event.cue.generatedVisual,
        segment: {
          ...event.cue.generatedVisual.segment,
          end: event.cue.start + acceptedDuration,
        },
      },
    };
    cues.push(accepted);
    plannedSeconds += acceptedDuration;
    consecutive += 1;
  }

  const predictedCoveredSeconds = Math.min(durationSeconds, existingCoveredSeconds + plannedSeconds);
  const remainingSeconds = Math.max(0, targetSeconds - predictedCoveredSeconds);
  const remainingPlanningSeconds = Math.max(0, planningTargetSeconds - plannedSeconds);
  return {
    cues,
    report: {
      status:
        planningTargetSeconds <= 0.001
          ? "not-needed"
          : remainingSeconds <= 0.001 && remainingPlanningSeconds <= 0.001
            ? "filled"
            : "partially-filled",
      targetSeconds: rounded(targetSeconds),
      existingCoveredSeconds: rounded(existingCoveredSeconds),
      deficitSeconds: rounded(deficitSeconds),
      longGapFillSeconds: rounded(longGapFillSeconds),
      planningTargetSeconds: rounded(planningTargetSeconds),
      editorialBudgetSeconds: rounded(editorialBudgetSeconds),
      plannedSeconds: rounded(plannedSeconds),
      predictedCoveredSeconds: rounded(predictedCoveredSeconds),
      remainingSeconds: rounded(remainingSeconds),
      remainingPlanningSeconds: rounded(remainingPlanningSeconds),
      cueIds: cues.map((cue) => cue.generatedVisual.segment.id),
    },
  };
};
