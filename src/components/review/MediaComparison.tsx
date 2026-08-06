import React from "react";
import { Img, staticFile } from "remotion";
import { Icon, type IconId } from "../../icons";
import { Shimmer } from "../../motion-primitives";
import { IdentityMark, type MediaEntityKind } from "../../media-assets";
import { enter, palette, rise } from "./shared";
import { EmphasisText } from "./TextEmphasis";

export type MediaComparisonItem = {
  id: string;
  imageSrc?: string;
  iconId?: IconId | string;
  entityId?: string;
  entityKind?: MediaEntityKind;
  label: string;
  source?: string;
  caption?: string;
  accent?: string;
};

export type MediaComparisonProps = {
  frame: number;
  fps: number;
  items: MediaComparisonItem[];
  relation?: "=" | "≠" | "VS" | "→";
  takeaway?: string;
  shimmerProgress?: number;
};

export const MediaComparison: React.FC<MediaComparisonProps> = ({
  frame,
  fps,
  items,
  relation = "=",
  takeaway,
  shimmerProgress,
}) => {
  if (items.length < 1 || items.length > 3)
    throw new Error(`MediaComparison expects 1-3 items, received ${items.length}.`);
  const width = items.length === 1 ? 620 : items.length === 2 ? 330 : 220;
  const imageHeight = items.length === 3 ? 156 : 210;
  return (
    <div style={{ position: "absolute", left: 70, top: 210, width: 740 }}>
      <div
        style={{
          display: "flex",
          justifyContent: items.length === 1 ? "flex-start" : "space-between",
          alignItems: "center",
          gap: 14,
        }}
      >
        {items.map((item, index) => {
          const progress = enter(frame, fps, 10 + index * 16);
          const accent = item.accent ?? [palette.blue, palette.amber, palette.mint][index];
          return (
            <React.Fragment key={item.id}>
              {index > 0 ? (
                <div
                  style={{
                    fontSize: items.length === 3 ? 25 : 34,
                    fontWeight: 950,
                    color: palette.amber,
                    ...rise(enter(frame, fps, 22 + index * 16), 6),
                  }}
                >
                  {relation}
                </div>
              ) : null}
              <div style={{ width, minWidth: 0, ...rise(progress, 20) }}>
                <div style={{ height: 3, width: 72, borderRadius: 99, background: accent, marginBottom: 12 }} />
                <div
                  style={{
                    height: imageHeight,
                    borderRadius: 12,
                    overflow: "hidden",
                    position: "relative",
                    background: "rgba(255,255,255,0.92)",
                    outline: `1px solid ${accent}55`,
                    boxShadow: "0 16px 34px rgba(0,0,0,0.24)",
                  }}
                >
                  {item.imageSrc ? (
                    <Img
                      src={staticFile(item.imageSrc)}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : item.entityId && item.entityKind ? (
                    <div style={{ height: "100%", display: "grid", placeItems: "center" }}>
                      <IdentityMark
                        entityId={item.entityId}
                        kind={item.entityKind}
                        label={item.label}
                        size={96}
                        color={accent}
                      />
                    </div>
                  ) : (
                    <div style={{ height: "100%", display: "grid", placeItems: "center", color: accent }}>
                      <Icon id={item.iconId} fallbackLabel={item.label} size={64} color={accent} variant="light" />
                    </div>
                  )}
                  {shimmerProgress !== undefined && shimmerProgress < 1 ? (
                    <Shimmer progress={shimmerProgress} borderRadius={14} />
                  ) : null}
                </div>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginTop: 14 }}>
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
                    <div
                      style={{
                        fontSize: items.length === 3 ? 23 : 27,
                        fontWeight: 850,
                        lineHeight: 1.15,
                        whiteSpace: "normal",
                        overflowWrap: "anywhere",
                      }}
                    >
                      <EmphasisText text={item.label} />
                    </div>
                    {item.source ? (
                      <div
                        style={{
                          fontSize: 22,
                          fontWeight: 760,
                          color: accent,
                          opacity: 0.82,
                          letterSpacing: 1.1,
                          marginTop: 2,
                        }}
                      >
                        {item.source}
                      </div>
                    ) : null}
                  </div>
                </div>
                {item.caption ? (
                  <div style={{ fontSize: 24, lineHeight: 1.35, fontWeight: 680, opacity: 0.86, marginTop: 10 }}>
                    <EmphasisText text={item.caption} />
                  </div>
                ) : null}
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
            justifyContent: "center",
            marginTop: 24,
            ...rise(enter(frame, fps, 66), 9),
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
