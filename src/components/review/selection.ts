export type ReviewComponentId =
  | "distribution-bars"
  | "scenario-branches"
  | "market-cap-lines"
  | "person-evidence-card"
  | "factor-sequence"
  | "ranked-metric-list"
  | "binary-versus"
  | "key-stat-summary"
  | "media-comparison"
  | "image-evidence-inset"
  | "process-steps"
  | "causal-chain"
  | "quote-source-card"
  | "historical-timeline"
  | "decision-matrix"
  | "model-classification-map"
  | "capability-surface-grid"
  | "tradeoff-scale";

export type VisualAnalysis = {
  rhetoric:
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
    | "tradeoff";
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
};

export type SelectionDecision = {
  componentId: ReviewComponentId;
  modules: {
    populationRow: boolean;
  };
  reason: string;
};

export const selectReviewComponent = (analysis: VisualAnalysis): SelectionDecision => {
  const comparableEntityCount = analysis.entityCount ?? 0;
  const sequenceItemCount = Math.max(analysis.factorCount ?? 0, analysis.stepCount ?? 0);
  const statCount = analysis.statCount ?? 0;
  const mediaCount = analysis.mediaCount ?? 0;
  const nodeCount = analysis.nodeCount ?? 0;

  if (
    analysis.rhetoric === "historical-timeline" &&
    (analysis.milestoneCount ?? 0) >= 3 &&
    (analysis.milestoneCount ?? 0) <= 6
  )
    return {
      componentId: "historical-timeline",
      modules: { populationRow: false },
      reason: "Three to six explicit milestones form a historical or progression timeline.",
    };
  if (analysis.rhetoric === "decision-matrix" && comparableEntityCount >= 2 && comparableEntityCount <= 8)
    return {
      componentId: "decision-matrix",
      modules: { populationRow: false },
      reason: "Entities are positioned on two explicit decision axes.",
    };
  if (
    analysis.rhetoric === "model-classification" &&
    (analysis.categoryCount ?? 0) >= 2 &&
    (analysis.categoryCount ?? 0) <= 6
  )
    return {
      componentId: "model-classification-map",
      modules: { populationRow: false },
      reason: "Two to six categories form a classification map.",
    };
  if (analysis.rhetoric === "core-positioning" && nodeCount >= 2 && nodeCount <= 6)
    throw new Error("No approved review component currently covers core-positioning semantics.");
  if (analysis.rhetoric === "capability-surface" && comparableEntityCount >= 2 && (analysis.dimensionCount ?? 0) >= 2)
    return {
      componentId: "capability-surface-grid",
      modules: { populationRow: false },
      reason: "Entities are evaluated across multiple capability dimensions.",
    };
  if (analysis.rhetoric === "tradeoff" && (analysis.dimensionCount ?? 0) >= 2 && (analysis.dimensionCount ?? 0) <= 3)
    return {
      componentId: "tradeoff-scale",
      modules: { populationRow: false },
      reason: "Two or three metrics move in tension.",
    };

  if (analysis.rhetoric === "person-evidence") {
    return {
      componentId: "person-evidence-card",
      modules: { populationRow: false },
      reason: "The spoken argument is anchored to a named person and supporting evidence.",
    };
  }

  if (analysis.rhetoric === "scenario" && (analysis.branchCount ?? 0) >= 2) {
    return {
      componentId: "scenario-branches",
      modules: { populationRow: false },
      reason: "The argument presents at least two conditional outcomes.",
    };
  }

  if (analysis.hasTimeSeries && (analysis.entityCount ?? 0) >= 2) {
    return {
      componentId: "market-cap-lines",
      modules: { populationRow: false },
      reason: "Multiple comparable entities are measured over time.",
    };
  }

  if (
    comparableEntityCount >= 3 &&
    comparableEntityCount <= 8 &&
    (analysis.rhetoric === "ranking" || (analysis.rhetoric === "comparison" && analysis.sharedMetric))
  ) {
    return {
      componentId: "ranked-metric-list",
      modules: { populationRow: false },
      reason: "Three or more entities share one comparable numeric metric and should be ranked together.",
    };
  }

  if (analysis.rhetoric === "comparison" && comparableEntityCount === 2) {
    return {
      componentId: "binary-versus",
      modules: { populationRow: false },
      reason: "Exactly two options or viewpoints are contrasted.",
    };
  }

  if (analysis.rhetoric === "key-stat" && statCount >= 1 && statCount <= 3) {
    return {
      componentId: "key-stat-summary",
      modules: { populationRow: false },
      reason: "One to three headline values carry the spoken conclusion.",
    };
  }

  if (analysis.rhetoric === "media-comparison" && mediaCount >= 1 && mediaCount <= 3) {
    return {
      componentId: "media-comparison",
      modules: { populationRow: false },
      reason: "One to three screenshots or visual sources support the argument.",
    };
  }

  if (analysis.rhetoric === "image-evidence") {
    return {
      componentId: "image-evidence-inset",
      modules: { populationRow: false },
      reason: "One registered project image directly supports the spoken claim.",
    };
  }

  if (analysis.rhetoric === "process-steps" && sequenceItemCount >= 3 && sequenceItemCount <= 6) {
    return {
      componentId: "process-steps",
      modules: { populationRow: false },
      reason: "The narration describes three to six strictly ordered procedural steps.",
    };
  }

  if (analysis.rhetoric === "causal-chain" && nodeCount >= 3 && nodeCount <= 5) {
    return {
      componentId: "causal-chain",
      modules: { populationRow: false },
      reason: "Three to five linked nodes form one directional cause-and-effect chain.",
    };
  }

  if (analysis.rhetoric === "quote-source") {
    return {
      componentId: "quote-source-card",
      modules: { populationRow: false },
      reason: "An exact quote is anchored to a named source.",
    };
  }

  if (
    sequenceItemCount >= 3 &&
    sequenceItemCount <= 5 &&
    (analysis.rhetoric === "factor-sequence" || analysis.rhetoric === "process")
  ) {
    return {
      componentId: "factor-sequence",
      modules: { populationRow: false },
      reason: "The argument explains three to five factors or ordered stages in sequence.",
    };
  }

  return {
    componentId: "distribution-bars",
    modules: { populationRow: Boolean(analysis.involvesPopulation) },
    reason: analysis.involvesPopulation
      ? "A point-in-time comparison also carries a population-coverage claim."
      : "A point-in-time comparison is best represented by bars without a population motif.",
  };
};
