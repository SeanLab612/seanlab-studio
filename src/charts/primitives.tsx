import type React from "react";
import { chartTokens, colorTokens, typographyTokens } from "../design-tokens";

export const chartColors = chartTokens.series;

export const ChartGrid: React.FC<{ width: number; height: number; rows?: number; columns?: number }> = ({
  width,
  height,
  rows = 4,
  columns = 0,
}) => (
  <g data-chart-primitive="grid">
    {Array.from({ length: rows + 1 }, (_, index) => (
      <line
        key={`r-${index}`}
        x1={0}
        x2={width}
        y1={(index / rows) * height}
        y2={(index / rows) * height}
        stroke={chartTokens.gridMajor}
      />
    ))}
    {Array.from({ length: columns + 1 }, (_, index) =>
      columns ? (
        <line
          key={`c-${index}`}
          y1={0}
          y2={height}
          x1={(index / columns) * width}
          x2={(index / columns) * width}
          stroke={chartTokens.gridMinor}
        />
      ) : null,
    )}
  </g>
);

export const ChartAxis: React.FC<{
  x: number;
  y: number;
  length: number;
  orientation: "horizontal" | "vertical";
  label?: string;
}> = ({ x, y, length, orientation, label }) => (
  <g data-chart-primitive="axis">
    <line
      x1={x}
      y1={y}
      x2={orientation === "horizontal" ? x + length : x}
      y2={orientation === "vertical" ? y - length : y}
      stroke={chartTokens.axis}
      strokeWidth={1.5}
    />
    {label ? (
      <text
        x={orientation === "horizontal" ? x + length : x - 10}
        y={orientation === "horizontal" ? y + 30 : y - length}
        textAnchor={orientation === "horizontal" ? "end" : "end"}
        fill={colorTokens.paperMuted}
        fontSize={14}
        fontWeight={700}
      >
        {label}
      </text>
    ) : null}
  </g>
);

export const BarMark: React.FC<{
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  opacity?: number;
}> = ({ x, y, width, height, color, opacity = 1 }) => (
  <rect
    data-chart-primitive="bar"
    x={x}
    y={y}
    width={Math.max(0, width)}
    height={Math.max(0, height)}
    rx={Math.min(12, width / 3)}
    fill={color}
    opacity={opacity}
  />
);

export const LineMark: React.FC<{ d: string; color: string; progress?: number; width?: number; fill?: string }> = ({
  d,
  color,
  progress = 1,
  width = 4,
  fill = "none",
}) => (
  <path
    data-chart-primitive="line"
    d={d}
    fill={fill}
    stroke={color}
    strokeWidth={width}
    strokeLinecap="round"
    strokeLinejoin="round"
    pathLength={1}
    strokeDasharray={1}
    strokeDashoffset={1 - progress}
  />
);

export const PointMark: React.FC<{ x: number; y: number; color: string; radius?: number; label?: string }> = ({
  x,
  y,
  color,
  radius = 6,
  label,
}) => (
  <g data-chart-primitive="point">
    <circle cx={x} cy={y} r={radius + 5} fill={color} opacity={0.15} />
    <circle cx={x} cy={y} r={radius} fill={color} />
    {label ? (
      <text x={x + radius + 7} y={y + 5} fill={colorTokens.paper} fontSize={14} fontWeight={750}>
        {label}
      </text>
    ) : null}
  </g>
);

export const RangeBand: React.FC<{ d: string; color: string }> = ({ d, color }) => (
  <path data-chart-primitive="range" d={d} fill={color} opacity={0.16} />
);

export const ThresholdLine: React.FC<{ x1: number; x2: number; y: number; label: string; color?: string }> = ({
  x1,
  x2,
  y,
  label,
  color = colorTokens.amber,
}) => (
  <g data-chart-primitive="threshold">
    <line x1={x1} x2={x2} y1={y} y2={y} stroke={color} strokeWidth={2} strokeDasharray="7 7" />
    <text x={x2} y={y - 8} textAnchor="end" fill={color} fontSize={13} fontWeight={800}>
      {label}
    </text>
  </g>
);

export const ChartLegend: React.FC<{ items: Array<{ label: string; color: string }>; x?: number; y?: number }> = ({
  items,
  x = 0,
  y = 0,
}) => (
  <g data-chart-primitive="legend" transform={`translate(${x} ${y})`}>
    {items.map((item, index) => (
      <g key={item.label} transform={`translate(${index * 118} 0)`}>
        <circle cx={5} cy={5} r={5} fill={item.color} />
        <text x={16} y={10} fill={colorTokens.paperMuted} fontSize={13} fontWeight={700}>
          {item.label}
        </text>
      </g>
    ))}
  </g>
);

export const ChartSvg: React.FC<{ children: React.ReactNode; width?: number; height?: number }> = ({
  children,
  width = 700,
  height = 430,
}) => (
  <svg
    data-chart-surface="true"
    width={width}
    height={height}
    viewBox={`0 0 ${width} ${height}`}
    style={{ overflow: "visible", fontFamily: typographyTokens.family }}
  >
    {children}
  </svg>
);
