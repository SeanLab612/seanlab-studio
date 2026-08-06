export type EditorialStatementCue = {
  start: number;
  end: number;
  generatedVisual?: { component?: { id?: string }; segment?: { id?: string } };
};

export type EditorialStatementPolicyResult<T extends EditorialStatementCue> = {
  cues: T[];
  suppressedCueIds: string[];
  coverageSeconds: number;
  coverageRatio: number;
};

export const applyEditorialStatementPolicy = <T extends EditorialStatementCue>(
  input: readonly T[],
  durationSeconds: number,
  options: {
    maximumCoverageRatio?: number;
    maximumConsecutive?: number;
    minimumDurationSeconds?: number;
    resetIntervals?: readonly { start: number; end: number }[];
  } = {},
): EditorialStatementPolicyResult<T> => {
  const maximumCoverageRatio = options.maximumCoverageRatio ?? 1;
  const maximumConsecutive = options.maximumConsecutive ?? 2;
  const minimumDurationSeconds = options.minimumDurationSeconds ?? 4;
  const budget = Math.max(0, durationSeconds * maximumCoverageRatio);
  const cues: T[] = [];
  const suppressedCueIds: string[] = [];
  let used = 0;
  let consecutive = 0;
  let priorEditorialEnd: number | null = null;

  for (const cue of input) {
    const editorial = cue.generatedVisual?.component?.id === "editorial-statement";
    if (!editorial) {
      consecutive = 0;
      priorEditorialEnd = null;
      cues.push(cue);
      continue;
    }
    const priorEnd = priorEditorialEnd;
    if (
      priorEnd !== null &&
      options.resetIntervals?.some((interval) => interval.end > priorEnd + 0.001 && interval.start < cue.start - 0.001)
    )
      consecutive = 0;
    const cueId = cue.generatedVisual?.segment?.id ?? `editorial-${suppressedCueIds.length + 1}`;
    const available = Math.max(0, budget - used);
    const requested = Math.max(0, cue.end - cue.start);
    if (consecutive >= maximumConsecutive || available < minimumDurationSeconds || requested < minimumDurationSeconds) {
      suppressedCueIds.push(cueId);
      continue;
    }
    const acceptedDuration = Math.min(requested, available, 8);
    if (acceptedDuration < minimumDurationSeconds) {
      suppressedCueIds.push(cueId);
      continue;
    }
    const accepted =
      acceptedDuration < requested
        ? ({
            ...cue,
            end: cue.start + acceptedDuration,
            generatedVisual: cue.generatedVisual
              ? {
                  ...cue.generatedVisual,
                  segment: cue.generatedVisual.segment
                    ? { ...cue.generatedVisual.segment, end: cue.start + acceptedDuration }
                    : cue.generatedVisual.segment,
                }
              : cue.generatedVisual,
          } as T)
        : cue;
    cues.push(accepted);
    used += acceptedDuration;
    consecutive += 1;
    priorEditorialEnd = accepted.end;
  }

  return {
    cues,
    suppressedCueIds,
    coverageSeconds: Number(used.toFixed(3)),
    coverageRatio: durationSeconds > 0 ? Number((used / durationSeconds).toFixed(4)) : 0,
  };
};
