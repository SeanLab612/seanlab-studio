import type { ApprovedVisualComponentId } from "../visual-brief/types.ts";

export const TYPOGRAPHY_POLICY_VERSION = "typography-2.0" as const;

export const TYPOGRAPHY_MODES = ["auto", "system-only", "wenkai-emphasis"] as const;
export type TypographyMode = (typeof TYPOGRAPHY_MODES)[number];

export type TypographyProfileId = "system-black" | "wenkai-narrative";
export type TypographyTextRole =
  | "caption"
  | "display-title"
  | "component-title"
  | "body"
  | "metric"
  | "label"
  | "source"
  | "quote"
  | "annotation";

export type TypographyComponentId = ApprovedVisualComponentId | "whole-video-title";

export type TypographyProjectPolicy = {
  version: typeof TYPOGRAPHY_POLICY_VERSION;
  mode: TypographyMode;
};

export type TypographySelectionInput = {
  mode: TypographyMode;
  role: TypographyTextRole;
  text: string;
  componentId?: TypographyComponentId;
};

export type TypographyReasonCode =
  | "system-mode"
  | "system-role-locked"
  | "component-not-eligible"
  | "auto-title-conservative"
  | "copy-capacity"
  | "technical-copy"
  | "glyph-coverage"
  | "wenkai-narrative";

export type TypographyDecision = {
  policyVersion: typeof TYPOGRAPHY_POLICY_VERSION;
  mode: TypographyMode;
  profileId: TypographyProfileId;
  role: TypographyTextRole;
  componentId?: TypographyComponentId;
  family: string;
  fontWeight: number;
  reasonCode: TypographyReasonCode;
  reason: string;
  fallback: boolean;
};
