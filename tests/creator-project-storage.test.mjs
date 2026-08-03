import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import test from "node:test";
import {
  migrateProjectStorage,
  planProjectStorageMigration,
  rebaseSucceededWorkflowState,
} from "../scripts/creator/migrate-project-storage.mjs";
import { createManifest, readManifest, writeManifest } from "../scripts/workflow/manifest.mjs";

test("creator projects migrate into one projects/id directory with a nested video workspace", async () => {
  const root = await mkdtemp(join(tmpdir(), "creator-storage-"));
  const legacyRoot = join(root, "creator-projects");
  const projectsRoot = join(root, "projects");
  const legacyProject = join(legacyRoot, "html");
  const legacyVideo = join(projectsRoot, "html-video");
  const source = join(legacyProject, "assets", "speaker.mov");
  await mkdir(dirname(source), { recursive: true });
  await writeFile(source, "speaker");
  await mkdir(join(legacyProject, "authoring"), { recursive: true });
  await writeFile(join(legacyProject, "authoring", "final-script.md"), "script");
  const manifestPath = join(legacyVideo, "project.json");
  const manifest = createManifest({ id: "html-video", title: "HTML", source, outputPath: manifestPath });
  await writeManifest(manifest, manifestPath);
  const now = new Date().toISOString();
  await writeFile(
    join(legacyProject, "creator-project.json"),
    `${JSON.stringify({
      schemaVersion: "1.0",
      project: { id: "html", title: "HTML", createdAt: now, updatedAt: now, status: "video-ready" },
      agent: {
        id: "codex-cli",
        fallback: "none",
        authoringContractVersion: "1.0",
        semanticContractVersion: "1.1",
      },
      brief: { topic: "HTML", category: "tool-review" },
      sources: [],
      materials: [{ id: "material-1", kind: "speaker-video", label: "speaker", assetId: "speaker", required: true }],
      authoring: { state: "locked", finalScript: "authoring/final-script.md", finalScriptSha256: "a".repeat(64) },
      video: { projectId: "html-video", manifest: manifestPath, sourceAssetId: "speaker" },
    }, null, 2)}\n`,
  );
  const plan = await planProjectStorageMigration({ id: "html", legacyRoot, projectsRoot });
  assert.equal(plan.targetDir, join(projectsRoot, "html"));
  const result = await migrateProjectStorage({ id: "html", legacyRoot, projectsRoot });
  assert.equal(result.videoManifest, join(projectsRoot, "html", "video", "project.json"));
  assert.equal((await stat(join(projectsRoot, "html", "assets", "speaker.mov"))).size, 7);
  const migratedCreator = JSON.parse(await readFile(join(projectsRoot, "html", "creator-project.json"), "utf8"));
  assert.equal(migratedCreator.video.manifest, result.videoManifest);
  const migratedManifest = JSON.parse(await readFile(result.videoManifest, "utf8"));
  assert.equal(migratedManifest.paths.source, relative(dirname(result.videoManifest), join(projectsRoot, "html", "assets", "speaker.mov")));
  const context = await readManifest(result.videoManifest);
  await mkdir(dirname(context.paths.preflightReport), { recursive: true });
  await writeFile(context.paths.preflightReport, "{}\n");
  await writeFile(
    context.paths.state,
    `${JSON.stringify({
      schemaVersion: "1.0",
      projectId: "html-video",
      manifestPath: result.videoManifest,
      stageOrder: ["preflight"],
      stages: { preflight: { status: "succeeded", inputSignature: "old", outputSignature: "old" } },
      events: [],
    })}\n`,
  );
  const rebased = await rebaseSucceededWorkflowState(result.videoManifest);
  assert.deepEqual(rebased.changed, ["preflight"]);
  const rebasedState = JSON.parse(await readFile(context.paths.state, "utf8"));
  assert.notEqual(rebasedState.stages.preflight.inputSignature, "old");
  assert.notEqual(rebasedState.stages.preflight.outputSignature, "old");
});
