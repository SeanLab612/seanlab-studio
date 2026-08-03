import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

test("image asset metadata editing, additive batch tags, and exact duplicate warnings stay in the shared registry", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "seanlab-image-metadata-"));
  try {
    await mkdir(resolve(root, ".asset-library/images"), { recursive: true });
    await writeFile(
      resolve(root, ".asset-library/images/registry.json"),
      JSON.stringify({
        schemaVersion: "1.0",
        assets: [
          {
            id: "recorder-paper",
            subject: "录音机",
            tags: ["声音"],
            file: "recorder-paper/asset.png",
            sha256: "same-image",
            promotedAt: "2026-07-28T00:00:00.000Z",
          },
          {
            id: "recorder-clay",
            subject: "粘土录音机",
            file: "recorder-clay/asset.png",
            sha256: "same-image",
            promotedAt: "2026-07-27T00:00:00.000Z",
          },
        ],
      }),
    );
    const script = `
      import assert from "node:assert/strict";
      import {
        addPromotedImageAssetTagsBatch,
        listPromotedImageAssets,
        updatePromotedImageAssetMetadata
      } from ${JSON.stringify(new URL("../scripts/creator/generated-assets.mjs", import.meta.url).href)};

      const updated = await updatePromotedImageAssetMetadata({
        assetId: "recorder-paper",
        metadata: {
          displayName: "纸张编辑部录音机",
          subject: "录音机",
          description: "用于声音、播客和录制主题",
          style: "paper-editorial",
          aliases: ["磁带机", "录音设备", "磁带机"],
          keywords: ["录音机", "播客"],
          tags: ["声音"],
          applicableScenes: ["声音处理", "播客录音"],
          excludedTerms: ["手机录音"]
        }
      });
      assert.equal(updated.displayName, "纸张编辑部录音机");
      assert.deepEqual(updated.aliases, ["磁带机", "录音设备"]);

      await addPromotedImageAssetTagsBatch({
        assetIds: ["recorder-paper", "recorder-clay"],
        tags: ["常用设备", "声音"]
      });
      const assets = await listPromotedImageAssets();
      const paper = assets.find((asset) => asset.id === "recorder-paper");
      const clay = assets.find((asset) => asset.id === "recorder-clay");
      assert.deepEqual(paper.tags, ["声音", "常用设备"]);
      assert.deepEqual(clay.tags, ["常用设备", "声音"]);
      assert.deepEqual(paper.duplicateAssetIds, ["recorder-clay"]);
      assert.deepEqual(clay.duplicateAssetIds, ["recorder-paper"]);
    `;
    await promisify(execFile)(process.execPath, ["--input-type=module", "-e", script], {
      cwd: process.cwd(),
      env: { ...process.env, REMOTION_MD_CREATOR_ROOT: root },
    });
    const registry = JSON.parse(await readFile(resolve(root, ".asset-library/images/registry.json"), "utf8"));
    assert.equal(registry.assets[0].displayName, "纸张编辑部录音机");
    assert.deepEqual(registry.assets[0].applicableScenes, ["声音处理", "播客录音"]);
    assert.deepEqual(registry.assets[0].excludedTerms, ["手机录音"]);
    assert.ok(registry.assets.every((asset) => asset.metadataUpdatedAt));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("image asset metadata validation rejects oversized and malformed fields before writing", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "seanlab-image-metadata-invalid-"));
  try {
    await mkdir(resolve(root, ".asset-library/images"), { recursive: true });
    const registryPath = resolve(root, ".asset-library/images/registry.json");
    const original = JSON.stringify({
      schemaVersion: "1.0",
      assets: [{ id: "asset-1", subject: "原始主体", file: "asset-1/asset.png" }],
    });
    await writeFile(registryPath, original);
    const script = `
      import assert from "node:assert/strict";
      import { updatePromotedImageAssetMetadata } from ${JSON.stringify(new URL("../scripts/creator/generated-assets.mjs", import.meta.url).href)};
      await assert.rejects(
        updatePromotedImageAssetMetadata({
          assetId: "asset-1",
          metadata: {
            displayName: "名称",
            subject: "主体",
            description: "",
            style: "",
            aliases: "不是数组",
            keywords: [],
            tags: [],
            applicableScenes: [],
            excludedTerms: []
          }
        }),
        /aliases must be a list/
      );
    `;
    await promisify(execFile)(process.execPath, ["--input-type=module", "-e", script], {
      cwd: process.cwd(),
      env: { ...process.env, REMOTION_MD_CREATOR_ROOT: root },
    });
    assert.equal(await readFile(registryPath, "utf8"), original);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
