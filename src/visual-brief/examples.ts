import { generateVisualBriefFromDraft, type NarrationSegment, type VisualBriefDraft } from "./generator.ts";

const narrative = (title: string) => ({
  eyebrow: "SEMANTIC VISUAL",
  title,
  subtitleZh: title,
  subtitleEn: title,
});

export const visualBriefExamples: Array<{
  name: string;
  mode: "production" | "review";
  expected: string;
  segment: NarrationSegment;
  draft: VisualBriefDraft;
}> = [
  {
    name: "HPLC mobile phase replacement",
    mode: "production",
    expected: "factor-sequence",
    segment: { id: "hplc", start: 0, end: 12, text: "停止泵，更换溶剂瓶，排气，最后平衡色谱柱。" },
    draft: {
      analysis: { rhetoric: "process", stepCount: 4 },
      narrative: narrative("流动相更换四步"),
      props: {
        items: [{ title: "停止泵" }, { title: "换溶剂" }, { title: "管路排气" }, { title: "平衡色谱柱" }],
        activeIndex: 0,
      },
    },
  },
  {
    name: "five antibody purity ranking",
    mode: "production",
    expected: "ranked-metric-list",
    segment: { id: "purity", start: 12, end: 22, text: "比较五种抗体的主峰纯度。" },
    draft: {
      analysis: { rhetoric: "comparison", entityCount: 5, sharedMetric: true },
      narrative: narrative("五种抗体主峰纯度"),
      props: {
        mode: "percentage",
        items: [96.2, 94.8, 98.1, 91.5, 97.3].map((value, index) => ({ label: `抗体${index + 1}`, value })),
      },
    },
  },
  {
    name: "two方案对比",
    mode: "production",
    expected: "binary-versus",
    segment: { id: "binary", start: 22, end: 30, text: "本地部署成本更高，云端方案上线更快。" },
    draft: {
      analysis: { rhetoric: "comparison", entityCount: 2 },
      narrative: narrative("本地还是云端"),
      props: {
        items: [
          { label: "本地部署", metric: "可控" },
          { label: "云端方案", metric: "更快" },
        ],
      },
    },
  },
  {
    name: "headline statistics",
    mode: "production",
    expected: "key-stat-summary",
    segment: { id: "stats", start: 30, end: 38, text: "报名人数1290万，其中县城学生占60%。" },
    draft: {
      analysis: { rhetoric: "key-stat", statCount: 2 },
      narrative: narrative("两组数字说明覆盖面"),
      props: {
        items: [
          { label: "报名人数", value: "1,290万" },
          { label: "县城学生", value: "60%" },
        ],
      },
    },
  },
  {
    name: "three interface comparison",
    mode: "production",
    expected: "media-comparison",
    segment: { id: "media", start: 38, end: 48, text: "三个软件界面相似，但背后的模型不同。" },
    draft: {
      analysis: { rhetoric: "media-comparison", mediaCount: 3 },
      narrative: narrative("相似界面，不同模型"),
      props: { items: [{ label: "产品A" }, { label: "产品B" }, { label: "产品C" }] },
    },
  },
  {
    name: "strict HPLC procedure",
    mode: "production",
    expected: "process-steps",
    segment: { id: "strict-process", start: 48, end: 60, text: "先停泵，再换流动相，然后逐通道排气，最后平衡色谱柱。" },
    draft: {
      analysis: { rhetoric: "process-steps", stepCount: 4 },
      narrative: narrative("流动相更换顺序"),
      props: {
        items: [{ title: "停泵" }, { title: "换流动相" }, { title: "排气" }, { title: "平衡色谱柱" }],
        activeIndex: 0,
      },
    },
  },
  {
    name: "liquidity causal chain",
    mode: "production",
    expected: "causal-chain",
    segment: {
      id: "causal",
      start: 60,
      end: 72,
      text: "降息降低融资成本，增加流动性，提升风险偏好，最后推动估值上涨。",
    },
    draft: {
      analysis: { rhetoric: "causal-chain", nodeCount: 4 },
      narrative: narrative("降息的四层传导"),
      props: {
        nodes: [{ label: "利率下降" }, { label: "流动性增加" }, { label: "风险偏好上升" }, { label: "估值抬升" }],
        activeIndex: 0,
      },
    },
  },
  {
    name: "report quotation",
    mode: "production",
    expected: "quote-source-card",
    segment: { id: "quote", start: 72, end: 82, text: "报告指出，如果盈利没有改善，流动性推动的上涨很难持续。" },
    draft: {
      analysis: { rhetoric: "quote-source" },
      narrative: narrative("流动性不能替代盈利"),
      props: { quote: "如果盈利没有同步改善，流动性带来的上涨很难长期持续。", sourceName: "宏观策略月报" },
    },
  },
  {
    name: "historical evolution",
    mode: "review",
    expected: "historical-timeline",
    segment: { id: "timeline", start: 82, end: 94, text: "2017到2026经历四个阶段。" },
    draft: {
      analysis: { rhetoric: "historical-timeline", milestoneCount: 4 },
      narrative: narrative("四次关键跃迁"),
      props: { items: [{ year: "2017" }, { year: "2020" }, { year: "2023" }, { year: "2026" }] },
    },
  },
  {
    name: "portfolio matrix",
    mode: "review",
    expected: "decision-matrix",
    segment: { id: "matrix", start: 94, end: 104, text: "用增长和协同两个维度判断五项业务。" },
    draft: {
      analysis: { rhetoric: "decision-matrix", entityCount: 5 },
      narrative: narrative("资源投向哪里"),
      props: {
        xLabel: "增长",
        yLabel: "协同",
        points: [
          { x: 80, y: 80 },
          { x: 60, y: 70 },
          { x: 40, y: 50 },
          { x: 30, y: 20 },
          { x: 15, y: 15 },
        ],
      },
    },
  },
  {
    name: "model classification",
    mode: "review",
    expected: "model-classification-map",
    segment: { id: "classes", start: 104, end: 114, text: "模型分成通用、推理、本地和行业四类。" },
    draft: {
      analysis: { rhetoric: "model-classification", categoryCount: 4 },
      narrative: narrative("四种模型定位"),
      props: { items: [{ title: "通用" }, { title: "推理" }, { title: "本地" }, { title: "行业" }] },
    },
  },
  {
    name: "capability surface",
    mode: "review",
    expected: "capability-surface-grid",
    segment: { id: "surface", start: 124, end: 134, text: "五种抗体在四项指标上进行比较。" },
    draft: {
      analysis: { rhetoric: "capability-surface", entityCount: 5, dimensionCount: 4 },
      narrative: narrative("能力覆盖矩阵"),
      props: {
        rows: ["A", "B", "C", "D", "E"],
        columns: ["纯度", "回收率", "稳定性", "聚集体"],
        values: [
          [0.8, 0.8, 0.8, 0.8],
          [0.8, 0.8, 0.8, 0.8],
          [0.8, 0.8, 0.8, 0.8],
          [0.8, 0.8, 0.8, 0.8],
          [0.8, 0.8, 0.8, 0.8],
        ],
      },
    },
  },
  {
    name: "design tradeoff",
    mode: "review",
    expected: "tradeoff-scale",
    segment: { id: "tradeoff", start: 134, end: 144, text: "精度提高会牺牲速度并增加成本。" },
    draft: {
      analysis: { rhetoric: "tradeoff", dimensionCount: 3 },
      narrative: narrative("三项权衡"),
      props: {
        items: [
          { label: "速度", value: 48 },
          { label: "精度", value: 91 },
          { label: "成本", value: 76 },
        ],
      },
    },
  },
];

export const buildVisualBriefExampleOutputs = () =>
  visualBriefExamples.map((example) => ({
    ...example,
    output: generateVisualBriefFromDraft(example.segment, example.draft, example.mode),
  }));
