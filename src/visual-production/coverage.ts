import { PRIMARY_VISUAL_TYPES, type PrimaryVisualType, type VisualInterval } from "./types.ts";

const rounded = (value: number) => Number(value.toFixed(4));

export const summarizeVisualCoverage = ({
  intervals,
  durationSeconds,
}: {
  intervals: readonly VisualInterval[];
  durationSeconds: number;
}) => {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0)
    throw new Error("Visual coverage duration must be positive");
  const ordered = [...intervals].sort((left, right) => left.start - right.start || left.end - right.end);
  let priorEnd = 0;
  for (const interval of ordered) {
    if (!PRIMARY_VISUAL_TYPES.includes(interval.primaryVisualType))
      throw new Error(`Unsupported visual type: ${interval.primaryVisualType}`);
    if (interval.start < 0 || interval.end <= interval.start || interval.end > durationSeconds + 0.001)
      throw new Error(`Visual interval ${interval.id} has invalid timing`);
    if (interval.start < priorEnd - 0.001)
      throw new Error(`Visual interval ${interval.id} overlaps another primary visual`);
    priorEnd = interval.end;
  }
  const secondsByType = Object.fromEntries(PRIMARY_VISUAL_TYPES.map((type) => [type, 0])) as Record<
    PrimaryVisualType,
    number
  >;
  for (const interval of ordered) secondsByType[interval.primaryVisualType] += interval.end - interval.start;
  const coveredSeconds = Object.values(secondsByType).reduce((sum, seconds) => sum + seconds, 0);
  secondsByType.speaker += Math.max(0, durationSeconds - coveredSeconds);
  const fullScreenSeconds = ordered
    .filter((item) => item.takeover === "full")
    .reduce((sum, item) => sum + item.end - item.start, 0);
  const pipSeconds = ordered
    .filter((item) => item.speakerPresence === "circle-pip")
    .reduce((sum, item) => sum + item.end - item.start, 0);
  const speakerPrimarySeconds = secondsByType.speaker;
  return {
    schemaVersion: "1.0" as const,
    durationSeconds: rounded(durationSeconds),
    secondsByType: Object.fromEntries(
      Object.entries(secondsByType).map(([key, value]) => [key, rounded(value)]),
    ) as Record<PrimaryVisualType, number>,
    ratioByType: Object.fromEntries(
      Object.entries(secondsByType).map(([key, value]) => [key, rounded(value / durationSeconds)]),
    ) as Record<PrimaryVisualType, number>,
    componentCoverage: rounded(secondsByType.component / durationSeconds),
    realMaterialCoverage: rounded((secondsByType.image + secondsByType["screen-demo"]) / durationSeconds),
    animationCoverage: rounded(secondsByType.animation / durationSeconds),
    fullScreenTakeoverRatio: rounded(fullScreenSeconds / durationSeconds),
    speakerVisibleRatio: rounded(Math.min(durationSeconds, speakerPrimarySeconds + pipSeconds) / durationSeconds),
  };
};
