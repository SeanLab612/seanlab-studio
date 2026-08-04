import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, cp, lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, resolve } from "node:path";
import { processTreeSpawnOptions, terminateProcessTree } from "../workflow/process-tree.mjs";

const allowedRepairRoots = ["schemas/", "scripts/", "src/", "studio/", "tests/"];
const deniedRepairPaths = new Set(["package.json", "package-lock.json", "pnpm-lock.yaml", "yarn.lock", ".gitignore"]);
const repairWorkspaceEntries = [
  ...allowedRepairRoots.map((path) => path.slice(0, -1)),
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "biome.json",
  "remotion.config.ts",
  "requirements.txt",
  "skills",
  "docs",
  "config",
  "public",
  "regression-fixtures",
];
const humanDecisionCategories = new Set(["approval", "creator-input", "input", "review-revision"]);
const humanDecisionCodes = new Set([
  "APPROVAL_REQUIRED",
  "INPUT_SOURCE_MISSING",
  "INPUT_SCENE_DURATION_UNSAFE",
  "BINDING_ANCHOR_NOT_FOUND",
  "REVISION_REQUEST_INVALID",
  "REVISION_BASELINE_CONFLICT",
]);
const repairableTechnicalCategories = new Set([
  "captions",
  "configuration",
  "internal",
  "semantic-planning",
  "studio-defect",
  "transcription",
  "visual-contract",
  "workflow",
]);

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const normalizedRepoPath = (value) => value.replaceAll("\\", "/").replace(/^\.\/+/, "");

const fileSha256 = async (path) => sha256(await readFile(path));

const collectRepairFiles = async (root, relative = "") => {
  const files = [];
  const absolute = resolve(root, relative);
  let entries;
  try {
    entries = await readdir(absolute, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return files;
    throw error;
  }
  for (const entry of entries) {
    const path = normalizedRepoPath(relative ? `${relative}/${entry.name}` : entry.name);
    if (entry.isDirectory()) files.push(...(await collectRepairFiles(root, path)));
    else if (entry.isFile()) files.push(path);
  }
  return files;
};

const repairSourceSnapshot = async (root) => {
  const snapshot = new Map();
  for (const allowedRoot of allowedRepairRoots) {
    for (const path of await collectRepairFiles(root, allowedRoot.slice(0, -1)))
      snapshot.set(path, await fileSha256(resolve(root, path)));
  }
  return snapshot;
};

const changedRepairPaths = (before, after) =>
  [...new Set([...before.keys(), ...after.keys()])].filter((path) => before.get(path) !== after.get(path));

const createRepairWorkspace = async ({ root, worktree }) => {
  await mkdir(worktree, { recursive: true });
  for (const entry of repairWorkspaceEntries) {
    try {
      await cp(resolve(root, entry), resolve(worktree, entry), { recursive: true, preserveTimestamps: true });
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  try {
    const nodeModules = resolve(root, "node_modules");
    if ((await lstat(nodeModules)).isDirectory()) await symlink(nodeModules, resolve(worktree, "node_modules"), "dir");
  } catch {}
};

const applyValidatedRepair = async ({ root, worktree, before, after, changedPaths, stagingRoot }) => {
  const current = await repairSourceSnapshot(root);
  if (changedPaths.some((path) => current.get(path) !== before.get(path)))
    return { success: false, reason: "source-changed-during-repair" };
  if (changedPaths.some((path) => before.has(path) && !after.has(path)))
    return { success: false, reason: "agent-deleted-source-file" };

  for (const path of changedPaths) {
    const staged = resolve(stagingRoot, path);
    await mkdir(dirname(staged), { recursive: true });
    await copyFile(resolve(worktree, path), staged);
  }
  for (const path of changedPaths) {
    const target = resolve(root, path);
    await mkdir(dirname(target), { recursive: true });
    await rename(resolve(stagingRoot, path), target);
  }
  return { success: true };
};

export const isAutonomousTechnicalRepairEligible = (failure = {}) => {
  if (!failure.code || humanDecisionCodes.has(failure.code)) return false;
  if (humanDecisionCategories.has(failure.category)) return false;
  if (failure.stage === "human-approval") return false;
  return repairableTechnicalCategories.has(failure.category);
};

export const validateAutonomousRepairPaths = (paths) => {
  const normalized = [...new Set(paths.map(normalizedRepoPath))];
  for (const path of normalized) {
    if (!path || isAbsolute(path) || path.includes("..")) throw new Error(`Unsafe automatic repair path: ${path}`);
    if (path.startsWith("projects/") || deniedRepairPaths.has(path))
      throw new Error(`Automatic repair cannot modify ${path}`);
    if (!allowedRepairRoots.some((root) => path.startsWith(root)))
      throw new Error(`Automatic repair path is outside the allowlist: ${path}`);
  }
  return normalized;
};

const run = ({ command, args, cwd, input, signal, timeoutMs = 15 * 60_000, env = process.env }) =>
  new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, processTreeSpawnOptions({ cwd, env, stdio: ["pipe", "pipe", "pipe"] }));
    let stdout = "";
    let stderr = "";
    let settled = false;
    let timeout;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
      if (error) rejectRun(error);
      else resolveRun(value);
    };
    const abort = () => {
      terminateProcessTree(child, "SIGTERM");
      finish(Object.assign(new Error("Automatic technical repair was cancelled"), { name: "AbortError" }));
    };
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", (error) => finish(error));
    child.on("close", (code) => {
      if (code === 0) finish(undefined, { stdout, stderr });
      else finish(new Error(`${command} exited with code ${code}: ${stderr.trim() || stdout.trim()}`));
    });
    timeout = setTimeout(() => {
      terminateProcessTree(child, "SIGTERM");
      finish(new Error(`${command} timed out during automatic technical repair`));
    }, timeoutMs);
    if (signal?.aborted) abort();
    else signal?.addEventListener("abort", abort, { once: true });
    child.stdin.end(input);
  });

const repairPrompt = ({ projectId, recovery }) =>
  [
    "You are the fixed production Agent repairing a technical defect in SeanLab Studio.",
    "Work only inside this isolated source snapshot. Make the smallest source-code repair that resolves the supplied failure.",
    "You may edit only schemas/, scripts/, src/, studio/, and tests/.",
    "Never modify projects/, creator media, narration, visual choices, approvals, package manifests, lockfiles, Git history, credentials, or external systems.",
    "Do not commit, push, install dependencies, restart Studio, call image generation, or bypass any human review gate.",
    "Add or update a focused regression test. Run relevant checks before finishing.",
    "If the evidence is insufficient or the problem requires content, aesthetic, media, or approval judgment, make no changes and explain why.",
    "",
    `Project: ${projectId}`,
    JSON.stringify(
      {
        failure: recovery.failure,
        stage: recovery.stage,
        preserved: recovery.preserved,
        resume: recovery.resume,
        latestJob: recovery.latestJob,
      },
      null,
      2,
    ),
  ].join("\n");

const agentCommand = ({ agentId, model, worktree, prompt }) => {
  if (agentId === "codex-cli")
    return {
      command: "codex",
      args: [
        "exec",
        "--ephemeral",
        "--skip-git-repo-check",
        "--sandbox",
        "workspace-write",
        "--color",
        "never",
        "-c",
        'approval_policy="never"',
        "-C",
        worktree,
        ...(model ? ["--model", model] : []),
        "-",
      ],
    };
  if (agentId === "claude-code")
    return {
      command: "claude",
      args: [
        "--print",
        "--no-session-persistence",
        "--permission-mode",
        "acceptEdits",
        "--allowedTools",
        "Read,Edit,Write,Glob,Grep,Bash(npm run format:check),Bash(npm run lint),Bash(npm run typecheck),Bash(npm run test:unit),Bash(npm run test:workflow-core)",
        ...(model ? ["--model", model] : []),
        prompt,
      ],
    };
  throw new Error(`Unsupported production Agent for technical repair: ${agentId}`);
};

export const runProductionAgentTechnicalRepair = async ({
  projectId,
  recovery,
  agentId,
  model,
  signal,
  repoRoot = process.cwd(),
  execute = run,
}) => {
  if (!isAutonomousTechnicalRepairEligible(recovery.failure))
    return { kind: "validated-source-repair", success: false, reason: "failure-requires-human-judgment" };
  const root = resolve(repoRoot);
  const temporaryRoot = await mkdtemp(resolve(tmpdir(), "seanlab-agent-repair-"));
  const worktree = resolve(temporaryRoot, "worktree");
  const stagingRoot = resolve(temporaryRoot, "validated");
  try {
    await createRepairWorkspace({ root, worktree });
    const before = await repairSourceSnapshot(worktree);
    const prompt = repairPrompt({ projectId, recovery });
    const command = agentCommand({ agentId, model, worktree, prompt });
    await execute({
      ...command,
      cwd: worktree,
      input: agentId === "codex-cli" ? prompt : undefined,
      signal,
    });
    const after = await repairSourceSnapshot(worktree);
    const changedPaths = validateAutonomousRepairPaths(changedRepairPaths(before, after));
    if (!changedPaths.length)
      return { kind: "validated-source-repair", success: false, reason: "agent-produced-no-safe-change" };
    for (const script of ["format:check", "lint", "typecheck", "test:unit", "test:workflow-core"])
      await execute({
        command: "npm",
        args: ["run", script],
        cwd: worktree,
        signal,
        timeoutMs: 20 * 60_000,
      });
    const applied = await applyValidatedRepair({ root, worktree, before, after, changedPaths, stagingRoot });
    if (!applied.success) return { kind: "validated-source-repair", ...applied };
    const patchManifest = changedPaths.map((path) => ({ path, before: before.get(path), after: after.get(path) }));
    return {
      kind: "validated-source-repair",
      success: true,
      changedPaths,
      patchSha256: sha256(JSON.stringify(patchManifest)),
      validation: ["format:check", "lint", "typecheck", "test:unit", "test:workflow-core"],
    };
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
};
