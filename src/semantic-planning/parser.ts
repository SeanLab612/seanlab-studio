import type { SemanticNarrativePlan } from "./types.ts";
import { deriveVideoIdentity } from "./video-identity.ts";

const assertObject: (value: unknown, label: string) => asserts value is Record<string, unknown> = (value, label) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
};

const visualRelations = (text: string) =>
  (
    [
      [
        "process",
        /(?:(?:步骤|阶段).{0,24}(?:依次|逐个|顺序|展开|出现)|(?:依次|逐个).{0,24}(?:步骤|阶段|展开|出现)|先.{1,30}(?:再|然后|最后))/,
      ],
      ["comparison", /(?:左右(?:两边)?|对比|两种做法|优缺点|(?:把|将|拿|和|与).{1,20}(?:比较|对照))/],
      ["checklist", /(?:检查项|逐项|清单|检查是否|检查是不是)/],
      ["annotation", /(?:划掉|高亮|圈出|下划线|标注)/],
    ] satisfies ReadonlyArray<readonly [string, RegExp]>
  ).flatMap(([relation, pattern]) => (pattern.test(text) ? [relation] : []));

export const parseSemanticNarrativePlan = (
  value: unknown,
  captions: Array<{ start: number; end: number; zh?: string }>,
  maximumSegmentSeconds = 30,
): SemanticNarrativePlan => {
  assertObject(value, "semantic narrative plan");
  if (value.schemaVersion !== "1.0") throw new Error("semantic narrative plan schemaVersion must be 1.0");
  if (value.analyzedThroughCue !== captions.length - 1)
    throw new Error(`semantic narrative plan must analyze through caption ${captions.length - 1}`);
  if (!Array.isArray(value.segments)) throw new Error("semantic narrative plan segments must be an array");
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
    if (cueCount > 10 || duration > maximumSegmentSeconds)
      throw new Error(
        `segments[${index}] exceeds the semantic density limit (${cueCount} cues, ${duration.toFixed(2)}s)`,
      );
    const sourceText = captions
      .slice(Number(raw.startCue), Number(raw.endCue) + 1)
      .map((caption) => caption.zh ?? "")
      .join("");
    const relations = visualRelations(sourceText);
    if (relations.length > 1)
      throw new Error(
        `segments[${index}] mixes multiple visual relationships and must be split by evidence (cues ${raw.startCue}-${raw.endCue}: ${relations.join(", ")})`,
      );
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
