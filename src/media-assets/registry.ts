import { identityAssetById, identityAssets, type IdentityAssetId } from "./identity-assets.ts";
import { personAssetById, personAssets, type RegisteredPersonId } from "./person-assets.ts";
import type { MediaAssetDefinition, MediaIntent, MediaVariant, ResolvedMediaAsset } from "./types.ts";

export type MediaEntityId = RegisteredPersonId | IdentityAssetId;

export const mediaAssetRegistry = new Map<string, MediaAssetDefinition>([
  ...personAssets.map((asset) => [asset.id, asset] as const),
  ...identityAssets.map((asset) => [asset.id, asset] as const),
]);

const variantOrder: readonly MediaVariant[] = ["circle", "square", "card", "light", "dark", "monochrome", "original"];

const normalizeEntityKey = (value: string) => value.toLocaleLowerCase().replace(/[^a-z0-9\u3400-\u9fff]+/g, "");
const mediaAliases = new Map<string, string>();
for (const asset of mediaAssetRegistry.values()) {
  for (const alias of [asset.id, asset.label, ...asset.aliases]) mediaAliases.set(normalizeEntityKey(alias), asset.id);
}
for (const [alias, id] of Object.entries({
  trump: "donald_trump",
  特朗普: "donald_trump",
  川普: "donald_trump",
  "donald j trump": "donald_trump",
  ollama: "brand.ollama",
  "local model": "brand.ollama",
  "local llm": "brand.ollama",
  本地模型: "brand.ollama",
  本地大模型: "brand.ollama",
  omlx: "brand.omlx",
  "o mlx": "brand.omlx",
}))
  mediaAliases.set(normalizeEntityKey(alias), id);

export const resolveMediaEntityId = (value: string) => mediaAliases.get(normalizeEntityKey(value));

export const resolveMediaEntityReference = (value: string) => {
  const entityId =
    resolveMediaEntityId(value) ??
    [...mediaAliases.entries()].find(([alias]) => alias.length >= 4 && normalizeEntityKey(value).includes(alias))?.[1];
  const asset = entityId ? mediaAssetRegistry.get(entityId) : undefined;
  return asset ? { entityId: asset.id, kind: asset.kind } : undefined;
};

export const resolveMediaAsset = (
  intent: MediaIntent,
  options: { allowCandidate?: boolean } = {},
): ResolvedMediaAsset | undefined => {
  const canonicalId = mediaAssetRegistry.has(intent.entityId) ? intent.entityId : resolveMediaEntityId(intent.entityId);
  const asset = canonicalId ? mediaAssetRegistry.get(canonicalId) : undefined;
  if (!asset) return undefined;
  const usable = asset.status === "approved" || (options.allowCandidate === true && asset.status === "candidate");
  const preferred = intent.preferredVariant;
  const variant = usable
    ? preferred && asset.variants[preferred]
      ? preferred
      : variantOrder.find((candidate) => asset.variants[candidate])
    : undefined;
  return {
    entityId: asset.id,
    kind: asset.kind,
    path: variant ? asset.variants[variant]?.path : undefined,
    variant,
    label: asset.label,
    fallback: asset.fallback,
    source: asset.source,
    status: asset.status,
  };
};

export const getPersonAsset = (id: string) => personAssetById.get(id as RegisteredPersonId);
export const getIdentityAsset = (id: string) => identityAssetById.get(id as IdentityAssetId);

export const mediaAssetInventory = {
  people: personAssets.length,
  identities: identityAssets.length,
  candidates: [...mediaAssetRegistry.values()].filter((asset) => asset.status === "candidate").length,
  approved: [...mediaAssetRegistry.values()].filter((asset) => asset.status === "approved").length,
  fallbacks: [...mediaAssetRegistry.values()].filter((asset) => !asset.variants.square && !asset.variants.circle)
    .length,
} as const;
