import type { CoverContract, CoverFormat } from "./types.ts";

export type CoverAssetPackSelection = {
  format: CoverFormat;
  personSrc: string;
  backgroundSrc?: string;
  theme: CoverContract["theme"];
  accents: CoverContract["accents"];
  titleLines: CoverContract["titleLines"];
  kicker?: string;
  badge?: string;
  iconIds?: CoverContract["iconIds"];
  supportingFacts?: CoverContract["supportingFacts"];
};

export const coverAssetPackFixture = (selection: CoverAssetPackSelection): CoverContract => ({
  schemaVersion: "1.0",
  templateId: "creator-editorial-1.0",
  titleLines: selection.titleLines,
  kicker: selection.kicker ?? "LOCAL CREATOR WORKFLOW",
  badge: selection.badge ?? "CREATOR VIDEO",
  iconIds: selection.iconIds,
  supportingFacts: selection.supportingFacts ?? ["写稿与素材", "视觉分镜", "本地交付"],
  portraitSrc: selection.personSrc,
  generatedBackgroundSrc: selection.backgroundSrc,
  portraitTreatment: selection.backgroundSrc ? "transparent-cutout" : "photo-crop",
  theme: selection.theme,
  accents: selection.accents,
});
