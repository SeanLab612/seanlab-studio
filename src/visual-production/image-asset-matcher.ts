import { resolveFunctionalIconId } from "../icons/resolve-functional-icon.ts";
import type { SystemIconId } from "../icons/registry.ts";

export type MatchableImageAsset = {
  id: string;
  displayName?: string;
  subject?: string;
  description?: string;
  style?: string;
  keywords?: string[];
  tags?: string[];
  aliases?: string[];
  applicableScenes?: string[];
  excludedTerms?: string[];
  prompt?: string;
  templateId?: string;
  promotedAt?: string;
};

export type ImageAssetMatch = {
  asset: MatchableImageAsset;
  score: number;
  matchedTerms: string[];
  reasons: string[];
};

export type ImageAssetDecision =
  | {
      kind: "image";
      recommended: ImageAssetMatch;
      alternatives: ImageAssetMatch[];
      fallbackIconId: SystemIconId;
      reason: string;
    }
  | {
      kind: "icon";
      alternatives: [];
      fallbackIconId: SystemIconId;
      reason: string;
    };

const normalize = (value: string) => value.normalize("NFKC").toLocaleLowerCase("zh-CN").replace(/\s+/g, " ").trim();

const semanticTerms = (value: string | undefined) =>
  normalize(value ?? "")
    .split(/[·•|/\\,，。；;：:（）()[\]{}<>《》“”"'!?！？\n\r_-]+/)
    .map((term) => term.trim())
    .filter((term) => [...term].length >= 2 && [...term].length <= 40);

const hasAffirmativeMention = (query: string, term: string) => {
  let from = 0;
  while (from < query.length) {
    const index = query.indexOf(term, from);
    if (index < 0) return false;
    const prefix = query.slice(Math.max(0, index - 6), index).replace(/\s+/g, "");
    if (!/(?:不是|并非|不像|而不是|相比|比)$/.test(prefix)) return true;
    from = index + term.length;
  }
  return false;
};

const weightedTerms = (asset: MatchableImageAsset) => [
  ...(asset.keywords ?? []).flatMap((value) => semanticTerms(value).map((term) => ({ term, weight: 18 }))),
  ...(asset.aliases ?? []).flatMap((value) => semanticTerms(value).map((term) => ({ term, weight: 16 }))),
  ...semanticTerms(asset.displayName).map((term) => ({ term, weight: 14 })),
  ...(asset.tags ?? []).flatMap((value) => semanticTerms(value).map((term) => ({ term, weight: 14 }))),
  ...(asset.applicableScenes ?? []).flatMap((value) => semanticTerms(value).map((term) => ({ term, weight: 12 }))),
  ...semanticTerms(asset.subject).map((term) => ({ term, weight: 12 })),
  ...semanticTerms(asset.description).map((term) => ({ term, weight: 8 })),
  ...semanticTerms(asset.style).map((term) => ({ term, weight: 6 })),
  ...semanticTerms(asset.prompt).map((term) => ({ term, weight: 4 })),
];

const hasExcludedTerm = (query: string, asset: MatchableImageAsset) =>
  (asset.excludedTerms ?? [])
    .flatMap((value) => semanticTerms(value))
    .some((term) => hasAffirmativeMention(query, term));

export const matchImageAssets = (
  text: string,
  assets: MatchableImageAsset[],
  { limit = 3, minimumScore = 10 }: { limit?: number; minimumScore?: number } = {},
): ImageAssetMatch[] => {
  const query = normalize(text);
  if (!query || limit <= 0) return [];
  return assets
    .map((asset) => {
      if (hasExcludedTerm(query, asset))
        return {
          asset,
          score: 0,
          matchedTerms: [],
          reasons: ["口播命中素材人工排除词"],
        };
      const matches = new Map<string, number>();
      for (const { term, weight } of weightedTerms(asset)) {
        if (!hasAffirmativeMention(query, term)) continue;
        matches.set(term, Math.max(matches.get(term) ?? 0, weight));
      }
      const matchedTerms = [...matches.keys()].sort(
        (left, right) => right.length - left.length || left.localeCompare(right),
      );
      const score = [...matches.values()].reduce((total, weight) => total + weight, 0);
      return {
        asset,
        score,
        matchedTerms,
        reasons: matchedTerms.map((term) => `口播命中素材语义“${term}”`),
      };
    })
    .filter((match) => match.score >= minimumScore)
    .sort(
      (left, right) =>
        right.score - left.score ||
        (right.asset.promotedAt ?? "").localeCompare(left.asset.promotedAt ?? "") ||
        left.asset.id.localeCompare(right.asset.id),
    )
    .slice(0, Math.min(10, limit));
};

export const recommendImageAssetOrIcon = (
  text: string,
  assets: MatchableImageAsset[],
  options?: { limit?: number; minimumScore?: number },
): ImageAssetDecision => {
  const alternatives = matchImageAssets(text, assets, options);
  const fallbackIconId = resolveFunctionalIconId(undefined, text);
  const recommended = alternatives[0];
  const excludedAsset = assets.find((asset) => hasExcludedTerm(normalize(text), asset));
  if (!recommended)
    return {
      kind: "icon",
      alternatives: [],
      fallbackIconId,
      reason: excludedAsset
        ? `口播命中素材 ${excludedAsset.displayName ?? excludedAsset.subject ?? excludedAsset.id} 的人工排除词，继续使用本地图标 ${fallbackIconId}`
        : `图片素材库没有达到匹配阈值，继续使用本地图标 ${fallbackIconId}`,
    };
  return {
    kind: "image",
    recommended,
    alternatives,
    fallbackIconId,
    reason: `${recommended.reasons.join("；")}，用于动画阶段；没有合适图片时使用图标 ${fallbackIconId}`,
  };
};
