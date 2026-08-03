import type React from "react";
import { interpolate } from "remotion";
import { Icon, type IconId } from "../../icons";
import { LiquidGlass } from "../LiquidGlass";
import { enter, palette, rise } from "./shared";
import { EmphasisText } from "./TextEmphasis";
import { resolveProgressiveEmphasis } from "./progressive-emphasis";

export type FactorSequenceItem = {
  id: string;
  iconId?: IconId | string;
  title: string;
  detail?: string;
  accent?: string;
};

export type FactorSequenceProps = {
  frame: number;
  fps: number;
  items: FactorSequenceItem[];
  activeIndex: number;
  activeProgress?: number;
  headline?: string;
  highlightedText?: string;
  summary?: string;
};

const assertItemCount = (count: number) => {
  if (count < 3 || count > 5) {
    throw new Error(`FactorSequence expects 3-5 items, received ${count}.`);
  }
};

export const FactorSequence: React.FC<FactorSequenceProps> = ({
  frame,
  fps,
  items,
  activeIndex,
  activeProgress = 1,
  headline,
  highlightedText,
  summary,
}) => {
  assertItemCount(items.length);
  const intro = enter(frame, fps, 7);
  const columns = items.length === 4 ? 2 : 3;
  const compact = items.length > 3;
  const currentIndex = Math.max(0, Math.min(items.length - 1, activeIndex));

  return (
    <div style={{ position: "absolute", left: 70, top: 210, width: 740, ...rise(intro) }}>
      {headline || highlightedText ? (
        <div style={{ marginBottom: 30 }}>
          {headline ? (
            <div style={{ fontSize: 48, fontWeight: 850, lineHeight: 1.05 }}>
              <EmphasisText text={headline} />
            </div>
          ) : null}
          {highlightedText ? (
            <div style={{ fontSize: 54, fontWeight: 880, lineHeight: 1.05, color: palette.mint, marginTop: 6 }}>
              <EmphasisText text={highlightedText} />
            </div>
          ) : null}
          {summary ? <div style={{ fontSize: 24, fontWeight: 680, opacity: 0.8, marginTop: 13 }}>{summary}</div> : null}
        </div>
      ) : null}

      <div
        style={{ display: "grid", gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: compact ? 16 : 18 }}
      >
        {items.map((item, index) => {
          const itemProgress = enter(frame, fps, 14 + index * 6);
          const emphasis = resolveProgressiveEmphasis({ index, activeIndex: currentIndex, activeProgress });
          const isActive = emphasis.state === "active";
          const accent = item.accent ?? palette.blue;
          return (
            <div
              key={item.id}
              style={{
                ...rise(itemProgress, 14),
                opacity: emphasis.opacity * itemProgress,
                filter: `brightness(${emphasis.brightness}) saturate(${emphasis.saturation})`,
                transform: `scale(${interpolate(itemProgress, [0, 1], [0.96, emphasis.scale])})`,
                transition: "none",
              }}
            >
              <LiquidGlass
                surface="bare"
                accent={`${accent}${isActive ? "66" : "2A"}`}
                padding={compact ? "18px" : "22px"}
                radius={22}
                style={{
                  height: compact ? 128 : 178,
                }}
              >
                <div
                  style={{
                    height: "100%",
                    display: "flex",
                    flexDirection: compact ? "row" : "column",
                    alignItems: compact ? "center" : "flex-start",
                    gap: compact ? 16 : 18,
                  }}
                >
                  <Icon
                    id={item.iconId}
                    fallbackLabel={item.title}
                    size={compact ? 52 : 58}
                    color={accent}
                    variant="dark"
                  />
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: compact ? 28 : 30,
                        lineHeight: 1.12,
                        fontWeight: 850,
                        color: isActive ? palette.paper : "rgba(245,242,234,0.88)",
                      }}
                    >
                      <EmphasisText text={item.title} />
                    </div>
                    {item.detail ? (
                      <div
                        style={{
                          fontSize: compact ? 22 : 20,
                          lineHeight: 1.35,
                          fontWeight: 600,
                          opacity: 0.78,
                          marginTop: 9,
                        }}
                      >
                        <EmphasisText text={item.detail} />
                      </div>
                    ) : null}
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
