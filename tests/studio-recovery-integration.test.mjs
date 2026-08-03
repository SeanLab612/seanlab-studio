import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const availablePort = () =>
  new Promise((done, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close(() => done(port));
    });
  });

const waitForHealth = async (port) => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (response.ok) return response.json();
    } catch {}
    await new Promise((done) => setTimeout(done, 50));
  }
  throw new Error("Studio health endpoint did not start");
};

test("Studio restart isolates abandoned work instead of replaying it", async () => {
  const root = await mkdtemp(join(tmpdir(), "remotion-studio-recovery-"));
  const dataRoot = join(root, "studio-data");
  await mkdir(dataRoot, { recursive: true });
  await writeFile(
    join(dataRoot, "jobs.json"),
    `${JSON.stringify([
      { id: "queued-1", kind: "narration", projectId: "missing-a", status: "queued", queuedAt: new Date().toISOString() },
      { id: "running-1", kind: "video-workflow", projectId: "missing-b", status: "running", startedAt: new Date().toISOString() },
      { id: "done-1", kind: "narration", projectId: "missing-c", status: "completed", completedAt: new Date().toISOString() },
    ])}\n`,
  );
  const port = await availablePort();
  const child = spawn(process.execPath, ["--experimental-strip-types", "scripts/studio-server.mjs"], {
    cwd: resolve("."),
    env: {
      ...process.env,
      PORT: String(port),
      REMOTION_MD_CREATOR_ROOT: join(root, "projects"),
      REMOTION_MD_STUDIO_DATA_ROOT: dataRoot,
    },
    stdio: "ignore",
  });
  try {
    const health = await waitForHealth(port);
    assert.equal(health.policy.maxConcurrentJobs, 1);
    const jobs = await fetch(`http://127.0.0.1:${port}/api/jobs`).then((response) => response.json());
    assert.equal(jobs.find((item) => item.id === "queued-1").status, "interrupted");
    assert.equal(jobs.find((item) => item.id === "running-1").status, "interrupted");
    assert.equal(jobs.find((item) => item.id === "done-1").status, "completed");
    assert.match(jobs.find((item) => item.id === "running-1").error, /was restarted automatically/);
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
  }
});
