import type { SemanticNarrativePlan } from "./types.ts";
import { deriveVideoIdentity } from "./video-identity.ts";
import { SemanticPlanValidationError } from "./validation.ts";

const assertObject: (value: unknown, label: string) => asserts value is Record<string, unknown> = (value, label) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
};

export const parseSemanticNarrativePlan = (
  value: unknown,
  captions: Array<{ start: number; end: number; zh?: string }>,
  maximumSegmentSeconds = 30,
  referenceVisualBeats: Array<{ id: string; exactSpokenQuote?: string; materialAssetIds?: string[] }> = [],
  minimumVisualCoverageRatio = 0,
  availableMaterialIds: ReadonlySet<string> = new Set(),
): SemanticNarrativePlan => {
  assertObject(value, "semantic narrative plan");
  if (value.schemaVersion !== "1.0") throw new Error("semantic narrative plan schemaVersion must be 1.0");
  if (value.analyzedThroughCue !== captions.length - 1)
    throw new Error(`semantic narrative plan must analyze through caption ${captions.length - 1}`);
  if (!Array.isArray(value.segments)) throw new Error("semantic narrative plan segments must be an array");
  if (referenceVisualBeats.length) {
    if (!Array.isArray(value.visualDecisions))
      throw new Error("semantic narrative plan must decide every reference visual beat");
    const expected = new Set(referenceVisualBeats.map((beat) => beat.id));
    const seen = new Set<string>();
    for (const [index, raw] of value.visualDecisions.entries()) {
      assertObject(raw, `visualDecisions[${index}]`);
      if (typeof raw.beatId !== "string" || !expected.has(raw.beatId))
        throw new Error(`visualDecisions[${index}] references an unknown visual beat`);
      if (seen.has(raw.beatId)) throw new Error(`visualDecisions contains duplicate beat ${raw.beatId}`);
      if (!new Set(["use", "skip"]).has(String(raw.action)) || typeof raw.reason !== "string" || !raw.reason.trim())
        throw new Error(`visualDecisions[${index}] must contain use/skip and a reason`);
      const referenceBeat = referenceVisualBeats.find((beat) => beat.id === raw.beatId);
      const referencedMaterials = referenceBeat?.materialAssetIds ?? [];
      const falselyMissingMaterial =
        raw.action === "skip" &&
        referencedMaterials.some((id) => availableMaterialIds.has(id)) &&
        /(?:missing|unavailable|not (?:registered|available)|不存在|不可用|未登记|没有登记|找不到)/i.test(raw.reason);
      if (falselyMissingMaterial)
        throw new Error(`visualDecisions[${index}] incorrectly treats an available referenced material as missing`);
      seen.add(raw.beatId);
    }
    const missing = [...expected].filter((id) => !seen.has(id));
    if (missing.length) throw new Error(`visualDecisions is missing reference beats: ${missing.join(", ")}`);
  }
  let previousEnd = -1;
  for (const [index, raw] of value.segments.entries()) {
    assertObject(raw, `segments[${index}]`);
    if (!Number.isInteger(raw.startCue) || !Number.isInteger(raw.endCue))
      throw new Error(`segments[${index}] cue bounds must be integers`);
    if (Number(raw.startCue) < 0 || Number(raw.endCue) < Number(raw.startCue) || Number(raw.endCue) >= captions.length)
      throw new Error(`segments[${index}] cue bounds are outside the semantic transcript`);
    if (Number(raw.startCue) <= previousEnd)
      throw new Error(`segments[${index}] overlaps or reorders an earlier segment`);
    previousEnd = Number(raw.endCue);
    const cueCount = Number(raw.endCue) - Number(raw.startCue) + 1;
    const duration = captions[Number(raw.endCue)].end - captions[Number(raw.startCue)].start;
    if (cueCount > 10 || duration > maximumSegmentSeconds) {
      const message = `segments[${index}] exceeds the semantic density limit (${cueCount} cues, ${duration.toFixed(2)}s)`;
      throw new SemanticPlanValidationError({
        kind: "semantic-density",
        segmentIndex: index,
        startCue: Number(raw.startCue),
        endCue: Number(raw.endCue),
        message,
      });
    }
    if (!Array.isArray(raw.items)) throw new Error(`segments[${index}].items must be an array`);
    let previousItemStart = Number(raw.startCue) - 1;
    for (const [itemIndex, item] of raw.items.entries()) {
      assertObject(item, `segments[${index}].items[${itemIndex}]`);
      const hasStart = item.startCue !== undefined;
      const hasEnd = item.endCue !== undefined;
      if (hasStart !== hasEnd)
        throw new Error(`segments[${index}].items[${itemIndex}] must provide both startCue and endCue`);
      if (!hasStart) continue;
      if (
        !Number.isInteger(item.startCue) ||
        !Number.isInteger(item.endCue) ||
        Number(item.startCue) < Number(raw.startCue) ||
        Number(item.endCue) > Number(raw.endCue) ||
        Number(item.endCue) < Number(item.startCue)
      )
        throw new Error(`segments[${index}].items[${itemIndex}] evidence is outside its parent segment`);
      if (Number(item.startCue) < previousItemStart)
        throw new Error(`segments[${index}].items[${itemIndex}] reorders earlier item evidence`);
      previousItemStart = Number(item.startCue);
    }
  }
  if (minimumVisualCoverageRatio > 0 && captions.length) {
    const visualIntervals = value.segments
      .filter((segment) => segment && typeof segment === "object" && segment.visualPriority !== "skip")
      .map((segment) => ({
        start: captions[Number(segment.startCue)].start,
        end: captions[Number(segment.endCue)].end,
      }));
    const decisions = new Map(
      (Array.isArray(value.visualDecisions) ? value.visualDecisions : [])
        .filter((decision) => decision && typeof decision === "object")
        .map((decision) => [String(decision.beatId), String(decision.action)]),
    );
    const normalizedCaptions = captions.map((caption) =>
      (caption.zh ?? "")
        .normalize("NFKC")
        .toLowerCase()
        .replace(/[\s\p{P}\p{S}]/gu, ""),
    );
    const joined = normalizedCaptions.join("");
    const cueByCharacter = normalizedCaptions.flatMap((text, cueIndex) =>
      Array.from({ length: text.length }, () => cueIndex),
    );
    for (const beat of referenceVisualBeats) {
      if (decisions.get(beat.id) !== "use" || !beat.exactSpokenQuote) continue;
      const needle = beat.exactSpokenQuote
        .normalize("NFKC")
        .toLowerCase()
        .replace(/[\s\p{P}\p{S}]/gu, "");
      const startCharacter = joined.indexOf(needle);
      if (startCharacter < 0 || !needle.length) continue;
      const startCue = cueByCharacter[startCharacter];
      const endCue = cueByCharacter[startCharacter + needle.length - 1];
      if (startCue !== undefined && endCue !== undefined)
        visualIntervals.push({ start: captions[startCue].start, end: captions[endCue].end });
    }
    const merged: Array<{ start: number; end: number }> = [];
    for (const interval of visualIntervals.sort((left, right) => left.start - right.start || left.end - right.end)) {
      const previous = merged.at(-1);
      if (!previous || interval.start > previous.end) merged.push({ ...interval });
      else previous.end = Math.max(previous.end, interval.end);
    }
    const durationSeconds = captions.at(-1)?.end ?? 0;
    const coveredSeconds = merged.reduce((total, interval) => total + interval.end - interval.start, 0);
    const coverageRatio = durationSeconds > 0 ? coveredSeconds / durationSeconds : 1;
    if (coverageRatio + 0.0001 < minimumVisualCoverageRatio)
      throw new Error(
        `semantic visual coverage ${(coverageRatio * 100).toFixed(1)}% is below ${(minimumVisualCoverageRatio * 100).toFixed(1)}%`,
      );
  }
  if (value.videoIdentity !== undefined) {
    assertObject(value.videoIdentity, "videoIdentity");
    if (
      typeof value.videoIdentity.title !== "string" ||
      typeof value.videoIdentity.eyebrow !== "string" ||
      typeof value.videoIdentity.subject !== "string" ||
      !Number.isInteger(value.videoIdentity.startCue) ||
      !Number.isInteger(value.videoIdentity.endCue) ||
      Number(value.videoIdentity.startCue) < 0 ||
      Number(value.videoIdentity.endCue) >= captions.length ||
      Number(value.videoIdentity.startCue) > Number(value.videoIdentity.endCue)
    )
      throw new Error("videoIdentity must contain evidence-backed text and valid cue bounds");
  }
  const plan = value as unknown as SemanticNarrativePlan;
  return { ...plan, videoIdentity: deriveVideoIdentity(plan, captions) };
};
