import type React from "react";
import type { IconId } from "../../icons";
import { chartAccentPair, enter, palette, rise } from "./shared";
import { EmphasisText } from "./TextEmphasis";
import { resolveProgressiveEmphasis } from "./progressive-emphasis";

export type ProcessStepItem = {
  id: string;
  title: string;
  detail?: string;
  iconId?: IconId | string;
  duration?: string;
  warning?: string;
  accent?: string;
};

export type ProcessStepsProps = {
  frame: number;
  fps: number;
  items: ProcessStepItem[];
  activeIndex: number;
  activeProgress?: number;
  takeaway?: string;
};

export const ProcessSteps: React.FC<ProcessStepsProps> = ({
  frame,
  fps,
  items,
  activeIndex,
  activeProgress = 1,
  takeaway,
}) => {
  if (items.length < 3 || items.length > 6)
    throw new Error(`ProcessSteps expects 3-6 items, received ${items.length}.`);
  const current = Math.max(0, Math.min(items.length - 1, activeIndex));
  const rowHeight = Math.min(102, Math.floor(430 / items.length));
  const intro = enter(frame, fps, 7);
  const accents = chartAccentPair(
    items[current]?.accent,
    items.map((item) => item.accent),
  );

  return (
    <div style={{ position: "absolute", left: 70, top: 205, width: 740, ...rise(intro) }}>
      <div style={{ position: "relative", display: "flex", flexDirection: "column" }}>
        <div
          style={{
            position: "absolute",
            left: 18,
            top: 30,
            bottom: 30,
            width: 2,
            borderRadius: 99,
            background: "rgba(255,255,255,0.14)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 18,
            top: 30,
            width: 2,
            height: `${(current / Math.max(1, items.length - 1)) * 88}%`,
            maxHeight: "calc(100% - 60px)",
            borderRadius: 99,
            background: `linear-gradient(${accents[0]}, ${accents[1]})`,
            boxShadow: `0 0 16px ${accents[1]}77`,
          }}
        />

        {items.map((item, index) => {
          const progress = enter(frame, fps, 12 + index * 5);
          const emphasis = resolveProgressiveEmphasis({ index, activeIndex: current, activeProgress });
          const completed = emphasis.state === "completed";
          const active = emphasis.state === "active";
          const accent = accents[index % accents.length];
          return (
            <div
              key={item.id}
              style={{
                display: "grid",
                gridTemplateColumns: "48px minmax(0, 1fr) 82px",
                gap: 10,
                alignItems: "center",
                minHeight: rowHeight,
                ...rise(progress, 12),
                opacity: emphasis.opacity * progress,
                filter: `brightness(${emphasis.brightness}) saturate(${emphasis.saturation})`,
                transform: `scale(${emphasis.scale})`,
                transformOrigin: "left center",
              }}
            >
              <div
                style={{
                  position: "relative",
                  zIndex: 2,
                  width: 38,
                  color: active || completed ? accent : palette.muted,
                  fontSize: 24,
                  fontWeight: 900,
                  letterSpacing: -0.8,
                  textShadow: active ? `0 0 18px ${accent}88` : "none",
                }}
              >
                {String(index + 1).padStart(2, "0")}
              </div>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: rowHeight < 82 ? 29 : 36,
                    fontWeight: 880,
                    lineHeight: 1.05,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  <EmphasisText text={item.title.trim()} />
                </div>
                {item.detail ? (
                  <div style={{ fontSize: 22, fontWeight: 680, color: palette.muted, marginTop: 8, lineHeight: 1.2 }}>
                    <EmphasisText text={item.detail} />
                  </div>
                ) : null}
              </div>
              <div style={{ textAlign: "right", minWidth: 0 }}>
                {item.duration ? (
                  <div style={{ fontSize: 22, fontWeight: 850, color: accent }}>{item.duration}</div>
                ) : null}
                {item.warning ? (
                  <div style={{ fontSize: 22, fontWeight: 780, color: accent, marginTop: 7 }}>{item.warning}</div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      {takeaway ? (
        <div
          style={{
            fontSize: 24,
            fontWeight: 780,
            color: accents[1],
            marginTop: 14,
            marginLeft: 64,
            ...rise(enter(frame, fps, 48), 8),
          }}
        >
          <EmphasisText text={takeaway} />
        </div>
      ) : null}
    </div>
  );
};
