import { narrationStoryboardSections } from "../../src/creator-workflow/storyboard-sections.ts";
import { recommendImageAssetOrIcon } from "../../src/visual-production/image-asset-matcher.ts";
import { recommendAnimationIntent } from "../../src/visual-production/recommendation.ts";
import { getPromotedImageAsset, listPromotedImageAssets } from "./generated-assets.mjs";

const publicMatch = (match) => ({
  asset: match.asset,
  score: match.score,
  matchedTerms: match.matchedTerms,
  reasons: match.reasons,
});

const publicDecision = (decision) =>
  decision.kind === "image"
    ? {
        ...decision,
        recommended: publicMatch(decision.recommended),
        alternatives: decision.alternatives.map(publicMatch),
      }
    : decision;

const matchEntry = ({ assets, sectionId, text, stageId, styleProfileId, selectedAssetId, beatId }) => {
  const compatible = assets.filter((asset) => !asset.templateId || asset.templateId === styleProfileId);
  let decision = publicDecision(recommendImageAssetOrIcon(text, compatible));
  const selectedAsset = selectedAssetId ? compatible.find((asset) => asset.id === selectedAssetId) : undefined;
  if (selectedAsset && decision.kind === "icon") {
    const selectedMatch = {
      asset: selectedAsset,
      score: 0,
      matchedTerms: [],
      reasons: ["项目 Agent 已选择这个动画素材"],
    };
    decision = {
      kind: "image",
      recommended: selectedMatch,
      alternatives: [selectedMatch],
      fallbackIconId: decision.fallbackIconId,
      reason: `项目 Agent 已选择图片素材；图标 ${decision.fallbackIconId} 保留为动画内部兜底`,
    };
  }
  if (
    selectedAsset &&
    decision.kind === "image" &&
    !decision.alternatives.some((candidate) => candidate.asset.id === selectedAsset.id)
  )
    decision.alternatives.unshift({
      asset: selectedAsset,
      score: 0,
      matchedTerms: [],
      reasons: ["项目 Agent 已选择这个动画素材"],
    });
  return {
    sectionId,
    ...(beatId ? { beatId } : {}),
    stageId,
    styleProfileId,
    ...(selectedAssetId ? { selectedAssetId } : {}),
    ...(selectedAsset ? { selectedAsset } : {}),
    text,
    decision,
  };
};

const animationEntries = ({ assets, sectionId, beatId, intent }) =>
  intent.stages.map((stage) =>
    matchEntry({
      assets,
      sectionId,
      ...(beatId ? { beatId } : {}),
      stageId: stage.id,
      styleProfileId: intent.styleProfileId,
      selectedAssetId: stage.imageAssetId,
      text: `${stage.label} ${stage.action} ${stage.spokenQuote}`,
    }),
  );

export const buildProjectImageAssetMatches = async ({ narration, storyboard }) => {
  if (!narration) return [];
  const assets = await listPromotedImageAssets();
  return narrationStoryboardSections(narration)
    .filter((section) => Boolean(section.narration.trim()))
    .flatMap((section) => {
      const review = storyboard.sections?.[section.id];
      const beats = review?.beats ?? [];
      if (beats.length)
        return beats.flatMap((beat) =>
          beat.primaryVisualType === "animation" && beat.animationIntent
            ? animationEntries({
                assets,
                sectionId: section.id,
                beatId: beat.id,
                intent: beat.animationIntent,
              })
            : [],
        );
      if (review?.mode && !["auto", "animation"].includes(review.mode)) return [];
      const intent = review?.animationIntent ?? recommendAnimationIntent(section);
      return intent ? animationEntries({ assets, sectionId: section.id, intent }) : [];
    });
};

export const previewPromotedImageAssetMatch = async ({ assetId, text }) => {
  if (typeof text !== "string" || !text.trim()) throw new Error("Enter narration text to preview image matching");
  if (text.length > 2_000) throw new Error("Image asset match preview text is too long");
  const asset = await getPromotedImageAsset(assetId);
  return recommendImageAssetOrIcon(text, [asset]);
};
