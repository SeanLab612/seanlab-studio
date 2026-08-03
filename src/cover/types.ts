import type { ComponentAccent } from "../design-tokens/tokens.ts";
import { isIconId, type IconId } from "../icons/registry.ts";

export const coverSchemaVersion = "1.0" as const;

export type CoverFormat = "landscape" | "portrait";
export type CoverTheme = "signal" | "paper" | "studio";

export type CoverContract = {
  schemaVersion: typeof coverSchemaVersion;
  templateId: "creator-editorial-1.0";
  titleLines: readonly [string, string] | readonly [string, string, string];
  kicker: string;
  badge: string;
  iconIds?: readonly IconId[];
  /** Read-only compatibility for cover props created before multi-icon selection. */
  iconId?: IconId;
  supportingFacts: readonly [string, string, string];
  portraitSrc: string;
  brandName?: string;
  portraitCrop?: { x: number; y: number; zoom: number };
  theme: CoverTheme;
  accents: readonly [ComponentAccent, ComponentAccent];
  generatedBackgroundSrc?: string;
  portraitTreatment?: "separate" | "integrated-background" | "transparent-cutout" | "photo-crop";
};

export const validateCoverContract = (cover: CoverContract) => {
  if (cover.schemaVersion !== coverSchemaVersion) throw new Error("cover schema version is unsupported");
  if (cover.templateId !== "creator-editorial-1.0") throw new Error("cover template is unsupported");
  if (cover.titleLines.length < 2 || cover.titleLines.length > 3) throw new Error("cover title must use 2-3 lines");
  if (cover.titleLines.some((line) => !line.trim() || [...line].length > 12))
    throw new Error("each cover title line must contain 1-12 characters");
  if (!cover.kicker.trim() || [...cover.kicker].length > 24)
    throw new Error("cover kicker must contain 1-24 characters");
  if (!cover.badge.trim() || [...cover.badge].length > 16) throw new Error("cover badge must contain 1-16 characters");
  const iconIds = cover.iconIds ?? (cover.iconId ? [cover.iconId] : []);
  if (iconIds.length > 4) throw new Error("cover supports at most four registered icons");
  if (new Set(iconIds).size !== iconIds.length) throw new Error("cover icons must be unique");
  if (iconIds.some((iconId) => !isIconId(iconId))) throw new Error("cover icons must use the local registry");
  if (cover.supportingFacts.some((fact) => !fact.trim() || [...fact].length > 12))
    throw new Error("cover supporting facts must contain 1-12 characters");
  if (!cover.portraitSrc.trim() || /^(?:https?:)?\/\//i.test(cover.portraitSrc))
    throw new Error("cover.portraitSrc must be a local asset path");
  if (cover.generatedBackgroundSrc && /^(?:https?:)?\/\//i.test(cover.generatedBackgroundSrc))
    throw new Error("cover.generatedBackgroundSrc must be a local asset path");
  if (cover.portraitTreatment === "integrated-background" && !cover.generatedBackgroundSrc)
    throw new Error("integrated cover portrait requires a generated local background");
  if (
    cover.portraitCrop &&
    (!Number.isFinite(cover.portraitCrop.x) ||
      !Number.isFinite(cover.portraitCrop.y) ||
      !Number.isFinite(cover.portraitCrop.zoom) ||
      cover.portraitCrop.x < 0 ||
      cover.portraitCrop.x > 100 ||
      cover.portraitCrop.y < 0 ||
      cover.portraitCrop.y > 100 ||
      cover.portraitCrop.zoom < 1 ||
      cover.portraitCrop.zoom > 2.5)
  )
    throw new Error("cover portrait crop must stay inside the supported range");
  if (cover.accents[0] === cover.accents[1]) throw new Error("cover requires two distinct approved accents");
  return cover;
};
