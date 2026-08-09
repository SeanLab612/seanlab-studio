import assert from "node:assert/strict";
import test from "node:test";
import {
  auditPublicMediaInventory,
  isGitHubSyntheticPullMerge,
  runPrivacyAudit,
} from "../scripts/privacy-audit.mjs";

test("public media inventory rejects unregistered, changed, and missing assets", async () => {
  const bytes = new Map([
    ["docs/registered.png", Buffer.from("registered")],
    ["docs/changed.jpg", Buffer.from("changed")],
    ["docs/unregistered.webp", Buffer.from("unregistered")],
  ]);
  const report = await auditPublicMediaInventory({
    tracked: [...bytes.keys()],
    manifest: {
      schemaVersion: "1.0",
      policy: "no-real-people",
      assets: {
        "docs/registered.png":
          "b1a9e561106ea030330ac272e9f446130d42887aa4596fbf9a1dc4bd2144ed4a",
        "docs/changed.jpg": "0".repeat(64),
        "docs/missing.mp4": "1".repeat(64),
      },
    },
    readAsset: (path) => bytes.get(path),
  });

  assert.deepEqual(
    report.findings.map(({ rule, path }) => ({ rule, path })),
    [
      { rule: "media.checksum-mismatch", path: "docs/changed.jpg" },
      { rule: "media.unregistered", path: "docs/unregistered.webp" },
      { rule: "media.manifest-missing", path: "docs/missing.mp4" },
    ],
  );
});

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
  assert.equal(
    report.status,
    "passed",
    JSON.stringify(report.findings, null, 2),
  );
  assert.equal(report.summary.findings, 0);
});
