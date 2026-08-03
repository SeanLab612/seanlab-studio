import type { NarrationScriptPackage } from "./types.ts";
import type { NarrationVisualForm } from "./visual-authoring.ts";

export const STRUCTURAL_STORYBOARD_SECTION_IDS = ["opening", "overview", "conclusion"] as const;

export type StructuralStoryboardSectionId = (typeof STRUCTURAL_STORYBOARD_SECTION_IDS)[number];

export type StoryboardNarrationSection = {
  id: string;
  title: string;
  narration: string;
  visualIntent: "speaker" | "screen-recording" | "screenshot" | "semantic-visual";
  visualOpportunities: Array<{ form: NarrationVisualForm; evidenceText: string }>;
  materialIds: string[];
  recordingInstruction: string | null;
};

const structuralSectionFields = {
  opening: { title: "开场", field: "opening" },
  overview: { title: "本期概述", field: "overview" },
  conclusion: { title: "结尾总结", field: "conclusion" },
} as const;

export const inferStructuralVisualForm = (text: string): NarrationVisualForm => {
  const value = text.trim();
  if (/\d|[一二三四五六七八九十]+(?:个|项|种|步)|百分之|%/.test(value)) return "number-focus";
  if (/(?:如果|只要|只有|否则|条件).*(?:就|才|会|结果)/.test(value)) return "conditional-outcomes";
  if (/(?:因为|由于|原因|导致|带来|所以|因此|从而)/.test(value)) return "cause-to-result";
  if (/(?:对比|相比|不同|区别|而不是|前后|优点|缺点)/.test(value)) return "two-way-contrast";
  if (/(?:第一|首先|然后|接着|随后|最后|流程|步骤|阶段)/.test(value)) return "ordered-progression";
  if (/(?:分为|分成|类型|类别|包括).*(?:、|，)/.test(value)) return "category-map";
  if (/(?:核心|关键|重点|记住|真正|本质|结论)/.test(value)) return "text-emphasis";
  return "text-emphasis";
};

export const structuralStoryboardSection = (
  narration: NarrationScriptPackage,
  sectionId: StructuralStoryboardSectionId,
): StoryboardNarrationSection => {
  const config = structuralSectionFields[sectionId];
  const spokenText = narration[config.field] ?? "";
  return {
    id: sectionId,
    title: config.title,
    narration: spokenText,
    visualIntent: "semantic-visual",
    visualOpportunities: [{ form: inferStructuralVisualForm(spokenText), evidenceText: spokenText }],
    materialIds: [],
    recordingInstruction: null,
  };
};

export const narrationStoryboardSections = (narration: NarrationScriptPackage): StoryboardNarrationSection[] => [
  structuralStoryboardSection(narration, "opening"),
  structuralStoryboardSection(narration, "overview"),
  ...narration.sections.map((section) => ({ ...section, visualOpportunities: section.visualOpportunities ?? [] })),
  structuralStoryboardSection(narration, "conclusion"),
];

export const narrationStoryboardSection = (narration: NarrationScriptPackage, sectionId: string) =>
  narrationStoryboardSections(narration).find((section) => section.id === sectionId);
