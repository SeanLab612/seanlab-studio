import type React from "react";
import { interpolate } from "remotion";
import { createNumericDomain, scaleLinear } from "../../charts";
import { LiquidGlass } from "../LiquidGlass";
import { enter, palette, rise, TinyPerson } from "./shared";
import { EmphasisText } from "./TextEmphasis";

export type DistributionBar = {
  label: string;
  value: number;
  displayValue?: string;
  emphasized?: boolean;
};

export type PopulationRow = {
  label: string;
  count?: number;
  highlightedCount?: number;
};

export const DistributionBars: React.FC<{
  frame: number;
  fps: number;
  bars?: DistributionBar[];
  annotation?: string;
  populationRow?: PopulationRow | null;
}> = ({
  frame,
  fps,
  bars = [
    { label: "20%", value: 24 },
    { label: "40%", value: 39 },
    { label: "60%", value: 58 },
    { label: "80%", value: 76, emphasized: true },
    { label: "TOP", value: 96, emphasized: true },
  ],
  annotation = "收益越高，资源越集中",
  populationRow = { label: "增长应该惠及每一个人", count: 16, highlightedCount: 4 },
}) => {
  const intro = enter(frame, fps, 7);
  const domain = createNumericDomain(
    bars.map((bar) => bar.value),
    { includeZero: true, padding: 0 },
  );
  const chartHeight = populationRow ? 325 : 410;
  const peopleCount = populationRow?.count ?? 0;
  const highlightedCount = populationRow?.highlightedCount ?? 0;
  return (
    <div style={{ position: "absolute", left: 74, top: populationRow ? 250 : 215, width: 720, ...rise(intro) }}>
      {annotation ? (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
          <LiquidGlass
            surface="bare"
            accent={`${palette.amber}55`}
            padding="9px 16px"
            radius={22}
            style={{ color: palette.amber, fontSize: 24, fontWeight: 800, letterSpacing: 1 }}
          >
            ↗ <EmphasisText text={annotation} />
          </LiquidGlass>
        </div>
      ) : null}
      <div style={{ height: chartHeight, display: "flex", alignItems: "flex-end", gap: 16 }}>
        {bars.map((bar, index) => {
          const p = enter(frame, fps, 14 + index * 6);
          const height = interpolate(p, [0, 1], [4, scaleLinear(bar.value, domain, [0, chartHeight - 45])]);
          const color = bar.emphasized ? palette.amber : "rgba(245,242,234,0.72)";
          const barWidth = Math.min(112, (720 - Math.max(0, bars.length - 1) * 16) / bars.length);
          return (
            <div key={bar.label} style={{ width: barWidth, textAlign: "center", position: "relative" }}>
              {bar.displayValue ? (
                <div style={{ fontSize: 22, fontWeight: 850, marginBottom: 9, color }}>{bar.displayValue}</div>
              ) : null}
              <div
                style={{
                  height,
                  borderRadius: "13px 13px 5px 5px",
                  background: `linear-gradient(180deg, ${color}, ${bar.emphasized ? `${palette.amber}66` : "rgba(245,242,234,0.22)"})`,
                  boxShadow: bar.emphasized ? `0 0 34px ${palette.amber}35` : "none",
                }}
              />
              <div style={{ fontSize: 22, fontWeight: 800, marginTop: 12, color }}>{bar.label}</div>
            </div>
          );
        })}
      </div>
      {populationRow ? (
        <>
          <div style={{ marginTop: 26, display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: palette.mint, letterSpacing: 1.8 }}>FOR EVERYONE</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>
              <EmphasisText text={populationRow.label} />
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 17 }}>
            {Array.from({ length: peopleCount }).map((_, index) => (
              <TinyPerson
                key={index}
                active={frame > 42 + index * 2}
                color={index >= peopleCount - highlightedCount ? palette.mint : palette.paper}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
};
