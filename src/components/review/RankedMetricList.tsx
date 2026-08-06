import type React from "react";
import { interpolate } from "remotion";
import { normalizeValue } from "../../charts";
import { Icon, type IconId } from "../../icons";
import { IdentityMark, type MediaEntityKind } from "../../media-assets";
import { LiquidGlass } from "../LiquidGlass";
import { enter, palette, rise } from "./shared";
import { EmphasisText } from "./TextEmphasis";

export type MetricMode = "price" | "score" | "percentage" | "duration" | "number";
export type RankingDirection = "higher-is-better" | "lower-is-better";

export type RankedMetricItem = {
  id: string;
  iconId?: IconId | string;
  entityId?: string;
  entityKind?: MediaEntityKind;
  label: string;
  sublabel?: string;
  value: number;
  displayValue?: string;
  badges?: string[];
  accent?: string;
};

export type RankedMetricCallout = {
  label: string;
  value: string;
  detail?: string;
  accent?: string;
};

export type RankedMetricListProps = {
  frame: number;
  fps: number;
  items: RankedMetricItem[];
  mode: MetricMode;
  rankingDirection?: RankingDirection;
  highlightId?: string;
  metricLabel?: string;
  takeaway?: string;
  callout?: RankedMetricCallout;
  previousOrderIds?: string[];
  reorderProgress?: number;
  compact?: boolean;
};

const assertItemCount = (count: number) => {
  if (count < 3 || count > 8) {
    throw new Error(`RankedMetricList expects 3-8 items, received ${count}.`);
  }
};

const directionFor = (mode: MetricMode, override?: RankingDirection): RankingDirection => {
  if (override) return override;
  return mode === "price" || mode === "duration" ? "lower-is-better" : "higher-is-better";
};

const formatValue = (item: RankedMetricItem, mode: MetricMode) => {
  if (item.displayValue) return item.displayValue;
  if (mode === "price") return `$${item.value}`;
  if (mode === "percentage") return `${item.value}%`;
  if (mode === "duration") return `${item.value}s`;
  return `${item.value}`;
};

export const RankedMetricList: React.FC<RankedMetricListProps> = ({
  frame,
  fps,
  items,
  mode,
  rankingDirection,
  highlightId,
  metricLabel,
  takeaway,
  callout,
  previousOrderIds,
  reorderProgress = 1,
  compact = false,
}) => {
  assertItemCount(items.length);
  const intro = enter(frame, fps, 7);
  const direction = directionFor(mode, rankingDirection);
  const sortedItems = items
    .map((item, inputIndex) => ({ item, inputIndex }))
    .sort((a, b) => {
      const delta = direction === "higher-is-better" ? b.item.value - a.item.value : a.item.value - b.item.value;
      return delta || a.inputIndex - b.inputIndex;
    })
    .map(({ item }) => item);
  const winnerId = highlightId ?? sortedItems[0].id;
  const values = sortedItems.map((item) => item.value);
  const rowHeight = Math.min(compact ? 82 : 80, Math.max(62, Math.floor((compact ? 510 : 520) / sortedItems.length)));

  return (
    <div
      style={{
        position: "absolute",
        left: compact ? 54 : 70,
        top: compact ? 194 : 204,
        width: compact ? 590 : 740,
        ...rise(intro),
      }}
    >
      <div
        style={{
          minHeight: callout ? 104 : 60,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 18,
        }}
      >
        <div>
          {metricLabel ? (
            <div style={{ fontSize: compact ? 23 : 23, fontWeight: 850, color: palette.amber, letterSpacing: 2.4 }}>
              {metricLabel}
            </div>
          ) : null}
          {takeaway ? (
            <div
              style={{
                fontSize: compact ? 26 : 25,
                fontWeight: 760,
                marginTop: 10,
                maxWidth: callout ? (compact ? 350 : 510) : "100%",
              }}
            >
              <EmphasisText text={takeaway} />
            </div>
          ) : null}
        </div>
        {callout ? (
          <LiquidGlass
            surface="bare"
            accent={`${callout.accent ?? palette.amber}55`}
            padding="12px 18px"
            radius={20}
            style={{ width: 190 }}
          >
            <div style={{ fontSize: 20, fontWeight: 780, opacity: 0.86 }}>{callout.label}</div>
            <div
              style={{
                fontSize: 36,
                lineHeight: 1,
                fontWeight: 900,
                color: callout.accent ?? palette.amber,
                marginTop: 7,
              }}
            >
              {callout.value}
            </div>
            {callout.detail ? (
              <div style={{ fontSize: 18, fontWeight: 680, opacity: 0.8, marginTop: 7 }}>{callout.detail}</div>
            ) : null}
          </LiquidGlass>
        ) : null}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
        {sortedItems.map((item, index) => {
          const rowProgress = enter(frame, fps, 14 + index * 5);
          const isWinner = item.id === winnerId;
          const accent = item.accent ?? (isWinner ? palette.amber : palette.blue);
          const barWidth = Math.max(3, normalizeValue(item.value, values) * 100);
          const previousIndex = previousOrderIds?.indexOf(item.id) ?? index;
          const reorderOffset =
            (previousIndex >= 0 ? previousIndex - index : 0) * (rowHeight + 8) * (1 - reorderProgress);
          return (
            <div
              key={item.id}
              style={{
                ...rise(rowProgress, 10),
                opacity: rowProgress,
                transform: `translate3d(0, ${reorderOffset}px, 0) scale(${previousIndex !== index ? 1 + Math.sin(reorderProgress * Math.PI) * 0.018 : 1})`,
                position: "relative",
                zIndex: previousIndex !== index ? 2 : 1,
              }}
            >
              <LiquidGlass
                surface="bare"
                accent={`${accent}${isWinner ? "50" : "20"}`}
                padding="0px"
                radius={17}
                style={{
                  minHeight: rowHeight,
                }}
              >
                <div
                  style={{
                    minHeight: rowHeight,
                    display: "grid",
                    gridTemplateColumns: compact ? "184px 1fr 60px" : "232px 1fr 78px",
                    alignItems: "center",
                    gap: compact ? 10 : 14,
                    padding: compact ? "0 12px" : "0 16px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 13, minWidth: 0 }}>
                    {item.entityId && item.entityKind ? (
                      <IdentityMark
                        entityId={item.entityId}
                        kind={item.entityKind}
                        label={item.label}
                        size={Math.min(48, rowHeight - 15)}
                      />
                    ) : (
                      <Icon
                        id={item.iconId}
                        fallbackLabel={item.label}
                        size={Math.min(48, rowHeight - 15)}
                        variant="light"
                      />
                    )}
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: compact ? 20 : rowHeight < 68 ? 18 : 21,
                          fontWeight: 850,
                          lineHeight: 1.08,
                          whiteSpace: "normal",
                          overflowWrap: "anywhere",
                          color: isWinner ? accent : palette.paper,
                        }}
                      >
                        <EmphasisText text={item.label} />
                      </div>
                      {item.sublabel ? (
                        <div
                          style={{
                            fontSize: rowHeight < 68 ? 16 : 18,
                            fontWeight: 750,
                            opacity: 0.76,
                            letterSpacing: 0.9,
                            marginTop: 3,
                            lineHeight: 1.08,
                            whiteSpace: "normal",
                            overflowWrap: "anywhere",
                          }}
                        >
                          {item.sublabel}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div>
                    <div
                      style={{
                        height: 12,
                        borderRadius: 999,
                        background: "rgba(255,255,255,0.11)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${interpolate(rowProgress, [0, 1], [0, barWidth])}%`,
                          height: "100%",
                          borderRadius: 999,
                          background: isWinner ? `linear-gradient(90deg, ${accent}, #FFF0A8)` : accent,
                          boxShadow: isWinner ? `0 0 22px ${accent}77` : "none",
                        }}
                      />
                    </div>
                    {item.badges?.length ? (
                      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                        {item.badges.slice(0, 3).map((badge) => (
                          <span
                            key={badge}
                            style={{ fontSize: 19, fontWeight: 800, color: accent, letterSpacing: 0.2 }}
                          >
                            {badge}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div
                    style={{
                      fontSize: compact ? 28 : rowHeight < 65 ? 24 : 30,
                      fontWeight: 900,
                      color: isWinner ? accent : palette.paper,
                      textAlign: "right",
                    }}
                  >
                    {formatValue(item, mode)}
                  </div>
                </div>
              </LiquidGlass>
            </div>
          );
        })}
      </div>
    </div>
  );
};
