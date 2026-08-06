import type React from "react";
import { createLinePath, createNumericDomain, lineCoordinates, scaleLinear } from "../../charts";
import { clamp01, enter, palette, rise } from "./shared";
import { componentAccentTokens, resolveComponentAccent } from "../../design-tokens";
import { EmphasisText } from "./TextEmphasis";

export type MarketSeries = {
  name: string;
  valueLabel: string;
  points: number[];
  color?: string;
};

const seriesColors = componentAccentTokens;

const defaultSeries: MarketSeries[] = [
  { name: "NVDA", valueLabel: "$5.2T", points: [18, 24, 38, 61, 83, 100] },
  { name: "MSFT", valueLabel: "$4.1T", points: [22, 27, 39, 56, 72, 86] },
  { name: "AAPL", valueLabel: "$3.8T", points: [25, 30, 41, 53, 67, 79] },
  { name: "GOOGL", valueLabel: "$3.1T", points: [17, 22, 31, 45, 59, 69] },
  { name: "AMZN", valueLabel: "$2.7T", points: [14, 20, 28, 39, 50, 61] },
  { name: "META", valueLabel: "$1.9T", points: [12, 16, 23, 33, 43, 52] },
  { name: "TSLA", valueLabel: "$1.3T", points: [10, 13, 18, 25, 34, 43] },
];

export const MarketCapLines: React.FC<{
  frame: number;
  fps: number;
  series?: MarketSeries[];
  groupLabel?: string;
  totalValue?: string;
  totalCaption?: string;
  takeaway?: string;
  timeLabels?: string[];
}> = ({
  frame,
  fps,
  series = defaultSeries,
  groupLabel = "MAGNIFICENT 7",
  totalValue = "$21.9T",
  totalCaption = "总市值",
  takeaway = "七家公司，正在重塑整个指数",
  timeLabels = [],
}) => {
  const intro = enter(frame, fps, 8);
  const draw = clamp01((frame - 18) / 70);
  const allValues = series.flatMap((item) => item.points);
  const domain = createNumericDomain(allValues, { includeZero: false, padding: 0 });
  const graphWidth = 558;
  const graphHeight = 342;
  const endY = (item: MarketSeries) => {
    return graphHeight - scaleLinear(item.points[item.points.length - 1], domain, [0, graphHeight - 38]);
  };
  const sortedLabels = series
    .map((item, index) => ({ index, rawY: endY(item), labelY: endY(item) }))
    .sort((a, b) => a.rawY - b.rawY);
  const labelGap = series.length <= 4 ? 44 : 34;
  sortedLabels.forEach((label, index) => {
    label.labelY =
      index === 0 ? Math.max(18, label.rawY) : Math.max(label.rawY, sortedLabels[index - 1].labelY + labelGap);
  });
  const overflow = Math.max(0, sortedLabels[sortedLabels.length - 1].labelY - (graphHeight - 4));
  sortedLabels.forEach((label) => {
    label.labelY -= overflow;
  });
  const labelYByIndex = new Map(sortedLabels.map((label) => [label.index, label.labelY]));

  return (
    <div style={{ position: "absolute", left: 70, top: 220, width: 780, ...rise(intro) }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: palette.amber, letterSpacing: 3.4 }}>
          <EmphasisText text={groupLabel} />
        </div>
        <div style={{ fontSize: 50, fontWeight: 880 }}>
          <EmphasisText text={totalValue} />
        </div>
        <div style={{ fontSize: 24, fontWeight: 700, color: palette.muted }}>{totalCaption}</div>
      </div>
      <svg width="760" height="440" viewBox="0 0 760 440" style={{ marginTop: 8, overflow: "visible" }}>
        {[0, 1, 2, 3].map((n) => (
          <line key={n} x1="20" y1={48 + n * 88} x2="605" y2={48 + n * 88} stroke="rgba(255,255,255,0.08)" />
        ))}
        {timeLabels.length >= 2
          ? timeLabels.map((label, index) => (
              <text
                key={`${label}-${index}`}
                x={12 + (index * graphWidth) / Math.max(1, timeLabels.length - 1)}
                y="410"
                fill="rgba(245,242,234,0.62)"
                fontSize="20"
                textAnchor={index === 0 ? "start" : index === timeLabels.length - 1 ? "end" : "middle"}
              >
                {label}
              </text>
            ))
          : null}
        {series.map((item, index) => {
          const color = resolveComponentAccent(item.color, seriesColors[index % seriesColors.length]);
          const y = endY(item);
          const labelY = labelYByIndex.get(index) ?? y;
          return (
            <g key={item.name}>
              <path
                d={createLinePath(lineCoordinates(item.points, domain, graphWidth + 24, graphHeight, 12))}
                fill="none"
                stroke={color}
                strokeWidth={index === 0 ? 7 : 4}
                strokeLinecap="round"
                strokeLinejoin="round"
                pathLength="1"
                strokeDasharray="1"
                strokeDashoffset={1 - clamp01((draw - index * 0.04) / 0.76)}
                opacity={index === 0 ? 1 : 0.82}
              />
              <circle cx={582} cy={y} r={index === 0 ? 7 : 5} fill={color} />
              <line x1="588" y1={y} x2="602" y2={labelY} stroke={color} strokeWidth="2" opacity="0.6" />
              <foreignObject x="606" y={labelY - 18} width="104" height="42">
                <div
                  style={{
                    color,
                    fontSize: item.name.length > 8 ? 18 : 22,
                    fontWeight: 850,
                    lineHeight: 1.05,
                    overflowWrap: "anywhere",
                  }}
                >
                  {item.name}
                </div>
              </foreignObject>
              <text x="748" y={labelY + 8} textAnchor="end" fill={palette.paper} fontSize="22" fontWeight="750">
                {item.valueLabel}
              </text>
            </g>
          );
        })}
      </svg>
      <div style={{ display: "flex", alignItems: "center", marginTop: -30 }}>
        <div style={{ fontSize: 26, fontWeight: 850 }}>
          <EmphasisText text={takeaway} />
        </div>
      </div>
    </div>
  );
};
