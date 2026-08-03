import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { createManifest, writeManifest } from "../scripts/workflow/manifest.mjs";

const root = await mkdtemp(join(tmpdir(), "remotion-storage-cleanup-"));
process.env.REMOTION_MD_CREATOR_ROOT = join(root, "projects");
const store = await import(`../scripts/creator/project-store.mjs?cleanup=${Date.now()}`);
const storage = await import(`../scripts/operations/storage-governance.mjs?cleanup=${Date.now()}`);

test("bound cleanup rejects stale previews and preserves creator assets", async () => {
  const project = await store.createCreatorProject({
    id: "cleanup-test",
    title: "Cleanup Test",
    topic: "Cleanup",
    category: "tutorial",
    agentId: "codex-cli",
  });
  const projectRoot = store.projectDir(project.project.id);
  const source = join(projectRoot, "assets/speaker.mp4");
  const transcript = join(projectRoot, "video/transcript.json");
  const manifestPath = join(projectRoot, "video/project.json");
  await mkdir(dirname(source), { recursive: true });
  await mkdir(dirname(transcript), { recursive: true });
  await writeFile(source, "private-speaker");
  await writeFile(transcript, JSON.stringify({ words: [] }));
  const manifest = createManifest({
    id: "cleanup-video",
    title: "Cleanup Test",
    source,
    transcript,
    outputPath: manifestPath,
  });
  manifest.providers.translation.provider = "offline";
  manifest.providers.semanticPlanning.provider = "fixture";
  await writeManifest(manifest, manifestPath);
  project.materials.push({
    id: "material-speaker",
    kind: "speaker-video",
    label: "Speaker",
    assetId: "speaker",
    required: true,
  });
  project.video = { projectId: manifest.project.id, manifest: manifestPath, sourceAssetId: "speaker" };
  await store.saveCreatorProject(project);
  const logs = join(projectRoot, "video/workspace/logs");
  await mkdir(logs, { recursive: true });
  await writeFile(join(logs, "first.log"), "first");
  const stale = await storage.previewCreatorProjectStorage(project.project.id);
  await writeFile(join(logs, "second.log"), "second");
  await assert.rejects(
    storage.applyCreatorProjectCleanup({
      projectId: project.project.id,
      planSha256: stale.planSha256,
      candidateIds: ["technical-logs"],
      confirmation: "delete-regenerable-cache",
    }),
    /preview is stale/,
  );
  const current = await storage.previewCreatorProjectStorage(project.project.id);
  await assert.rejects(
    storage.applyCreatorProjectCleanup({
      projectId: project.project.id,
      planSha256: current.planSha256,
      candidateIds: ["technical-logs"],
      confirmation: "yes",
    }),
    /exact delete-regenerable-cache/,
  );
  const result = await storage.applyCreatorProjectCleanup({
    projectId: project.project.id,
    planSha256: current.planSha256,
    candidateIds: ["technical-logs"],
    confirmation: "delete-regenerable-cache",
  });
  await assert.rejects(access(logs));
  assert.equal(await readFile(source, "utf8"), "private-speaker");
  assert.equal(result.record.deleted[0].id, "technical-logs");
  assert.ok(result.record.reclaimedBytes > 0);
  assert.match(await readFile(result.recordPath, "utf8"), /creator-project-cleanup/);
});
