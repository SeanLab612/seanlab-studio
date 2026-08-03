import type React from "react";
import { interpolate } from "remotion";
import { chartTokens, colorTokens } from "../design-tokens";
import {
  bandPositions,
  createLinePath,
  createNumericDomain,
  formatChartValue,
  lineCoordinates,
  scaleLinear,
} from "./core";
import {
  BarMark,
  ChartAxis,
  ChartGrid,
  ChartLegend,
  ChartSvg,
  chartColors,
  LineMark,
  PointMark,
  RangeBand,
} from "./primitives";
import type { ChartDatum, ChartModel, ChartRecipeId } from "./types";

const progressFor = (frame: number, start = 8, duration = 42) =>
  interpolate(frame, [start, start + duration], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
const dataOr = (model: ChartModel, fallback: ChartDatum[]) => (model.data?.length ? model.data : fallback);

const BarChart: React.FC<{ model: ChartModel; frame: number }> = ({ model, frame }) => {
  const data = dataOr(model, [
    { id: "a", label: "A", value: 48 },
    { id: "b", label: "B", value: 72 },
    { id: "c", label: "C", value: 91 },
  ]);
  const domain = createNumericDomain(data.map((item) => item.value));
  const bands = bandPositions(data.length, 42, 650, 16);
  const progress = progressFor(frame);
  return (
    <ChartSvg>
      <ChartGrid width={620} height={320} rows={4} />
      <ChartAxis x={30} y={320} length={620} orientation="horizontal" label={model.unit} />
      {data.map((item, index) => {
        const height = scaleLinear(item.value, domain, [0, 286]) * progress;
        const band = bands[index];
        return (
          <g key={item.id}>
            <BarMark
              x={band.x}
              y={320 - height}
              width={band.width}
              height={height}
              color={item.color ?? chartColors[index % chartColors.length]}
            />
            <text
              x={band.x + band.width / 2}
              y={350}
              textAnchor="middle"
              fill={colorTokens.paper}
              fontSize={14}
              fontWeight={750}
            >
              {item.label}
            </text>
            <text
              x={band.x + band.width / 2}
              y={310 - height}
              textAnchor="middle"
              fill={item.color ?? chartColors[index % chartColors.length]}
              fontSize={15}
              fontWeight={850}
            >
              {item.displayValue ?? formatChartValue(item.value, model.format)}
            </text>
          </g>
        );
      })}
    </ChartSvg>
  );
};

const LineChart: React.FC<{ model: ChartModel; frame: number; band?: boolean }> = ({ model, frame, band }) => {
  const series = model.series?.length
    ? model.series
    : [
        { id: "a", label: "样本 A", values: [22, 35, 31, 58, 71] },
        { id: "b", label: "样本 B", values: [18, 28, 44, 49, 63] },
      ];
  const domain = createNumericDomain(series.flatMap((item) => item.values));
  const progress = progressFor(frame, 10, 58);
  const paths = series.map((item) => createLinePath(lineCoordinates(item.values, domain, 610, 300, 12)));
  const first = lineCoordinates(series[0].values, domain, 610, 300, 12);
  const bandPath = first.length
    ? `${createLinePath(
        first.map((point) => ({ ...point, y: point.y - 28 })),
        false,
      )} L${[...first]
        .reverse()
        .map((point) => `${point.x.toFixed(1)} ${(point.y + 28).toFixed(1)}`)
        .join(" L")} Z`
    : "";
  return (
    <ChartSvg>
      <g transform="translate(32 18)">
        <ChartGrid width={610} height={300} rows={4} columns={4} />
        {band ? <RangeBand d={bandPath} color={series[0].color ?? chartColors[0]} /> : null}
        {series.map((item, index) => (
          <LineMark
            key={item.id}
            d={paths[index]}
            color={item.color ?? chartColors[index]}
            progress={progress}
            width={index ? 3 : 5}
          />
        ))}
        <ChartLegend
          items={series.map((item, index) => ({ label: item.label, color: item.color ?? chartColors[index] }))}
          y={340}
        />
      </g>
    </ChartSvg>
  );
};

const DotPlot: React.FC<{ model: ChartModel; frame: number }> = ({ model, frame }) => {
  const data = dataOr(model, [
    { id: "a", label: "方案 A", value: 32 },
    { id: "b", label: "方案 B", value: 58 },
    { id: "c", label: "方案 C", value: 84 },
  ]);
  const domain = createNumericDomain(data.map((item) => item.value));
  const p = progressFor(frame);
  return (
    <ChartSvg>
      {data.map((item, index) => {
        const y = 70 + index * 85;
        const x = scaleLinear(item.value, domain, [160, 620]) * p;
        const color = item.color ?? chartColors[index];
        return (
          <g key={item.id}>
            <text x={26} y={y + 5} fill={colorTokens.paper} fontSize={17} fontWeight={750}>
              {item.label}
            </text>
            <line x1={160} x2={620} y1={y} y2={y} stroke={chartTokens.track} strokeWidth={5} strokeLinecap="round" />
            <PointMark x={x} y={y} color={color} radius={7} />
            <text x={635} y={y + 6} fill={color} fontSize={17} fontWeight={850}>
              {item.displayValue ?? formatChartValue(item.value, model.format)}
            </text>
          </g>
        );
      })}
    </ChartSvg>
  );
};

const RingRatio: React.FC<{ model: ChartModel; frame: number }> = ({ model, frame }) => {
  const data = dataOr(model, [{ id: "ratio", label: "完成率", value: 68 }]).slice(0, 3);
  const p = progressFor(frame);
  return (
    <ChartSvg>
      {data.map((item, index) => {
        const radius = 72;
        const circumference = Math.PI * 2 * radius;
        const value = Math.max(0, Math.min(100, item.value));
        const x = 130 + index * 220;
        const color = item.color ?? chartColors[index];
        return (
          <g key={item.id} transform={`translate(${x} 180) rotate(-90)`}>
            <circle r={radius} fill="none" stroke={chartTokens.track} strokeWidth={18} />
            <circle
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth={18}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - (value / 100) * p)}
            />
            <text
              transform="rotate(90)"
              textAnchor="middle"
              y={9}
              fill={colorTokens.paper}
              fontSize={35}
              fontWeight={900}
            >
              {formatChartValue(value, "percentage")}
            </text>
            <text
              transform="rotate(90)"
              textAnchor="middle"
              y={116}
              fill={colorTokens.paperMuted}
              fontSize={16}
              fontWeight={750}
            >
              {item.label}
            </text>
          </g>
        );
      })}
    </ChartSvg>
  );
};

const Waterfall: React.FC<{ model: ChartModel; frame: number }> = ({ model, frame }) => {
  const data = dataOr(model, [
    { id: "start", label: "收入", value: 100 },
    { id: "cost", label: "成本", value: -38 },
    { id: "tax", label: "税费", value: -12 },
    { id: "end", label: "利润", value: 50 },
  ]);
  const domain = createNumericDomain([0, ...data.map((item) => item.value), 100]);
  const bands = bandPositions(data.length, 35, 660, 18);
  let running = 0;
  const p = progressFor(frame);
  return (
    <ChartSvg>
      <ChartGrid width={650} height={320} />
      {data.map((item, index) => {
        const previous = running;
        const isTotal = index === 0 || index === data.length - 1;
        running = isTotal ? item.value : running + item.value;
        const from = isTotal ? 0 : previous;
        const to = running;
        const y1 = scaleLinear(Math.max(from, to), domain, [310, 20]);
        const y2 = scaleLinear(Math.min(from, to), domain, [310, 20]);
        const color = isTotal ? chartColors[index ? 1 : 0] : item.value >= 0 ? colorTokens.mint : colorTokens.red;
        return (
          <g key={item.id}>
            <BarMark x={bands[index].x} y={y1} width={bands[index].width} height={(y2 - y1) * p} color={color} />
            <text
              x={bands[index].x + bands[index].width / 2}
              y={342}
              textAnchor="middle"
              fill={colorTokens.paper}
              fontSize={14}
              fontWeight={700}
            >
              {item.label}
            </text>
          </g>
        );
      })}
    </ChartSvg>
  );
};

const Scatter: React.FC<{ model: ChartModel; frame: number; quadrant?: boolean }> = ({ model, frame, quadrant }) => {
  const data = dataOr(model, [
    { id: "a", label: "A", value: 0, x: 22, y: 68 },
    { id: "b", label: "B", value: 0, x: 48, y: 42 },
    { id: "c", label: "C", value: 0, x: 76, y: 81 },
    { id: "d", label: "D", value: 0, x: 84, y: 30 },
  ]);
  const p = progressFor(frame);
  return (
    <ChartSvg>
      <g transform="translate(45 16)">
        <ChartGrid width={610} height={320} rows={quadrant ? 2 : 4} columns={quadrant ? 2 : 4} />
        <ChartAxis x={0} y={320} length={610} orientation="horizontal" label={quadrant ? "风险 →" : "X →"} />
        <ChartAxis x={0} y={320} length={320} orientation="vertical" label={quadrant ? "收益 ↑" : "Y ↑"} />
        {quadrant ? (
          <>
            <text x={460} y={35} fill={colorTokens.mint} fontSize={15} fontWeight={800}>
              高收益 / 高风险
            </text>
            <text x={18} y={302} fill={colorTokens.paperMuted} fontSize={14}>
              低收益 / 低风险
            </text>
          </>
        ) : null}
        {data.map((item, index) => (
          <PointMark
            key={item.id}
            x={scaleLinear(item.x ?? 0, { min: 0, max: 100 }, [0, 610])}
            y={scaleLinear(item.y ?? 0, { min: 0, max: 100 }, [320, 0])}
            color={item.color ?? chartColors[index]}
            radius={4 + p * 4}
            label={item.label}
          />
        ))}
      </g>
    </ChartSvg>
  );
};

const Funnel: React.FC<{ model: ChartModel; frame: number }> = ({ model, frame }) => {
  const data = dataOr(model, [
    { id: "a", label: "访问", value: 100 },
    { id: "b", label: "咨询", value: 62 },
    { id: "c", label: "试用", value: 36 },
    { id: "d", label: "付费", value: 18 },
  ]);
  const max = Math.max(...data.map((item) => item.value));
  const p = progressFor(frame);
  return (
    <ChartSvg>
      {data.map((item, index) => {
        const width = (item.value / max) * 580 * p;
        const x = 350 - width / 2;
        return (
          <g key={item.id}>
            <rect
              x={x}
              y={35 + index * 82}
              width={width}
              height={60}
              rx={14}
              fill={chartColors[index]}
              opacity={0.9 - index * 0.08}
            />
            <text x={350} y={72 + index * 82} textAnchor="middle" fill={colorTokens.ink} fontSize={17} fontWeight={850}>
              {item.label} · {formatChartValue(item.value, model.format)}
            </text>
          </g>
        );
      })}
    </ChartSvg>
  );
};

const BeforeAfter: React.FC<{ model: ChartModel; frame: number }> = ({ model, frame }) => {
  const data = dataOr(model, [
    { id: "speed", label: "处理时间", value: 58, secondaryValue: 18 },
    { id: "error", label: "错误率", value: 12, secondaryValue: 4 },
    { id: "cost", label: "单次成本", value: 42, secondaryValue: 27 },
  ]);
  const values = data.flatMap((item) => [item.value, item.secondaryValue ?? item.value]);
  const domain = createNumericDomain(values);
  const p = progressFor(frame);
  return (
    <ChartSvg>
      <ChartLegend
        items={[
          { label: "之前", color: colorTokens.paperMuted },
          { label: "之后", color: colorTokens.mint },
        ]}
        x={450}
        y={20}
      />
      {data.map((item, index) => {
        const y = 85 + index * 100;
        const before = scaleLinear(item.value, domain, [165, 620]);
        const after = scaleLinear(item.secondaryValue ?? item.value, domain, [165, 620]);
        return (
          <g key={item.id}>
            <text x={18} y={y + 6} fill={colorTokens.paper} fontSize={16} fontWeight={750}>
              {item.label}
            </text>
            <line
              x1={before}
              y1={y}
              x2={before + (after - before) * p}
              y2={y}
              stroke={colorTokens.paperMuted}
              strokeWidth={5}
            />
            <PointMark x={before} y={y} color={colorTokens.paperMuted} radius={6} />
            <PointMark x={before + (after - before) * p} y={y} color={colorTokens.mint} radius={7} />
          </g>
        );
      })}
    </ChartSvg>
  );
};

export const ChartRecipe: React.FC<{ recipeId: ChartRecipeId; model: ChartModel; frame: number }> = ({
  recipeId,
  model,
  frame,
}) => {
  if (recipeId === "bar-comparison") return <BarChart model={model} frame={frame} />;
  if (recipeId === "line-trend") return <LineChart model={model} frame={frame} />;
  if (recipeId === "dot-plot") return <DotPlot model={model} frame={frame} />;
  if (recipeId === "ring-ratio") return <RingRatio model={model} frame={frame} />;
  if (recipeId === "waterfall") return <Waterfall model={model} frame={frame} />;
  if (recipeId === "scatter") return <Scatter model={model} frame={frame} />;
  if (recipeId === "interval-band") return <LineChart model={model} frame={frame} band />;
  if (recipeId === "funnel") return <Funnel model={model} frame={frame} />;
  if (recipeId === "before-after") return <BeforeAfter model={model} frame={frame} />;
  return <Scatter model={model} frame={frame} quadrant />;
};
