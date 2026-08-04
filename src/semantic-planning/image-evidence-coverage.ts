export type RequiredImageEvidenceAsset = {
  id: string;
  required?: boolean;
  sourceLabel?: string;
  path?: string;
  sha256?: string;
};

export type ImageEvidenceOverlayCue = {
  generatedVisual?: {
    component?: { id?: string };
    props?: Record<string, unknown>;
  };
};

export const evaluateRequiredImageEvidenceCoverage = (
  assets: readonly RequiredImageEvidenceAsset[],
  overlayCues: readonly ImageEvidenceOverlayCue[],
  directImageCues: readonly { assetId: string; sources?: readonly { assetId: string }[] }[] = [],
  animationCues: readonly {
    animationIntent?: { stages?: readonly { imageAssetId?: string }[] };
  }[] = [],
) => {
  const requiredAssetIds = assets.filter((asset) => asset.required).map((asset) => asset.id);
  const animationAssetIds = animationCues.flatMap((cue) =>
    (cue.animationIntent?.stages ?? []).flatMap((stage) => {
      if (!stage.imageAssetId) return [];
      const registered = assets.find((asset) => asset.sourceLabel === `动画素材库 · ${stage.imageAssetId}`);
      return registered ? [registered.id] : [];
    }),
  );
  const selectedAssetIds = new Set([
    ...overlayCues.flatMap((cue) => {
      if (cue.generatedVisual?.component?.id !== "image-evidence-inset") return [];
      const assetId = cue.generatedVisual.props?.assetId;
      return typeof assetId === "string" && assetId ? [assetId] : [];
    }),
    ...directImageCues.flatMap((cue) => [cue.assetId, ...(cue.sources ?? []).map((source) => source.assetId)]),
    ...animationAssetIds,
  ]);
  const evidenceIdentity = (asset: RequiredImageEvidenceAsset) => asset.sha256 ?? asset.path ?? asset.id;
  const selectedEvidenceIdentities = new Set(
    [...selectedAssetIds].flatMap((id) => {
      const asset = assets.find((candidate) => candidate.id === id);
      return asset ? [evidenceIdentity(asset)] : [];
    }),
  );
  const missingRequiredAssetIds = assets
    .filter((asset) => asset.required)
    .filter((asset) => !selectedEvidenceIdentities.has(evidenceIdentity(asset)))
    .map((asset) => asset.id);
  return {
    status: missingRequiredAssetIds.length ? ("blocked" as const) : ("passed" as const),
    registeredCount: assets.length,
    requiredCount: requiredAssetIds.length,
    selectedRequiredCount: requiredAssetIds.length - missingRequiredAssetIds.length,
    requiredAssetIds,
    selectedAssetIds: [...selectedAssetIds],
    missingRequiredAssetIds,
  };
};

export const assertRequiredImageEvidenceCoverage = (
  assets: readonly RequiredImageEvidenceAsset[],
  overlayCues: readonly ImageEvidenceOverlayCue[],
  directImageCues: readonly { assetId: string; sources?: readonly { assetId: string }[] }[] = [],
  animationCues: readonly {
    animationIntent?: { stages?: readonly { imageAssetId?: string }[] };
  }[] = [],
) => {
  const report = evaluateRequiredImageEvidenceCoverage(assets, overlayCues, directImageCues, animationCues);
  if (report.status === "blocked")
    throw new Error(
      `Required image evidence is not shown: ${report.missingRequiredAssetIds.join(", ")}. Bind every required image to one spoken section and keep it visible through review.`,
    );
  return report;
};
