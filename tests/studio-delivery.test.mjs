import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { createManifest, writeManifest } from "../scripts/workflow/manifest.mjs";
import { createStages } from "../scripts/workflow/stages.mjs";

const root = await mkdtemp(join(tmpdir(), "remotion-md-studio-delivery-"));
process.env.REMOTION_MD_CREATOR_ROOT = join(root, "projects");

const write = async (path, value) => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, Buffer.isBuffer(value) ? value : `${JSON.stringify(value, null, 2)}\n`);
};
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

const setupValidatedDelivery = async (projectId) => {
  const store = await import(`../scripts/creator/project-store.mjs?delivery=${projectId}`);
  const project = await store.createCreatorProject({
    id: projectId,
    title: projectId,
    topic: "Studio delivery",
    category: "tool-review",
    agentId: "codex-cli",
  });
  const projectRoot = store.projectDir(projectId);
  const manifestPath = join(projectRoot, "video", "project.json");
  const source = join(projectRoot, "assets", "speaker.mp4");
  const transcript = join(projectRoot, "video", "transcript.json");
  await write(source, Buffer.from("source"));
  await write(transcript, { words: [] });
  await writeManifest(
    createManifest({ id: `${projectId}-video`, title: projectId, source, transcript, outputPath: manifestPath }),
    manifestPath,
  );
  project.materials.push({
    id: "material-speaker",
    kind: "speaker-video",
    label: "Speaker",
    assetId: "speaker",
    required: true,
  });
  project.video = { projectId: `${projectId}-video`, manifest: manifestPath, sourceAssetId: "speaker" };
  project.project.status = "approved";
  await store.saveCreatorProject(project);

  const workflow = await import(`../scripts/creator/studio-workflow.mjs?delivery=${projectId}`);
  const { context } = await workflow.workflowContextForCreator(projectId);
  const output = join(context.paths.workspace, "delivery-source-resolution.mp4");
  const outputBytes = Buffer.from(`validated-delivery-${projectId}`);
  await write(output, outputBytes);
  const validation = {
    schemaVersion: "1.0",
    kind: "delivery-validation",
    projectId,
    generatedAt: new Date().toISOString(),
    status: "passed",
    expected: { width: 1920, height: 1080, codec: "h264", durationSeconds: 12, durationToleranceSeconds: 1 },
    decode: { status: "passed" },
    output: { path: output, bytes: outputBytes.length, sha256: sha256(outputBytes) },
    provenance: { kind: "delivery-render-report", provenance: { inputSignature: "fixture" } },
    probe: {},
    media: {
      video: { codec_type: "video", codec_name: "h264", width: 1920, height: 1080, r_frame_rate: "60/1" },
      audio: { codec_type: "audio", codec_name: "aac" },
      durationSeconds: 12,
    },
    findings: [],
  };
  await write(context.paths.deliveryValidation, validation);

  const snapshotDir = join(context.paths.workspace, "approvals", "fixture-approved");
  const snapshotPath = join(snapshotDir, "approval-snapshot.json");
  const snapshot = {
    schemaVersion: "1.1",
    kind: "approval-snapshot",
    projectId,
    createdAt: new Date().toISOString(),
    reviewEvidenceSha256: "review-binding",
    externalBindings: [
      { kind: "source-video", path: source, bytes: (await readFile(source)).length, sha256: sha256(await readFile(source)) },
      {
        kind: "project-manifest",
        path: manifestPath,
        bytes: (await readFile(manifestPath)).length,
        sha256: sha256(await readFile(manifestPath)),
      },
    ],
    artifacts: [],
  };
  await write(snapshotPath, snapshot);
  const snapshotSha256 = sha256(await readFile(snapshotPath));
  const stages = createStages(context);
  const state = {
    schemaVersion: "1.0",
    projectId,
    manifestPath,
    updatedAt: new Date().toISOString(),
    stageOrder: stages.map((stage) => stage.name),
    events: [
      { at: new Date().toISOString(), event: "stage.succeeded", stage: "delivery-render" },
      { at: new Date().toISOString(), event: "stage.succeeded", stage: "delivery-validate" },
    ],
    stages: Object.fromEntries(stages.map((stage) => [stage.name, { status: "pending" }])),
  };
  state.stages["human-approval"] = {
    status: "approved",
    approvedAt: new Date().toISOString(),
    reviewEvidenceSha256: "review-binding",
    snapshot: {
      id: "fixture-approved",
      path: "approvals/fixture-approved/approval-snapshot.json",
      sha256: snapshotSha256,
      artifactCount: 0,
    },
  };
  state.stages["delivery-render"] = { status: "succeeded", outputs: [output] };
  state.stages["delivery-validate"] = { status: "succeeded", outputs: [context.paths.deliveryValidation] };
  await write(context.paths.state, state);
  return { store, context, output, outputBytes };
};

test("Studio exposes a validated delivery, accepts it once, and writes a project-local summary", async () => {
  const fixture = await setupValidatedDelivery("delivery-accept");
  const delivery = await import(`../scripts/creator/studio-delivery.mjs?accept=${Date.now()}`);
  const before = await delivery.loadStudioDelivery("delivery-accept");
  assert.equal(before.status, "awaiting-acceptance");
  assert.equal(before.readyForAcceptance, true);
  assert.equal(before.validation.media.videoCodec, "h264");
  assert.equal(before.validation.media.hasAudio, true);
  assert.equal((await delivery.resolveDeliveryArtifact("delivery-accept", "video")).path, fixture.output);
  await assert.rejects(() => delivery.resolveDeliveryArtifact("delivery-accept", "arbitrary"), /不支持/);

  const accepted = await delivery.acceptStudioDelivery({
    projectId: "delivery-accept",
    confirmation: "human-delivery-accepted",
    note: "最终版本",
  });
  assert.equal(accepted.decision.outputSha256, sha256(fixture.outputBytes));
  assert.equal(accepted.summary.finalVideo.path, "video/workspace/delivery-source-resolution.mp4");
  assert.equal(accepted.summary.reviewPackage.approvalBindingSha256, "review-binding");
  assert.equal((await fixture.store.loadCreatorProject("delivery-accept")).project.status, "delivered");
  assert.equal((await delivery.loadStudioDelivery("delivery-accept")).status, "delivered");
  assert.equal((await delivery.loadStudioDelivery("delivery-accept")).summary.finalVideo.sha256, sha256(fixture.outputBytes));
  await assert.rejects(
    () => delivery.returnStudioDelivery({ projectId: "delivery-accept", reason: "反悔" }),
    /已经完成交付/,
  );
});

test("a returned delivery cannot be approved again without a changed validated artifact", async () => {
  await setupValidatedDelivery("delivery-return");
  const delivery = await import(`../scripts/creator/studio-delivery.mjs?return=${Date.now()}`);
  await delivery.returnStudioDelivery({ projectId: "delivery-return", reason: "录屏停留时间不足" });
  const loaded = await delivery.loadStudioDelivery("delivery-return");
  assert.equal(loaded.status, "returned");
  assert.equal(loaded.decision.reason, "录屏停留时间不足");
  await assert.rejects(
    () =>
      delivery.acceptStudioDelivery({
        projectId: "delivery-return",
        confirmation: "human-delivery-accepted",
      }),
    /不能在未返修的情况下重新批准/,
  );
});

test("Studio surfaces a physical delivery file that is not backed by formal workflow state", async () => {
  const fixture = await setupValidatedDelivery("delivery-state-conflict");
  const state = JSON.parse(await readFile(fixture.context.paths.state, "utf8"));
  state.stages["delivery-render"] = { status: "pending" };
  state.stages["delivery-validate"] = { status: "pending" };
  await write(fixture.context.paths.state, state);

  const delivery = await import(`../scripts/creator/studio-delivery.mjs?conflict=${Date.now()}`);
  const loaded = await delivery.loadStudioDelivery("delivery-state-conflict");
  assert.equal(loaded.status, "conflict");
  assert.equal(loaded.canStart, false);
  assert.deepEqual(
    loaded.consistency.findings.map((item) => item.code),
    ["DELIVERY_FILE_WITHOUT_RENDER_STATE", "DELIVERY_VALIDATION_WITHOUT_STATE"],
  );
  assert.equal(loaded.video, undefined);
});
