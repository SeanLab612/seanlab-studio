import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { delimiter, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const label = "com.seanlab.remotion-md-studio";
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const logPath = resolve(repositoryRoot, "studio-data/studio.log");
const action = process.argv[2] ?? "status";
const allowedActions = new Set(["start", "stop", "status"]);

if (!allowedActions.has(action)) throw new Error("Usage: npm run studio:start | studio:stop | studio:status");
if (process.platform !== "darwin") throw new Error("The persistent Studio service currently requires macOS launchctl");

const shellQuote = (value) => `'${String(value).replaceAll("'", `'\\''`)}'`;
const studioPath = [
  resolve(repositoryRoot, ".venv/bin"),
  dirname(process.execPath),
  resolve(homedir(), ".npm-global/bin"),
  resolve(homedir(), ".local/bin"),
  resolve(homedir(), ".bun/bin"),
  resolve(homedir(), ".cargo/bin"),
  "/opt/homebrew/bin",
  "/usr/local/bin",
  ...(process.env.PATH ?? "").split(delimiter),
]
  .filter(Boolean)
  .filter((value, index, values) => values.indexOf(value) === index)
  .join(delimiter);
const launchctl = (args, { allowFailure = false } = {}) => {
  const result = spawnSync("launchctl", args, { encoding: "utf8" });
  if (!allowFailure && result.status !== 0)
    throw new Error(result.stderr.trim() || `launchctl exited ${result.status}`);
  return result;
};

const health = async () => {
  try {
    const response = await fetch("http://127.0.0.1:3080/api/health", { signal: AbortSignal.timeout(1_000) });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
};

const waitForHealth = async () => {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const value = await health();
    if (value) return value;
    await new Promise((done) => setTimeout(done, 100));
  }
  throw new Error(`Studio did not start. Inspect ${logPath}`);
};

if (action === "stop") {
  launchctl(["remove", label], { allowFailure: true });
  console.log("SeanLab Studio service stopped");
} else if (action === "status") {
  const value = await health();
  if (!value) {
    console.log("SeanLab Studio service is not running");
    process.exitCode = 1;
  } else {
    console.log(`SeanLab Studio service is running (pid ${value.pid}) at http://localhost:3080`);
  }
} else {
  const existing = await health();
  if (existing) {
    console.log(`SeanLab Studio service is already running (pid ${existing.pid}) at http://localhost:3080`);
  } else {
    await mkdir(dirname(logPath), { recursive: true });
    launchctl(["remove", label], { allowFailure: true });
    const command = `export PATH=${shellQuote(studioPath)}; cd ${shellQuote(repositoryRoot)} && exec ${shellQuote(process.execPath)} --experimental-strip-types scripts/studio-server.mjs >> ${shellQuote(logPath)} 2>&1`;
    launchctl(["submit", "-l", label, "--", "/bin/zsh", "-ilc", command]);
    const value = await waitForHealth();
    console.log(`SeanLab Studio service started (pid ${value.pid}) at http://localhost:3080`);
  }
}
