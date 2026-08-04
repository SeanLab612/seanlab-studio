import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { createManifest, writeManifest } from "../scripts/workflow/manifest.mjs";
import { createStages } from "../scripts/workflow/stages.mjs";
import { signatureFor } from "../scripts/workflow/state.mjs";

const write = async (path, value) => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, typeof value === "string" || Buffer.isBuffer(value) ? value : `${JSON.stringify(value, null, 2)}\n`);
};
const hash = (value) => createHash("sha256").update(value).digest("hex");
const hashFile = async (path) => hash(await readFile(path));
const canonicalHash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const execFileAsync = promisify(execFile);

test("Studio loads, annotates, rejects, and tamper-checks a current static review package", async () => {
  const root = await mkdtemp(join(tmpdir(), "remotion-md-static-review-"));
  process.env.REMOTION_MD_CREATOR_ROOT = join(root, "creator-projects");
  const projectId = "static-review-test";
  const videoRoot = join(root, "video-project");
  const manifestPath = join(videoRoot, "project.json");
  const source = join(videoRoot, "source.mp4");
  const transcript = join(videoRoot, "transcript.json");
  await write(source, "source");
  await write(transcript, { words: [] });
  const manifest = createManifest({
    id: projectId,
    title: "Static Review Test",
    source,
    transcript,
    outputPath: manifestPath,
  });
  manifest.workflow.motionReviewMode = "full-pacing";
  await writeManifest(manifest, manifestPath);

  const store = await import(`../scripts/creator/project-store.mjs?fixture=${Date.now()}`);
  const project = await store.createCreatorProject({
    id: projectId,
    title: "Static Review Test",
    topic: "审核画廊",
    category: "tool-review",
    agentId: "codex-cli",
  });
  project.project.status = "video-ready";
  project.video = { projectId, manifest: manifestPath };
  await store.saveCreatorProject(project);

  const workflow = await import(`../scripts/creator/studio-workflow.mjs?fixture=${Date.now()}`);
  const initialWorkflow = await workflow.loadStudioWorkflow(projectId);
  assert.equal(initialWorkflow.creatorStatus, "video-ready");
  assert.equal(initialWorkflow.stages.every((stage) => stage.status === "pending"), true);
  const { context } = await workflow.workflowContextForCreator(projectId);
  const qaDir = join(context.paths.workspace, "visual-qa");
  const framePath = join(qaDir, "frames", "01-entry.png");
  const frameManifestPath = join(qaDir, "frames-manifest.json");
  const qaPath = join(qaDir, "qa-report.json");
  const imageMetricsPath = join(qaDir, "image-metrics.json");
  const contactPath = join(qaDir, "contact-sheet.png");
  const titleContactPath = join(qaDir, "title-continuity-contact-sheet.png");
  await write(framePath, Buffer.from("png-frame"));
  await write(contactPath, Buffer.from("contact"));
  await write(titleContactPath, Buffer.from("titles"));
  await write(frameManifestPath, {
    frames: [
      {
        cueIndex: 0,
        cueId: "segment-1",
        componentId: "binary-versus",
        layoutId: "speaker-right-overlay-left",
        phase: "entry",
        timeSeconds: 1.2,
        frame: 72,
        visualCategory: "semantic-component",
        file: framePath,
      },
    ],
  });
  const qaReport = {
    schemaVersion: "1.0",
    projectId,
    reviewMode: "static",
    generatedAt: new Date().toISOString(),
    canvas: { width: 1920, height: 1080 },
    status: "passed",
    reportSha256: hash("qa-report"),
    summary: { cues: 1, frames: 1, errors: 0, warnings: 0, infos: 0 },
    policy: {},
    renderContext: { overlayScale: 1 },
    dependencies: { node: "test", remotion: "test", ffmpeg: "test", opencv: "test" },
    baseline: {},
    artifacts: {},
    findings: [],
  };
  await write(qaPath, qaReport);
  await write(imageMetricsPath, { frames: [{ file: framePath, missing: false, laplacianVariance: 800 }] });
  await write(context.paths.visualDirectionPlan, {
    chapters: [{ id: "chapter-1", label: "第一章", startCue: 0, endCue: 2 }],
    decisions: [{ candidateId: "segment-1", chapterId: "chapter-1", action: "select", importance: "hero" }],
    titleCues: [],
  });
  await write(context.paths.visualDirectionReport, {
    summary: { selectedCount: 1, skippedCount: 0, visualCoverageRatio: 0.25, visualsPerMinute: 1 },
    importanceUsage: { hero: 1 },
    componentUsage: { "binary-versus": 1 },
  });
  await write(context.paths.resolvedSceneTimeline, { summary: { authored: 0, resolved: 0, requiredUnresolved: 0 }, scenes: [] });
  await write(context.paths.terminologyReview, { entryCount: 3, projectOverrideCount: 0, domains: ["ai-software"] });
  await write(context.paths.regressionReport, { status: "passed", findings: [] });
  await write(context.paths.visualPacingReview, "fixture 720p preview\n");
  await write(context.paths.finalProps, { overlayCues: [] });

  const artifacts = [];
  for (const [path, kind] of [
    [frameManifestPath, "frames-manifest"],
    [qaPath, "qa-report"],
    [imageMetricsPath, "image-metrics"],
    [contactPath, "contact-sheet"],
    [titleContactPath, "title-continuity-contact-sheet"],
    [framePath, "risk-frame"],
    [context.paths.visualDirectionPlan, "visual-direction-plan"],
    [context.paths.visualDirectionReport, "visual-direction-report"],
    [context.paths.resolvedSceneTimeline, "resolved-scene-timeline"],
    [context.paths.visualPacingReview, "visual-pacing-review-video"],
    [context.paths.finalProps, "delivery-render-props"],
  ]) {
    const bytes = (await readFile(path)).length;
    artifacts.push({ kind, path: relative(context.paths.workspace, path).split(sep).join("/"), bytes, sha256: await hashFile(path) });
  }
  artifacts.sort((left, right) => left.path.localeCompare(right.path));
  const binding = {
    schemaVersion: "1.0",
    projectId,
    reviewMode: "static",
    qaStatus: "passed",
    qaReportSha256: qaReport.reportSha256,
    artifacts,
  };
  const evidence = {
    ...binding,
    kind: "review-evidence",
    generatedAt: new Date().toISOString(),
    approvalBindingSha256: canonicalHash(binding),
    summary: { riskFrames: 1, speakerOnlyFrames: 0 },
  };
  await write(context.paths.reviewEvidence, evidence);
  await write(context.paths.reviewEvidenceSummary, "review summary\n");

  const definitions = new Map(createStages(context).map((stage) => [stage.name, stage]));
  for (const name of ["visual-qa", "visual-pacing-review", "review-evidence", "regression-fixtures", "agent-review"])
    for (const output of definitions.get(name).outputs)
      if (!(await readFile(output).catch(() => undefined))) await write(output, output.endsWith(".json") ? {} : "fixture\n");
  const state = {
    schemaVersion: "1.0",
    projectId,
    manifestPath,
    stageOrder: createStages(context).map((stage) => stage.name),
    events: [],
    stages: { "human-approval": { status: "pending" } },
  };
  for (const name of ["visual-qa", "visual-pacing-review", "review-evidence", "regression-fixtures", "agent-review"])
    state.stages[name] = {
      status: "succeeded",
      outputs: definitions.get(name).outputs,
      outputSignature: await signatureFor(definitions.get(name).outputs),
    };
  await write(context.paths.state, state);

  const reviewModule = await import(`../scripts/creator/studio-static-review.mjs?fixture=${Date.now()}`);
  const loaded = await reviewModule.loadStaticReview(projectId);
  assert.equal(loaded.evidenceValid, true);
  assert.equal(loaded.provenance.status, "current");
  assert.equal(loaded.frames.length, 1);
  assert.match(loaded.artifacts.visualPacingReview, /visual-pacing-review-video/);
  assert.equal(loaded.approval.ready, true);
  assert.deepEqual(
    (await reviewModule.assertStaticReviewApproval({
      projectId,
      approvalBindingSha256: evidence.approvalBindingSha256,
      confirmation: "human-review-approved",
    })).workflowArgs,
    ["--approve"],
  );
  await execFileAsync(process.execPath, ["scripts/workflow.mjs", "--project", manifestPath, "--approve"], {
    cwd: resolve("."),
  });
  const approvedState = JSON.parse(await readFile(context.paths.state, "utf8"));
  assert.equal(approvedState.stages["human-approval"].status, "approved");
  assert.equal(approvedState.stages["human-approval"].reviewEvidenceSha256, evidence.approvalBindingSha256);
  assert.ok(approvedState.stages["human-approval"].snapshot.artifactCount >= 1);
  const deliveryModule = await import(`../scripts/creator/studio-delivery.mjs?fixture=${Date.now()}`);
  const approvedManifest = await readFile(manifestPath, "utf8");
  assert.deepEqual(
    (
      await deliveryModule.assertStudioDeliveryStart({
        projectId,
        confirmation: "human-delivery-start",
        profile: { resolution: "4k", frameRate: "source" },
      })
    ).workflowArgs,
    ["--until", "delivery", "--delivery-resolution", "4k", "--delivery-frame-rate", "source"],
  );
  assert.equal(await readFile(manifestPath, "utf8"), approvedManifest);
  approvedState.stages["human-approval"] = { status: "pending" };
  await write(context.paths.state, approvedState);
  const note = await reviewModule.addStaticReviewNote({
    projectId,
    approvalBindingSha256: evidence.approvalBindingSha256,
    artifactId: "frame-0001",
    cueId: "segment-1",
    text: "进入画面完整",
  });
  assert.equal(note.text, "进入画面完整");
  await reviewModule.rejectStaticReview({
    projectId,
    approvalBindingSha256: evidence.approvalBindingSha256,
    reason: "画面节奏需要调整",
  });
  const rejected = await reviewModule.loadStaticReview(projectId);
  assert.equal(rejected.approval.status, "rejected");
  assert.equal(rejected.notes.length, 1);
  await write(framePath, Buffer.from("tampered-frame"));
  const stale = await reviewModule.loadStaticReview(projectId);
  assert.equal(stale.evidenceValid, false);
  assert.equal(stale.provenance.status, "historical");
  await assert.rejects(() => reviewModule.resolveStaticReviewArtifact(projectId, "frame-0001"), /发生了变化/);
});
