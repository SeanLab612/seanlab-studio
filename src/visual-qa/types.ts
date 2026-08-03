import type { ApprovedVisualComponentId } from "../visual-brief/types.ts";
import type { LayoutTemplateId, PixelRect } from "../layout-templates/types.ts";

export type QaPhase = "entry" | "transition" | "stable" | "exit-risk";
export type QaSeverity = "info" | "warning" | "error";

export type ComponentQaContract = {
  componentId: ApprovedVisualComponentId;
  contentBounds: PixelRect;
  minimumFontPx: number;
  expectedEndState: "visible" | "allowed-empty";
  mediaPolicy: "none" | "optional-cover" | "required-cover" | "required-contain";
  checks: Array<"canvas" | "face" | "subtitle" | "title" | "font" | "media" | "end-state">;
};

export type LayoutQaContract = {
  layoutId: LayoutTemplateId;
  canvas: { width: 1920; height: 1080 };
  titleBounds: PixelRect;
  faceBounds: PixelRect;
  subtitleBounds: PixelRect;
  contentBounds: PixelRect[];
};

export type QaFinding = {
  id: string;
  severity: QaSeverity;
  rule: string;
  message: string;
  cueId: string;
  componentId: ApprovedVisualComponentId;
  layoutId: LayoutTemplateId;
  phase?: QaPhase;
  frame?: number;
  timeSeconds?: number;
  screenshot?: string;
};
