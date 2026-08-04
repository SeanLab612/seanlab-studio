import assert from "node:assert/strict";
import test from "node:test";
import {
  resumeStageForStudio,
  studioStageDependenciesCurrent,
  workflowArgsForStudioAction,
  workflowArgsForStudioReadiness,
} from "../scripts/creator/studio-contract.mjs";

test("Studio exposes only registered workflow actions", () => {
  assert.deepEqual(workflowArgsForStudioAction("preview"), ["--until", "recut", "--dry-run"]);
  assert.deepEqual(workflowArgsForStudioAction("recut"), ["--until", "recut"]);
  assert.deepEqual(workflowArgsForStudioAction("review"), ["--until", "review"]);
  assert.deepEqual(workflowArgsForStudioAction("approve-recut"), ["--approve-recut"]);
  assert.deepEqual(workflowArgsForStudioAction("replan-recut"), ["--replan-recut", "--until", "recut"]);
  assert.deepEqual(workflowArgsForStudioAction("replan-semantic"), ["--replan-semantic", "--until", "review"]);
  assert.deepEqual(workflowArgsForStudioAction("continue"), ["--until", "review"]);
  assert.deepEqual(workflowArgsForStudioAction("production"), [
    "--until",
    "delivery",
    "--production-agent-auto-approve",
    "--delivery-resolution",
    "source",
    "--delivery-frame-rate",
    "source",
  ]);
  assert.deepEqual(workflowArgsForStudioAction("delivery"), ["--until", "delivery"]);
  assert.throws(() => workflowArgsForStudioAction(["--force"]), /仅允许/);
  assert.throws(() => workflowArgsForStudioAction("arbitrary-command"), /仅允许/);
});

test("Studio readiness previews the continuous Agent production path to final acceptance", () => {
  assert.deepEqual(workflowArgsForStudioReadiness({ recutApproved: false, reviewApproved: false }), [
    "--until",
    "delivery",
    "--production-agent-auto-approve",
    "--dry-run",
    "--delivery-resolution",
    "source",
    "--delivery-frame-rate",
    "source",
  ]);
  assert.deepEqual(workflowArgsForStudioReadiness({ recutApproved: true, reviewApproved: false }), [
    "--until",
    "delivery",
    "--production-agent-auto-approve",
    "--dry-run",
    "--delivery-resolution",
    "source",
    "--delivery-frame-rate",
    "source",
  ]);
  assert.deepEqual(
    workflowArgsForStudioReadiness({
      recutApproved: true,
      reviewApproved: false,
      stages: [
        { name: "semantic-plan", status: "succeeded" },
        { name: "component-props", status: "failed" },
        { name: "visual-direction", status: "pending" },
      ],
    }),
    [
      "--from",
      "component-props",
      "--until",
      "delivery",
      "--production-agent-auto-approve",
      "--dry-run",
      "--delivery-resolution",
      "source",
      "--delivery-frame-rate",
      "source",
    ],
  );
  assert.deepEqual(
    workflowArgsForStudioReadiness(
      { recutApproved: true, reviewApproved: true },
      { resolution: "2k", frameRate: 60 },
    ),
    [
      "--until",
      "delivery",
      "--dry-run",
      "--delivery-resolution",
      "2k",
      "--delivery-frame-rate",
      "60",
    ],
  );
  assert.deepEqual(
    workflowArgsForStudioReadiness(
      {
        recutApproved: false,
        reviewApproved: true,
        stages: [
          { name: "preflight", status: "stale" },
          { name: "recut-approval", status: "stale" },
          { name: "human-approval", status: "approved" },
          { name: "delivery-render", status: "pending" },
        ],
      },
      { resolution: "1080p", frameRate: 60 },
    ),
    [
      "--until",
      "delivery",
      "--dry-run",
      "--delivery-resolution",
      "1080p",
      "--delivery-frame-rate",
      "60",
    ],
  );
  assert.deepEqual(
    workflowArgsForStudioReadiness(
      {
        recutApproved: false,
        reviewApproved: true,
        stages: [
          { name: "recut-approval", status: "stale" },
          { name: "human-approval", status: "approved" },
          { name: "delivery-render", status: "failed" },
        ],
      },
      { resolution: "1080p", frameRate: 30 },
    ),
    [
      "--from",
      "delivery-render",
      "--until",
      "delivery",
      "--dry-run",
      "--delivery-resolution",
      "1080p",
      "--delivery-frame-rate",
      "30",
    ],
  );
});

test("Studio resumes from the first stale or interrupted stage instead of replaying the workflow", () => {
  assert.equal(
    resumeStageForStudio([
      { name: "transcribe", status: "succeeded" },
      { name: "recut-review", status: "interrupted" },
      { name: "recut-approval", status: "stale" },
    ]),
    "recut-review",
  );
  assert.equal(
    resumeStageForStudio([
      { name: "edit-promote", status: "succeeded" },
      { name: "brand-align", status: "pending" },
      { name: "human-approval", status: "pending" },
    ]),
    "brand-align",
  );
  assert.equal(resumeStageForStudio([{ name: "human-approval", status: "pending" }]), undefined);
});

test("Studio refresh validates the dependency graph instead of treating stage order as one chain", () => {
  const state = {
    stages: {
      ingest: { status: "succeeded" },
      "image-probe": { status: "pending" },
      translate: { status: "succeeded" },
    },
  };
  assert.equal(studioStageDependenciesCurrent({ name: "transcribe", dependsOn: ["ingest"] }, state), true);
  assert.equal(
    studioStageDependenciesCurrent({ name: "semantic-plan", dependsOn: ["translate", "image-probe"] }, state),
    false,
  );
});
