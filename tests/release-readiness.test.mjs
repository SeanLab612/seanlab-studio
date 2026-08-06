import assert from "node:assert/strict";
import test from "node:test";
import { runReleaseReadiness } from "../scripts/release-readiness.mjs";

test("release readiness keeps version, operator commands, docs, governance, and local-data boundaries aligned", async () => {
  const report = await runReleaseReadiness();
  assert.notEqual(report.status, "failed", JSON.stringify(report.checks, null, 2));
  assert.equal(report.summary.failed, 0);
  assert.ok(report.checks.some((check) => check.id === "local-data.untracked" && check.status === "passed"));
  for (const id of [
    "open-source.license",
    "open-source.third-party-notices",
    "open-source.asset-provenance",
    "open-source.dependency-licenses",
  ]) {
    assert.ok(report.checks.some((check) => check.id === id && check.status === "passed"), id);
  }
  assert.equal(report.version, "0.2.0");
  assert.equal(report.productPosition, "local-production-mvp");
  assert.equal(report.versionPromotion, "explicitly-approved");
  assert.deepEqual(report.safety, {
    agentInvoked: false,
    translationInvoked: false,
    renderingInvoked: false,
    creatorProjectsRead: false,
  });
});
