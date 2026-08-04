import { createHash } from "node:crypto";
import type { NarrationScriptPackage } from "../creator-workflow/types.ts";
import type { RecutProviderPlan } from "../recut-planning/index.ts";
import type { SemanticNarrativePlan } from "../semantic-planning/types.ts";

export type EvidenceRange = { startCue: number; endCue: number };
export type WordRange = { startWord: number; endWord: number };

export const stableJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`)
      .join(",")}}`;
  return JSON.stringify(value);
};

export const sha256Json = (value: unknown) => createHash("sha256").update(stableJson(value)).digest("hex");

const ratio = (numerator: number, denominator: number) => (denominator > 0 ? numerator / denominator : 1);
const intersects = (left: WordRange, right: WordRange) =>
  left.startWord <= right.endWord && right.startWord <= left.endWord;
const cueSet = (ranges: EvidenceRange[]) => {
  const cues = new Set<number>();
  for (const range of ranges) for (let cue = range.startCue; cue <= range.endCue; cue += 1) cues.add(cue);
  return cues;
};

const sourceConstraintTerms = [
  "开源",
  "闭源",
  "免费",
  "收费",
  "本地",
  "云端",
  "自动",
  "实时",
  "内置",
  "商业",
  "官方",
  "社区",
  "认可",
  "丰富",
  "稳定",
  "安全",
  "工具",
  "平台",
  "支持",
  "替代",
  "许可证",
  "受欢迎",
  "关注度",
  "认可度",
  "从零开始",
  "快速",
  "高效",
  "强大",
  "成熟",
  "领先",
  "不需要",
  "转成视频",
] as const;

const sourceConstraintEnglishAliases: Partial<Record<(typeof sourceConstraintTerms)[number], RegExp>> = {
  开源: /\bopen[-\s]?source\b/i,
  闭源: /\bclosed[-\s]?source\b/i,
  免费: /\bfree\b/i,
  收费: /\bpaid\b/i,
  本地: /\blocal(?:[-\s]?first)?\b/i,
  云端: /\bcloud\b/i,
  自动: /\bautomat(?:e|ed|es|ic|ically|ion)\b/i,
  实时: /\breal[-\s]?time\b/i,
  内置: /\bbuilt[-\s]?in\b/i,
  商业: /\bcommercial\b/i,
  官方: /\bofficial\b/i,
  社区: /\bcommunity\b/i,
  稳定: /\bstable\b/i,
  安全: /\b(?:safe|safety|secure|security)\b/i,
  工具: /\btools?\b/i,
  平台: /\bplatform\b/i,
  支持: /\bsupport(?:s|ed|ing)?\b/i,
  替代: /\balternative\b/i,
  许可证: /\blicen[cs]e\b/i,
  受欢迎: /\bpopular\b/i,
  快速: /\b(?:fast|faster|fastest|quick|quickly)\b/i,
  高效: /\befficient\b/i,
  强大: /\bpowerful\b/i,
  成熟: /\bmature\b/i,
  领先: /\bleading\b/i,
  不需要: /\b(?:do(?:es)?\s+not|don['’]t|doesn['’]t)\s+need\b|\bwithout\s+(?:requiring|the\s+need\s+for)\b/i,
};

const normalizeGroundingText = (value: string) =>
  value
    .toLocaleLowerCase()
    .replace(/[，。！？；：、,.!?;:'"“”‘’（）()[\]{}<>《》\s]/g, "")
    .replaceAll("无需", "不需要");

const normalizeCoverageText = (value: string) =>
  normalizeGroundingText(value)
    .replace(/stars?/g, "星")
    .replace(/forks?/g, "叉")
    .replace(/watches?/g, "关注");

const parseChineseNumber = (value: string) => {
  const digits: Record<string, number> = {
    零: 0,
    〇: 0,
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
  };
  if (value === "十") return 10;
  if (value.includes("十")) {
    const [tens, ones] = value.split("十");
    return (tens ? digits[tens] : 1) * 10 + (ones ? digits[ones] : 0);
  }
  return [...value].reduce((total, digit) => total * 10 + digits[digit], 0);
};

const normalizedNumberClaims = (value: string) => {
  const arabic = [...value.toLocaleLowerCase().matchAll(/(?<![a-z0-9])\d[\d,]*(?:\.\d+)?(?:%|k)?(?![a-z0-9])/g)].map(
    (match) => {
      const raw = match[0].replaceAll(",", "");
      if (raw.endsWith("k")) return String(Number(raw.slice(0, -1)) * 1000);
      return raw;
    },
  );
  const chinese = [
    ...value.matchAll(
      /([零〇一二两三四五六七八九十]{1,3})(?=分钟|阶段|部分|个|步|项|点|件|种|段|次|张|条|处|组|份|秒|年|月|日)/g,
    ),
    ...value.matchAll(/([零〇一二两三四五六七八九十]{2,3})(?=[，、,;；。！？!?]|$|和[零〇一二两三四五六七八九十])/g),
  ]
    .filter((match) => match[1] !== "一" && value[Number(match.index) - 1] !== "第")
    .map((match) => String(parseChineseNumber(match[1])));
  return [...new Set([...arabic, ...chinese])];
};

export const evaluateSourceGrounding = ({ outputText, sourceText }: { outputText: string; sourceText?: string }) => {
  if (!sourceText?.trim())
    return {
      sourceGroundingCoverage: 1,
      groundedSourceTerms: [] as string[],
      unsupportedSourceTerms: [] as string[],
      groundedQualifierTerms: [] as string[],
      unsupportedQualifierTerms: [] as string[],
      groundedNumberClaims: [] as string[],
      unsupportedNumberClaims: [] as string[],
    };
  const output = normalizeGroundingText(outputText);
  const source = normalizeGroundingText(sourceText);
  const observedTerms = sourceConstraintTerms.filter((term) => output.includes(normalizeGroundingText(term)));
  const sourceSupportsTerm = (term: (typeof sourceConstraintTerms)[number]) =>
    source.includes(normalizeGroundingText(term)) || sourceConstraintEnglishAliases[term]?.test(sourceText) === true;
  const groundedTerms = observedTerms.filter(sourceSupportsTerm);
  const unsupportedTerms = observedTerms.filter((term) => !sourceSupportsTerm(term));
  const outputNumbers = [...new Set(normalizedNumberClaims(outputText))];
  const sourceNumbers = new Set(normalizedNumberClaims(sourceText));
  const groundedNumbers = outputNumbers.filter((term) => sourceNumbers.has(term));
  const unsupportedNumbers = outputNumbers.filter((term) => !sourceNumbers.has(term));
  const groundedSourceTerms = [...new Set([...groundedTerms, ...groundedNumbers])];
  const unsupportedSourceTerms = [...new Set([...unsupportedTerms, ...unsupportedNumbers])];
  return {
    sourceGroundingCoverage: ratio(
      groundedSourceTerms.length,
      groundedSourceTerms.length + unsupportedSourceTerms.length,
    ),
    groundedSourceTerms,
    unsupportedSourceTerms,
    groundedQualifierTerms: groundedTerms,
    unsupportedQualifierTerms: unsupportedTerms,
    groundedNumberClaims: groundedNumbers,
    unsupportedNumberClaims: unsupportedNumbers,
  };
};

export const deriveNamedItemCountEvidence = ({ labels, sourceText }: { labels: string[]; sourceText: string }) => {
  const source = normalizeGroundingText(sourceText);
  const count = labels.filter((label) => {
    const normalized = normalizeGroundingText(label);
    return normalized.length > 0 && source.includes(normalized);
  }).length;
  return count > 1 ? `${count}项` : undefined;
};

export const narrationClaimText = (narration: NarrationScriptPackage) =>
  [
    narration.title,
    narration.overview,
    ...narration.sections.flatMap((section) => [section.title, section.narration]),
    narration.conclusion,
  ].join("\n");

export const semanticSegmentClaimText = (segment: SemanticNarrativePlan["segments"][number]) => {
  const structuralOrdinalUnits = new Set(["步", "阶段", "项", "点"]);
  const hasStructuralOrdinalSeries =
    segment.items.length > 1 &&
    segment.items.every(
      (item, index) => item.displayValue === String(index + 1) && structuralOrdinalUnits.has(item.unit),
    );
  return [
    segment.narrative.title,
    segment.narrative.subtitleZh,
    segment.narrative.takeaway,
    ...segment.items.flatMap((item) => [
      item.label,
      item.detail,
      ...(hasStructuralOrdinalSeries ? [] : [item.displayValue, item.unit]),
      item.timeLabel,
    ]),
    segment.imageEvidence?.caption,
    segment.quote.text,
    segment.quote.sourceName,
    segment.quote.sourceRole,
  ]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join("\n");
};

export const semanticVideoIdentityClaimText = (plan: SemanticNarrativePlan) =>
  [plan.videoIdentity?.title, plan.videoIdentity?.subject]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join("\n");

const semanticClaimText = (plan: SemanticNarrativePlan) =>
  [semanticVideoIdentityClaimText(plan), ...plan.segments.map(semanticSegmentClaimText)]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join("\n");

export const evaluateNarrationConformance = ({
  narration,
  requiredTerms,
  forbiddenTerms,
  sourceGroundingText,
  registeredMaterialIds,
}: {
  narration: NarrationScriptPackage;
  requiredTerms: Array<string | string[]>;
  forbiddenTerms: string[];
  sourceGroundingText?: string;
  registeredMaterialIds: string[];
}) => {
  const text = narration.fullScript;
  const normalizedText = normalizeCoverageText(text);
  const requiredGroups = requiredTerms.map((term) => (Array.isArray(term) ? term : [term]));
  const requiredHits = requiredGroups
    .filter((terms) => terms.some((term) => normalizedText.includes(normalizeCoverageText(term))))
    .map((terms) => terms[0]);
  const forbiddenHits = forbiddenTerms.filter((term) => text.includes(term));
  const referencedMaterialIds = narration.sections.flatMap((section) => section.materialIds);
  const unknownMaterialIds = [...new Set(referencedMaterialIds.filter((id) => !registeredMaterialIds.includes(id)))];
  const sourceGrounding = evaluateSourceGrounding({
    outputText: narrationClaimText(narration),
    sourceText: sourceGroundingText,
  });
  return {
    requiredTermCoverage: ratio(requiredHits.length, requiredGroups.length),
    requiredHits,
    forbiddenHits,
    ...sourceGrounding,
    unknownMaterialIds,
    sectionCount: narration.sections.length,
    passed:
      requiredHits.length === requiredGroups.length &&
      forbiddenHits.length === 0 &&
      sourceGrounding.unsupportedSourceTerms.length === 0 &&
      unknownMaterialIds.length === 0,
  };
};

export const evaluateRecutConformance = ({
  plan,
  expectedCandidates,
  acceptableCandidateSets,
  protectedWordRanges,
}: {
  plan: RecutProviderPlan;
  expectedCandidates?: Array<WordRange & { kind: string }>;
  acceptableCandidateSets?: Array<Array<WordRange & { kind: string }>>;
  protectedWordRanges: WordRange[];
}) => {
  const expectedSets = acceptableCandidateSets ?? (expectedCandidates ? [expectedCandidates] : []);
  if (expectedSets.length === 0) throw new Error("Recut conformance requires at least one accepted candidate set");
  const scoreSet = (accepted: Array<WordRange & { kind: string }>) => {
    const exactMatch = (candidate: RecutProviderPlan["candidates"][number]) =>
      accepted.some(
        (expected) =>
          expected.kind === candidate.kind &&
          expected.startWord === candidate.startWord &&
          expected.endWord === candidate.endWord,
      );
    const matchedExpected = accepted.filter((expected) =>
      plan.candidates.some(
        (candidate) =>
          expected.kind === candidate.kind &&
          expected.startWord === candidate.startWord &&
          expected.endWord === candidate.endWord,
      ),
    );
    const correctCandidates = plan.candidates.filter(exactMatch);
    const precision = ratio(correctCandidates.length, plan.candidates.length);
    const recall = ratio(matchedExpected.length, accepted.length);
    return { accepted, precision, recall, correctCandidates, matchedExpected };
  };
  const best = expectedSets
    .map(scoreSet)
    .sort(
      (left, right) =>
        right.precision + right.recall - (left.precision + left.recall) ||
        right.matchedExpected.length - left.matchedExpected.length,
    )[0];
  const protectedViolations = plan.candidates.filter((candidate) =>
    protectedWordRanges.some((range) => intersects(candidate, range)),
  );
  return {
    candidateCount: plan.candidates.length,
    precision: best.precision,
    recall: best.recall,
    acceptedCandidateSet: best.accepted,
    protectedViolationCount: protectedViolations.length,
    protectedViolations,
    passed:
      best.correctCandidates.length === plan.candidates.length &&
      best.matchedExpected.length === best.accepted.length &&
      protectedViolations.length === 0,
  };
};

export const evaluateSemanticConformance = ({
  plan,
  expectedEvidenceRanges,
  forbiddenTerms,
  sourceGroundingText,
  registeredImageIds,
  materializedCandidateCount,
  validationCandidateCount = materializedCandidateCount,
  viewerCopyPassCount,
  layoutCapacityPassCount,
}: {
  plan: SemanticNarrativePlan;
  expectedEvidenceRanges: EvidenceRange[];
  forbiddenTerms: string[];
  sourceGroundingText?: string;
  registeredImageIds: string[];
  materializedCandidateCount: number;
  validationCandidateCount?: number;
  viewerCopyPassCount: number;
  layoutCapacityPassCount: number;
}) => {
  const actualRanges = plan.segments
    .filter((segment) => segment.rhetoric === "image-evidence" && segment.imageEvidence)
    .map(({ startCue, endCue }) => ({ startCue, endCue }));
  const actualCues = cueSet(actualRanges);
  const expectedCues = cueSet(expectedEvidenceRanges);
  const matchedCueCount = [...actualCues].filter((cue) => expectedCues.has(cue)).length;
  const evidencePrecision = ratio(matchedCueCount, actualCues.size);
  const evidenceRecall = ratio(matchedCueCount, expectedCues.size);
  const serialized = stableJson(plan);
  const forbiddenHits = forbiddenTerms.filter((term) => serialized.includes(term));
  const sourceGrounding = evaluateSourceGrounding({
    outputText: semanticClaimText(plan),
    sourceText: sourceGroundingText,
  });
  const referencedImageIds = plan.segments.flatMap((segment) =>
    segment.imageEvidence ? [segment.imageEvidence.assetId] : [],
  );
  const unknownImageIds = [...new Set(referencedImageIds.filter((id) => !registeredImageIds.includes(id)))];
  return {
    plannedSegmentCount: plan.segments.length,
    evidencePrecision,
    evidenceRecall,
    forbiddenHits,
    ...sourceGrounding,
    unknownImageIds,
    materializedCandidateCount,
    viewerCopyPassRate: ratio(viewerCopyPassCount, validationCandidateCount),
    layoutCapacityPassRate: ratio(layoutCapacityPassCount, validationCandidateCount),
    passed:
      evidencePrecision === 1 &&
      evidenceRecall === 1 &&
      forbiddenHits.length === 0 &&
      sourceGrounding.unsupportedSourceTerms.length === 0 &&
      unknownImageIds.length === 0 &&
      viewerCopyPassCount === validationCandidateCount &&
      layoutCapacityPassCount === validationCandidateCount,
  };
};

export const jaccardSimilarity = (left: string[], right: string[]) => {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const intersection = [...leftSet].filter((item) => rightSet.has(item)).length;
  const union = new Set([...leftSet, ...rightSet]).size;
  return ratio(intersection, union);
};

export const pairwiseMinimumSimilarity = (values: string[][]) => {
  if (values.length < 2) return 1;
  const scores: number[] = [];
  for (let left = 0; left < values.length; left++)
    for (let right = left + 1; right < values.length; right++)
      scores.push(jaccardSimilarity(values[left], values[right]));
  return Math.min(...scores);
};
