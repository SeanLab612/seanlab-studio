import type { ApprovedVisualComponentId } from "../visual-brief/types.ts";
import { CHART_RECIPE_IDS, type ChartRecipeId, type ChartRelation, type RestrictedChartRecipeId } from "./types.ts";

export type ChartRecipeDefinition = {
  id: ChartRecipeId;
  status: "approved";
  relations: readonly ChartRelation[];
  minItems: number;
  maxItems: number;
  supportsNegative: boolean;
  supportsRange: boolean;
};

const recipe = (
  id: ChartRecipeId,
  relations: readonly ChartRelation[],
  minItems: number,
  maxItems: number,
  options: Partial<Pick<ChartRecipeDefinition, "supportsNegative" | "supportsRange">> = {},
): ChartRecipeDefinition => ({
  id,
  status: "approved",
  relations,
  minItems,
  maxItems,
  supportsNegative: false,
  supportsRange: false,
  ...options,
});

export const chartRecipeRegistry: Record<ChartRecipeId, ChartRecipeDefinition> = {
  "bar-comparison": recipe("bar-comparison", ["category-comparison", "distribution"], 2, 12, {
    supportsNegative: true,
  }),
  "line-trend": recipe("line-trend", ["time-series"], 2, 7),
  "dot-plot": recipe("dot-plot", ["category-comparison", "distribution"], 3, 12, { supportsNegative: true }),
  "ring-ratio": recipe("ring-ratio", ["proportion"], 1, 3),
  waterfall: recipe("waterfall", ["bridge"], 3, 10, { supportsNegative: true }),
  scatter: recipe("scatter", ["distribution", "risk-return"], 3, 20, { supportsNegative: true }),
  "interval-band": recipe("interval-band", ["range", "time-series"], 2, 12, { supportsRange: true }),
  funnel: recipe("funnel", ["funnel"], 3, 7),
  "before-after": recipe("before-after", ["before-after"], 2, 8, { supportsNegative: true }),
  "risk-return-quadrant": recipe("risk-return-quadrant", ["risk-return"], 2, 12, { supportsNegative: true }),
};

if (Object.keys(chartRecipeRegistry).length !== CHART_RECIPE_IDS.length)
  throw new Error("Chart recipe registry is incomplete.");

export const restrictedChartRecipes: Record<RestrictedChartRecipeId, { status: "restricted"; reason: string }> = {
  radar: {
    status: "restricted",
    reason:
      "Radar is allowed only when all dimensions share a normalized scale and visual area is not used as the conclusion.",
  },
};

export const componentChartBindings: Partial<Record<ApprovedVisualComponentId, readonly ChartRecipeId[]>> = {
  "distribution-bars": ["bar-comparison", "dot-plot", "ring-ratio"],
  "market-cap-lines": ["line-trend", "interval-band"],
  "ranked-metric-list": ["bar-comparison", "dot-plot"],
  "key-stat-summary": ["ring-ratio", "before-after"],
  "decision-matrix": ["scatter", "risk-return-quadrant"],
};
