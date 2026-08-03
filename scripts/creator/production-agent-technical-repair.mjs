import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, resolve } from "node:path";
import { processTreeSpawnOptions, terminateProcessTree } from "../workflow/process-tree.mjs";

const allowedRepairRoots = ["schemas/", "scripts/", "src/", "studio/", "tests/"];
const deniedRepairPaths = new Set(["package.json", "package-lock.json", "pnpm-lock.yaml", "yarn.lock", ".gitignore"]);
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

export const isAutonomousTechnicalRepairEligible = (failure = {}) => {
  if (!failure.code || humanDecisionCodes.has(failure.code)) return false;
  if (humanDecisionCategories.has(failure.category)) return false;
  if (["delivery-render", "delivery-validate", "human-approval"].includes(failure.stage)) return false;
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
    "Work only inside this isolated Git worktree. Make the smallest source-code repair that resolves the supplied failure.",
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

const statusPaths = (status) =>
  status
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => normalizedRepoPath(line.slice(3).split(" -> ").at(-1)));

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
  const tracked = await execute({
    command: "git",
    args: ["status", "--porcelain", "--untracked-files=no"],
    cwd: root,
    signal,
  });
  if (tracked.stdout.trim())
    return { kind: "validated-source-repair", success: false, reason: "source-worktree-not-clean" };

  const temporaryRoot = await mkdtemp(resolve(tmpdir(), "seanlab-agent-repair-"));
  const worktree = resolve(temporaryRoot, "worktree");
  let worktreeAdded = false;
  try {
    await execute({ command: "git", args: ["worktree", "add", "--detach", worktree, "HEAD"], cwd: root, signal });
    worktreeAdded = true;
    try {
      const nodeModules = resolve(root, "node_modules");
      if ((await lstat(nodeModules)).isDirectory())
        await symlink(nodeModules, resolve(worktree, "node_modules"), "dir");
    } catch {}
    const prompt = repairPrompt({ projectId, recovery });
    const command = agentCommand({ agentId, model, worktree, prompt });
    await execute({
      ...command,
      cwd: worktree,
      input: agentId === "codex-cli" ? prompt : undefined,
      signal,
    });
    const status = await execute({
      command: "git",
      args: ["status", "--porcelain", "--untracked-files=all"],
      cwd: worktree,
      signal,
    });
    const changedPaths = validateAutonomousRepairPaths(statusPaths(status.stdout));
    if (!changedPaths.length)
      return { kind: "validated-source-repair", success: false, reason: "agent-produced-no-safe-change" };
    const untracked = status.stdout
      .split(/\r?\n/)
      .filter((line) => line.startsWith("?? "))
      .map((line) => line.slice(3));
    if (untracked.length)
      await execute({ command: "git", args: ["add", "-N", "--", ...untracked], cwd: worktree, signal });
    for (const script of ["format:check", "lint", "typecheck", "test:unit", "test:workflow-core"])
      await execute({
        command: "npm",
        args: ["run", script],
        cwd: worktree,
        signal,
        timeoutMs: 20 * 60_000,
      });
    const diff = await execute({
      command: "git",
      args: ["diff", "--binary", "--no-ext-diff", "HEAD", "--", ...changedPaths],
      cwd: worktree,
      signal,
    });
    if (!diff.stdout.trim())
      return { kind: "validated-source-repair", success: false, reason: "agent-produced-empty-patch" };
    await execute({ command: "git", args: ["apply", "--check", "-"], cwd: root, input: diff.stdout, signal });
    await execute({ command: "git", args: ["apply", "-"], cwd: root, input: diff.stdout, signal });
    return {
      kind: "validated-source-repair",
      success: true,
      changedPaths,
      patchSha256: sha256(diff.stdout),
      validation: ["format:check", "lint", "typecheck", "test:unit", "test:workflow-core"],
    };
  } finally {
    if (worktreeAdded)
      await execute({
        command: "git",
        args: ["worktree", "remove", "--force", worktree],
        cwd: root,
      }).catch(() => {});
    await rm(temporaryRoot, { recursive: true, force: true });
  }
};
