import { chartRecipeRegistry } from "../charts/registry.ts";
import { approvedComponentRegistry, type ApprovedComponentId } from "../components/library/registry.ts";

export const NARRATION_VISUAL_FORMS = [
  {
    id: "two-way-contrast",
    label: "双向对比",
    guidance: "两种做法、前后状态、优缺点或相反观点；口播要把两个对象和比较维度说完整。",
    componentCoverage: ["binary-versus"],
  },
  {
    id: "multi-dimension-comparison",
    label: "多维比较",
    guidance: "多个对象在能力、成本、速度等维度上的差异；只写资料能够支持的维度。",
    componentCoverage: ["capability-surface-grid"],
  },
  {
    id: "ordered-progression",
    label: "有序流程",
    guidance: "三到六个有先后依赖的步骤；用自然语言交代顺序和当前重点。",
    componentCoverage: ["process-steps"],
  },
  {
    id: "progressive-explanation",
    label: "逐项解释",
    guidance: "三到五个因素、条件或组成部分；每一项都要有独立而简短的含义。",
    componentCoverage: ["factor-sequence"],
  },
  {
    id: "cause-to-result",
    label: "因果链",
    guidance: "原因经过中间机制带来结果；明确方向，不能把并列关系写成因果。",
    componentCoverage: ["causal-chain"],
  },
  {
    id: "conditional-outcomes",
    label: "条件分支",
    guidance: "如果满足不同条件会产生不同结果；先说判断条件，再说对应结果。",
    componentCoverage: ["scenario-branches"],
  },
  {
    id: "number-focus",
    label: "重点数字",
    guidance: "一到三个有来源的数字、比例或结论；数字和含义必须同时出现。",
    componentCoverage: ["key-stat-summary"],
  },
  {
    id: "ranking-or-distribution",
    label: "排名或分布",
    guidance: "共享同一指标的对象排名、占比或集中程度；不得混用不同口径。",
    componentCoverage: ["distribution-bars", "ranked-metric-list"],
  },
  {
    id: "change-over-time",
    label: "趋势变化",
    guidance: "同一指标随时间上升、下降或分化；资料没有时间维度时不要使用。",
    componentCoverage: ["market-cap-lines"],
  },
  {
    id: "dated-milestones",
    label: "时间节点",
    guidance: "版本、事件或阶段按日期演进；每个节点必须有明确时间依据。",
    componentCoverage: ["historical-timeline"],
  },
  {
    id: "category-map",
    label: "分类关系",
    guidance: "把一个主题分成若干类型或把对象归入不同类别；分类标准要一致。",
    componentCoverage: ["model-classification-map"],
  },
  {
    id: "core-and-supports",
    label: "核心与支撑",
    guidance: "一个中心定位连接两到六个能力、依据或结果；先把中心和各支撑关系说完整。",
    componentCoverage: [],
  },
  {
    id: "tradeoff-or-positioning",
    label: "取舍与定位",
    guidance: "速度、质量、成本等维度之间的取舍，或对象在两个维度上的位置。",
    componentCoverage: ["decision-matrix", "tradeoff-scale"],
  },
  {
    id: "source-backed-evidence",
    label: "来源证据",
    guidance: "已登记截图、录屏、人物、原话或文档直接证明当前说法；不能虚构素材。",
    componentCoverage: ["person-evidence-card", "media-comparison", "image-evidence-inset", "quote-source-card"],
  },
  {
    id: "text-emphasis",
    label: "文字标注",
    guidance: "对一到三个短语做高亮、下划线、圈选、框选、括起或划掉；划掉只用于明确否定。",
    componentCoverage: ["rough-annotation"],
  },
  {
    id: "plain-language-claim",
    label: "观点陈述",
    guidance:
      "一句缺少数据、步骤、对比或来源结构的大白话，只表达一个完整判断；下游会把它设计成克制的文字画面。若有用户素材或更强语义结构，优先使用素材和专用组件。",
    componentCoverage: ["editorial-statement"],
  },
] as const satisfies readonly {
  id: string;
  label: string;
  guidance: string;
  componentCoverage: readonly ApprovedComponentId[];
}[];

export type NarrationVisualForm = (typeof NARRATION_VISUAL_FORMS)[number]["id"];

export const NARRATION_VISUAL_FORM_IDS = NARRATION_VISUAL_FORMS.map((item) => item.id) as NarrationVisualForm[];

export const narrationVisualFormsPrompt = () =>
  `${NARRATION_VISUAL_FORMS.map((item) => `- ${item.id}（${item.label}）：${item.guidance}`).join("\n")}\n\n素材段落规则：\n- section.materialIds 只记录写稿阶段最明确的一份首选素材，可以为空。\n- 同一素材可以绑定多个不同 section；下游还会按实体、证据角色和精确口播句自动安排更多视觉节拍。\n- 一组直接相关的截图可以由下游合并成一个图片节拍；录屏必须只覆盖它能够证明的短句。不要为迁就素材重复口播。`;

export const narrationProductionCapabilityPrompt = () => {
  const chartGuidance = [
    "对象之间有同口径数值对比时，说清对象、指标和数值",
    "同一指标随时间变化时，说清时间点和对应值",
    "表达排名、分布、比例、阶段流失或前后变化时，保持口径一致",
    "表达两个维度的位置、风险与收益或区间范围时，明确坐标含义",
  ];
  return `下游当前具备 ${Object.keys(approvedComponentRegistry).length} 种已审批信息组件和 ${Object.keys(chartRecipeRegistry).length} 种数据图表形式。这些数量只用于说明表达能力边界，不是覆盖指标，也不得决定具体组件、图表、布局、时间或动画。写稿时只需把真实语义关系说完整；不要为了触发组件虚构结构。\n\n适合信息组件的表达触发条件：\n${NARRATION_VISUAL_FORMS.map((item) => `- ${item.label}：${item.guidance}`).join("\n")}\n\n适合数据图表的表达触发条件：\n${chartGuidance.map((item) => `- ${item}`).join("\n")}`;
};
