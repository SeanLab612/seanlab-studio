import generated from "./generated-registry.json" with { type: "json" };
import type { SoundAsset, SoundRole } from "./types.ts";

export const soundAssetRegistry = Object.freeze(generated.assets as SoundAsset[]);

export const getSoundAsset = (id: string) => {
  const asset = soundAssetRegistry.find((item) => item.id === id);
  if (!asset) throw new Error(`Unknown sound asset: ${id}`);
  return asset;
};

export const soundAssetForRole = (role: SoundRole) => {
  const asset = soundAssetRegistry.find((item) => item.role === role);
  if (!asset) throw new Error(`No sound asset is registered for role: ${role}`);
  return asset;
};
