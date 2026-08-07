import assert from "node:assert/strict";
import test from "node:test";
import { runPrivacyAudit } from "../scripts/privacy-audit.mjs";

test("public repository history passes the privacy policy", async () => {
  const report = await runPrivacyAudit();
  assert.equal(report.status, "passed", JSON.stringify(report.findings, null, 2));
  assert.equal(report.summary.findings, 0);
});
