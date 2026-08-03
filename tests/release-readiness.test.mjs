import assert from "node:assert/strict";
import test from "node:test";
import { runReleaseReadiness } from "../scripts/release-readiness.mjs";

test("release readiness keeps version, operator commands, docs, governance, and local-data boundaries aligned", async () => {
  const report = await runReleaseReadiness();
  assert.notEqual(report.status, "failed", JSON.stringify(report.checks, null, 2));
  assert.equal(report.summary.failed, 0);
  assert.ok(report.checks.some((check) => check.id === "local-data.untracked" && check.status === "passed"));
  assert.equal(report.version, "0.1.0");
  assert.equal(report.productPosition, "local-production-mvp");
  assert.equal(report.versionPromotion, "explicitly-approved");
  assert.deepEqual(report.safety, {
    agentInvoked: false,
    translationInvoked: false,
    renderingInvoked: false,
    creatorProjectsRead: false,
  });
});
