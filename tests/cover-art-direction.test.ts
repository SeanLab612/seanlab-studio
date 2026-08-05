import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { coverAssetPackFixture } from "../src/cover/asset-pack.ts";
import { coverReviewFixture, generatedCoverReviewFixture } from "../src/cover/review-fixtures.ts";
import { componentAccentTokens } from "../src/design-tokens/tokens.ts";
import { validateCoverContract } from "../src/cover/types.ts";

test("cover review fixtures use the creator-neutral template and local placeholder", () => {
  for (const theme of ["signal", "paper", "studio"] as const) {
    const cover = validateCoverContract(coverReviewFixture(theme));
    assert.equal(cover.templateId, "creator-editorial-1.0");
    assert.equal(cover.portraitSrc, "review-assets/creator-placeholder.svg");
    assert.equal(cover.titleLines.length, 2);
    assert.equal(new Set(cover.accents).size, 2);
    for (const accent of cover.accents) assert.ok(componentAccentTokens.includes(accent));
  }
});

test("cover contract rejects remote image dependencies", () => {
  const fixture = coverReviewFixture("signal");
  assert.throws(
    () => validateCoverContract({ ...fixture, portraitSrc: "https://example.com/person.jpg" }),
    /local asset path/,
  );
  assert.throws(
    () => validateCoverContract({ ...fixture, generatedBackgroundSrc: "https://example.com/background.png" }),
    /local asset path/,
  );
});

test("cover contract rejects headline overflow", () => {
  const fixture = coverReviewFixture("signal");
  assert.throws(
    () => validateCoverContract({ ...fixture, titleLines: ["这是一行明显超过十二个汉字的封面标题", "第二行"] }),
    /1-12 characters/,
  );
});

test("cover contract accepts one to four unique registered optional icons", () => {
  const fixture = coverReviewFixture("signal");
  assert.deepEqual(validateCoverContract({ ...fixture, iconIds: ["brand.github", "system.flow"] }).iconIds, [
    "brand.github",
    "system.flow",
  ]);
  // Props written before the multi-select contract remain readable.
  assert.equal(validateCoverContract({ ...fixture, iconId: "brand.github" }).iconId, "brand.github");
  assert.throws(
    () => validateCoverContract({ ...fixture, iconIds: ["brand.unregistered" as "brand.github"] }),
    /local registry/,
  );
  assert.throws(() => validateCoverContract({ ...fixture, iconIds: ["brand.github", "brand.github"] }), /unique/);
  assert.throws(
    () =>
      validateCoverContract({
        ...fixture,
        iconIds: ["brand.github", "system.flow", "system.check", "system.clock", "system.warning"],
      }),
    /at most four/,
  );
});

test("generated review covers retain explicit creator-controlled crops", () => {
  const landscape = generatedCoverReviewFixture("landscape");
  const portrait = generatedCoverReviewFixture("portrait");
  assert.equal(landscape.portraitTreatment, "photo-crop");
  assert.equal(landscape.generatedBackgroundSrc, undefined);
  assert.notEqual(landscape.portraitCrop?.x, portrait.portraitCrop?.x);
});

test("cover asset pack accepts a user-managed local portrait without a bundled background", () => {
  const cover = validateCoverContract(
    coverAssetPackFixture({
      format: "landscape",
      personSrc: "projects/example/cover/portrait.jpg",
      theme: "signal",
      accents: ["#6EA8FF", "#FF626B"],
      titleLines: ["真人素材", "本地组合"],
    }),
  );
  assert.equal(cover.portraitTreatment, "photo-crop");
  assert.match(cover.portraitSrc, /portrait\.jpg$/);
  assert.equal(cover.generatedBackgroundSrc, undefined);
});

test("public cover flow ships only background templates and requires a user cutout", async () => {
  const source = await readFile("scripts/creator/studio-covers.mjs", "utf8");
  const registry = JSON.parse(await readFile("public/assets/covers/registry.json", "utf8"));
  assert.match(source, /请先导入自己的封面人物照片/);
  assert.match(source, /people: portraitConfigured \?/);
  assert.match(source, /transparent-cutout/);
  assert.doesNotMatch(source, /sean-pose|user-provided-private/);
  assert.equal(registry.backgrounds.length, 3);
  assert.equal(registry.people, undefined);
  assert.ok(
    registry.backgrounds.every(
      (item: { generationContract: string }) => item.generationContract === "background-only-no-people-no-text-v1",
    ),
  );
});

test("Douyin cover compositions render at 4:3 landscape and 3:4 portrait ratios", async () => {
  const rootSource = await readFile("src/Root.tsx", "utf8");
  assert.match(rootSource, /id="CoverAssetPackLandscape"[\s\S]{0,180}width=\{1440\}[\s\S]{0,80}height=\{1080\}/);
  assert.match(rootSource, /id="CoverAssetPackPortrait"[\s\S]{0,180}width=\{1080\}[\s\S]{0,80}height=\{1440\}/);
});
