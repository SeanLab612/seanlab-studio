import type { ChartModel, ChartValidationIssue, ChartValueFormat } from "./types.ts";

export type NumericDomain = { min: number; max: number };

export const createNumericDomain = (values: number[], options: { includeZero?: boolean; padding?: number } = {}) => {
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return { min: 0, max: 1 } satisfies NumericDomain;
  let min = Math.min(...finite);
  let max = Math.max(...finite);
  if (options.includeZero !== false) {
    min = Math.min(0, min);
    max = Math.max(0, max);
  }
  if (min === max) max = min + Math.max(1, Math.abs(min) * 0.1);
  const padding = (max - min) * (options.padding ?? 0.08);
  return { min: min - padding, max: max + padding } satisfies NumericDomain;
};

export const scaleLinear = (value: number, domain: NumericDomain, range: [number, number]) => {
  const progress = (value - domain.min) / Math.max(Number.EPSILON, domain.max - domain.min);
  return range[0] + Math.min(1, Math.max(0, progress)) * (range[1] - range[0]);
};

export const normalizeValue = (value: number, values: number[]) =>
  scaleLinear(value, createNumericDomain(values, { includeZero: true, padding: 0 }), [0, 1]);

export const bandPositions = (count: number, start: number, end: number, gap = 12) => {
  const safeCount = Math.max(1, count);
  const width = Math.max(1, (end - start - gap * (safeCount - 1)) / safeCount);
  return Array.from({ length: safeCount }, (_, index) => ({ x: start + index * (width + gap), width }));
};

export const formatChartValue = (
  value: number,
  format: ChartValueFormat = "number",
  options: { currency?: string; maximumFractionDigits?: number } = {},
) => {
  if (!Number.isFinite(value)) return "—";
  if (format === "percentage") return `${value.toLocaleString("zh-CN", { maximumFractionDigits: 1 })}%`;
  if (format === "currency")
    return new Intl.NumberFormat("zh-CN", {
      style: "currency",
      currency: options.currency ?? "CNY",
      maximumFractionDigits: options.maximumFractionDigits ?? 0,
    }).format(value);
  if (format === "duration") return `${value.toLocaleString("zh-CN", { maximumFractionDigits: 1 })}s`;
  return value.toLocaleString("zh-CN", { maximumFractionDigits: options.maximumFractionDigits ?? 1 });
};

export const lineCoordinates = (values: number[], domain: NumericDomain, width: number, height: number, padding = 0) =>
  values.map((value, index) => ({
    x: padding + (index / Math.max(1, values.length - 1)) * (width - padding * 2),
    y: height - padding - scaleLinear(value, domain, [0, height - padding * 2]),
  }));

export const createLinePath = (coordinates: Array<{ x: number; y: number }>, smooth = true) => {
  if (!coordinates.length) return "";
  if (coordinates.length === 1) return `M${coordinates[0].x} ${coordinates[0].y}`;
  let path = `M${coordinates[0].x.toFixed(1)} ${coordinates[0].y.toFixed(1)}`;
  if (!smooth)
    return `${path} ${coordinates
      .slice(1)
      .map((point) => `L${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
      .join(" ")}`;
  for (let index = 0; index < coordinates.length - 1; index += 1) {
    const p0 = coordinates[index - 1] ?? coordinates[index];
    const p1 = coordinates[index];
    const p2 = coordinates[index + 1];
    const p3 = coordinates[index + 2] ?? p2;
    path += ` C${(p1.x + (p2.x - p0.x) / 6).toFixed(1)} ${(p1.y + (p2.y - p0.y) / 6).toFixed(1)} ${(p2.x - (p3.x - p1.x) / 6).toFixed(1)} ${(p2.y - (p3.y - p1.y) / 6).toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return path;
};

export const validateChartModel = (model: ChartModel): ChartValidationIssue[] => {
  const issues: ChartValidationIssue[] = [];
  const data = model.data ?? [];
  const series = model.series ?? [];
  if (!data.length && !series.length)
    issues.push({ severity: "error", rule: "chart.data.empty", message: "Chart requires data or series." });
  const values = [...data.map((item) => item.value), ...series.flatMap((item) => item.values)];
  if (values.some((value) => !Number.isFinite(value)))
    issues.push({ severity: "error", rule: "chart.value.invalid", message: "Chart values must be finite numbers." });
  if (data.some((item) => item.label.trim().length === 0))
    issues.push({ severity: "error", rule: "chart.label.empty", message: "Every datum requires a label." });
  if (data.length > 12)
    issues.push({
      severity: "warning",
      rule: "chart.density.data",
      message: "More than 12 data points may be too dense.",
    });
  if (series.length > 7)
    issues.push({
      severity: "warning",
      rule: "chart.density.series",
      message: "More than seven series may be hard to distinguish.",
    });
  if (model.format === "percentage" && values.some((value) => value < 0 || value > 100))
    issues.push({
      severity: "error",
      rule: "chart.percentage.range",
      message: "Percentage values must be between 0 and 100.",
    });
  return issues;
};
