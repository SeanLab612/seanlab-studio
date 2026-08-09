import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const policyPath = resolve(root, "config/privacy-policy.json");
const mediaExtensions = new Set([".gif", ".jpeg", ".jpg", ".m4v", ".mov", ".mp4", ".png", ".webm", ".webp"]);
const git = (args, options = {}) =>
  execFileSync("git", args, { cwd: root, encoding: options.encoding ?? "utf8", maxBuffer: 64 * 1024 * 1024 });
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const personalTokenHashes = (bytes, denylist) => {
  if (bytes.includes(0)) return [];
  const tokens = bytes.toString("utf8").match(/[\p{L}\p{N}_.@+-]{4,}/gu) ?? [];
  return [...new Set(tokens.map(sha256).filter((digest) => denylist.includes(digest)))];
};

export const isGitHubSyntheticPullMerge = ({ parents, committerEmail, subject }) =>
  parents.trim().split(/\s+/u).length === 2 &&
  committerEmail === "noreply@github.com" &&
  /^Merge [0-9a-f]{40} into [0-9a-f]{40}$/u.test(subject);

export const runPrivacyAudit = async () => {
  const policy = JSON.parse(await readFile(policyPath, "utf8"));
  const findings = [];
  const tracked = git(["ls-files", "-z"]).split("\0").filter(Boolean);
  const trackedSet = new Set(tracked);

  for (const path of tracked) {
    if (policy.protectedRoots.some((prefix) => path.startsWith(prefix)))
      findings.push({ rule: "tracked.protected-root", path });
    const bytes = await readFile(resolve(root, path));
    if (policy.forbiddenAssetSha256.includes(sha256(bytes))) findings.push({ rule: "asset.known-private", path });
    for (const digest of personalTokenHashes(bytes, policy.forbiddenTextSha256))
      findings.push({ rule: "text.personal-identifier", path, digest });
  }

  const authors = git(["log", "--all", "--format=%P%x09%ae%x09%ce%x09%s"])
    .split(/\r?\n/u)
    .map((value) => {
      const [parents = "", authorEmail = "", committerEmail = "", ...subjectParts] = value.split("\t");
      return {
        parents,
        authorEmail: authorEmail.trim(),
        committerEmail: committerEmail.trim(),
        subject: subjectParts.join("\t"),
      };
    })
    .filter((commit) => !isGitHubSyntheticPullMerge(commit))
    .map((commit) => commit.authorEmail)
    .filter(Boolean);
  for (const email of new Set(authors)) {
    if (!policy.allowedCommitEmails.includes(email)) findings.push({ rule: "history.personal-email", email });
  }

  const objects = git(["rev-list", "--objects", "--all"])
    .split(/\r?\n/u)
    .map((line) => {
      const separator = line.indexOf(" ");
      return separator < 0
        ? { oid: line, path: "" }
        : { oid: line.slice(0, separator), path: line.slice(separator + 1) };
    })
    .filter(({ oid }) => oid);
  for (const forbiddenPath of policy.forbiddenHistoricalPaths) {
    if (objects.some(({ path }) => path === forbiddenPath))
      findings.push({ rule: "history.forbidden-path", path: forbiddenPath });
  }

  const seenMedia = new Set();
  const seenBlobs = new Set();
  for (const { oid, path } of objects) {
    if (seenBlobs.has(oid)) continue;
    let type;
    try {
      type = git(["cat-file", "-t", oid]).trim();
    } catch {
      continue;
    }
    if (type !== "blob") continue;
    seenBlobs.add(oid);
    const bytes = git(["cat-file", "blob", oid], { encoding: "buffer" });
    for (const digest of personalTokenHashes(bytes, policy.forbiddenTextSha256))
      findings.push({ rule: "history.personal-identifier", path, oid, digest });
    if (mediaExtensions.has(extname(path).toLowerCase())) {
      seenMedia.add(oid);
      if (policy.forbiddenAssetSha256.includes(sha256(bytes)))
        findings.push({ rule: "history.known-private-asset", path, oid });
    }
  }

  for (const path of policy.forbiddenHistoricalPaths) {
    if (trackedSet.has(path)) findings.push({ rule: "tracked.forbidden-path", path });
  }

  return {
    kind: "privacy-audit",
    status: findings.length ? "failed" : "passed",
    summary: { trackedFiles: tracked.length, historicalMediaObjects: seenMedia.size, findings: findings.length },
    findings,
  };
};

const entrypoint = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (entrypoint === import.meta.url) {
  const report = await runPrivacyAudit();
  console.log(JSON.stringify(report, null, 2));
  if (report.status !== "passed") process.exitCode = 1;
}
