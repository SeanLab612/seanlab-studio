import type React from "react";
import { formatChartValue, type ChartValueFormat } from "../../charts";
import { Icon, type IconId } from "../../icons";
import { LiquidGlass } from "../LiquidGlass";
import { enter, palette, rise } from "./shared";
import { EmphasisText } from "./TextEmphasis";

export type KeyStatItem = {
  id: string;
  value: string;
  label: string;
  detail?: string;
  accent?: string;
  numericValue?: number;
  valueFormat?: ChartValueFormat;
};

export type KeyStatChip = {
  id: string;
  iconId?: IconId | string;
  text: string;
  accent?: string;
};

export type KeyStatSummaryProps = {
  frame: number;
  fps: number;
  items: KeyStatItem[];
  conclusion?: string;
  chips?: KeyStatChip[];
};

export const KeyStatSummary: React.FC<KeyStatSummaryProps> = ({ frame, fps, items, conclusion, chips = [] }) => {
  if (items.length < 1 || items.length > 3)
    throw new Error(`KeyStatSummary expects 1-3 items, received ${items.length}.`);
  const intro = enter(frame, fps, 7);
  return (
    <div style={{ position: "absolute", left: 70, top: 220, width: 740, ...rise(intro) }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
          gap: 24,
          alignItems: "end",
        }}
      >
        {items.map((item, index) => {
          const progress = enter(frame, fps, 14 + index * 10);
          const accent = item.accent ?? [palette.blue, palette.amber, palette.mint][index];
          return (
            <div key={item.id} style={{ ...rise(progress, 22), minWidth: 0 }}>
              <div
                style={{
                  fontSize: items.length === 1 ? 108 : items.length === 2 ? 78 : 58,
                  lineHeight: 0.95,
                  fontWeight: 950,
                  color: accent,
                  letterSpacing: -3,
                  textShadow: `0 0 30px ${accent}2A`,
                  whiteSpace: "nowrap",
                }}
              >
                <EmphasisText
                  text={
                    item.numericValue === undefined ? item.value : formatChartValue(item.numericValue, item.valueFormat)
                  }
                />
              </div>
              <div style={{ fontSize: 22, fontWeight: 850, marginTop: 20 }}>
                <EmphasisText text={item.label} />
              </div>
              {item.detail ? (
                <div style={{ fontSize: 22, fontWeight: 650, opacity: 0.78, marginTop: 8, lineHeight: 1.35 }}>
                  {item.detail}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {conclusion ? (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 34, ...rise(enter(frame, fps, 40), 12) }}>
          <LiquidGlass surface="bare" accent={`${palette.mint}45`} padding="14px 24px" radius={19}>
            <div style={{ fontSize: 26, fontWeight: 820 }}>
              <EmphasisText text={conclusion} />
            </div>
          </LiquidGlass>
        </div>
      ) : null}

      {chips.length ? (
        <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
          {chips.slice(0, 3).map((chip, index) => {
            const accent = chip.accent ?? [palette.blue, palette.amber, palette.mint][index];
            return (
              <div key={chip.id} style={rise(enter(frame, fps, 50 + index * 6), 10)}>
                <LiquidGlass surface="bare" accent={`${accent}38`} padding="8px 10px" radius={15}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 22, fontWeight: 780 }}>
                    <Icon id={chip.iconId} fallbackLabel={chip.text} size={28} color={accent} variant="dark" />
                    {chip.text}
                  </div>
                </LiquidGlass>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};
