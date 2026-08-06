import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  assertStudioRecoveryConfirmation,
  buildStudioRecovery,
  recordStudioRecoveryConfirmation,
  studioRecoveryDiagnosisPrompt,
} from "../scripts/creator/studio-recovery.mjs";
import { workflowExecutionForStudioRecovery } from "../scripts/creator/studio-contract.mjs";

const baseWorkflow = () => ({
  recutApproved: true,
  reviewReady: false,
  reviewApproved: false,
  currentFailure: {
    code: "PROVIDER_REQUEST_TIMEOUT",
    category: "provider",
    stage: "semantic-plan",
    message: "内容服务超时",
    remediation: "重试同一阶段",
    retryable: true,
  },
  stages: [
    { name: "ingest", status: "succeeded" },
    { name: "recut-approval", status: "approved" },
    { name: "semantic-plan", status: "failed" },
    { name: "visual-direction", status: "pending" },
    { name: "human-approval", status: "pending" },
  ],
});

test("recovery snapshot exposes preserved work and a bound resumable action", () => {
  const recovery = buildStudioRecovery({
    projectId: "recovery-test",
    workflow: baseWorkflow(),
    jobs: [
      {
        id: "job-1",
        projectId: "recovery-test",
        kind: "video-workflow",
        action: "continue",
        status: "failed",
        error: "内容服务超时",
        technicalTail: ["provider timed out"],
      },
      {
        id: "job-ready",
        projectId: "recovery-test",
        kind: "video-workflow",
        action: "readiness",
        status: "completed",
        readiness: {
          readinessSha256: "a".repeat(64),
          readinessStatus: "ready",
          targetStage: "agent-review",
          nextHumanGate: "human-approval",
          plannedStages: ["semantic-plan", "visual-direction"],
          reusedStages: ["ingest", "recut-approval"],
          blockedStages: [],
          execution: { agentCalls: 1, translationCalls: 0, videoRenderStages: 0, staticRenderStages: 2 },
          avoidedExpensiveStages: ["recut-review"],
          issues: [],
        },
      },
    ],
    artifacts: [
      { kind: "transcript", available: true, path: "video/transcript.json", bytes: 80, sha256: "b".repeat(64) },
      { kind: "visual-brief", available: false },
    ],
    agent: { id: "codex-cli", model: "gpt-5.6-sol", fallback: "none" },
  });
  assert.equal(recovery.status, "recoverable");
  assert.equal(recovery.resume.action, "continue");
  assert.equal(recovery.resume.stage, "semantic-plan");
  assert.deepEqual(recovery.preserved.completedStages, ["ingest"]);
  assert.deepEqual(recovery.preserved.approvedStages, ["recut-approval"]);
  assert.equal(recovery.preserved.artifactCount, 1);
  assert.equal(recovery.readiness.execution.agentCalls, 1);
  assert.match(recovery.recoverySha256, /^[a-f0-9]{64}$/);
  assert.equal(assertStudioRecoveryConfirmation({ recovery, expectedSha256: recovery.recoverySha256 }), recovery);
  assert.throws(
    () => assertStudioRecoveryConfirmation({ recovery, expectedSha256: "0".repeat(64) }),
    /快照已经变化/,
  );
  const prompt = studioRecoveryDiagnosisPrompt(recovery);
  assert.match(prompt.system, /read-only/);
  assert.match(prompt.user, /provider timed out/);
  assert.doesNotMatch(prompt.user, /\/Users\//);
});

test("recovery prefers the real failed stage over an earlier optional pending stage", () => {
  const workflow = baseWorkflow();
  workflow.stages.splice(2, 0, { name: "supplemental-probe", status: "pending" });
  const recovery = buildStudioRecovery({
    projectId: "recovery-test",
    workflow,
    jobs: [],
    artifacts: [],
    agent: {},
  });
  assert.equal(recovery.resume.stage, "semantic-plan");
});

test("an Agent self-review revision restarts visual production from the safe authored-plan boundary", () => {
  const workflow = baseWorkflow();
  workflow.currentFailure = {
    code: "STAGE_EXECUTION_FAILED",
    category: "workflow",
    stage: "agent-review",
    message: "one confirmed component needs speaker fallback",
    retryable: true,
  };
  workflow.stages = [
    { name: "visual-input-preflight", status: "succeeded" },
    { name: "regression-fixtures", status: "succeeded" },
    { name: "agent-review", status: "failed" },
    { name: "human-approval", status: "pending" },
  ];
  const recovery = buildStudioRecovery({
    projectId: "agent-review-revision",
    workflow,
    jobs: [],
    artifacts: [],
    agent: {},
  });
  assert.equal(recovery.resume.action, "continue");
  assert.equal(recovery.resume.stage, "visual-input-preflight");
});

test("an approved review keeps the Agent responsible for delivery render and validation failures", () => {
  const workflow = baseWorkflow();
  workflow.reviewReady = true;
  workflow.reviewApproved = true;
  workflow.currentFailure = {
    code: "RENDER_STALLED",
    category: "workflow",
    stage: "delivery-render",
    message: "delivery stalled",
    remediation: "resume the validated delivery checkpoint",
    retryable: true,
  };
  workflow.stages = [
    { name: "review-evidence", status: "succeeded" },
    { name: "human-approval", status: "approved" },
    { name: "delivery-render", status: "failed" },
    { name: "delivery-validate", status: "pending" },
  ];
  const recovery = buildStudioRecovery({
    projectId: "delivery-recovery",
    workflow,
    jobs: [
      {
        id: "delivery-failed",
        projectId: "delivery-recovery",
        kind: "video-workflow",
        action: "delivery",
        status: "failed",
        currentFailure: workflow.currentFailure,
      },
    ],
    artifacts: [],
    agent: {},
  });
  assert.equal(recovery.status, "recoverable");
  assert.equal(recovery.resume.action, "delivery");
  assert.equal(recovery.resume.stage, "delivery-render");
});

test("a baseline approval cannot hide an earlier production failure", () => {
  const workflow = baseWorkflow();
  workflow.reviewReady = true;
  workflow.reviewApproved = true;
  const recovery = buildStudioRecovery({
    projectId: "baseline-upstream-failure",
    workflow,
    jobs: [
      {
        id: "semantic-failed",
        projectId: "baseline-upstream-failure",
        kind: "video-workflow",
        action: "continue",
        status: "failed",
        currentFailure: workflow.currentFailure,
      },
    ],
    artifacts: [],
    agent: {},
  });
  assert.equal(recovery.status, "recoverable");
  assert.equal(recovery.resume.action, "continue");
  assert.equal(recovery.resume.stage, "semantic-plan");
});

test("recovery blocks product contract defects and duplicate starts", () => {
  const contractFailure = baseWorkflow();
  contractFailure.currentFailure = {
    code: "REGISTRY_CONTRACT_INVALID",
    stage: "validate",
    message: "组件登记无效",
    retryable: true,
  };
  assert.equal(
    buildStudioRecovery({
      projectId: "recovery-test",
      workflow: contractFailure,
      jobs: [],
      artifacts: [],
      agent: {},
    }).status,
    "blocked",
  );
  assert.equal(
    buildStudioRecovery({
      projectId: "recovery-test",
      workflow: baseWorkflow(),
      jobs: [{ id: "running", projectId: "recovery-test", status: "running", progress: { message: "仍在渲染" } }],
      artifacts: [],
      agent: {},
    }).status,
    "busy",
  );
});

test("a later completed production job clears an older terminal job from recovery", () => {
  const workflow = baseWorkflow();
  delete workflow.currentFailure;
  workflow.stages[2] = { name: "semantic-plan", status: "succeeded" };
  const recovery = buildStudioRecovery({
    projectId: "recovery-test",
    workflow,
    jobs: [
      { id: "failed", projectId: "recovery-test", kind: "video-workflow", action: "continue", status: "failed" },
      {
        id: "completed",
        projectId: "recovery-test",
        kind: "video-workflow",
        action: "continue",
        status: "completed",
      },
    ],
    artifacts: [],
    agent: {},
  });
  assert.equal(recovery.status, "healthy");
  assert.equal(recovery.failure, undefined);
});

test("an approved workflow treats an old failed stage as history after later production succeeds", () => {
  const workflow = baseWorkflow();
  workflow.reviewApproved = true;
  workflow.reviewReady = true;
  workflow.stages[2] = { name: "semantic-plan", status: "stale" };
  const recovery = buildStudioRecovery({
    projectId: "recovery-test",
    workflow,
    jobs: [
      { id: "failed", projectId: "recovery-test", kind: "video-workflow", action: "continue", status: "failed" },
      {
        id: "delivered",
        projectId: "recovery-test",
        kind: "video-workflow",
        action: "delivery",
        status: "completed",
      },
    ],
    artifacts: [],
    agent: {},
  });
  assert.equal(recovery.status, "healthy");
  assert.equal(recovery.failure, undefined);
});

test("a registered semantic-plan recovery replans before an unconfirmed production direction", () => {
  const execution = workflowExecutionForStudioRecovery({
    recovery: {
      authority: { registeredRepairKind: "validated-semantic-plan-repair" },
      failure: { code: "SEMANTIC_PLAN_INVALID", stage: "visual-direction", retryable: true },
      resume: { action: "continue", stage: "visual-direction" },
    },
    snapshot: { productionPlan: { confirmed: false } },
  });
  assert.equal(execution.action, "plan");
  assert.equal(execution.expectedTargetStage, "validate");
  assert.deepEqual(execution.workflowArgs, [
    "--from",
    "semantic-plan",
    "--replan-semantic",
    "--until",
    "plan",
    "--production-agent-auto-approve",
  ]);
});

test("recovery targets the direction gate when the production direction is not confirmed", () => {
  const execution = workflowExecutionForStudioRecovery({
    recovery: {
      authority: {},
      failure: { code: "PROVIDER_REQUEST_TIMEOUT", stage: "visual-direction", retryable: true },
      resume: { action: "continue", stage: "visual-direction" },
    },
    snapshot: { productionPlan: { confirmed: false } },
  });
  assert.equal(execution.action, "continue");
  assert.equal(execution.expectedTargetStage, "validate");
  assert.deepEqual(execution.workflowArgs, ["--from", "visual-direction", "--until", "review"]);
});

test("recovery confirmation is written before a state-changing resume", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "studio-recovery-confirmation-"));
  const recovery = buildStudioRecovery({
    projectId: "recovery-test",
    workflow: baseWorkflow(),
    jobs: [],
    artifacts: [],
    agent: {},
  });
  const record = await recordStudioRecoveryConfirmation({
    projectId: "recovery-test",
    recovery,
    readiness: {
      readinessSha256: "c".repeat(64),
      targetStage: "agent-review",
      plannedStages: ["semantic-plan"],
      reusedStages: ["ingest"],
      execution: { agentCalls: 1 },
    },
    projectRoot,
  });
  const stored = JSON.parse(await readFile(record.path, "utf8"));
  assert.equal(stored.kind, "studio-recovery-confirmation");
  assert.equal(stored.recoverySha256, recovery.recoverySha256);
  assert.equal(stored.resume.stage, "semantic-plan");
});
