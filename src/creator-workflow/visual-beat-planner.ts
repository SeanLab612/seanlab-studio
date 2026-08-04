import { recommendAnimationIntent } from "../visual-production/recommendation.ts";
import type { VisualBeat } from "../visual-production/types.ts";
import type { StoryboardNarrationSection } from "./storyboard-sections.ts";
import { NARRATION_VISUAL_FORMS, type NarrationVisualForm } from "./visual-authoring.ts";

type CreatorMaterial = {
  id: string;
  kind: string;
  label?: string;
  description?: string;
  evidenceRole?: string;
  durationSeconds?: number;
};

const sentenceRanges = (text: string) => {
  const ranges: Array<{ text: string; start: number; end: number }> = [];
  const matcher = /[^。！？；!?]+[。！？；!?]?/g;
  for (const match of text.matchAll(matcher)) {
    const value = match[0].trim();
    if (!value) continue;
    const leading = match[0].indexOf(value);
    const start = (match.index ?? 0) + Math.max(0, leading);
    ranges.push({ text: value, start, end: start + value.length });
  }
  return ranges;
};

const overlaps = (range: { start: number; end: number }, used: Array<{ start: number; end: number }>) =>
  used.some((item) => range.start < item.end && range.end > item.start);

const materialEntity = (material: CreatorMaterial) =>
  ["录音机", "机械车", "机器人"].find((name) => `${material.label ?? ""} ${material.description ?? ""}`.includes(name));

const materialScore = (material: CreatorMaterial, text: string, role: "source" | "result" | "recording") => {
  if (role === "recording" && material.kind !== "screen-recording") return -1;
  if (role !== "recording" && material.kind !== "screenshot") return -1;
  let score = 0;
  const entity = materialEntity(material);
  if (entity && text.includes(entity)) score += 8;
  if (entity && text.slice(0, 32).includes(entity)) score += 12;
  if (role === "source" && material.evidenceRole === "source") score += 5;
  if (role === "result" && material.evidenceRole === "result") score += 5;
  if (role === "recording") score += 4;
  if (role === "source" && /参考图|原始图|一张图片|输入/.test(text)) score += 3;
  if (role === "result" && /生成结果|最终模型|产物|模型/.test(text)) score += 2;
  if (role === "result" && /最终模型/.test(material.label ?? "") && /测试|生成结果|模型/.test(text)) score += 4;
  if (/说明书|拆解视图/.test(material.label ?? "") && /说明书|应用|复用|热点|拆解/.test(text)) score += 10;
  if (role === "recording" && /浏览器|旋转|缩放|录屏|拖拽|交互|查看|演示/.test(text)) score += 4;
  return score;
};

const bestMaterial = (
  materials: CreatorMaterial[],
  text: string,
  role: "source" | "result" | "recording",
  preferredIds: string[] = [],
) =>
  materials
    .filter((item) => !preferredIds.length || preferredIds.includes(item.id))
    .map((item) => ({ item, score: materialScore(item, text, role) }))
    .filter((item) => item.score >= 0)
    .sort((left, right) => right.score - left.score || left.item.id.localeCompare(right.item.id))[0]?.item;

const presentationFor = (type: VisualBeat["primaryVisualType"]) => {
  if (type === "speaker") return { takeover: "none" as const, speakerPresence: "full" as const };
  if (type === "component") return { takeover: "partial" as const, speakerPresence: "full" as const };
  return { takeover: "full" as const, speakerPresence: "circle-pip" as const };
};

const makeBeat = ({
  sectionId,
  index,
  quote,
  type,
  form,
  materialIds,
  animationIntent,
}: {
  sectionId: string;
  index: number;
  quote: string;
  type: VisualBeat["primaryVisualType"];
  form?: NarrationVisualForm;
  materialIds?: string[];
  animationIntent?: VisualBeat["animationIntent"];
}): VisualBeat => ({
  id: `${sectionId}-beat-${index}`,
  exactSpokenQuote: quote,
  status: "suggested",
  executionPolicy: "reference",
  primaryVisualType: type,
  ...(form ? { semanticForm: form } : {}),
  ...(materialIds?.length === 1 ? { materialId: materialIds[0] } : {}),
  ...(materialIds?.length ? { materialIds } : {}),
  ...(materialIds?.length ? { materialDisplay: "full" as const } : {}),
  ...(animationIntent ? { animationIntent } : {}),
  ...presentationFor(type),
});

const rangeOf = (section: StoryboardNarrationSection, quote: string) => {
  const start = section.narration.indexOf(quote);
  return start < 0 ? undefined : { start, end: start + quote.length };
};

const emphasisQuote = (value: string) => {
  const candidates = value.match(/(?:不能|没有|不是|只确认|真正|关键|重点)[^，。；！？,.!?;]{1,12}/g) ?? [];
  return candidates.find((item) => [...item].length >= 2 && [...item].length <= 14) ?? [...value].slice(0, 14).join("");
};

const recordingQuote = (value: string, durationSeconds?: number) => {
  if (!Number.isFinite(durationSeconds) || Number(durationSeconds) <= 0) return value;
  const maximumCharacters = Math.max(12, Math.floor((Number(durationSeconds) / 0.8) * 3));
  if ([...value].length <= maximumCharacters) return value;
  const prefix = [...value].slice(0, maximumCharacters).join("");
  const boundary = Math.max(prefix.lastIndexOf("，"), prefix.lastIndexOf("；"), prefix.lastIndexOf("。"));
  return (boundary >= 12 ? prefix.slice(0, boundary + 1) : prefix).replace(/[、：,\s]+$/g, "");
};

const materialBeats = (
  section: StoryboardNarrationSection,
  materials: CreatorMaterial[],
  used: Array<{ start: number; end: number }>,
) => {
  const output: Array<Omit<Parameters<typeof makeBeat>[0], "sectionId" | "index">> = [];
  const sentences = sentenceRanges(section.narration);

  const preferredScreenshotIds = (section.materialIds ?? []).filter((materialId) =>
    materials.some((material) => material.id === materialId && material.kind === "screenshot"),
  );
  if (preferredScreenshotIds.length) {
    const preferredEvidenceRanges = (section.visualOpportunities ?? [])
      .map((opportunity) => rangeOf(section, opportunity.evidenceText?.trim() ?? ""))
      .filter((range): range is { start: number; end: number } => Boolean(range));
    const target =
      preferredEvidenceRanges
        .map((evidenceRange) =>
          sentences.find(
            (sentence) =>
              !overlaps(sentence, used) && sentence.start < evidenceRange.end && sentence.end > evidenceRange.start,
          ),
        )
        .find((sentence): sentence is (typeof sentences)[number] => Boolean(sentence)) ??
      sentences.find((sentence) => !overlaps(sentence, used));
    if (target) {
      used.push(target);
      output.push({ quote: target.text, type: "image", materialIds: preferredScreenshotIds.slice(0, 3) });
    }
  }

  const namedSources = ["录音机", "机械车", "机器人"]
    .filter((name) => section.narration.includes(name))
    .map((name) =>
      materials.find(
        (material) =>
          material.kind === "screenshot" &&
          material.evidenceRole === "source" &&
          `${material.label ?? ""} ${material.description ?? ""}`.includes(name),
      ),
    )
    .filter((item): item is CreatorMaterial => Boolean(item));
  if (section.id === "overview" && namedSources.length >= 3) {
    const target = sentences.find(
      (sentence) =>
        namedSources.filter((material) => sentence.text.includes(materialEntity(material) ?? "")).length >= 3,
    );
    if (target) {
      const groupedQuote =
        target.text.match(
          /(?:用它)?生成了[^。！？；!?]{0,42}录音机[^。！？；!?]{0,42}机械车[^。！？；!?]{0,42}机器人[^。！？；!?]{0,12}三个模型/,
        )?.[0] ?? target.text;
      const groupedRange = rangeOf(section, groupedQuote) ?? target;
      used.push(groupedRange);
      output.push({ quote: groupedQuote, type: "image", materialIds: namedSources.slice(0, 3).map((item) => item.id) });
    }
  }

  if (!output.some((beat) => beat.type === "image")) {
    const target =
      sentences.find(
        (sentence) =>
          !overlaps(sentence, used) && /第[一二三]个测试|生成结果|最终模型|参考图|交互式产品说明书/.test(sentence.text),
      ) ?? undefined;
    if (target) {
      const role = /参考图|原始图/.test(target.text) ? "source" : "result";
      const titleEntity = ["录音机", "机械车", "机器人"].find((name) => section.title.includes(name));
      const candidates = titleEntity
        ? materials.filter((material) => materialEntity(material) === titleEntity)
        : materials;
      const material = bestMaterial(candidates, `${section.title} ${target.text}`, role);
      if (
        material &&
        materialEntity(material) &&
        `${section.title} ${target.text}`.includes(materialEntity(material) ?? "") &&
        materialScore(material, `${section.title} ${target.text}`, role) > 4
      ) {
        used.push(target);
        output.unshift({ quote: target.text, type: "image", materialIds: [material.id] });
      }
    }
  }

  const preferredRecordingIds = (section.materialIds ?? []).filter((materialId) =>
    materials.some((material) => material.id === materialId && material.kind === "screen-recording"),
  );
  if (section.visualIntent === "screen-recording" || preferredRecordingIds.length) {
    const target =
      sentences.find(
        (sentence) =>
          !overlaps(sentence, used) && /浏览器|旋转|缩放|录屏|拖拽|交互|查看|演示|热点|聚焦|高亮/.test(sentence.text),
      ) ?? sentences.find((sentence) => !overlaps(sentence, used));
    if (target) {
      const material = bestMaterial(materials, `${section.title} ${target.text}`, "recording", preferredRecordingIds);
      if (material) {
        const quote = recordingQuote(target.text, material.durationSeconds);
        const quoteRange = rangeOf(section, quote) ?? target;
        used.push(quoteRange);
        output.push({ quote, type: "screen-demo", materialIds: [material.id] });
      }
    }
  }
  return output;
};

export const planVisualBeats = (
  section: StoryboardNarrationSection,
  materials: CreatorMaterial[] = [],
): VisualBeat[] => {
  if (!section.narration.trim()) return [];
  const used: Array<{ start: number; end: number }> = [];
  const drafts = materialBeats(section, materials, used);

  if (section.id === "overview") {
    const numericPhrases = section.narration.match(/(?:接近|大约|约)?\d+(?:\.\d+)?\s*(?:星|分|分钟|项|个|%)/g) ?? [];
    for (const phrase of numericPhrases.slice(0, 2)) {
      const range = rangeOf(section, phrase);
      if (!range || overlaps(range, used)) continue;
      used.push(range);
      drafts.push({ quote: phrase, type: "component", form: "number-focus" });
    }
  }

  if (section.id === "conclusion") {
    for (const phrase of ["可以，但不是没有代价", "点赞关注,谢谢"]) {
      const range = rangeOf(section, phrase);
      if (!range || overlaps(range, used)) continue;
      used.push(range);
      drafts.push({ quote: phrase, type: "component", form: "text-emphasis" });
    }
  }

  const untestedPhrase =
    section.narration.match(/(?:这个方案|不过这个方案|但这个方案)?我还没有实际试过/)?.[0] ??
    section.narration.match(/没有实际试过/)?.[0];
  if (untestedPhrase) {
    const range = rangeOf(section, untestedPhrase);
    if (range && !overlaps(range, used) && [...untestedPhrase].length <= 14) {
      used.push(range);
      drafts.push({ quote: untestedPhrase, type: "component", form: "text-emphasis" });
    }
  }

  for (const opportunity of section.visualOpportunities ?? []) {
    const rawQuote = opportunity.evidenceText?.trim();
    const quote = opportunity.form === "text-emphasis" && rawQuote ? emphasisQuote(rawQuote) : rawQuote;
    const range = quote ? rangeOf(section, quote) : undefined;
    if (!quote || !range || overlaps(range, used)) continue;
    const animationIntent = recommendAnimationIntent({
      ...section,
      narration: quote,
      visualOpportunities: [{ ...opportunity, evidenceText: quote }],
    });
    const form = NARRATION_VISUAL_FORMS.find((item) => item.id === opportunity.form);
    const canUseComponent = Boolean(form?.componentCoverage.length);
    if (animationIntent) {
      used.push(range);
      drafts.push({ quote, type: "animation", animationIntent });
    } else if (canUseComponent) {
      used.push(range);
      drafts.push({ quote, type: "component", form: opportunity.form });
    }
  }

  if (!drafts.some((draft) => ["component", "animation"].includes(draft.type))) {
    const target = sentenceRanges(section.narration).find(
      (sentence) => !overlaps(sentence, used) && /\d|分|分钟|%|token|项|个模型/.test(sentence.text),
    );
    if (target) {
      used.push(target);
      drafts.push({ quote: target.text, type: "component", form: "number-focus" });
    }
  }

  if (!drafts.length) {
    const sentences = sentenceRanges(section.narration);
    const target =
      sentences.find((sentence) => /\d|因为|所以|但是|如果|结论|意味着|证明/.test(sentence.text)) ?? sentences[0];
    if (target) {
      const form = section.visualOpportunities?.[0]?.form ?? "text-emphasis";
      const supported = NARRATION_VISUAL_FORMS.find((item) => item.id === form)?.componentCoverage.length;
      if (supported) drafts.push({ quote: target.text, type: "component", form });
    }
  }

  return drafts
    .map((draft) => ({ draft, range: rangeOf(section, draft.quote) }))
    .filter((item): item is { draft: (typeof drafts)[number]; range: { start: number; end: number } } =>
      Boolean(item.range),
    )
    .sort((left, right) => left.range.start - right.range.start)
    .slice(0, 6)
    .map(({ draft }, index) => makeBeat({ sectionId: section.id, index: index + 1, ...draft }));
};
