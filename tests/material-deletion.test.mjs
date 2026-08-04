import assert from "node:assert/strict";
import { mkdtemp, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";

test("intake materials can be removed recoverably without reusing surviving ids", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "seanlab-material-delete-"));
  const previousRoot = process.env.REMOTION_MD_CREATOR_ROOT;
  process.env.REMOTION_MD_CREATOR_ROOT = root;
  try {
    const store = await import(`../scripts/creator/project-store.mjs?material-delete=${Date.now()}`);
    await store.createCreatorProject({
      id: "delete-materials",
      title: "Delete materials",
      topic: "Test recoverable deletion",
      category: "other",
      agentId: "codex-cli",
    });
    const firstSource = resolve(root, "first.png");
    const secondSource = resolve(root, "second.png");
    const thirdSource = resolve(root, "third.png");
    await writeFile(firstSource, "first");
    await writeFile(secondSource, "second");
    await writeFile(thirdSource, "third");
    const first = await store.importCreatorAsset({
      projectId: "delete-materials",
      sourcePath: firstSource,
      kind: "screenshot",
    });
    const second = await store.importCreatorAsset({
      projectId: "delete-materials",
      sourcePath: secondSource,
      kind: "screenshot",
    });
    const removed = await store.deleteCreatorMaterial({
      projectId: "delete-materials",
      materialId: first.materialId,
    });
    assert.equal(removed.recoverable, true);
    await assert.rejects(() => store.resolveCreatorAsset("delete-materials", first.assetId), /not found/);
    const trash = await readdir(resolve(root, "delete-materials/assets/.trash"));
    assert.equal(trash.some((name) => name.includes(first.assetId)), true);
    const third = await store.importCreatorAsset({
      projectId: "delete-materials",
      sourcePath: thirdSource,
      kind: "screenshot",
    });
    assert.equal(second.materialId, "material-2");
    assert.equal(third.materialId, "material-3");
    const project = await store.loadCreatorProject("delete-materials");
    assert.deepEqual(
      project.materials.map((item) => item.id),
      ["material-2", "material-3"],
    );
    assert.equal((await stat(resolve(root, "delete-materials/creator-project.json"))).isFile(), true);
  } finally {
    if (previousRoot === undefined) delete process.env.REMOTION_MD_CREATOR_ROOT;
    else process.env.REMOTION_MD_CREATOR_ROOT = previousRoot;
    await rm(root, { recursive: true, force: true });
  }
});
