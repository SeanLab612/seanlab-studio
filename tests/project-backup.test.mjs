import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const root = await mkdtemp(join(tmpdir(), "remotion-project-backup-"));
process.env.REMOTION_MD_CREATOR_ROOT = join(root, "projects");
process.env.REMOTION_MD_BACKUP_ROOT = join(root, "backups");
const store = await import(`../scripts/creator/project-store.mjs?backup=${Date.now()}`);
const backup = await import(`../scripts/operations/project-backup.mjs?backup=${Date.now()}`);

test("project backup verifies hashes and restores with an archived rollback", async () => {
  await store.createCreatorProject({
    id: "backup-test",
    title: "Backup Test",
    topic: "Backup",
    category: "tutorial",
    agentId: "codex-cli",
  });
  await writeFile(join(store.projectDir("backup-test"), "creator-note.txt"), "original");
  const created = await backup.createProjectBackup({ projectId: "backup-test", backupRoot: join(root, "backups") });
  assert.equal(created.verification.status, "passed");
  await writeFile(join(store.projectDir("backup-test"), "creator-note.txt"), "changed");
  await assert.rejects(
    backup.restoreProjectBackup({ backupPath: created.path, confirmation: "wrong", backupRoot: join(root, "backups") }),
    /exact project id/,
  );
  const restored = await backup.restoreProjectBackup({
    backupPath: created.path,
    confirmation: "backup-test",
    backupRoot: join(root, "backups"),
  });
  assert.equal(await readFile(join(store.projectDir("backup-test"), "creator-note.txt"), "utf8"), "original");
  assert.ok(restored.rollbackPath);
  assert.equal(await readFile(join(restored.rollbackPath, "creator-note.txt"), "utf8"), "changed");
});

test("project backup detects tampering before restore", async () => {
  await store.createCreatorProject({
    id: "tamper-test",
    title: "Tamper Test",
    topic: "Backup",
    category: "tutorial",
    agentId: "codex-cli",
  });
  const created = await backup.createProjectBackup({ projectId: "tamper-test", backupRoot: join(root, "backups") });
  await writeFile(join(created.path, "project/creator-project.json"), "{}");
  assert.equal((await backup.verifyProjectBackup(created.path)).status, "failed");
});

test("backup retention is preview-first and needs exact confirmation", async () => {
  await store.createCreatorProject({
    id: "retention-test",
    title: "Retention Test",
    topic: "Backup",
    category: "tutorial",
    agentId: "codex-cli",
  });
  for (let index = 0; index < 4; index += 1) {
    await writeFile(join(store.projectDir("retention-test"), "revision.txt"), String(index));
    await backup.createProjectBackup({ projectId: "retention-test", backupRoot: join(root, "backups") });
  }
  const preview = await backup.previewBackupRetention({
    projectId: "retention-test",
    backupRoot: join(root, "backups"),
  });
  assert.equal(preview.keep.length, 3);
  assert.equal(preview.removable.length, 1);
  await assert.rejects(
    backup.pruneProjectBackups({
      projectId: "retention-test",
      confirmation: "wrong",
      backupRoot: join(root, "backups"),
    }),
    /exact project id/,
  );
  const pruned = await backup.pruneProjectBackups({
    projectId: "retention-test",
    confirmation: "retention-test",
    backupRoot: join(root, "backups"),
  });
  assert.equal(pruned.removed.length, 1);
  assert.equal(
    (await backup.listProjectBackups({ projectId: "retention-test", backupRoot: join(root, "backups") })).length,
    3,
  );
});
