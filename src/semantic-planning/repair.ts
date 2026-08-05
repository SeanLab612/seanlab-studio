type CaptionTiming = { start: number; end: number };
type SemanticCaption = CaptionTiming & { zh?: string };
type SegmentBounds = { startCue?: unknown; endCue?: unknown };
type ItemBounds = { startCue?: unknown; endCue?: unknown };
import { semanticVisualRelations, type SemanticPlanValidationIssue } from "./validation.ts";

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

export const splitSemanticRelationshipRange = ({
  startCue,
  endCue,
  captions,
}: {
  startCue: number;
  endCue: number;
  captions: SemanticCaption[];
}) => {
  const marked: Array<{ cue: number; relation: string }> = [];
  const seen = new Set<string>();
  let cumulativeText = "";
  for (let cue = startCue; cue <= endCue; cue += 1) {
    cumulativeText += captions[cue].zh ?? "";
    const newlyDetected = semanticVisualRelations(cumulativeText).filter((relation) => !seen.has(relation));
    if (newlyDetected.length > 1) return [];
    if (newlyDetected.length === 1) {
      seen.add(newlyDetected[0]);
      marked.push({ cue, relation: newlyDetected[0] });
    }
  }
  if (new Set(marked.map((entry) => entry.relation)).size < 2) return [];

  const ranges: Array<{ startCue: number; endCue: number }> = [];
  let rangeStart = startCue;
  let activeRelation = marked[0].relation;
  for (const marker of marked.slice(1)) {
    if (marker.relation === activeRelation) continue;
    ranges.push({ startCue: rangeStart, endCue: marker.cue - 1 });
    rangeStart = marker.cue;
    activeRelation = marker.relation;
  }
  ranges.push({ startCue: rangeStart, endCue });
  return ranges.filter((range) => range.startCue <= range.endCue);
};

export const semanticValidationRepairInstruction = (
  value: unknown,
  captions: SemanticCaption[],
  maximumSegmentSeconds = 24,
  issue?: SemanticPlanValidationIssue,
) => {
  if (!issue) return semanticDensityRepairInstruction(value, captions, maximumSegmentSeconds);
  if (issue.kind === "semantic-density")
    return semanticDensityRepairInstruction(value, captions, maximumSegmentSeconds);

  const ranges = splitSemanticRelationshipRange({
    startCue: issue.startCue,
    endCue: issue.endCue,
    captions,
  });
  if (ranges.length > 1)
    return `Replace segments[${issue.segmentIndex}] (${issue.startCue}-${issue.endCue}) with ${ranges.length} separate complete segment objects using exactly these inclusive cue ranges: ${ranges.map((range) => `${range.startCue}-${range.endCue}`).join(", ")}. Each replacement must express only one visual relationship and must have its own evidence-supported rhetoric, narrative, items and reason based only on captions inside that range.`;

  return `Rewrite segments[${issue.segmentIndex}] (${issue.startCue}-${issue.endCue}) so it expresses exactly one evidence-backed visual relationship (${issue.relations?.join(", ") ?? "unknown"}). A single caption cue is atomic: if one cue itself suggests multiple relationships, choose the one most directly supported by its wording or omit that segment instead of inventing evidence or overlapping cue ranges.`;
};
