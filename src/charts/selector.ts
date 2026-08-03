import { chartRecipeRegistry } from "./registry.ts";
import type { ChartIntent, ChartRecipeId } from "./types.ts";

export const selectChartRecipe = (intent: ChartIntent): { id: ChartRecipeId; reason: string } => {
  let id: ChartRecipeId;
  if (intent.relation === "time-series") id = intent.hasRanges ? "interval-band" : "line-trend";
  else if (intent.relation === "proportion") id = "ring-ratio";
  else if (intent.relation === "bridge") id = "waterfall";
  else if (intent.relation === "range") id = "interval-band";
  else if (intent.relation === "funnel") id = "funnel";
  else if (intent.relation === "before-after") id = "before-after";
  else if (intent.relation === "risk-return") id = "risk-return-quadrant";
  else if (intent.relation === "distribution" && intent.metricCount >= 2) id = "scatter";
  else if (intent.entityCount > 8) id = "dot-plot";
  else id = "bar-comparison";
  const definition = chartRecipeRegistry[id];
  if (intent.entityCount < definition.minItems || intent.entityCount > definition.maxItems)
    throw new Error(`${id} expects ${definition.minItems}-${definition.maxItems} items.`);
  if (intent.hasNegativeValues && !definition.supportsNegative)
    throw new Error(`${id} does not support negative values.`);
  if (intent.hasRanges && !definition.supportsRange && id !== "line-trend")
    throw new Error(`${id} does not support ranges.`);
  return { id, reason: `${intent.relation} with ${intent.entityCount} entities maps to ${id}.` };
};

export const validateChartIntent = (intent: ChartIntent) => {
  if (!Number.isInteger(intent.entityCount) || intent.entityCount < 1)
    throw new Error("chartIntent.entityCount must be positive.");
  if (!Number.isInteger(intent.metricCount) || intent.metricCount < 1)
    throw new Error("chartIntent.metricCount must be positive.");
  return selectChartRecipe(intent);
};
