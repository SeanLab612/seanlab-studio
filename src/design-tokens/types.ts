import type React from "react";

export type TokenStatus = "draft" | "approved";
export type AccentRole = "amber" | "blue" | "mint" | "red" | "violet" | "neutral";
export type ScrimSide = "left" | "right" | "none";

export type DesignTokenGroup = {
  id: "color" | "typography" | "glass" | "scrim" | "spacing" | "safe-area";
  status: TokenStatus;
  purpose: string;
  useWhen: string[];
  avoidWhen: string[];
};

export type GlassRecipe = {
  background: string;
  border: string;
  boxShadow: string;
  backdropFilter: string;
  WebkitBackdropFilter: string;
};

export type ScrimRecipe = {
  side: ScrimSide;
  background: string;
  style: React.CSSProperties;
};
