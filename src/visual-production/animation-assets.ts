import type { ResolvedAnimationCue } from "./timeline.ts";

type FrozenAnimationImageAsset = {
  sourceLabel?: string;
  publicSrc?: string;
  description?: string;
};

export const bindFrozenAnimationImageAssets = (
  cues: ResolvedAnimationCue[],
  assets: FrozenAnimationImageAsset[],
): ResolvedAnimationCue[] =>
  cues.map((cue) => ({
    ...cue,
    animationIntent: {
      ...cue.animationIntent,
      stages: cue.animationIntent.stages.map((stage) => {
        if (!stage.imageAssetId) return stage;
        const asset = assets.find((item) => item.sourceLabel === `动画素材库 · ${stage.imageAssetId}`);
        if (!asset?.publicSrc) throw new Error(`Animation stage ${stage.id} has no frozen public image asset`);
        return {
          ...stage,
          imageAssetLabel: stage.imageAssetLabel ?? asset.description ?? stage.imageAssetId,
          imageAssetSrc: asset.publicSrc,
        };
      }),
    },
  }));
