import { colorTokens } from "../design-tokens/tokens.ts";
import type { CoverContract, CoverFormat, CoverTheme } from "./types.ts";
import { validateCoverContract } from "./types.ts";

const themeAccents = {
  signal: [colorTokens.red, colorTokens.blue],
  paper: [colorTokens.amber, colorTokens.red],
  studio: [colorTokens.violet, colorTokens.mint],
} as const;

export const coverReviewFixture = (theme: CoverTheme): CoverContract =>
  validateCoverContract({
    schemaVersion: "1.0",
    templateId: "creator-editorial-1.0",
    titleLines: ["让口播内容", "自动长出画面"],
    kicker: "LOCAL CREATOR VIDEO",
    badge: "本地 AI 视频工作流",
    supportingFacts: ["自动理解", "20 种组件", "静态审核"],
    portraitSrc: "review-assets/creator-placeholder.svg",
    theme,
    accents: themeAccents[theme],
  });

export const generatedCoverReviewFixture = (format: CoverFormat): CoverContract =>
  validateCoverContract({
    ...coverReviewFixture("signal"),
    portraitTreatment: "photo-crop",
    portraitCrop: { x: format === "portrait" ? 58 : 64, y: 42, zoom: 1.15 },
  });
