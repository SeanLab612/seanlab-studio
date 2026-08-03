export const APPROVED_COMPONENT_IDS = [
  "distribution-bars",
  "scenario-branches",
  "market-cap-lines",
  "person-evidence-card",
  "factor-sequence",
  "ranked-metric-list",
  "binary-versus",
  "key-stat-summary",
  "media-comparison",
  "image-evidence-inset",
  "process-steps",
  "causal-chain",
  "quote-source-card",
  "historical-timeline",
  "decision-matrix",
  "model-classification-map",
  "capability-surface-grid",
  "tradeoff-scale",
  "rough-annotation",
] as const;

export type ApprovedVisualComponentId = (typeof APPROVED_COMPONENT_IDS)[number];
export const RETIRED_COMPONENT_IDS = ["core-positioning-node"] as const;
export type RetiredVisualComponentId = (typeof RETIRED_COMPONENT_IDS)[number];
// Retired IDs remain readable for already-frozen project artifacts, but new
// selection and registry validation use ApprovedVisualComponentId only.
export type VisualComponentId = ApprovedVisualComponentId | RetiredVisualComponentId;
export type GenerationMode = "production" | "review";

export type LocalizedText = { zh: string; en?: string };
export type TextRole = "caption" | "display-copy" | "design-label";

export type NarrationSegment = {
  id: string;
  start: number;
  end: number;
  text: string;
  subtitleEn?: string;
};

export type VisualRhetoric =
  | "scenario"
  | "comparison"
  | "trend"
  | "distribution"
  | "person-evidence"
  | "factor-sequence"
  | "process"
  | "process-steps"
  | "ranking"
  | "key-stat"
  | "media-comparison"
  | "image-evidence"
  | "causal-chain"
  | "quote-source"
  | "historical-timeline"
  | "decision-matrix"
  | "model-classification"
  | "core-positioning"
  | "capability-surface"
  | "tradeoff"
  | "rough-annotation";

export type VisualBriefAnalysis = {
  rhetoric: VisualRhetoric;
  motionIntent?: import("../motion-recipes/types.ts").MotionIntent;
  visualPriority?: "skip" | "normal" | "high";
  entityCount?: number;
  branchCount?: number;
  factorCount?: number;
  stepCount?: number;
  statCount?: number;
  mediaCount?: number;
  nodeCount?: number;
  milestoneCount?: number;
  dimensionCount?: number;
  categoryCount?: number;
  sharedMetric?: boolean;
  hasTimeSeries?: boolean;
  involvesPopulation?: boolean;
  chartIntent?: import("../charts/types.ts").ChartIntent;
  mediaIntents?: import("../media-assets/types.ts").MediaIntent[];
};

export type VisualBriefNarrative = {
  eyebrow: string;
  title: string;
  subtitleZh: string;
  subtitleEn: string;
  takeaway?: string;
};

export type VisualBriefDraft = {
  analysis: VisualBriefAnalysis;
  narrative: VisualBriefNarrative;
  props: Record<string, unknown>;
};

export type GeneratedVisualBrief = {
  schemaVersion: "1.0";
  segment: NarrationSegment;
  analysis: VisualBriefAnalysis;
  component: { id: VisualComponentId; status: "approved"; selectionReason: string };
  motion?: {
    intent: import("../motion-recipes/types.ts").MotionIntent;
    recipeId:
      | import("../motion-recipes/types.ts").MotionRecipeId
      | import("../motion-recipes/types.ts").CandidateMotionRecipeId;
  };
  chart?: {
    intent: import("../charts/types.ts").ChartIntent;
    recipeId: import("../charts/types.ts").ChartRecipeId;
    selectionReason: string;
  };
  narrative: VisualBriefNarrative;
  textRoles?: {
    segmentText: "caption";
    narrative: "display-copy";
    labels: "design-label";
  };
  props: Record<string, unknown>;
};

export type VisualBriefModelAdapter = {
  completeJson(input: { system: string; user: string }): Promise<unknown>;
};
