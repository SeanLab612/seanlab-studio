import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { createManifest, writeManifest } from "../scripts/workflow/manifest.mjs";
import { createStages } from "../scripts/workflow/stages.mjs";

const root = await mkdtemp(join(tmpdir(), "remotion-md-studio-operations-"));
process.env.REMOTION_MD_CREATOR_ROOT = join(root, "projects");

const write = async (path, value) => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, Buffer.isBuffer(value) ? value : `${JSON.stringify(value, null, 2)}\n`);
};

const setup = async () => {
  const store = await import(`../scripts/creator/project-store.mjs?operations=${Date.now()}`);
  const project = await store.createCreatorProject({
    id: "operations-test",
    title: "Operations Test",
    topic: "Studio revision",
    category: "tool-review",
    agentId: "claude-code",
    model: "mimo-v2.5-pro",
  });
  const rootDir = store.projectDir(project.project.id);
  const source = resolve(rootDir, "assets/speaker.mp4");
  const transcript = resolve(rootDir, "video/transcript.json");
  const manifestPath = resolve(rootDir, "video/project.json");
  await write(source, Buffer.from("speaker"));
  await write(transcript, { words: [{ start: 0, end: 0.5, text: "保留口播" }] });
  const manifest = createManifest({
    id: "operations-test-video",
    title: project.project.title,
    source,
    transcript,
    outputPath: manifestPath,
    agentId: "claude-code",
    agentModel: "mimo-v2.5-pro",
  });
  await writeManifest(manifest, manifestPath);
  project.materials.push({
    id: "material-speaker",
    kind: "speaker-video",
    label: "Speaker",
    assetId: "speaker",
    required: true,
  });
  project.video = { projectId: manifest.project.id, manifest: manifestPath, sourceAssetId: "speaker" };
  project.project.status = "approved";
  await store.saveCreatorProject(project);
  const workflow = await import(`../scripts/creator/studio-workflow.mjs?operations=${Date.now()}`);
  const { context } = await workflow.workflowContextForCreator(project.project.id);
  const captions = [{ start: 0, end: 2, zh: "保留口播", en: "Old translation", role: "caption" }];
  const cue = {
    start: 0,
    end: 6,
    title: "工作流",
    subtitle: "完整流程",
    subtitleEn: "Workflow",
    layoutTemplateId: "speaker-right-main",
    generatedVisual: {
      segment: { id: "segment-1", start: 0, end: 6, text: "保留口播" },
      component: { id: "binary-versus", status: "approved" },
      narrative: { eyebrow: "FLOW", title: "工作流", subtitleZh: "完整流程", subtitleEn: "Workflow" },
      props: { items: [{ id: "a", label: "之前", metric: "分散" }, { id: "b", label: "现在", metric: "一体化" }] },
    },
  };
  await write(context.paths.semanticCaptions, captions);
  await write(context.paths.captions, captions);
  await write(resolve(context.paths.workspace, "edl.json"), { totalDurationS: 6, ranges: [{ start: 0, end: 6 }] });
  await write(context.paths.semanticNarrativePlan, { segments: [{ id: "segment-1", text: "保留口播" }] });
  await write(context.paths.planning, { schemaVersion: "1.0", overlayCues: [cue] });
  await write(context.paths.reviewProps, { overlayCues: [cue], subtitleCues: captions });
  await write(context.paths.visualDirectionPlan, { decisions: [{ candidateId: "segment-1", action: "show" }] });
  await write(context.paths.semanticProviderReport, {
    executor: "claude-code",
    model: "mimo-v2.5-pro",
    cliVersion: "2.1.186",
  });
  await write(context.paths.reviewEvidence, { kind: "review-evidence" });
  await write(resolve(context.paths.workspace, "visual-qa/qa-report.json"), { status: "passed" });
  await write(context.paths.regressionReport, { status: "passed" });
  const stages = createStages(context);
  const state = {
    schemaVersion: "1.0",
    projectId: manifest.project.id,
    manifestPath,
    updatedAt: new Date().toISOString(),
    stageOrder: stages.map(({ name }) => name),
    events: [],
    stages: Object.fromEntries(stages.map(({ name }) => [name, { status: name === "human-approval" ? "approved" : "succeeded" }])),
  };
  state.stages["human-approval"].snapshot = { id: "old-approval", path: "approvals/old.json", sha256: "a".repeat(64) };
  await write(context.paths.state, state);
  return { context, projectId: project.project.id };
};

test("Studio inspectors expose current evidence and a baseline-bound narrow revision", async () => {
  const fixture = await setup();
  const operations = await import(`../scripts/creator/studio-operations.mjs?test=${Date.now()}`);
  const loaded = await operations.loadStudioOperations({
    projectId: fixture.projectId,
    jobs: [{ id: "job-1", projectId: fixture.projectId, kind: "video-workflow", status: "failed" }],
  });
  assert.equal(loaded.inspectors.transcript.text, "保留口播");
  assert.equal(loaded.inspectors.semantic.provider.model, "mimo-v2.5-pro");
  assert.equal(loaded.inspectors.visuals[0].componentId, "binary-versus");
  assert.equal(loaded.operations.jobs[0].id, "job-1");
  assert.equal(loaded.operations.recovery.status, "blocked");
  assert.equal(loaded.operations.recovery.latestJob.id, "job-1");

  const preview = await operations.previewStudioRevision({
    projectId: fixture.projectId,
    reviewer: "Sean",
    reason: "修正英文字幕",
    kind: "translation",
    values: { cueIndex: 0, en: "Reviewed translation" },
  });
  assert.equal(preview.impact.earliestStage, "validate");
  assert.equal(preview.impact.providerCalls.semanticAgent, false);
  assert.equal(preview.request.operations[0].expectedZh, "保留口播");

  const result = await operations.applyStudioRevision({ projectId: fixture.projectId, request: preview.request });
  const captions = JSON.parse(await readFile(fixture.context.paths.captions, "utf8"));
  const state = JSON.parse(await readFile(fixture.context.paths.state, "utf8"));
  assert.equal(captions[0].zh, "保留口播");
  assert.equal(captions[0].en, "Reviewed translation");
  assert.equal(result.earliestStaleStage, "validate");
  assert.equal(state.stages["human-approval"].status, "pending");
  assert.equal(state.stages["human-approval"].snapshot, undefined);
});
