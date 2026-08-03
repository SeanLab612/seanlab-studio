import type { LocalRoughAnnotationPlan, RoughAnnotationSemanticIntent, SemanticNarrativeSegment } from "./types.ts";

const cleanTarget = (value: string) =>
  value
    .trim()
    .replace(/^[“《〈『「"']+|[”》〉』」"'。，；！？,.!?;]+$/g, "")
    .replace(/^(?:所谓|其实|就是|只是|一味地?)/, "")
    .trim();

const withinCapacity = (value: string) => {
  const length = [...value].length;
  return length >= 2 && length <= 14;
};

const uniqueTargets = (values: string[]) => [...new Set(values.map(cleanTarget).filter(withinCapacity))].slice(0, 3);

const matchTargets = (text: string, pattern: RegExp) => {
  const values: string[] = [];
  for (const match of text.matchAll(pattern)) {
    if (match[1]) values.push(match[1]);
  }
  return uniqueTargets(values);
};

const itemTargets = (intent: SemanticNarrativeSegment) => uniqueTargets(intent.items.map((item) => item.label));
const narrativeTarget = (intent: SemanticNarrativeSegment) =>
  uniqueTargets([intent.narrative.title, intent.narrative.takeaway])[0];

const plan = (intent: RoughAnnotationSemanticIntent, targets: string[]): LocalRoughAnnotationPlan | undefined => {
  const bounded = uniqueTargets(targets);
  return bounded.length
    ? { intent, targets: bounded, annotations: bounded.map((target) => ({ target, intent })) }
    : undefined;
};

const mixedPlan = (
  annotations: Array<{ target: string; intent: RoughAnnotationSemanticIntent }>,
): LocalRoughAnnotationPlan | undefined => {
  const bounded = annotations
    .map((item) => ({ ...item, target: cleanTarget(item.target) }))
    .filter((item) => withinCapacity(item.target))
    .filter((item, index, items) => items.findIndex((candidate) => candidate.target === item.target) === index)
    .slice(0, 3);
  return bounded.length
    ? { intent: bounded[0].intent, targets: bounded.map((item) => item.target), annotations: bounded }
    : undefined;
};

const splitTargets = (value: string) =>
  uniqueTargets(
    value
      .split(/(?:、|和|与|以及|还有)/)
      .map((item) => item.replace(/^(?:真正重要的|真正重要|重点|关键|核心)(?:是|在于)?/, "")),
  );

const explicitMixedPlan = (text: string) => {
  const crossed = matchTargets(text, /([^,，。；;!！?？]{2,14}?)(?:可以)?(?:被)?(?:直接)?划掉/g);
  if (!crossed.length) return undefined;
  const emphasis = [
    ...text.matchAll(/(?:真正重要的?|重点|关键|核心)(?:是|在于|就是)?([^，。；;！？!?]{2,30})/g),
  ].flatMap((match) => splitTargets(match[1] ?? ""));
  return mixedPlan([
    ...crossed.map((target) => ({ target, intent: "negation" as const })),
    ...emphasis.map((target) => ({ target, intent: "strong-emphasis" as const })),
  ]);
};

/**
 * Converts evidence-bound language into semantic annotation intent. The Agent
 * never emits package names or drawing primitives; the renderer maps this local
 * intent to one deterministic rough-notation effect.
 */
export const resolveLocalRoughAnnotationPlan = (
  sourceText: string,
  intent: SemanticNarrativeSegment,
): LocalRoughAnnotationPlan | undefined => {
  const text = sourceText.replace(/\s+/g, " ").trim();
  const primaryEvidenceRhetoric = new Set([
    "trend",
    "distribution",
    "person-evidence",
    "ranking",
    "key-stat",
    "media-comparison",
    "image-evidence",
    "quote-source",
    "historical-timeline",
    "decision-matrix",
    "capability-surface",
  ]);
  if (primaryEvidenceRhetoric.has(intent.rhetoric)) return undefined;

  // Interrogative checks describe a review question, not a negated assertion.
  const assertiveText = text.replace(/(?:是不是|是否|有没有|能不能|要不要|会不会)[^，。；;！？!?]*/g, "");

  const explicitlyMixed = explicitMixedPlan(assertiveText);
  if (explicitlyMixed) return explicitlyMixed;

  const negated = matchTargets(assertiveText, /(?:不是|并非|绝非|不要|不应|不能)([^,，。；;!！?？]{2,14})/g);
  if (["factor-sequence", "process-steps", "causal-chain", "core-positioning"].includes(intent.rhetoric))
    return undefined;
  if (negated.length) return plan("negation", negated);

  const corrected = matchTargets(text, /(?:把|将)?([^,，。；;!！?？]{2,14}?)(?:改成|改为|换成|替换为|淘汰|废除)/g);
  if (corrected.length) return plan("correction", corrected);

  if (intent.motionIntent !== "emphasize") return undefined;

  const semanticItems = itemTargets(intent);
  if (/(?:包括|分为|分成|由.+组成|共同|一组)/.test(text) && semanticItems.length >= 2)
    return plan("grouping", semanticItems);

  const focused = matchTargets(text, /(?:所谓|也就是|指的是)([^,，。；;!！?？]{2,14})/g);
  if (focused.length) return plan("focus-concept", focused);

  const title = narrativeTarget(intent);
  if (/(?:结论|核心|关键|重点)(?:是|在于|就是)?/.test(text) && title) return plan("bounded-conclusion", [title]);

  const fallback = semanticItems.length ? semanticItems : title ? [title] : [];
  if (/(?:真正|最重要|尤其|必须|一定)/.test(text) || intent.visualPriority === "high")
    return plan("strong-emphasis", fallback);

  return plan("light-emphasis", fallback);
};

const exactGroundedTargets = (text: string, intent: SemanticNarrativeSegment) => {
  const candidates = [...intent.items.map((item) => item.label), intent.narrative.title, intent.narrative.takeaway];
  return uniqueTargets(candidates.filter((candidate) => candidate && text.includes(candidate)));
};

const literalFallbackTargets = (text: string) => {
  const quoted = [...text.matchAll(/[“「『"]([^”」』"]{2,14})[”」』"]/g)].map((match) => match[1] ?? "");
  const named = [...text.matchAll(/(?:叫|称为|就是|重点是|关键是|核心是)([^，。；;！？!?]{2,14})/g)].map(
    (match) => match[1] ?? "",
  );
  const emphasized = [...text.matchAll(/((?:完全|真正|关键|核心|重点|自动|人工|本地)[^，。；;！？!?]{1,13})/g)].map(
    (match) => match[1] ?? "",
  );
  const latin = text.match(/[A-Za-z][A-Za-z0-9 ._-]{1,18}/g) ?? [];
  return uniqueTargets([...quoted, ...named, ...emphasized, ...latin]);
};

/**
 * Creates a restrained, evidence-grounded annotation for an otherwise empty
 * speaker passage. It only reuses exact spoken phrases or exact semantic item
 * labels that occur in the same caption range.
 */
export const resolveSpeakerRoughAnnotationPlan = (
  sourceText: string,
  intent: SemanticNarrativeSegment,
): LocalRoughAnnotationPlan | undefined => {
  const text = sourceText.replace(/\s+/g, " ").trim();
  const explicit = resolveLocalRoughAnnotationPlan(text, intent);
  if (explicit) return explicit;
  const targets = exactGroundedTargets(text, intent);
  const fallback = targets.length ? targets : literalFallbackTargets(text);
  if (!fallback.length) return undefined;
  const annotationIntent: RoughAnnotationSemanticIntent = /(?:叫|称为|就是)/.test(text)
    ? "focus-concept"
    : /(?:重点|关键|核心|真正|尤其|必须)/.test(text)
      ? "strong-emphasis"
      : fallback.length > 1
        ? "grouping"
        : "light-emphasis";
  return plan(annotationIntent, fallback);
};

export const effectForRoughAnnotationIntent = (
  intent: RoughAnnotationSemanticIntent,
): "highlight" | "underline" | "circle" | "box" | "crossed-off" | "strike-through" | "bracket" => {
  switch (intent) {
    case "strong-emphasis":
      return "highlight";
    case "light-emphasis":
      return "underline";
    case "focus-concept":
      return "circle";
    case "bounded-conclusion":
      return "box";
    case "negation":
      return "crossed-off";
    case "correction":
      return "strike-through";
    case "grouping":
      return "bracket";
  }
};
