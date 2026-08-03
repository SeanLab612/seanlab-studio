import type { MediaAssetDefinition } from "./types.ts";

// The public repository intentionally starts without a bundled people library.
// Creators can promote their own licensed assets through the local asset workflow.
export const personAssets: readonly MediaAssetDefinition[] = [];
export type RegisteredPersonId = string;
export const personAssetById = new Map<string, MediaAssetDefinition>();
