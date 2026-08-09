import assert from "node:assert/strict";
import test from "node:test";
import { isGitHubSyntheticPullMerge, runPrivacyAudit } from "../scripts/privacy-audit.mjs";

test("privacy audit excludes only GitHub-generated pull request merge metadata", () => {
  assert.equal(
    isGitHubSyntheticPullMerge({
      oid: "5".repeat(40),
      parents: `${"1".repeat(40)} ${"2".repeat(40)}`,
      committerEmail: "noreply@github.com",
      subject: `Merge ${"3".repeat(40)} into ${"4".repeat(40)}`,
    }),
    true,
  );
  assert.equal(
    isGitHubSyntheticPullMerge({
      oid: "5".repeat(40),
      parents: `${"1".repeat(40)} ${"2".repeat(40)}`,
      committerEmail: "developer@example.com",
      subject: `Merge ${"3".repeat(40)} into ${"4".repeat(40)}`,
    }),
    false,
  );
  assert.equal(
    isGitHubSyntheticPullMerge(
      {
        oid: "5".repeat(40),
        parents: "",
        committerEmail: "noreply@github.com",
        subject: `Merge ${"3".repeat(40)} into ${"4".repeat(40)}`,
      },
      { eventName: "pull_request", eventSha: "5".repeat(40) },
    ),
    true,
  );
  assert.equal(
    isGitHubSyntheticPullMerge(
      {
        oid: "5".repeat(40),
        parents: "",
        committerEmail: "noreply@github.com",
        subject: `Merge ${"3".repeat(40)} into ${"4".repeat(40)}`,
      },
      { eventName: "push", eventSha: "5".repeat(40) },
    ),
    false,
  );
});

test("public repository history passes the privacy policy", async () => {
  const report = await runPrivacyAudit();
  assert.equal(report.status, "passed", JSON.stringify(report.findings, null, 2));
  assert.equal(report.summary.findings, 0);
});
