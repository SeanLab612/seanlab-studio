import type { CreatorCategory, CreatorEditorialBrief } from "./types.ts";

export const EDITORIAL_BRIEF_VERSION = "1.0" as const;

export const PUBLIC_CREATOR_CATEGORIES = [
  {
    id: "general",
    label: "通用",
    summary: "不限定内容类型，由 Agent 根据主题、资料和素材组织内容。",
  },
  {
    id: "github-project",
    label: "GitHub 项目介绍",
    summary: "基于真实使用、项目资料和适用边界介绍一个 GitHub 项目。",
  },
  {
    id: "news-analysis",
    label: "新闻介绍",
    summary: "说明发生了什么、为什么值得关注，以及仍有哪些未知项。",
  },
  {
    id: "tutorial",
    label: "教程类介绍",
    summary: "围绕一个明确结果，讲清准备、操作、失败点和完成检查。",
  },
] as const;

export type EditorialQuestion = {
  id: string;
  label: string;
  type: "text" | "textarea" | "select";
  required: boolean;
  placeholder?: string;
  options?: ReadonlyArray<{ value: string; label: string }>;
};

const universalQuestions: ReadonlyArray<EditorialQuestion> = [
  {
    id: "motivation",
    label: "你为什么想在这一期讲它？",
    type: "textarea",
    required: false,
    placeholder: "写下真实触发点，不要写宣传口号。",
  },
  {
    id: "relationship",
    label: "你和这个主题是什么关系？",
    type: "select",
    required: false,
    options: [
      { value: "used", label: "我实际使用或测试过" },
      { value: "creator", label: "这是我参与或创建的项目" },
      { value: "research", label: "我做过资料研究，但没有实际使用" },
      { value: "reporting", label: "我在跟进一个新闻事件" },
      { value: "other", label: "其他关系" },
    ],
  },
  {
    id: "relationship-detail",
    label: "你和这期内容是什么关系？",
    type: "textarea",
    required: false,
    placeholder: "例如使用了多久、做过什么测试，或为什么只能基于公开资料判断。",
  },
  {
    id: "audience",
    label: "这期内容主要讲给谁听？",
    type: "text",
    required: false,
    placeholder: "例如：想减少重复剪辑工作的独立创作者。",
  },
  {
    id: "takeaway",
    label: "观众看完后最应该带走什么？",
    type: "textarea",
    required: false,
    placeholder: "只写一个核心判断、答案或可执行结果。",
  },
  {
    id: "call-to-action",
    label: "结尾是否需要观众做什么？",
    type: "text",
    required: false,
    placeholder: "可留空；只有你明确填写时，稿件才会加入行动建议。",
  },
];

const categoryQuestions: Partial<Record<CreatorCategory, ReadonlyArray<EditorialQuestion>>> = {
  "github-project": [
    {
      id: "project-problem",
      label: "它具体解决了你的什么问题？",
      type: "textarea",
      required: false,
      placeholder: "用一次真实任务或工作流说明。",
    },
    {
      id: "project-evidence",
      label: "你亲自验证过的代表性过程或结果是什么？",
      type: "textarea",
      required: false,
      placeholder: "写清输入、操作和可见结果；没有验证过的不要补。",
    },
    {
      id: "project-focus",
      label: "这一期主要从哪个角度讲？",
      type: "select",
      required: false,
      options: [
        { value: "experience", label: "使用体验：它到底解决了什么" },
        { value: "recommendation", label: "项目推荐：为什么值得关注或收藏" },
        { value: "technical", label: "技术解释：它如何实现关键能力" },
        { value: "comparison", label: "对比评测：它和其他方案有什么差别" },
        { value: "tutorial", label: "实际教程：如何完成一个具体任务" },
        { value: "failure", label: "失败复盘：为什么没有继续使用" },
      ],
    },
    {
      id: "project-boundary",
      label: "它最明显的限制或不适用场景是什么？",
      type: "textarea",
      required: false,
      placeholder: "如果还没验证，请明确写“尚未验证”。",
    },
    {
      id: "project-verdict",
      label: "你目前会把它推荐给谁，又不会推荐给谁？",
      type: "textarea",
      required: false,
      placeholder: "给出有边界的判断。",
    },
  ],
  "news-analysis": [
    {
      id: "news-event",
      label: "这次真正发生了什么？",
      type: "textarea",
      required: false,
      placeholder: "用一句话写事件，不先下结论。",
    },
    {
      id: "news-why-now",
      label: "为什么现在值得讲？",
      type: "textarea",
      required: false,
      placeholder: "说明时间点、变化或直接影响。",
    },
    {
      id: "news-confirmed",
      label: "哪些事实已经确认？",
      type: "textarea",
      required: false,
      placeholder: "列出来源能够直接证明的事实。",
    },
    {
      id: "news-unknown",
      label: "哪些仍是未知、预测或争议？",
      type: "textarea",
      required: false,
      placeholder: "不要把推测写成事实。",
    },
    {
      id: "news-impact",
      label: "它会影响谁，你目前的判断是什么？",
      type: "textarea",
      required: false,
      placeholder: "区分事实影响和个人判断。",
    },
  ],
  tutorial: [
    {
      id: "tutorial-outcome",
      label: "观众最终要完成什么可见结果？",
      type: "textarea",
      required: false,
      placeholder: "例如完成一次真实任务，而不是泛泛“学会某工具”。",
    },
    {
      id: "tutorial-prerequisites",
      label: "开始前必须准备什么？",
      type: "textarea",
      required: false,
      placeholder: "只保留真正影响成功的前置条件。",
    },
    {
      id: "tutorial-path",
      label: "你亲自验证过的操作路径是什么？",
      type: "textarea",
      required: false,
      placeholder: "按动作和可见结果描述，不写未测试的捷径。",
    },
    {
      id: "tutorial-failure",
      label: "最常见的失败点或误区是什么？",
      type: "textarea",
      required: false,
      placeholder: "没有遇到时写清尚未验证，不要编造。",
    },
    {
      id: "tutorial-check",
      label: "观众如何确认自己已经完成？",
      type: "textarea",
      required: false,
      placeholder: "给出一个能够看见或检查的完成标准。",
    },
  ],
};

export const editorialQuestionnaire = (category: CreatorCategory) => ({
  version: EDITORIAL_BRIEF_VERSION,
  category,
  universal: universalQuestions,
  categorySpecific: categoryQuestions[category] ?? [],
});

const expectedQuestions = (category: CreatorCategory) => {
  const questionnaire = editorialQuestionnaire(category);
  return [...questionnaire.universal, ...questionnaire.categorySpecific];
};

export const createEmptyEditorialBrief = (): CreatorEditorialBrief => ({
  version: EDITORIAL_BRIEF_VERSION,
  status: "ready",
  answers: {},
});

export const normalizeEditorialBrief = (category: CreatorCategory, input: unknown): CreatorEditorialBrief => {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("写作方向必须是结构化对象");
  const raw = input as Partial<CreatorEditorialBrief>;
  if (raw.version !== EDITORIAL_BRIEF_VERSION) throw new Error(`写作方向版本必须是 ${EDITORIAL_BRIEF_VERSION}`);
  if (!raw.answers || typeof raw.answers !== "object" || Array.isArray(raw.answers))
    throw new Error("写作方向 answers 必须是对象");
  const answers: Record<string, string> = {};
  for (const question of expectedQuestions(category)) {
    const answer = raw.answers[question.id];
    if (answer === undefined || answer === null) continue;
    if (typeof answer !== "string") throw new Error(`写作方向“${question.label}”必须是文本`);
    const normalized = answer.trim();
    if (normalized.length > 2000) throw new Error(`写作方向“${question.label}”不能超过 2000 字`);
    if (question.options && normalized && !question.options.some((option) => option.value === normalized))
      throw new Error(`写作方向“${question.label}”选项无效`);
    if (normalized) answers[question.id] = normalized;
  }
  const missing = expectedQuestions(category)
    .filter((question) => question.required && !answers[question.id])
    .map((question) => question.id);
  return {
    version: EDITORIAL_BRIEF_VERSION,
    status: missing.length ? "draft" : "ready",
    answers,
    ...(typeof raw.updatedAt === "string" && raw.updatedAt.trim() ? { updatedAt: raw.updatedAt } : {}),
  };
};

export const missingEditorialAnswers = (category: CreatorCategory, brief: CreatorEditorialBrief) =>
  expectedQuestions(category)
    .filter((question) => question.required && !brief.answers[question.id]?.trim())
    .map((question) => ({ id: question.id, label: question.label }));

export const editorialBriefPrompt = (category: CreatorCategory, brief: CreatorEditorialBrief) => {
  const questions = new Map(expectedQuestions(category).map((question) => [question.id, question]));
  return Object.entries(brief.answers).map(([id, answer]) => {
    const question = questions.get(id);
    return {
      id,
      question: question?.label ?? id,
      answer: question?.options?.find((option) => option.value === answer)?.label ?? answer,
    };
  });
};
