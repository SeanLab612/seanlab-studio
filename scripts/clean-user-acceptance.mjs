import { execFile, spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { homedir, hostname, platform, release, tmpdir, userInfo } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { runEnvironmentDoctor } from "./operations/doctor.mjs";
import { loadProviderEnvironmentFromZsh } from "./workflow/shell-environment.mjs";

const execFileAsync = promisify(execFile);
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};
const agentId = option("--agent", "codex-cli");
if (!["codex-cli", "claude-code"].includes(agentId)) throw new Error("--agent must be codex-cli or claude-code");
const offlineCore = args.includes("--offline-core");
const outputPath = resolve(
  option("--output", `out/clean-user-acceptance/report-${new Date().toISOString().replaceAll(/[:.]/g, "-")}.json`),
);
const isolatedRoot = offlineCore ? await mkdtemp(join(tmpdir(), "remotion-md-isolated-runtime-")) : undefined;
if (isolatedRoot) {
  const isolatedHome = join(isolatedRoot, "home");
  await mkdir(isolatedHome, { recursive: true });
  process.env.HOME = isolatedHome;
  delete process.env.CODEX_HOME;
  delete process.env.MIMO_API_KEY;
} else {
  loadProviderEnvironmentFromZsh({ overwrite: true });
}

const commandCheck = async (id, file, commandArgs) => {
  const started = performance.now();
  try {
    const result = await execFileAsync(file, commandArgs, {
      cwd: resolve("."),
      encoding: "utf8",
      timeout: 10 * 60_000,
      maxBuffer: 20 * 1024 * 1024,
    });
    return {
      id,
      status: "passed",
      elapsedMs: Math.round(performance.now() - started),
      outputTail: `${result.stdout}\n${result.stderr}`.trim().split(/\r?\n/).slice(-12),
    };
  } catch (error) {
    return {
      id,
      status: "failed",
      elapsedMs: Math.round(performance.now() - started),
      exitCode: error.code,
      outputTail: `${error.stdout ?? ""}\n${error.stderr ?? error.message ?? ""}`.trim().split(/\r?\n/).slice(-20),
    };
  }
};

const availablePort = () =>
  new Promise((done, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      probe.close(() => done(address.port));
    });
  });

const waitForStudio = async (port, logs) => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`, {
        signal: AbortSignal.timeout(500),
      });
      if (response.ok) return response.json();
    } catch {}
    await new Promise((done) => setTimeout(done, 100));
  }
  throw new Error(`Studio did not become healthy: ${logs.slice(-12).join("\n")}`);
};

const studioSmoke = async () => {
  const sandbox = await mkdtemp(join(tmpdir(), "remotion-md-clean-user-"));
  const port = await availablePort();
  const logs = [];
  const child = spawn(process.execPath, ["--experimental-strip-types", "scripts/studio-server.mjs"], {
    cwd: resolve("."),
    env: {
      ...process.env,
      PORT: String(port),
      REMOTION_MD_CREATOR_ROOT: join(sandbox, "projects"),
      REMOTION_MD_STUDIO_DATA_ROOT: join(sandbox, "studio-data"),
      REMOTION_MD_BACKUP_ROOT: join(sandbox, "backups"),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const append = (chunk) => {
    logs.push(...chunk.toString().split(/\r?\n/).filter(Boolean));
    if (logs.length > 100) logs.splice(0, logs.length - 100);
  };
  child.stdout.on("data", append);
  child.stderr.on("data", append);
  try {
    const health = await waitForStudio(port, logs);
    const agentsResponse = await fetch(`http://127.0.0.1:${port}/api/agents`);
    const agents = await agentsResponse.json();
    const selected = agents.find((item) => item.id === agentId);
    if (!selected) throw new Error(`${agentId} is not registered`);
    if (!offlineCore && !selected.available) throw new Error(selected.remediation ?? `${agentId} is unavailable`);
    const model = selected.governance?.approvedModels?.[0];
    let created;
    let creationSurface;
    if (offlineCore) {
      const previousRoot = process.env.REMOTION_MD_CREATOR_ROOT;
      process.env.REMOTION_MD_CREATOR_ROOT = join(sandbox, "projects");
      try {
        const store = await import(`./creator/project-store.mjs?offline-acceptance=${Date.now()}`);
        created = await store.createCreatorProject({
          id: "clean-user-smoke",
          title: "Clean User Smoke",
          topic: "验证隔离安装与 Studio 基础流程",
          category: "tutorial",
          agentId,
          ...(model ? { model } : {}),
        });
        creationSurface = "deterministic-project-store";
      } finally {
        if (previousRoot === undefined) delete process.env.REMOTION_MD_CREATOR_ROOT;
        else process.env.REMOTION_MD_CREATOR_ROOT = previousRoot;
      }
    } else {
      const createResponse = await fetch(`http://127.0.0.1:${port}/api/projects`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: "clean-user-smoke",
          title: "Clean User Smoke",
          topic: "验证本机安装与 Studio 基础流程",
          category: "tutorial",
          agentId,
          ...(model ? { model } : {}),
        }),
      });
      created = await createResponse.json();
      if (!createResponse.ok) throw new Error(created.error ?? "Studio project creation failed");
      creationSurface = "studio-api";
    }
    const listResponse = await fetch(`http://127.0.0.1:${port}/api/projects`);
    const projects = await listResponse.json();
    if (!listResponse.ok || !projects.some((item) => item.project.id === "clean-user-smoke"))
      throw new Error("Studio could not discover the clean-user smoke project");
    const readResponse = await fetch(`http://127.0.0.1:${port}/api/projects/clean-user-smoke`);
    const reopened = await readResponse.json();
    if (!readResponse.ok) throw new Error("Studio could not reopen the clean-user smoke project");
    if (reopened.project.agent.fallback !== "none") throw new Error("Clean-user smoke project lost fallback:none");
    return {
      status: "passed",
      health,
      mode: offlineCore ? "offline-core" : "provider-ready",
      agent: { id: agentId, model: model ?? null, availabilityRequired: !offlineCore },
      project: {
        id: created.project.id,
        fallback: created.agent.fallback,
        creationSurface,
      },
      logs: logs.slice(-12),
    };
  } finally {
    await new Promise((done) => {
      if (child.exitCode !== null) return done();
      const timeout = setTimeout(done, 12_000);
      child.once("close", () => {
        clearTimeout(timeout);
        done();
      });
      child.kill("SIGTERM");
    });
    await rm(sandbox, { recursive: true, force: true });
  }
};

const doctor = await runEnvironmentDoctor({
  workspacePath: resolve("."),
  requireMimo: !offlineCore,
  requireCodex: !offlineCore && agentId === "codex-cli",
  requireClaude: !offlineCore && agentId === "claude-code",
});
const commands = args.includes("--skip-tests")
  ? []
  : [
      await commandCheck("typecheck", "npm", ["run", "typecheck"]),
      await commandCheck("unit-tests", "npm", ["run", "test:unit"]),
      await commandCheck("workflow-core-tests", "npm", ["run", "test:workflow-core"]),
    ];
let studio;
try {
  studio = await studioSmoke();
} catch (error) {
  studio = { status: "failed", error: error.message };
}
const failed =
  doctor.status === "failed" || commands.some((item) => item.status === "failed") || studio.status === "failed";
const report = {
  schemaVersion: "1.0",
  kind: "clean-macos-user-acceptance",
  mode: offlineCore ? "offline-core" : "provider-ready",
  generatedAt: new Date().toISOString(),
  status: failed ? "failed" : doctor.status === "warning" ? "warning" : "passed",
  host: {
    hostname: hostname(),
    user: userInfo().username,
    home: homedir(),
    platform: platform(),
    release: release(),
    architecture: process.arch,
  },
  guarantees: {
    agentInvoked: false,
    translationInvoked: false,
    mediaRendered: false,
    realCreatorProjectsTouched: false,
    providerCredentialsRequired: !offlineCore,
  },
  doctor,
  commands,
  studio,
};
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
if (isolatedRoot) await rm(isolatedRoot, { recursive: true, force: true });
console.log(`Clean macOS user acceptance: ${report.status.toUpperCase()}`);
console.log(`Report: ${outputPath}`);
if (failed) process.exitCode = 2;
