import type { VisualDirectionPlan } from "./types.ts";

type Interval = { start: number; end: number };
type QualityInput = {
  plan: VisualDirectionPlan;
  captions?: Array<{ zh?: string }>;
  screenScenes?: Interval[];
  brandIntervals?: Interval[];
  minimumEligibleCoverageRatio?: number;
  minimumMaterializationRatio?: number;
  minimumExplicitOpportunityCoverageRatio?: number;
  maximumUnexplainedSpeakerGapSeconds?: number;
};

const explicitOpportunity = (text: string) =>
  /(?:画面(?:就|会|可以|应该)|左右(?:两边)?(?:比较|对比)|逐项(?:出现|高亮|检查)|划掉|圈出|下划线|检查项|步骤依次|流程依次)/.test(
    text,
  );

const reservedPrimaryVisual = (decision: VisualDirectionPlan["decisions"][number]) =>
  decision.reasons.some(
    (reason) =>
      (reason.startsWith("Primary visual beat ") && reason.includes(" reserves this interval for ")) ||
      reason.startsWith("Suppressed by authored recording scene "),
  );

const duration = (interval: Interval) => Math.max(0, interval.end - interval.start);
const mergeIntervals = (values: Interval[]) => {
  const ordered = values.filter((item) => item.end > item.start).sort((a, b) => a.start - b.start);
  const merged: Interval[] = [];
  for (const interval of ordered) {
    const previous = merged.at(-1);
    if (!previous || interval.start > previous.end) merged.push({ ...interval });
    else previous.end = Math.max(previous.end, interval.end);
  }
  return merged;
};
const subtractIntervals = (source: Interval[], excluded: Interval[]) => {
  let remaining = mergeIntervals(source);
  for (const block of mergeIntervals(excluded)) {
    remaining = remaining.flatMap((item) => {
      if (block.end <= item.start || block.start >= item.end) return [item];
      return [
        { start: item.start, end: Math.min(item.end, block.start) },
        { start: Math.max(item.start, block.end), end: item.end },
      ].filter((part) => part.end > part.start);
    });
  }
  return remaining;
};
const overlapSeconds = (source: Interval[], coverage: Interval[]) =>
  subtractIntervals(source, []).reduce(
    (total, interval) =>
      total +
      mergeIntervals(coverage).reduce(
        (sum, item) => sum + Math.max(0, Math.min(interval.end, item.end) - Math.max(interval.start, item.start)),
        0,
      ),
    0,
  );

export const evaluateVisualDirectionQuality = ({
  plan,
  captions = [],
  screenScenes = [],
  brandIntervals = [],
  minimumEligibleCoverageRatio = 0.8,
  minimumMaterializationRatio = 0.8,
  minimumExplicitOpportunityCoverageRatio = 0.8,
  maximumUnexplainedSpeakerGapSeconds = 15,
}: QualityInput) => {
  const excluded = [...screenScenes, ...brandIntervals];
  const eligibleSource = subtractIntervals(
    plan.decisions.map((item) => ({ start: item.sourceStart, end: item.sourceEnd })),
    excluded,
  );
  const coverage = mergeIntervals([
    ...plan.decisions
      .filter((item) => item.action === "show" && item.displayStart !== null && item.displayEnd !== null)
      .map((item) => ({ start: item.displayStart as number, end: item.displayEnd as number })),
    ...plan.decisions.filter(reservedPrimaryVisual).map((item) => ({ start: item.sourceStart, end: item.sourceEnd })),
    ...(plan.titleCues ?? []).map((item) => ({ start: item.start, end: item.end })),
  ]);
  const eligibleSeconds = eligibleSource.reduce((total, item) => total + duration(item), 0);
  const coveredSeconds = overlapSeconds(eligibleSource, coverage);
  const coverageRatio = eligibleSeconds > 0 ? coveredSeconds / eligibleSeconds : 1;
  const eligibleDecisions = plan.decisions.filter(
    (decision) =>
      !decision.reasons.some((reason) => reason.includes("Confirmed creator storyboard requires speaker-only video")) &&
      subtractIntervals([{ start: decision.sourceStart, end: decision.sourceEnd }], excluded).length > 0,
  );
  const materialized = eligibleDecisions.filter((item) => item.componentId !== null || reservedPrimaryVisual(item));
  const materializationRatio = eligibleDecisions.length > 0 ? materialized.length / eligibleDecisions.length : 1;
  const components = materialized.flatMap((item) => (item.componentId ? [item.componentId] : []));
  const uniqueComponents = new Set(components).size;
  const requiredUniqueComponents =
    materialized.length >= 3 ? Math.min(3, Math.max(2, Math.ceil(materialized.length * 0.25))) : 1;
  let longestRepeat = 0;
  let currentRepeat = 0;
  let previous: string | undefined;
  const shownComponents = plan.decisions
    .filter((item) => item.action === "show" && item.componentId !== null)
    .map((item) => item.componentId as string);
  for (const component of shownComponents) {
    currentRepeat = component === previous ? currentRepeat + 1 : 1;
    longestRepeat = Math.max(longestRepeat, currentRepeat);
    previous = component;
  }
  const opportunityCueIndices = captions.flatMap((caption, index) =>
    explicitOpportunity(caption.zh ?? "") ? [index] : [],
  );
  const coveredOpportunityCount = opportunityCueIndices.filter((cue) =>
    plan.decisions.some(
      (decision) =>
        (decision.action === "show" || reservedPrimaryVisual(decision)) &&
        cue >= decision.startCue &&
        cue <= decision.endCue,
    ),
  ).length;
  const explicitOpportunityCoverageRatio = opportunityCueIndices.length
    ? coveredOpportunityCount / opportunityCueIndices.length
    : 1;
  const strictSpeakerOnly = plan.decisions
    .filter((decision) =>
      decision.reasons.some((reason) => reason.includes("Confirmed creator storyboard requires speaker-only video")),
    )
    .map((decision) => ({ start: decision.sourceStart, end: decision.sourceEnd }));
  const unexplainedSpeakerGaps = subtractIntervals(
    [{ start: 0, end: plan.durationSeconds }],
    [...excluded, ...strictSpeakerOnly, ...coverage],
  );
  const longestUnexplainedSpeakerGap = unexplainedSpeakerGaps.reduce(
    (maximum, interval) => Math.max(maximum, duration(interval)),
    0,
  );
  const findings: Array<{ rule: string; actual: number; expected: number }> = [];
  const advisories: Array<{ rule: string; actual: number; expected: number }> = [];
  if (coverageRatio + 0.0001 < minimumEligibleCoverageRatio)
    advisories.push({
      rule: "visual-direction.eligible-coverage",
      actual: coverageRatio,
      expected: minimumEligibleCoverageRatio,
    });
  if (materializationRatio + 0.0001 < minimumMaterializationRatio)
    findings.push({
      rule: "visual-direction.materialization",
      actual: materializationRatio,
      expected: minimumMaterializationRatio,
    });
  if (uniqueComponents < requiredUniqueComponents)
    advisories.push({
      rule: "visual-direction.diversity",
      actual: uniqueComponents,
      expected: requiredUniqueComponents,
    });
  if (longestRepeat > 2) advisories.push({ rule: "visual-direction.repetition", actual: longestRepeat, expected: 2 });
  if (explicitOpportunityCoverageRatio + 0.0001 < minimumExplicitOpportunityCoverageRatio)
    findings.push({
      rule: "visual-direction.explicit-opportunity-coverage",
      actual: explicitOpportunityCoverageRatio,
      expected: minimumExplicitOpportunityCoverageRatio,
    });
  const unshownCreatorConstraints = plan.decisions.filter(
    (decision) => decision.creatorConstraint?.mode === "information" && decision.action !== "show",
  ).length;
  if (unshownCreatorConstraints)
    findings.push({
      rule: "visual-direction.creator-confirmed-component",
      actual: unshownCreatorConstraints,
      expected: 0,
    });
  if (longestUnexplainedSpeakerGap > maximumUnexplainedSpeakerGapSeconds + 0.0001)
    findings.push({
      rule: "visual-direction.unexplained-speaker-gap",
      actual: longestUnexplainedSpeakerGap,
      expected: maximumUnexplainedSpeakerGapSeconds,
    });
  return {
    schemaVersion: "1.0" as const,
    status: findings.length ? ("blocked" as const) : ("passed" as const),
    metrics: {
      eligibleSeconds: Number(eligibleSeconds.toFixed(3)),
      coveredSeconds: Number(coveredSeconds.toFixed(3)),
      eligibleCoverageRatio: Number(coverageRatio.toFixed(4)),
      eligibleCandidateCount: eligibleDecisions.length,
      materializedCandidateCount: materialized.length,
      materializationRatio: Number(materializationRatio.toFixed(4)),
      uniqueComponents,
      longestComponentRepeat: longestRepeat,
      explicitOpportunityCount: opportunityCueIndices.length,
      coveredExplicitOpportunityCount: coveredOpportunityCount,
      explicitOpportunityCoverageRatio: Number(explicitOpportunityCoverageRatio.toFixed(4)),
      longestUnexplainedSpeakerGapSeconds: Number(longestUnexplainedSpeakerGap.toFixed(3)),
    },
    findings,
    advisories,
  };
};

export const assertVisualDirectionQuality = (input: QualityInput) => {
  const report = evaluateVisualDirectionQuality(input);
  if (report.status === "blocked") {
    throw new Error(`Visual direction quality gate blocked: ${report.findings.map((item) => item.rule).join(", ")}`);
  }
  return report;
};
