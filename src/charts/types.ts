export const CHART_RECIPE_IDS = [
  "bar-comparison",
  "line-trend",
  "dot-plot",
  "ring-ratio",
  "waterfall",
  "scatter",
  "interval-band",
  "funnel",
  "before-after",
  "risk-return-quadrant",
] as const;

export type ChartRecipeId = (typeof CHART_RECIPE_IDS)[number];
export type RestrictedChartRecipeId = "radar";
export type ChartValueFormat = "number" | "percentage" | "currency" | "duration";
export type ChartRelation =
  | "category-comparison"
  | "time-series"
  | "distribution"
  | "proportion"
  | "bridge"
  | "range"
  | "funnel"
  | "before-after"
  | "risk-return";

export type ChartIntent = {
  relation: ChartRelation;
  entityCount: number;
  metricCount: number;
  timePointCount?: number;
  hasNegativeValues?: boolean;
  hasRanges?: boolean;
  hasSharedScale?: boolean;
  normalizedPercent?: boolean;
  preferredOrientation?: "horizontal" | "vertical";
};

export type ChartDatum = {
  id: string;
  label: string;
  value: number;
  displayValue?: string;
  secondaryValue?: number;
  low?: number;
  high?: number;
  x?: number;
  y?: number;
  color?: string;
};

export type ChartSeries = {
  id: string;
  label: string;
  color?: string;
  values: number[];
};

export type ChartModel = {
  title?: string;
  unit?: string;
  format?: ChartValueFormat;
  data?: ChartDatum[];
  series?: ChartSeries[];
  categories?: string[];
  target?: number;
  source?: string;
};

export type ChartValidationIssue = {
  severity: "warning" | "error";
  rule: string;
  message: string;
};
