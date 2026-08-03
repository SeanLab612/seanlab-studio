import assert from "node:assert/strict";
import test from "node:test";
import { planBranchRetention } from "../scripts/prune-merged-branches.mjs";

const branches = ["feature-4", "feature-3", "feature-2", "feature-1"].map((name, index) => ({
  name,
  timestamp: 4 - index,
}));

test("keeps the three newest merged branches and prunes the oldest", () => {
  const plan = planBranchRetention(branches, 3);
  assert.deepEqual(
    plan.kept.map(({ name }) => name),
    ["feature-4", "feature-3", "feature-2"],
  );
  assert.deepEqual(
    plan.pruned.map(({ name }) => name),
    ["feature-1"],
  );
});

test("rejects an invalid retention count before any branch operation", () => {
  assert.throws(() => planBranchRetention(branches, -1), /non-negative integer/);
  assert.throws(() => planBranchRetention(branches, 1.5), /non-negative integer/);
});
