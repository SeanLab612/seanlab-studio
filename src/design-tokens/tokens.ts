import type { AccentRole, GlassRecipe, ScrimRecipe, ScrimSide } from "./types.ts";

export const colorTokens = {
  canvas: "#090B0F",
  paper: "#F5F2EA",
  paperMuted: "rgba(245,242,234,0.58)",
  paperFaint: "rgba(245,242,234,0.16)",
  ink: "#090B0F",
  amber: "#F3B545",
  blue: "#6EA8FF",
  tiffany: "#81D8D0",
  mint: "#59D98E",
  red: "#FF626B",
  violet: "#B59CFF",
  neutral: "#D8D7D2",
} as const;

/**
 * The only accent colors approved for production semantic components.
 * Canvas, paper and translucent neutral surfaces remain layout materials;
 * every data series, emphasis stroke and component accent resolves here.
 */
export const componentAccentTokens = [
  colorTokens.blue,
  colorTokens.mint,
  colorTokens.amber,
  colorTokens.violet,
  colorTokens.red,
  colorTokens.neutral,
] as const;

/**
 * Viewer-facing component copy stays neutral by default. Accent color is a
 * bounded semantic emphasis, never a per-item decoration or rainbow cycle.
 */
export const viewerTextEmphasisPolicy = {
  version: "neutral-base-1.0",
  baseColor: colorTokens.paper,
  accentColors: [colorTokens.blue, colorTokens.mint, colorTokens.amber, colorTokens.violet, colorTokens.red],
  maxAccentColorsPerComponent: 2,
  maxAccentRunsPerComponent: 3,
} as const;

export type ComponentAccent = (typeof componentAccentTokens)[number];

const legacyAccentAliases: Record<string, ComponentAccent> = {
  "#48a7ff": colorTokens.blue,
  "#58a6ff": colorTokens.blue,
  "#5d9dff": colorTokens.blue,
  "#62a8ff": colorTokens.blue,
  "#5ee6c1": colorTokens.mint,
  "#7ce8c3": colorTokens.mint,
  "#7cf7d4": colorTokens.mint,
  "#7dff72": colorTokens.mint,
  "#58d68d": colorTokens.mint,
  "#ffbd45": colorTokens.amber,
  "#ffca5d": colorTokens.amber,
  "#9b72ff": colorTokens.violet,
  "#c887ff": colorTokens.violet,
  "#ff5b6e": colorTokens.red,
  "#ff5e5b": colorTokens.red,
  "#ff5e8a": colorTokens.red,
  "#ff6d7a": colorTokens.red,
};

export const resolveComponentAccent = (
  value?: string,
  fallback: ComponentAccent = colorTokens.blue,
): ComponentAccent => {
  const normalized = value?.trim().toLocaleLowerCase();
  if (!normalized) return fallback;
  const approved = componentAccentTokens.find((color) => color.toLocaleLowerCase() === normalized);
  return approved ?? legacyAccentAliases[normalized] ?? fallback;
};

export const normalizeComponentAccentProps = <T>(value: T): T => {
  let fallbackIndex = 0;
  const visit = (entry: unknown): unknown => {
    if (Array.isArray(entry)) return entry.map(visit);
    if (!entry || typeof entry !== "object") return entry;
    return Object.fromEntries(
      Object.entries(entry).map(([key, nested]) => {
        if ((key === "accent" || key === "color") && typeof nested === "string") {
          const fallback = componentAccentTokens[fallbackIndex % componentAccentTokens.length];
          fallbackIndex += 1;
          return [key, resolveComponentAccent(nested, fallback)];
        }
        return [key, visit(nested)];
      }),
    );
  };
  return visit(value) as T;
};

export const chartTokens = {
  series: componentAccentTokens,
  gridMajor: "rgba(245,242,234,0.09)",
  gridMinor: "rgba(245,242,234,0.06)",
  axis: "rgba(245,242,234,0.34)",
  track: "rgba(245,242,234,0.12)",
  reviewSurface: "rgba(245,242,234,0.08)",
  reviewBorder: "rgba(245,242,234,0.16)",
  blueSurface: "rgba(110,168,255,0.08)",
  blueBorder: "rgba(110,168,255,0.35)",
} as const;

export const accentByRole: Record<AccentRole, string> = {
  amber: colorTokens.amber,
  blue: colorTokens.blue,
  mint: colorTokens.mint,
  red: colorTokens.red,
  violet: colorTokens.violet,
  neutral: colorTokens.neutral,
};

export const typographyTokens = {
  policyVersion: "system-1.0",
  family: '"SF Pro Display", "PingFang SC", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif',
  eyebrow: { fontSize: 21, fontWeight: 800, letterSpacing: 5.5, lineHeight: 1.1 },
  sectionTitle: { fontSize: 24, fontWeight: 700, lineHeight: 1.25 },
  headline: { fontSize: 48, fontWeight: 780, lineHeight: 1.08, letterSpacing: -1.2 },
  body: { fontSize: 24, fontWeight: 600, lineHeight: 1.34 },
  label: { fontSize: 18, fontWeight: 720, lineHeight: 1.2, letterSpacing: 1.2 },
  subtitleZh: { fontSize: 38, fontWeight: 750, lineHeight: 1.12 },
  subtitleEn: { fontSize: 23, fontWeight: 600, lineHeight: 1.16 },
} as const;

export const spacingTokens = {
  edge: 68,
  safeTop: 58,
  subtitleBottom: 34,
  subtitleHorizontal: 360,
  cardGap: 16,
  compact: 10,
  normal: 18,
  generous: 28,
} as const;

export const radiusTokens = { chip: 16, card: 24, panel: 30, pill: 999 } as const;

export const safeAreaTokens = {
  landscape: { top: 58, right: 68, bottom: 158, left: 68 },
  subtitle: { left: 320, right: 320, bottom: 28, height: 112 },
  titleZone: { top: 58, height: 112, width: 720 },
  facePadding: 72,
} as const;

export const glassOpacityScale = 1;

export const glassTokens = {
  compact: {
    background:
      "radial-gradient(ellipse 82% 44% at 9% -5%, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.025) 44%, transparent 72%), linear-gradient(132deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.006) 42%, transparent 63%), linear-gradient(145deg, rgba(255,255,255,0.035) 0%, rgba(22,27,32,0.045) 43%, rgba(7,11,15,0.075) 100%)",
    border: "1px solid rgba(255,255,255,0.2)",
    boxShadow:
      "0 14px 34px rgba(0,0,0,0.18), inset 1px 1px 0 rgba(255,255,255,0.32), inset -1px -1px 0 rgba(0,0,0,0.2)",
    backdropFilter: "blur(8px) saturate(1.3) contrast(1.04) brightness(1.03)",
    WebkitBackdropFilter: "blur(8px) saturate(1.3) contrast(1.04) brightness(1.03)",
  },
  card: {
    background:
      "linear-gradient(90deg, rgba(5,8,12,0.19) 0%, rgba(5,8,12,0.105) 64%, rgba(5,8,12,0.025) 100%), radial-gradient(ellipse 82% 44% at 9% -5%, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.035) 44%, transparent 72%), linear-gradient(132deg, rgba(255,255,255,0.075) 0%, rgba(255,255,255,0.008) 42%, transparent 63%), linear-gradient(145deg, rgba(255,255,255,0.045) 0%, rgba(22,27,32,0.06) 43%, rgba(7,11,15,0.095) 100%)",
    border: "1px solid rgba(255,255,255,0.22)",
    boxShadow:
      "0 20px 48px rgba(0,0,0,0.22), 0 5px 14px rgba(0,0,0,0.16), inset 1px 1px 0 rgba(255,255,255,0.42), inset -1px -1px 0 rgba(0,0,0,0.24), inset 0 0 22px rgba(255,255,255,0.045)",
    backdropFilter: "blur(10px) saturate(1.35) contrast(1.05) brightness(1.03)",
    WebkitBackdropFilter: "blur(10px) saturate(1.35) contrast(1.05) brightness(1.03)",
  },
  brightFootage: {
    background:
      "linear-gradient(90deg, rgba(5,8,12,0.24) 0%, rgba(5,8,12,0.14) 64%, rgba(5,8,12,0.045) 100%), radial-gradient(ellipse 82% 44% at 9% -5%, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.03) 44%, transparent 72%), linear-gradient(145deg, rgba(255,255,255,0.04) 0%, rgba(22,27,32,0.075) 43%, rgba(7,11,15,0.12) 100%)",
    border: "1px solid rgba(255,255,255,0.24)",
    boxShadow:
      "0 22px 52px rgba(0,0,0,0.24), inset 1px 1px 0 rgba(255,255,255,0.4), inset -1px -1px 0 rgba(0,0,0,0.26)",
    backdropFilter: "blur(12px) saturate(1.3) contrast(1.06) brightness(1.01)",
    WebkitBackdropFilter: "blur(12px) saturate(1.3) contrast(1.06) brightness(1.01)",
  },
} satisfies Record<string, GlassRecipe>;

const scaleRgbaOpacity = (value: string, scale: number) =>
  value.replace(/rgba\((\s*\d+\s*,\s*\d+\s*,\s*\d+\s*),\s*([\d.]+)\)/g, (_, channels, alpha) => {
    const scaledAlpha = Math.max(0, Math.min(1, Number(alpha) * scale));
    return `rgba(${channels},${Number(scaledAlpha.toFixed(4))})`;
  });

export const getGlassRecipe = (
  variant: keyof typeof glassTokens = "card",
  opacityScale = glassOpacityScale,
): GlassRecipe => {
  const recipe = glassTokens[variant];
  if (opacityScale === 1) return recipe;
  return {
    background: scaleRgbaOpacity(recipe.background, opacityScale),
    border: scaleRgbaOpacity(recipe.border, opacityScale),
    boxShadow: scaleRgbaOpacity(recipe.boxShadow, opacityScale),
    backdropFilter: recipe.backdropFilter,
    WebkitBackdropFilter: recipe.WebkitBackdropFilter,
  };
};

export const getScrimRecipe = (side: ScrimSide, strength = 1): ScrimRecipe => {
  const edge = Math.min(0.68, 0.5 * strength);
  const shoulder = Math.min(0.42, 0.36 * strength);
  const tail = Math.min(0.2, 0.14 * strength);
  if (side === "none") return { side, background: "none", style: { background: "none" } };
  const direction = side === "left" ? "90deg" : "270deg";
  const background = `linear-gradient(${direction}, rgba(5,7,10,${edge}) 0%, rgba(5,7,10,${shoulder}) 28%, rgba(5,7,10,${tail}) 40%, rgba(5,7,10,0) 46%)`;
  return { side, background, style: { background } };
};
