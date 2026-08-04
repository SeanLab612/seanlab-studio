import assert from "node:assert/strict";
import test from "node:test";
import { summarizeWorkflowPreview } from "../scripts/workflow/preview-summary.mjs";

test("workflow preview separates planned, reused, blocked, and avoided expensive work", () => {
  const summary = summarizeWorkflowPreview({
  targetStage: "agent-review",
    preview: [
      { stage: "captions", action: "reuse", executionClass: "local" },
      { stage: "translate", action: "reuse", executionClass: "translation-provider" },
      { stage: "review-base", action: "run", executionClass: "video-render", reasons: ["input-signature-changed"] },
      { stage: "qa-capture", action: "run", executionClass: "static-render", reasons: ["upstream-stage-planned"] },
    ],
  });
  assert.equal(summary.readinessStatus, "ready");
  assert.equal(summary.nextHumanGate, "human-approval");
  assert.deepEqual(summary.plannedStages, ["review-base", "qa-capture"]);
  assert.deepEqual(summary.reusedStages, ["captions", "translate"]);
  assert.deepEqual(summary.avoidedExpensiveStages, ["translate"]);
  assert.equal(summary.execution.videoRenderStages, 1);
  assert.equal(summary.execution.staticRenderStages, 1);
});

test("workflow preview reports a blocked next gate without treating it as runnable", () => {
  const summary = summarizeWorkflowPreview({
    targetStage: "delivery-validate",
    preview: [{ stage: "semantic-plan", action: "blocked", executionClass: "codex" }],
  });
  assert.equal(summary.readinessStatus, "blocked");
  assert.equal(summary.nextHumanGate, "delivery-acceptance");
  assert.deepEqual(summary.blockedStages, ["semantic-plan"]);
  assert.equal(summary.execution.agentCalls, 0);
});

test("workflow readiness blocks before a long job when project preflight fails", () => {
  const summary = summarizeWorkflowPreview({
    targetStage: "recut-review",
    scopeSignature: "scope-a",
    preview: [{ stage: "preflight", action: "run", executionClass: "local", inputSignature: "input-a" }],
    preflight: {
      status: "failed",
      summary: { passed: 1, warnings: 0, failed: 1 },
      checks: [
        { id: "source", label: "Source video", status: "failed", summary: "ENOENT", remediation: "Relink source" },
      ],
    },
  });
  assert.equal(summary.readinessStatus, "blocked");
  assert.equal(summary.issues[0].id, "source");
  assert.equal(summary.issues[0].remediation, "Relink source");
  assert.match(summary.readinessSha256, /^[a-f0-9]{64}$/);
});

test("workflow readiness preserves non-blocking warnings and binds the exact input plan", () => {
  const input = {
    targetStage: "agent-review",
    scopeSignature: "scope-a",
    preview: [{ stage: "captions", action: "run", executionClass: "local", inputSignature: "input-a" }],
    preflight: {
      status: "warning",
      summary: { passed: 1, warnings: 1, failed: 0 },
      checks: [
        {
          id: "terminology",
          label: "Terminology",
          status: "warning",
          summary: "Global terms only",
          remediation: "Select a domain pack when needed",
        },
      ],
    },
  };
  const first = summarizeWorkflowPreview(input);
  const same = summarizeWorkflowPreview(structuredClone(input));
  const changed = summarizeWorkflowPreview({
    ...input,
    preview: [{ ...input.preview[0], inputSignature: "input-b" }],
  });
  assert.equal(first.readinessStatus, "warning");
  assert.equal(first.readinessSha256, same.readinessSha256);
  assert.notEqual(first.readinessSha256, changed.readinessSha256);
});
