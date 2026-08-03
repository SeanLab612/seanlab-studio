import type React from "react";
import { getGlassRecipe, radiusTokens } from "../design-tokens";

type ProtectedGlassStyle = "background" | "border" | "boxShadow" | "backdropFilter" | "WebkitBackdropFilter";
type LiquidGlassLayoutStyle = Omit<React.CSSProperties, ProtectedGlassStyle>;

type LiquidGlassProps = {
  children: React.ReactNode;
  accent?: string;
  padding?: string;
  radius?: number;
  minWidth?: number;
  opacityScale?: number;
  style?: LiquidGlassLayoutStyle;
  contentStyle?: React.CSSProperties;
  variant?: "compact" | "card" | "brightFootage";
  surface?: "glass" | "bare";
};

export const LiquidGlass: React.FC<LiquidGlassProps> = ({
  children,
  accent = "rgba(255,255,255,0.2)",
  padding = "14px 20px",
  radius = 24,
  minWidth,
  opacityScale,
  style,
  contentStyle,
  variant = "card",
  surface = "glass",
}) => {
  const recipe = getGlassRecipe(variant, opacityScale);
  const bare = surface === "bare";
  return (
    <div
      style={{
        minWidth,
        padding,
        borderRadius: bare ? 0 : (radius ?? radiusTokens.card),
        position: "relative",
        overflow: bare ? "visible" : "hidden",
        ...style,
        ...(bare ? {} : recipe),
      }}
    >
      {bare ? null : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(circle at top left, ${accent}, transparent 48%)`,
            opacity: 0.16,
            pointerEvents: "none",
          }}
        />
      )}
      <div style={{ position: "relative", ...contentStyle }}>{children}</div>
    </div>
  );
};
