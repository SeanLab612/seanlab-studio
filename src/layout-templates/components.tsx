import type React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { colorTokens, getScrimRecipe, typographyTokens } from "../design-tokens";
import { getLayoutTemplate } from "./registry";
import type { LayoutSurfaceProps, PixelRect } from "./types";

const rectStyle = (rect: PixelRect): React.CSSProperties => ({
  position: "absolute",
  left: rect.x,
  top: rect.y,
  width: rect.width,
  height: rect.height,
});

export const LocalReadabilityScrim: React.FC<{ side: "left" | "right" | "none"; strength?: number }> = ({
  side,
  strength,
}) => {
  if (side === "none") return null;
  return <AbsoluteFill style={getScrimRecipe(side, strength).style} />;
};

export const LayoutSurface: React.FC<LayoutSurfaceProps> = ({
  templateId,
  backgroundSrc,
  children,
  showGuides = false,
  scrimStrength = 1,
}) => {
  const template = getLayoutTemplate(templateId);
  return (
    <AbsoluteFill
      style={{
        background: colorTokens.canvas,
        color: colorTokens.paper,
        fontFamily: typographyTokens.family,
        overflow: "hidden",
      }}
    >
      <AbsoluteFill>
        <Img src={staticFile(backgroundSrc)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
      <LocalReadabilityScrim side={template.scrimSide} strength={scrimStrength} />
      {children}
      {showGuides ? (
        <AbsoluteFill style={{ pointerEvents: "none", fontFamily: typographyTokens.family }}>
          <div
            style={{ ...rectStyle(template.titleZone), border: "2px solid #6EA8FF", color: "#6EA8FF", fontSize: 18 }}
          >
            <span style={{ position: "absolute", right: 6, bottom: 4, fontSize: 14 }}>TITLE ZONE</span>
          </div>
          {template.contentZones.map((zone, index) => (
            <div
              key={`${zone.x}-${zone.y}`}
              style={{ ...rectStyle(zone), border: "2px solid #59D98E", color: "#59D98E", fontSize: 18 }}
            >
              <span style={{ position: "absolute", right: 6, top: 4, fontSize: 14 }}>CONTENT {index + 1}</span>
            </div>
          ))}
          <div
            style={{
              ...rectStyle(template.faceExclusion),
              border: "2px dashed rgba(255,98,107,0.9)",
              background: "rgba(255,98,107,0.07)",
              color: "#FF626B",
              fontSize: 18,
            }}
          >
            FACE SAFE
          </div>
          <div
            style={{
              ...rectStyle(template.subtitleExclusion),
              border: "2px dashed rgba(243,181,69,0.9)",
              background: "rgba(243,181,69,0.07)",
              color: "#F3B545",
              fontSize: 18,
            }}
          >
            SUBTITLE SAFE
          </div>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};

export const getPrimaryContentStyle = (templateId: LayoutSurfaceProps["templateId"]): React.CSSProperties => {
  const zone = getLayoutTemplate(templateId).contentZones[0];
  return rectStyle(zone);
};
