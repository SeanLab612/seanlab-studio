import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildProjectStoragePlan } from "../scripts/operations/storage-governance.mjs";

test("storage plan exposes only allowlisted regenerable directories", async () => {
  const root = await mkdtemp(join(tmpdir(), "remotion-storage-plan-"));
  const workspace = join(root, "video/workspace");
  await mkdir(join(workspace, "logs"), { recursive: true });
  await mkdir(join(workspace, "clips_final_4k"), { recursive: true });
  await mkdir(join(root, "assets"), { recursive: true });
  await writeFile(join(workspace, "logs/run.log"), "log");
  await writeFile(join(workspace, "clips_final_4k/segment.mp4"), "segment");
  await writeFile(join(root, "assets/speaker.mp4"), "private-source");
  const plan = await buildProjectStoragePlan({ root, workspace, quotaBytes: 10 });
  assert.deepEqual(
    plan.cleanupPreview.map((item) => item.id),
    ["delivery-segments", "technical-logs"],
  );
  assert.ok(plan.project.bytes > 10);
  assert.equal(plan.project.status, "over-quota");
  assert.ok(plan.protected.includes("assets"));
  assert.equal(plan.cleanupPreview.some((item) => item.path.includes("assets")), false);
});

test("storage plan rejects a workspace outside the creator project", async () => {
  const root = await mkdtemp(join(tmpdir(), "remotion-storage-root-"));
  const external = await mkdtemp(join(tmpdir(), "remotion-storage-external-"));
  await assert.rejects(
    buildProjectStoragePlan({ root, workspace: external, quotaBytes: 100 }),
    /must stay inside/,
  );
  await access(root);
  assert.equal((await readFile(join(root, "missing"), "utf8").catch(() => null)), null);
});
