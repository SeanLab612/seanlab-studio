export type SemanticCoverageStatus = "approved" | "legacy" | "review" | "planned";

export type SemanticCoverageEntry = {
  id: string;
  label: string;
  status: SemanticCoverageStatus;
  componentIds: readonly string[];
  referenceBatch?: string;
  notes: string;
};

export const semanticCoverageRegistry = [
  {
    id: "editorial-statement",
    label: "观点陈述",
    status: "approved",
    componentIds: ["editorial-statement"],
    notes:
      "One complete plain-language claim with no stronger structured or material-backed form; capped at 25 percent of a video and two consecutive uses.",
  },
  {
    id: "rough-annotation",
    label: "手绘语义标注",
    status: "approved",
    componentIds: ["rough-annotation"],
    notes: "Seven official Remotion rough-notation effects selected from local evidence-bound semantic intent.",
  },
  {
    id: "model-classification-map",
    label: "模型分类地图",
    status: "approved",
    componentIds: ["model-classification-map"],
    notes: "Approved parameterized classification map with 2-6 categories.",
  },
  {
    id: "core-positioning-node",
    label: "核心定位节点",
    status: "review",
    componentIds: ["core-positioning-node"],
    notes:
      "Retired from the approved registry and retained for historical artifacts only; new core-and-supports production coverage belongs to the approved layered-system animation prototype.",
  },
  {
    id: "capability-surface-grid",
    label: "能力覆盖矩阵",
    status: "approved",
    componentIds: ["capability-surface-grid"],
    notes: "Approved dynamic 2-6 row and column capability grid.",
  },
  {
    id: "tradeoff-scale",
    label: "多指标权衡",
    status: "approved",
    componentIds: ["tradeoff-scale"],
    notes: "Approved dynamic 2-3 dimension tradeoff view.",
  },
  {
    id: "point-in-time-comparison",
    label: "单一时间截面对比",
    status: "approved",
    componentIds: ["distribution-bars"],
    notes: "Dynamic entity count and optional population row.",
  },
  {
    id: "conditional-scenarios",
    label: "条件分支与正反情景",
    status: "approved",
    componentIds: ["scenario-branches"],
    notes: "Active-branch emphasis and completed-branch dimming.",
  },
  {
    id: "multi-entity-time-series",
    label: "多实体时间序列",
    status: "approved",
    componentIds: ["market-cap-lines"],
    notes: "Dynamic series count, smooth curves, and collision-aware labels.",
  },
  {
    id: "person-and-evidence",
    label: "人物、观点与证据链",
    status: "approved",
    componentIds: ["person-evidence-card"],
    notes: "Optional portrait, quote, evidence cards, and timeline.",
  },
  {
    id: "binary-versus-comparison",
    label: "双项、正反观点与方案对比",
    status: "approved",
    componentIds: ["binary-versus"],
    referenceBatch: "legacy-reference-02",
    notes: "Two fully visible options, one primary metric per side, and a central relationship marker.",
  },
  {
    id: "key-stat-summary",
    label: "大数字、比例与关键结论",
    status: "approved",
    componentIds: ["key-stat-summary"],
    referenceBatch: "legacy-reference-01",
    notes: "One to three headline metrics, a conclusion, and compact evidence chips.",
  },
  {
    id: "factor-sequence",
    label: "多因素或多步骤逐项解释与自动降权",
    status: "approved",
    componentIds: ["factor-sequence"],
    referenceBatch: "legacy-reference-03, legacy-reference-04",
    notes: "Three to five icon-led factors or ordered stages; the active item is vivid and completed items dim.",
  },
  {
    id: "media-and-interface-comparison",
    label: "截图、界面与来源对比",
    status: "approved",
    componentIds: ["media-comparison"],
    referenceBatch: "legacy-reference-07",
    notes: "One to three screenshots with product identity, captions, and relationship symbols.",
  },
  {
    id: "project-image-evidence",
    label: "项目截图与图片证据",
    status: "approved",
    componentIds: ["image-evidence-inset"],
    notes: "One locally registered and checksum-frozen image, rendered with aspect-aware contain or cover behavior.",
  },
  {
    id: "ranked-metric-list",
    label: "多模型、多选项评分与测评排行",
    status: "approved",
    componentIds: ["ranked-metric-list"],
    referenceBatch: "legacy-reference-05, legacy-reference-06",
    notes:
      "Three to eight options remain fully visible; supports price, score, percentage, duration, numeric benchmark, and a highlighted conclusion.",
  },
  {
    id: "quote-and-source-card",
    label: "引用、报道与来源卡",
    status: "approved",
    componentIds: ["quote-source-card"],
    notes: "Exact quote, source identity, date, citation metadata, and optional source screenshot.",
  },
  {
    id: "causal-chain",
    label: "因果关系与传导链",
    status: "approved",
    componentIds: ["causal-chain"],
    notes: "Three to five directional cause, mechanism, intermediate-effect, and outcome nodes.",
  },
  {
    id: "process-steps",
    label: "流程与步骤",
    status: "approved",
    componentIds: ["process-steps"],
    notes: "Three to six strictly ordered steps with completed, current, and pending states.",
  },
  {
    id: "historical-timeline",
    label: "历史演变与时间线",
    status: "approved",
    componentIds: ["historical-timeline"],
    notes: "Approved 3-6 dated milestone timeline.",
  },
  {
    id: "decision-matrix",
    label: "四象限与矩阵判断",
    status: "approved",
    componentIds: ["decision-matrix"],
    notes: "Approved two-axis positioning with 2-8 entities.",
  },
] as const satisfies readonly SemanticCoverageEntry[];

export const getSemanticCoverage = (id: string) => semanticCoverageRegistry.find((entry) => entry.id === id);
