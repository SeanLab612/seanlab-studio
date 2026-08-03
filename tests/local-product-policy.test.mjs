import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { JobGate } from "../scripts/operations/job-gate.mjs";
import { KeyedMutex } from "../scripts/operations/keyed-mutex.mjs";
import { validateLocalProductPolicy } from "../scripts/operations/local-product-policy.mjs";

test("local product policy rejects unsafe concurrency and storage values", () => {
  assert.throws(
    () =>
      validateLocalProductPolicy({
        schemaVersion: "1.0",
        maxConcurrentJobs: 0,
        maxQueuedJobs: 20,
        minimumFreeBytes: 1,
        projectQuotaBytes: 1,
        backupRetention: 1,
      }),
    /maxConcurrentJobs/,
  );
});

test("tracked local product policy and schemas remain parseable", async () => {
  const policy = JSON.parse(await readFile("config/local-product-policy.json", "utf8"));
  const policySchema = JSON.parse(await readFile("schemas/local-product-policy.schema.json", "utf8"));
  const backupSchema = JSON.parse(await readFile("schemas/project-backup-manifest.schema.json", "utf8"));
  assert.equal(validateLocalProductPolicy(policy).maxConcurrentJobs, 1);
  assert.equal(policySchema.properties.maxConcurrentJobs.maximum, 4);
  assert.equal(backupSchema.properties.kind.const, "creator-project-backup");
});

test("job gate serializes heavy work and preserves FIFO order", async () => {
  const gate = new JobGate({ maxConcurrent: 1, maxQueued: 2 });
  await gate.acquire("first");
  let secondStarted = false;
  const second = gate.acquire("second").then(() => {
    secondStarted = true;
  });
  assert.deepEqual(gate.snapshot, {
    maxConcurrent: 1,
    maxQueued: 2,
    running: ["first"],
    queued: ["second"],
  });
  assert.equal(secondStarted, false);
  gate.release("first");
  await second;
  assert.equal(secondStarted, true);
  assert.deepEqual(gate.snapshot.running, ["second"]);
});

test("job gate can cancel queued work without disturbing the active job", async () => {
  const gate = new JobGate({ maxConcurrent: 1, maxQueued: 1 });
  await gate.acquire("active");
  const queued = gate.acquire("queued");
  assert.equal(gate.cancel("queued"), true);
  await assert.rejects(queued, /cancelled/);
  assert.deepEqual(gate.snapshot.running, ["active"]);
  assert.deepEqual(gate.snapshot.queued, []);
});

test("keyed mutex serializes one project without blocking another project", async () => {
  const mutex = new KeyedMutex();
  const events = [];
  let releaseFirst;
  const firstBlocked = new Promise((done) => {
    releaseFirst = done;
  });
  const first = mutex.run("project-a", async () => {
    events.push("a1-start");
    await firstBlocked;
    events.push("a1-end");
  });
  const second = mutex.run("project-a", async () => {
    events.push("a2");
  });
  const other = mutex.run("project-b", async () => {
    events.push("b1");
  });
  await other;
  assert.deepEqual(events, ["a1-start", "b1"]);
  releaseFirst();
  await Promise.all([first, second]);
  assert.deepEqual(events, ["a1-start", "b1", "a1-end", "a2"]);
});
