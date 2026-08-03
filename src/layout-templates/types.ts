import type React from "react";
import type { ScrimSide } from "../design-tokens";

export type LayoutTemplateId =
  | "speaker-center-left"
  | "speaker-center-right"
  | "speaker-left-overlay-right"
  | "speaker-right-overlay-left"
  | "bilateral-comparison"
  | "media-evidence";

export type PixelRect = { x: number; y: number; width: number; height: number };

export type LayoutTemplateDefinition = {
  id: LayoutTemplateId;
  status: "approved";
  purpose: string;
  speakerPosition: "left" | "center" | "right" | "adaptive";
  overlaySide: "left" | "right" | "both";
  scrimSide: ScrimSide;
  titleZone: PixelRect;
  contentZones: PixelRect[];
  faceExclusion: PixelRect;
  subtitleExclusion: PixelRect;
  maxTextWidth: number;
  useWhen: string[];
  avoidWhen: string[];
};

export type FixtureDefinition = {
  id: "center-dark" | "right-dark" | "left-dark" | "center-bright";
  src: string;
  speakerPosition: "left" | "center" | "right";
  luminance: "dark" | "bright";
  recommendedTemplate: LayoutTemplateId;
};

export type LayoutSurfaceProps = {
  templateId: LayoutTemplateId;
  backgroundSrc: string;
  children?: React.ReactNode;
  showGuides?: boolean;
  scrimStrength?: number;
};
