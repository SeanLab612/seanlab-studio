import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";

test("creator project rename changes only the display title", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "remotion-md-creator-title-"));
  const previousRoot = process.env.REMOTION_MD_CREATOR_ROOT;
  process.env.REMOTION_MD_CREATOR_ROOT = root;
  try {
    const store = await import(`../scripts/creator/project-store.mjs?rename-test=${Date.now()}`);
    await store.createCreatorProject({
      id: "rename-test",
      title: "旧标题",
      topic: "Agent 工作流",
      category: "tool-review",
      agentId: "codex-cli",
    });
    await assert.rejects(
      () =>
        store.createCreatorProject({
          id: "rename-test",
          title: "不会覆盖原项目",
          topic: "重复项目",
          category: "tool-review",
          agentId: "codex-cli",
        }),
      /已存在/,
    );
    const renamed = await store.renameCreatorProject("rename-test", "  新标题  ");

    assert.equal(renamed.project.id, "rename-test");
    assert.equal(renamed.project.title, "新标题");
    assert.equal(renamed.animation, undefined);
    assert.equal(store.projectDir("rename-test"), resolve(root, "rename-test"));
    await assert.rejects(() => store.renameCreatorProject("rename-test", "  "), /不能为空/);
    await assert.rejects(
      () => store.deleteCreatorProject({ id: "rename-test", confirmation: "错误名称" }),
      /输入完整项目名称/,
    );
    const deleted = await store.deleteCreatorProject({ id: "rename-test", confirmation: "新标题" });
    assert.equal(deleted.deleted, true);
    await assert.rejects(() => store.loadCreatorProject("rename-test"), /ENOENT/);
  } finally {
    if (previousRoot === undefined) delete process.env.REMOTION_MD_CREATOR_ROOT;
    else process.env.REMOTION_MD_CREATOR_ROOT = previousRoot;
    await rm(root, { recursive: true, force: true });
  }
});

test("creator project deletion never follows a stored manifest into a sibling project", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "remotion-md-creator-delete-boundary-"));
  const previousRoot = process.env.REMOTION_MD_CREATOR_ROOT;
  process.env.REMOTION_MD_CREATOR_ROOT = root;
  try {
    const store = await import(`../scripts/creator/project-store.mjs?delete-boundary=${Date.now()}`);
    const project = await store.createCreatorProject({
      id: "delete-source",
      title: "待删除项目",
      topic: "删除边界",
      category: "tool-review",
      agentId: "codex-cli",
    });
    const sibling = resolve(root, "keep-sibling");
    const marker = resolve(sibling, "marker.txt");
    await mkdir(sibling, { recursive: true });
    await writeFile(marker, "must survive");
    project.video = {
      projectId: "keep-sibling-video",
      manifest: resolve(sibling, "project.json"),
    };
    await store.saveCreatorProject(project);

    await store.deleteCreatorProject({ id: "delete-source", confirmation: "待删除项目" });

    assert.equal(await readFile(marker, "utf8"), "must survive");
    assert.equal((await stat(sibling)).isDirectory(), true);
  } finally {
    if (previousRoot === undefined) delete process.env.REMOTION_MD_CREATOR_ROOT;
    else process.env.REMOTION_MD_CREATOR_ROOT = previousRoot;
    await rm(root, { recursive: true, force: true });
  }
});

test("creator project inventory reports invalid directories instead of hiding them", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "remotion-md-creator-inventory-"));
  const previousRoot = process.env.REMOTION_MD_CREATOR_ROOT;
  process.env.REMOTION_MD_CREATOR_ROOT = root;
  try {
    const store = await import(`../scripts/creator/project-store.mjs?inventory=${Date.now()}`);
    await store.createCreatorProject({
      id: "valid-project",
      title: "正常项目",
      topic: "项目清单",
      category: "tool-review",
      agentId: "codex-cli",
    });
    const invalidDirectory = resolve(root, "broken_project");
    await mkdir(invalidDirectory);
    await writeFile(resolve(invalidDirectory, "creator-project.json"), "{broken");

    const inventory = await store.inspectCreatorProjects();

    assert.deepEqual(
      inventory.projects.map((item) => item.project.id),
      ["valid-project"],
    );
    assert.equal(inventory.invalidProjects.length, 1);
    assert.equal(inventory.invalidProjects[0].id, "broken_project");
    assert.match(inventory.invalidProjects[0].error, /Invalid creator project id/);
  } finally {
    if (previousRoot === undefined) delete process.env.REMOTION_MD_CREATOR_ROOT;
    else process.env.REMOTION_MD_CREATOR_ROOT = previousRoot;
    await rm(root, { recursive: true, force: true });
  }
});

test("creator project inventory sorts by creation time instead of title or latest update", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "remotion-md-creator-created-order-"));
  const previousRoot = process.env.REMOTION_MD_CREATOR_ROOT;
  process.env.REMOTION_MD_CREATOR_ROOT = root;
  try {
    const store = await import(`../scripts/creator/project-store.mjs?created-order=${Date.now()}`);
    const older = await store.createCreatorProject({
      id: "zeta-older",
      title: "Z 项目",
      topic: "较早创建",
      category: "tool-review",
      agentId: "codex-cli",
    });
    const newer = await store.createCreatorProject({
      id: "alpha-newer",
      title: "A 项目",
      topic: "较晚创建",
      category: "tool-review",
      agentId: "codex-cli",
    });
    older.project.createdAt = "2025-01-01T00:00:00.000Z";
    older.project.updatedAt = "2026-03-01T00:00:00.000Z";
    newer.project.createdAt = "2026-01-01T00:00:00.000Z";
    newer.project.updatedAt = "2026-02-01T00:00:00.000Z";
    await writeFile(store.projectFile(older.project.id), `${JSON.stringify(older, null, 2)}\n`);
    await writeFile(store.projectFile(newer.project.id), `${JSON.stringify(newer, null, 2)}\n`);

    const inventory = await store.inspectCreatorProjects();

    assert.deepEqual(
      inventory.projects.map((item) => item.project.id),
      ["alpha-newer", "zeta-older"],
    );
  } finally {
    if (previousRoot === undefined) delete process.env.REMOTION_MD_CREATOR_ROOT;
    else process.env.REMOTION_MD_CREATOR_ROOT = previousRoot;
    await rm(root, { recursive: true, force: true });
  }
});
