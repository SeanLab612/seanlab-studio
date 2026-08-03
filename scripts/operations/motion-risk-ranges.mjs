export const motionRiskRanges = ({ cues, paddingSeconds, maximumEndSeconds }) => {
  const sorted = cues
    .map((cue) => ({
      start: Math.max(0, Number(cue.start) - paddingSeconds),
      end: Math.min(maximumEndSeconds, Math.max(0, Number(cue.end) + paddingSeconds)),
      cueIds: [cue.id],
    }))
    .filter((range) => Number.isFinite(range.start) && Number.isFinite(range.end) && range.end > range.start)
    .sort((left, right) => left.start - right.start);
  const merged = [];
  for (const range of sorted) {
    const previous = merged.at(-1);
    if (previous && range.start <= previous.end + 0.25) {
      previous.end = Math.max(previous.end, range.end);
      previous.cueIds.push(...range.cueIds);
    } else merged.push(range);
  }
  return merged;
};
