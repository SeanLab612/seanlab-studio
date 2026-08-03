import assert from "node:assert/strict";
import test from "node:test";
import { identityAssets } from "../src/media-assets/identity-assets.ts";
import { personCatalog } from "../src/media-assets/people-catalog.ts";
import { personAssets } from "../src/media-assets/person-assets.ts";
import { mediaAssetInventory, resolveMediaAsset, resolveMediaEntityId } from "../src/media-assets/registry.ts";

test("public media libraries start empty and creator-neutral", () => {
  assert.deepEqual(personCatalog, []);
  assert.deepEqual(personAssets, []);
  assert.deepEqual(identityAssets, []);
  assert.deepEqual(mediaAssetInventory, { people: 0, identities: 0, candidates: 0, approved: 0, fallbacks: 0 });
});

test("an empty public library falls back safely without inventing an identity", () => {
  assert.equal(resolveMediaEntityId("private creator"), undefined);
  assert.equal(
    resolveMediaAsset({ kind: "person", entityId: "private creator", preferredVariant: "circle" }),
    undefined,
  );
});
