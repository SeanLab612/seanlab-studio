import { execFile } from "node:child_process";
import { readdir, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sizeTargets = [".git", "projects", "素材", "public", "studio-data", "out", "node_modules"];
const protectedRoots = ["projects", "素材", "studio-data/backups", "public/projects"];

export const parseGitCountObjects = (value) =>
  Object.fromEntries(
    String(value)
      .trim()
      .split("\n")
      .map((line) => line.split(":").map((part) => part.trim()))
      .filter(([key, amount]) => key && amount),
  );

export const formatBytes = (bytes) => {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let amount = value / 1024;
  let unit = units[0];
  for (let index = 1; index < units.length && amount >= 1024; index += 1) {
    amount /= 1024;
    unit = units[index];
  }
  return `${amount.toFixed(amount >= 10 ? 1 : 2)} ${unit}`;
};

const pathUsage = async (root, relativePath) => {
  const path = resolve(root, relativePath);
  const info = await stat(path).catch(() => undefined);
  if (!info) return undefined;
  const { stdout } = await execFileAsync("du", ["-sk", path]);
  return {
    path: relativePath,
    bytes: Number(stdout.trim().split(/\s+/)[0]) * 1024,
  };
};

const gitOutput = async (root, args) => (await execFileAsync("git", args, { cwd: root })).stdout;

const outCollections = async (root) => {
  const entries = await readdir(resolve(root, "out"), { withFileTypes: true }).catch(() => []);
  const usages = await Promise.all(
    entries.filter((entry) => entry.isDirectory()).map((entry) => pathUsage(root, `out/${entry.name}`)),
  );
  return usages
    .filter(Boolean)
    .sort((left, right) => right.bytes - left.bytes)
    .slice(0, 10);
};

export const collectRepositoryHealth = async (root = repositoryRoot) => {
  const [gitRaw, codexRefsRaw, statusRaw, usages, largestOutCollections] = await Promise.all([
    gitOutput(root, ["count-objects", "-v"]),
    gitOutput(root, ["for-each-ref", "--format=%(refname)", "refs/codex"]),
    gitOutput(root, ["status", "--porcelain=v1", "--untracked-files=normal"]),
    Promise.all(sizeTargets.map((target) => pathUsage(root, target))),
    outCollections(root),
  ]);
  const git = parseGitCountObjects(gitRaw);
  const packedBytes = Number(git["size-pack"] ?? 0) * 1024;
  return {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    repositoryRoot: root,
    usage: usages.filter(Boolean),
    git: {
      looseObjects: Number(git.count ?? 0),
      packs: Number(git.packs ?? 0),
      packedBytes,
      historySizeStatus: packedBytes >= 2 * 1024 ** 3 ? "warning" : "ok",
      garbageFiles: Number(git.garbage ?? 0),
      garbageBytes: Number(git["size-garbage"] ?? 0) * 1024,
      codexLocalRefs: codexRefsRaw.trim() ? codexRefsRaw.trim().split("\n").length : 0,
    },
    workingTree: {
      changedEntries: statusRaw.trim() ? statusRaw.trim().split("\n").length : 0,
    },
    largestOutCollections,
    protectedRoots,
    guidance: [
      "Use Studio project cleanup for regenerable workflow caches.",
      "Never use git clean -fdX because ignored creator projects and source media are protected.",
      "Review out collections before deletion because they may contain approved visual evidence.",
      ...(packedBytes >= 2 * 1024 ** 3
        ? [
            "Git history exceeds 2 GB. Run npm run repo:size:audit, then obtain explicit approval before any history rewrite.",
          ]
        : []),
    ],
  };
};

export const printRepositoryHealth = (report) => {
  console.log("SeanLab repository health");
  console.log(`Generated: ${report.generatedAt}`);
  console.log("\nDisk usage");
  for (const item of report.usage) console.log(`- ${item.path}: ${formatBytes(item.bytes)}`);
  console.log("\nGit");
  console.log(`- packed objects: ${formatBytes(report.git.packedBytes)}`);
  console.log(`- history size status: ${report.git.historySizeStatus}`);
  console.log(`- garbage: ${formatBytes(report.git.garbageBytes)} in ${report.git.garbageFiles} files`);
  console.log(`- local Codex rollback refs: ${report.git.codexLocalRefs}`);
  console.log(`- working tree entries: ${report.workingTree.changedEntries}`);
  console.log("\nLargest out collections");
  for (const item of report.largestOutCollections) console.log(`- ${item.path}: ${formatBytes(item.bytes)}`);
  console.log(`\nProtected: ${report.protectedRoots.join(", ")}`);
  console.log("Read-only report: no files were deleted.");
};

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  const report = await collectRepositoryHealth();
  if (process.argv.includes("--json")) console.log(JSON.stringify(report, null, 2));
  else printRepositoryHealth(report);
}
