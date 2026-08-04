import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  assertStudioReadinessConfirmation,
  blockedStudioReadiness,
  inspectStudioReadiness,
  readinessEventFromOutput,
  recordStudioReadinessConfirmation,
} from "../scripts/creator/studio-readiness.mjs";

const readiness = {
  event: "workflow.preview",
  readinessSha256: "a".repeat(64),
  scopeSignature: "b".repeat(64),
  readinessStatus: "warning",
  targetStage: "agent-review",
  nextHumanGate: "human-approval",
  plannedStages: ["review-base"],
  reusedStages: ["captions"],
  execution: { agentCalls: 0, translationCalls: 0, videoRenderStages: 1 },
  issues: [{ id: "terminology", severity: "warning" }],
};

test("Studio extracts the authoritative readiness event from workflow output", () => {
  assert.deepEqual(
    readinessEventFromOutput(`noise\n${JSON.stringify(readiness)}\n{"event":"workflow.finished"}\n`),
    readiness,
  );
  assert.throws(() => readinessEventFromOutput("noise only"), /没有返回/);
});

test("Studio readiness inspection accepts the intentional blocked exit code output", async () => {
  const result = await inspectStudioReadiness({
    manifest: "/tmp/project.json",
    workflowArgs: ["--until", "review", "--dry-run"],
    execute: async () => {
      const error = new Error("exit 2");
      error.stdout = `${JSON.stringify({ ...readiness, readinessStatus: "blocked" })}\n`;
      throw error;
    },
  });
  assert.equal(result.readinessStatus, "blocked");
});

test("Studio converts an invalid manifest into an actionable blocked readiness card", async () => {
  const result = blockedStudioReadiness({
    workflowArgs: ["--until", "recut", "--dry-run"],
    failure: {
      code: "MANIFEST_INVALID",
      message: "policies.animation.allowedTemplateIds is invalid",
      remediation: "Restore approved template ids",
    },
  });
  assert.equal(result.readinessStatus, "blocked");
  assert.equal(result.targetStage, "recut-review");
  assert.equal(result.nextHumanGate, "recut-approval");
  assert.match(result.issues[0].message, /allowedTemplateIds/);
  assert.equal(result.execution.videoRenderStages, 0);
});

test("Studio confirmation fails closed when the plan changed or remains blocked", () => {
  assert.equal(
    assertStudioReadinessConfirmation({
      readiness,
      expectedSha256: readiness.readinessSha256,
      expectedTargetStage: readiness.targetStage,
    }),
    readiness,
  );
  assert.throws(
    () =>
      assertStudioReadinessConfirmation({
        readiness,
        expectedSha256: "c".repeat(64),
        expectedTargetStage: readiness.targetStage,
      }),
    /已经过期/,
  );
  assert.throws(
    () =>
      assertStudioReadinessConfirmation({
        readiness: { ...readiness, readinessStatus: "blocked" },
        expectedSha256: readiness.readinessSha256,
        expectedTargetStage: readiness.targetStage,
      }),
    /阻塞项/,
  );
});

test("Studio records the exact confirmed readiness snapshot", async () => {
  const root = await mkdtemp(join(tmpdir(), "studio-readiness-"));
  const record = await recordStudioReadinessConfirmation({
    projectId: "readiness-test",
    action: "continue",
    readiness,
    projectRoot: root,
  });
  const stored = JSON.parse(await readFile(record.path, "utf8"));
  assert.equal(stored.readinessSha256, readiness.readinessSha256);
  assert.equal(stored.scopeSignature, readiness.scopeSignature);
  assert.deepEqual(stored.plannedStages, readiness.plannedStages);
});
