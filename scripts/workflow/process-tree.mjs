import { spawn, spawnSync } from "node:child_process";

export const processTreeSpawnOptions = (options = {}) => ({
  ...options,
  detached: process.platform !== "win32",
});

const descendantPids = (rootPid) => {
  const result = spawnSync("ps", ["-axo", "pid=,ppid="], { encoding: "utf8" });
  if (result.status !== 0) return [];
  const children = new Map();
  for (const line of result.stdout.split(/\r?\n/)) {
    const [pid, parentPid] = line.trim().split(/\s+/).map(Number);
    if (!Number.isInteger(pid) || !Number.isInteger(parentPid)) continue;
    const siblings = children.get(parentPid) ?? [];
    siblings.push(pid);
    children.set(parentPid, siblings);
  }
  const descendants = [];
  const visit = (pid) => {
    for (const childPid of children.get(pid) ?? []) {
      visit(childPid);
      descendants.push(childPid);
    }
  };
  visit(rootPid);
  return descendants;
};

const signalPidOrGroup = (pid, signal) => {
  try {
    process.kill(-pid, signal);
    return true;
  } catch {
    try {
      process.kill(pid, signal);
      return true;
    } catch {
      return false;
    }
  }
};

export const terminateProcessTree = (child, signal = "SIGTERM") => {
  if (!child?.pid) return false;
  if (process.platform === "win32") {
    const killer = spawn("taskkill", ["/pid", String(child.pid), "/t", ...(signal === "SIGKILL" ? ["/f"] : [])], {
      stdio: "ignore",
      windowsHide: true,
    });
    killer.unref();
    return true;
  }
  const pids = [...descendantPids(child.pid), child.pid];
  child.processTreePids = [...new Set([...(child.processTreePids ?? []), ...pids])];
  return pids.map((pid) => signalPidOrGroup(pid, signal)).some(Boolean);
};

export const isProcessTreeRunning = (child) => {
  if (!child?.pid) return false;
  if (process.platform === "win32") return child.exitCode === null && child.signalCode === null;
  return [...new Set([...(child.processTreePids ?? []), child.pid])].some((pid) => signalPidOrGroup(pid, 0));
};

const waitForProcessTreeExit = async (child, timeoutMs, pollIntervalMs) => {
  const deadline = Date.now() + timeoutMs;
  while (isProcessTreeRunning(child) && Date.now() < deadline)
    await new Promise((done) => setTimeout(done, pollIntervalMs));
  return !isProcessTreeRunning(child);
};

export const terminateProcessTreeWithEscalation = async (
  child,
  { graceMs = 5_000, killWaitMs = 2_000, pollIntervalMs = 50 } = {},
) => {
  if (!isProcessTreeRunning(child)) return { terminated: true, escalated: false };
  terminateProcessTree(child, "SIGTERM");
  if (await waitForProcessTreeExit(child, graceMs, pollIntervalMs)) return { terminated: true, escalated: false };
  terminateProcessTree(child, "SIGKILL");
  return {
    terminated: await waitForProcessTreeExit(child, killWaitMs, pollIntervalMs),
    escalated: true,
  };
};
