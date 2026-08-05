import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { createManifest, writeManifest } from "../scripts/workflow/manifest.mjs";

const root = await mkdtemp(join(tmpdir(), "seanlab-production-plan-"));
process.env.REMOTION_MD_CREATOR_ROOT = join(root, "projects");

const write = async (path, value) => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, Buffer.isBuffer(value) ? value : `${JSON.stringify(value, null, 2)}\n`);
};

test("production direction confirmation is read-only and invalidates when the plan changes", async () => {
  const store = await import(`../scripts/creator/project-store.mjs?production-plan=${Date.now()}`);
  const project = await store.createCreatorProject({
    id: "production-plan-test",
    title: "Production plan test",
    topic: "Test the autonomous workflow",
    category: "tool-review",
    agentId: "codex-cli",
  });
  const projectRoot = store.projectDir(project.project.id);
  const source = join(projectRoot, "assets", "speaker.mp4");
  const transcript = join(projectRoot, "video", "transcript.json");
  const manifestPath = join(projectRoot, "video", "project.json");
  await write(source, Buffer.from("speaker"));
  await write(transcript, { words: [] });
  const manifest = createManifest({
    id: "production-plan-video",
    title: project.project.title,
    source,
    transcript,
    outputPath: manifestPath,
  });
  await writeManifest(manifest, manifestPath);
  project.materials.push({
    id: "material-speaker",
    kind: "speaker-video",
    label: "Speaker",
    assetId: "speaker",
    required: true,
  });
  project.materials.push({
    id: "material-screenshot",
    kind: "screenshot",
    label: "Result screenshot",
    assetId: "result-screenshot",
    required: true,
    productionTreatment: "direct",
  });
  project.video = { projectId: manifest.project.id, manifest: manifestPath, sourceAssetId: "speaker" };
  project.project.status = "video-ready";
  await store.saveCreatorProject(project);

  const workflow = await import(`../scripts/creator/studio-workflow.mjs?production-plan=${Date.now()}`);
  const { context } = await workflow.workflowContextForCreator(project.project.id);
  await write(context.paths.semanticNarrativePlan, { segments: [{ id: "segment-1" }] });
  await write(context.paths.visualDirectionPlan, {
    durationSeconds: 30,
    chapters: [{ id: "chapter-1", label: "问题与结果", candidateIds: ["candidate-1"] }],
    decisions: [{ candidateId: "candidate-1", chapterId: "chapter-1", action: "show", componentId: "causal-chain" }],
  });
  await write(context.paths.visualDirectionReport, {
    summary: { visualCoverageRatio: 0.82 },
    visualTypeCoverage: { realMaterialCoverage: 0.3, animationCoverage: 0.2 },
  });
  await write(context.paths.state, {
    schemaVersion: "1.0",
    projectId: manifest.project.id,
    manifestPath,
    updatedAt: new Date().toISOString(),
    stages: { validate: { status: "succeeded", finishedAt: new Date().toISOString() } },
  });

  const before = await workflow.loadStudioWorkflow(project.project.id);
  assert.equal(before.productionPlan.ready, true);
  assert.equal(before.productionPlan.confirmed, false);
  assert.equal(before.productionPlan.summary.visualCoverageRatio, 0.82);
  assert.deepEqual(before.productionPlan.requiredMaterials.map(({ id }) => id), ["material-screenshot"]);

  await workflow.confirmProductionPlan({
    projectId: project.project.id,
    visualPlanSha256: before.productionPlan.sha256,
    confirmation: "human-confirm-production-direction",
  });
  assert.equal((await workflow.loadStudioWorkflow(project.project.id)).productionPlan.confirmed, true);

  await write(context.paths.visualDirectionPlan, {
    durationSeconds: 30,
    chapters: [{ id: "chapter-1", label: "更新后的方向", candidateIds: [] }],
    decisions: [],
  });
  const changed = await workflow.loadStudioWorkflow(project.project.id);
  assert.equal(changed.productionPlan.confirmed, false);
  await assert.rejects(
    () =>
      workflow.confirmProductionPlan({
        projectId: project.project.id,
        visualPlanSha256: before.productionPlan.sha256,
        confirmation: "human-confirm-production-direction",
      }),
    /已更新/,
  );
});
