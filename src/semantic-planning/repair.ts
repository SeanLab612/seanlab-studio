type CaptionTiming = { start: number; end: number };
type SegmentBounds = { startCue?: unknown; endCue?: unknown };
type ItemBounds = { startCue?: unknown; endCue?: unknown };

/**
 * Provider output occasionally contains valid evidence bounds in presentation
 * order rather than spoken order. The workflow contract requires spoken order,
 * so normalize fully bounded item lists deterministically before validation.
 */
export const normalizeSemanticItemOrder = (value: unknown): unknown => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const plan = value as Record<string, unknown>;
  if (!Array.isArray(plan.segments)) return value;
  return {
    ...plan,
    segments: plan.segments.map((segment) => {
      if (!segment || typeof segment !== "object" || Array.isArray(segment)) return segment;
      const record = segment as Record<string, unknown>;
      if (!Array.isArray(record.items) || record.items.length < 2) return segment;
      const items = record.items as ItemBounds[];
      if (
        !items.every(
          (item) =>
            item && typeof item === "object" && Number.isInteger(item.startCue) && Number.isInteger(item.endCue),
        )
      )
        return segment;
      return {
        ...record,
        items: [...items].sort(
          (left, right) => Number(left.startCue) - Number(right.startCue) || Number(left.endCue) - Number(right.endCue),
        ),
      };
    }),
  };
};

export const splitSemanticRange = ({
  startCue,
  endCue,
  captions,
  maximumCues = 8,
  maximumSeconds = 24,
}: {
  startCue: number;
  endCue: number;
  captions: CaptionTiming[];
  maximumCues?: number;
  maximumSeconds?: number;
}) => {
  const ranges: Array<{ startCue: number; endCue: number }> = [];
  let start = startCue;
  while (start <= endCue) {
    let end = start;
    while (end + 1 <= endCue) {
      const next = end + 1;
      const cueCount = next - start + 1;
      const duration = captions[next].end - captions[start].start;
      if (cueCount > maximumCues || duration > maximumSeconds) break;
      end = next;
    }
    ranges.push({ startCue: start, endCue: end });
    start = end + 1;
  }
  return ranges;
};

export const semanticDensityRepairInstruction = (
  value: unknown,
  captions: CaptionTiming[],
  maximumSegmentSeconds = 24,
) => {
  const segments = (value as { segments?: SegmentBounds[] } | undefined)?.segments;
  if (!Array.isArray(segments)) return "";
  const instructions = [];
  for (const [index, segment] of segments.entries()) {
    const startCue = Number(segment?.startCue);
    const endCue = Number(segment?.endCue);
    if (!Number.isInteger(startCue) || !Number.isInteger(endCue) || startCue < 0 || endCue >= captions.length) continue;
    const cueCount = endCue - startCue + 1;
    const duration = captions[endCue].end - captions[startCue].start;
    if (cueCount <= 10 && duration <= maximumSegmentSeconds) continue;
    const ranges = splitSemanticRange({
      startCue,
      endCue,
      captions,
      maximumCues: 8,
      maximumSeconds: Math.min(24, maximumSegmentSeconds),
    });
    instructions.push(
      `Replace segments[${index}] (${startCue}-${endCue}, ${cueCount} cues, ${duration.toFixed(2)}s) with ${ranges.length} separate complete segment objects using exactly these inclusive cue ranges: ${ranges.map((range) => `${range.startCue}-${range.endCue}`).join(", ")}. Each replacement must have its own evidence-supported rhetoric, narrative, items and reason based only on captions inside that range.`,
    );
  }
  return instructions.join("\n");
};
