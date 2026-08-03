import assert from "node:assert/strict";
import test from "node:test";
import { allowedOperatorActions, recommendResume, validateOperatorRequest } from "../src/operator-control/contract.ts";

test("operator control accepts only typed allowlisted actions", () => {
  const request = validateOperatorRequest({
    schemaVersion: "1.0",
    requestId: "status-001",
    action: "status",
    projectId: "workflow-test",
  });
  assert.equal(request.action, "status");
  assert.throws(
    () => validateOperatorRequest({ ...request, command: "rm -rf /" }),
    /Unsupported operator request fields/,
  );
  assert.throws(() => validateOperatorRequest({ ...request, action: "shell" }), /Unsupported operator action/);
});

test("approval requires an explicit human confirmation literal", () => {
  const base = { schemaVersion: "1.0", requestId: "approve-001", action: "approve", projectId: "workflow-test" };
  assert.throws(() => validateOperatorRequest(base), /human-review-approved/);
  assert.equal(validateOperatorRequest({ ...base, confirmation: "human-review-approved" }).action, "approve");
  const recut = {
    schemaVersion: "1.0",
    requestId: "recut-approve-001",
    action: "approve-recut",
    projectId: "workflow-test",
  };
  assert.throws(() => validateOperatorRequest(recut), /human-recut-approved/);
  assert.equal(validateOperatorRequest({ ...recut, confirmation: "human-recut-approved" }).action, "approve-recut");
});

test("operator exposes recut approval only after the continuous preview is ready", () => {
  assert.equal(
    allowedOperatorActions({
      hasState: true,
      reviewReady: false,
      approved: false,
      recutReady: true,
      recutApproved: false,
    }).includes("approve-recut"),
    true,
  );
  assert.equal(
    allowedOperatorActions({
      hasState: true,
      reviewReady: false,
      approved: false,
      recutReady: true,
      recutApproved: true,
    }).includes("approve-recut"),
    false,
  );
});

test("operator status derives safe actions and the narrowest resume point", () => {
  assert.deepEqual(allowedOperatorActions({ hasState: false, reviewReady: false, approved: false }), [
    "doctor",
    "preflight",
    "status",
    "plan",
    "export-bundle",
    "acceptance",
    "review",
  ]);
  assert.ok(allowedOperatorActions({ hasState: true, reviewReady: false, approved: false }).includes("apply-revision"));
  assert.deepEqual(
    recommendResume([
      { name: "preflight", status: "succeeded" },
      { name: "captions", status: "stale" },
    ]),
    { fromStage: "captions", target: "review" },
  );
});

test("revision control accepts a registered revision id but no arbitrary path", () => {
  const request = validateOperatorRequest({
    schemaVersion: "1.0",
    requestId: "revision-001",
    action: "apply-revision",
    projectId: "workflow-test",
    revisionId: "visual-fix-001",
  });
  assert.equal(request.revisionId, "visual-fix-001");
  assert.throws(() => validateOperatorRequest({ ...request, revisionId: "../outside" }), /revisionId is invalid/);
  assert.throws(
    () => validateOperatorRequest({ ...request, revisionId: undefined }),
    /apply-revision requires revisionId/,
  );
});
