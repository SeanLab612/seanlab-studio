import React from "react";
import { Icon, type IconId } from "../../icons";
import { IdentityMark, type MediaEntityKind } from "../../media-assets";
import { enter, palette, rise } from "./shared";
import { EmphasisText } from "./TextEmphasis";
import { resolveProgressiveEmphasis } from "./progressive-emphasis";

export type BinaryVersusItem = {
  id: string;
  iconId?: IconId | string;
  entityId?: string;
  entityKind?: MediaEntityKind;
  eyebrow?: string;
  label: string;
  metric: string;
  detail?: string;
  accent?: string;
};

export type BinaryVersusProps = {
  frame: number;
  fps: number;
  items: [BinaryVersusItem, BinaryVersusItem];
  relation?: "VS" | "OR" | "→" | "=";
  selectedId?: string;
  activeIndex?: number;
  activeProgress?: number;
  takeaway?: string;
  compact?: boolean;
};

export const BinaryVersus: React.FC<BinaryVersusProps> = ({
  frame,
  fps,
  items,
  relation = "VS",
  selectedId,
  activeIndex = items.length - 1,
  activeProgress = 1,
  takeaway,
  compact = false,
}) => {
  const intro = enter(frame, fps, 7);
  return (
    <div
      style={{
        position: "absolute",
        left: compact ? 54 : 70,
        top: compact ? 210 : 224,
        width: compact ? 590 : 760,
        ...rise(intro),
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: compact ? "1fr 48px 1fr" : "1fr 72px 1fr",
          alignItems: "stretch",
          gap: compact ? 7 : 14,
        }}
      >
        {items.map((item, index) => {
          const progress = enter(frame, fps, 15 + index * 12);
          const emphasis = resolveProgressiveEmphasis({ index, activeIndex, activeProgress });
          const selected = item.id === selectedId;
          const accent = item.accent ?? (index === 0 ? palette.mint : palette.red);
          const stableOpacity = selectedId ? (selected ? 1 : 0.5) : emphasis.opacity;
          const metricSize =
            item.metric.length > 12
              ? 34
              : item.metric.length > 9
                ? 38
                : item.metric.length > 7
                  ? 44
                  : compact
                    ? 46
                    : 55;
          return (
            <React.Fragment key={item.id}>
              {index === 1 ? (
                <div
                  style={{
                    fontSize: relation.length > 1 ? 34 : 42,
                    fontWeight: 950,
                    color: palette.amber,
                    textAlign: "center",
                    textShadow: `0 0 24px ${palette.amber}66`,
                    alignSelf: "center",
                    ...rise(enter(frame, fps, 24), 8),
                    opacity: activeIndex >= 1 ? activeProgress : 0,
                  }}
                >
                  {relation}
                </div>
              ) : null}
              <div
                style={{
                  position: "relative",
                  height: compact ? 310 : 292,
                  minWidth: 0,
                  overflow: "hidden",
                  padding: compact ? "8px 10px" : "8px 12px",
                  ...rise(progress, 18),
                  opacity: stableOpacity * progress,
                  filter: selectedId
                    ? `brightness(${selected ? 1 : 0.68}) saturate(${selected ? 1 : 0.62})`
                    : `brightness(${emphasis.brightness}) saturate(${emphasis.saturation})`,
                  transform: `scale(${selectedId ? (selected ? 1 : 0.985) : emphasis.scale})`,
                  textShadow: "0 2px 8px rgba(0,0,0,0.68)",
                }}
              >
                {selected ? (
                  <div
                    style={{
                      position: "absolute",
                      top: 8,
                      right: 8,
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: accent,
                      boxShadow: `0 0 16px ${accent}`,
                    }}
                  />
                ) : null}
                <div
                  style={{
                    height: "100%",
                    minWidth: 0,
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {item.entityId && item.entityKind ? (
                      <IdentityMark
                        entityId={item.entityId}
                        kind={item.entityKind}
                        label={item.label}
                        size={40}
                        color={accent}
                      />
                    ) : (
                      <Icon id={item.iconId} fallbackLabel={item.label} size={40} color={accent} variant="dark" />
                    )}
                    <div style={{ minWidth: 0 }}>
                      {item.eyebrow ? (
                        <div
                          style={{
                            fontSize: 20,
                            fontWeight: 850,
                            letterSpacing: compact ? 1.2 : 1.5,
                            color: accent,
                            lineHeight: 1.15,
                            whiteSpace: "normal",
                          }}
                        >
                          {item.eyebrow}
                        </div>
                      ) : null}
                      <div
                        style={{
                          fontSize: compact ? 25 : 26,
                          fontWeight: 850,
                          marginTop: item.eyebrow ? 5 : 0,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <EmphasisText text={item.label} />
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: metricSize,
                      lineHeight: 1.05,
                      fontWeight: 950,
                      color: accent,
                      marginTop: 38,
                      overflow: "hidden",
                      display: "-webkit-box",
                      WebkitBoxOrient: "vertical",
                      WebkitLineClamp: 3,
                      overflowWrap: "anywhere",
                    }}
                  >
                    <EmphasisText text={item.metric} />
                  </div>
                  {item.detail ? (
                    <div
                      style={{
                        fontSize: 26,
                        lineHeight: 1.4,
                        fontWeight: 650,
                        opacity: 0.82,
                        marginTop: 16,
                        overflow: "hidden",
                        display: "-webkit-box",
                        WebkitBoxOrient: "vertical",
                        WebkitLineClamp: 3,
                      }}
                    >
                      <EmphasisText text={item.detail} />
                    </div>
                  ) : null}
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>
      {takeaway ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginTop: 24,
            paddingLeft: 12,
            ...rise(enter(frame, fps, 36), 10),
          }}
        >
          <div style={{ fontSize: 28, fontWeight: 780 }}>
            <EmphasisText text={takeaway} />
          </div>
        </div>
      ) : null}
    </div>
  );
};
