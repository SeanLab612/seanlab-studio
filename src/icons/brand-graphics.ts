import {
  siAnthropic,
  siApple,
  siClaude,
  siDeepseek,
  siGithub,
  siGooglegemini,
  siKimi,
  siMeta,
  siMinimax,
  siNvidia,
  siQwen,
  type SimpleIcon,
} from "simple-icons";
import type { BrandIconId } from "./registry";

export type BrandIconGraphic = Pick<SimpleIcon, "hex" | "path" | "title" | "slug"> & {
  upstream: "simple-icons";
};

const graphic = ({ hex, path, title, slug }: SimpleIcon): BrandIconGraphic => ({
  hex,
  path,
  title,
  slug,
  upstream: "simple-icons",
});

// Only brands present in the pinned Simple Icons package are rendered as
// artwork. Registered brands without an admitted graphic keep the local text
// badge fallback so a removed or restricted upstream mark never breaks video
// production.
export const brandIconGraphics: Partial<Record<BrandIconId, BrandIconGraphic>> = {
  "brand.anthropic": graphic(siAnthropic),
  "brand.apple": graphic(siApple),
  "brand.claude": graphic(siClaude),
  "brand.deepseek": graphic(siDeepseek),
  "brand.github": graphic(siGithub),
  "brand.google-gemini": graphic(siGooglegemini),
  "brand.kimi": graphic(siKimi),
  "brand.meta": graphic(siMeta),
  "brand.minimax": graphic(siMinimax),
  "brand.nvidia": graphic(siNvidia),
  "brand.qwen": graphic(siQwen),
};

export const resolveBrandIconGraphic = (id: BrandIconId) => brandIconGraphics[id];
