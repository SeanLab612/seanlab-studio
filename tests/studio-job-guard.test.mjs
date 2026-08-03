import assert from "node:assert/strict";
import test from "node:test";
import {
  activeProjectJob,
  assertProjectHasNoActiveJob,
  ownedProjectJob,
} from "../scripts/operations/studio-job-guard.mjs";

test("Studio rejects a second active job for the same project", () => {
  const records = [
    { id: "running-a", projectId: "project-a", status: "running" },
    { id: "done-a", projectId: "project-a", status: "completed" },
    { id: "queued-b", projectId: "project-b", status: "queued" },
  ];
  assert.equal(activeProjectJob(records, "project-a")?.id, "running-a");
  assert.throws(() => assertProjectHasNoActiveJob(records, "project-a"), /已有任务/);
  assert.doesNotThrow(() => assertProjectHasNoActiveJob(records, "project-c"));
});

test("Studio only exposes a job through its owning project route", () => {
  const records = new Map([
    ["job-a", { id: "job-a", projectId: "project-a", status: "running" }],
  ]);
  assert.equal(ownedProjectJob(records, "project-a", "job-a")?.id, "job-a");
  assert.equal(ownedProjectJob(records, "project-b", "job-a"), undefined);
});
