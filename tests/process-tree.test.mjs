import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import {
  isProcessTreeRunning,
  processTreeSpawnOptions,
  terminateProcessTree,
  terminateProcessTreeWithEscalation,
} from "../scripts/workflow/process-tree.mjs";

const waitFor = async (check, timeoutMs = 3_000) => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await check()) return;
    await new Promise((done) => setTimeout(done, 25));
  }
  throw new Error("Timed out waiting for process-tree test condition");
};

test("render timeout terminates the complete POSIX child process group", { skip: process.platform === "win32" }, async () => {
  const directory = await mkdtemp(resolve(tmpdir(), "remotion-md-process-tree-"));
  const pidFile = resolve(directory, "grandchild.pid");
  const script = `
    const {spawn} = require("node:child_process");
    const {writeFileSync} = require("node:fs");
    process.on("SIGTERM", () => {});
    const child = spawn(process.execPath, ["-e", "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)"], {stdio: "ignore", detached: true});
    writeFileSync(${JSON.stringify(pidFile)}, String(child.pid));
    setInterval(() => {}, 1000);
  `;
  const child = spawn(process.execPath, ["-e", script], processTreeSpawnOptions({ stdio: "ignore" }));
  try {
    await waitFor(async () => {
      try {
        return Number(await readFile(pidFile, "utf8")) > 0;
      } catch {
        return false;
      }
    });
    assert.equal(isProcessTreeRunning(child), true);
    terminateProcessTree(child, "SIGTERM");
    await new Promise((done) => setTimeout(done, 50));
    assert.equal(isProcessTreeRunning(child), true);
    terminateProcessTree(child, "SIGKILL");
    await waitFor(() => !isProcessTreeRunning(child));
  } finally {
    if (isProcessTreeRunning(child)) terminateProcessTree(child, "SIGKILL");
  }
});

test(
  "bounded cancellation escalates when a render process ignores SIGTERM",
  { skip: process.platform === "win32" },
  async () => {
    const child = spawn(
      process.execPath,
      ["-e", "process.on('SIGTERM', () => {}); process.stdout.write('ready\\n'); setInterval(() => {}, 1000)"],
      processTreeSpawnOptions({ stdio: ["ignore", "pipe", "ignore"] }),
    );
    try {
      await once(child.stdout, "data");
      const startedAt = Date.now();
      const result = await terminateProcessTreeWithEscalation(child, {
        graceMs: 75,
        killWaitMs: 1_000,
        pollIntervalMs: 10,
      });
      assert.equal(result.escalated, true);
      assert.equal(result.terminated, true);
      assert.equal(isProcessTreeRunning(child), false);
      assert.ok(Date.now() - startedAt < 1_500);
    } finally {
      if (isProcessTreeRunning(child)) terminateProcessTree(child, "SIGKILL");
    }
  },
);
