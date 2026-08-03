import { validateChartModel } from "./core.ts";
import { chartRecipeRegistry } from "./registry.ts";
import type { ChartModel, ChartRecipeId, ChartValidationIssue } from "./types.ts";

const relativeLuminance = (hex: string) => {
  const match = hex.match(/^#([0-9a-f]{6})$/i);
  if (!match) return 1;
  const channels = [0, 2, 4].map((offset) => Number.parseInt(match[1].slice(offset, offset + 2), 16) / 255);
  return channels
    .map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
    .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
};

export const validateChartQa = ({
  recipeId,
  model,
  width = 700,
  minimumFontPx = 12,
  declaredFontPx = 13,
  finalStateHasMarks = true,
}: {
  recipeId: ChartRecipeId;
  model: ChartModel;
  width?: number;
  minimumFontPx?: number;
  declaredFontPx?: number;
  finalStateHasMarks?: boolean;
}): ChartValidationIssue[] => {
  const issues = validateChartModel(model);
  const definition = chartRecipeRegistry[recipeId];
  const items = ["line-trend", "interval-band"].includes(recipeId)
    ? Math.max(0, ...(model.series ?? []).map((series) => series.values.length))
    : (model.data?.length ?? model.series?.length ?? 0);
  if (items < definition.minItems || items > definition.maxItems)
    issues.push({
      severity: "error",
      rule: "chart.capacity",
      message: `${recipeId} supports ${definition.minItems}-${definition.maxItems} items.`,
    });
  if (declaredFontPx < minimumFontPx)
    issues.push({
      severity: "error",
      rule: "chart.font.minimum",
      message: `Chart text is ${declaredFontPx}px; minimum is ${minimumFontPx}px.`,
    });
  if ((model.data ?? []).some((item) => item.label.length > 18))
    issues.push({
      severity: "warning",
      rule: "chart.label.long",
      message: "A chart label exceeds 18 characters and may truncate.",
    });
  if (items > 0 && width / items < 42 && ["bar-comparison", "funnel", "before-after"].includes(recipeId))
    issues.push({
      severity: "warning",
      rule: "chart.label.overlap",
      message: "Available width per item may cause label overlap.",
    });
  if (
    ["bar-comparison", "line-trend", "dot-plot", "waterfall", "interval-band"].includes(recipeId) &&
    !model.unit &&
    !model.format
  )
    issues.push({
      severity: "warning",
      rule: "chart.unit.missing",
      message: "Quantitative chart should declare a unit or value format.",
    });
  if (model.categories && model.series?.some((series) => series.values.length !== model.categories?.length))
    issues.push({
      severity: "error",
      rule: "chart.legend.mismatch",
      message: "Series lengths must match category labels.",
    });
  const colors = [
    ...(model.data ?? []).map((item) => item.color),
    ...(model.series ?? []).map((item) => item.color),
  ].filter((value): value is string => Boolean(value));
  if (colors.some((color) => relativeLuminance(color) < 0.08))
    issues.push({
      severity: "warning",
      rule: "chart.color.contrast",
      message: "A chart color has low contrast against the dark surface.",
    });
  if (!finalStateHasMarks)
    issues.push({
      severity: "error",
      rule: "chart.end-state.empty",
      message: "Chart ends without visible data marks.",
    });
  return issues;
};
