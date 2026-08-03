import type { MediaAssetDefinition } from "./types.ts";

// Product and organization artwork is user-managed so the open-source package
// does not redistribute trademarks or private creator assets.
export const identityAssets: readonly MediaAssetDefinition[] = [];
export type IdentityAssetId = string;
export const identityAssetById = new Map<string, MediaAssetDefinition>();
