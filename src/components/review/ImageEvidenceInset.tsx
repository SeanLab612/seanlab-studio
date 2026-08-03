import type React from "react";
import { Img, interpolate, staticFile } from "remotion";
import { enter, palette } from "./shared";
import { EmphasisText } from "./TextEmphasis";

export type ImageEvidenceInsetProps = {
  frame: number;
  fps: number;
  assetId: string;
  imageSrc: string;
  orientation?: "landscape" | "portrait" | "square" | "long-portrait";
  fit?: "contain" | "cover";
  focalPoint?: { x: number; y: number };
  caption?: string;
  sourceLabel?: string;
};

const dimensionsFor = (orientation: NonNullable<ImageEvidenceInsetProps["orientation"]>) => {
  if (orientation === "long-portrait") return { width: 390, height: 570 };
  if (orientation === "portrait") return { width: 430, height: 540 };
  if (orientation === "square") return { width: 560, height: 500 };
  return { width: 740, height: 430 };
};

export const ImageEvidenceInset: React.FC<ImageEvidenceInsetProps> = ({
  frame,
  fps,
  assetId,
  imageSrc,
  orientation = "landscape",
  fit = "contain",
  focalPoint = { x: 0.5, y: 0.5 },
  caption,
  sourceLabel,
}) => {
  const progress = enter(frame, fps, 6);
  const { width, height } = dimensionsFor(orientation);
  const translate = interpolate(progress, [0, 1], [24, 0]);
  const scale = interpolate(progress, [0, 1], [0.975, 1]);
  return (
    <div
      data-image-evidence-id={assetId}
      style={{
        position: "absolute",
        left: 70,
        top: orientation === "landscape" ? 235 : 205,
        width,
        opacity: progress,
        transform: `translateY(${translate}px) scale(${scale})`,
      }}
    >
      <div
        style={{
          height,
          overflow: "hidden",
          position: "relative",
          borderRadius: 14,
          outline: `1px solid ${palette.mint}55`,
          boxShadow: "0 18px 38px rgba(0,0,0,0.28)",
        }}
      >
        <Img
          src={staticFile(imageSrc)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: fit,
            objectPosition: `${focalPoint.x * 100}% ${focalPoint.y * 100}%`,
          }}
        />
      </div>
      {caption || sourceLabel ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-start",
            alignItems: "flex-start",
            gap: 8,
            padding: "14px 2px 0",
            color: palette.paper,
          }}
        >
          <div style={{ fontSize: 26, lineHeight: 1.35, fontWeight: 780, maxWidth: "100%" }}>
            {caption ? <EmphasisText text={caption} /> : null}
          </div>
          {sourceLabel ? (
            <div style={{ fontSize: 22, fontWeight: 650, opacity: 0.8, letterSpacing: 1, whiteSpace: "nowrap" }}>
              来源 · {sourceLabel}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
