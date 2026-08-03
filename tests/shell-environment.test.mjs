import assert from "node:assert/strict";
import test from "node:test";
import { loadProviderEnvironmentFromZsh } from "../scripts/workflow/shell-environment.mjs";

test("zsh environment loader imports only allowlisted provider variables without returning secret values", () => {
  const environment = {};
  const report = loadProviderEnvironmentFromZsh({
    environment,
    platform: "darwin",
    runner: () => ({
      status: 0,
      stdout:
        "zsh startup text\n__SEANLAB_PROVIDER_ENV_START__\0MIMO_API_KEY=private-test-token\0UNRELATED_SECRET=do-not-import\0",
      stderr: "",
    }),
  });

  assert.equal(environment.MIMO_API_KEY, "private-test-token");
  assert.equal(environment.UNRELATED_SECRET, undefined);
  assert.deepEqual(report.imported, ["MIMO_API_KEY"]);
  assert.deepEqual(report.detected, ["MIMO_API_KEY"]);
  assert.doesNotMatch(JSON.stringify(report), /private-test-token|do-not-import/);
});

test("zsh environment loader reports failure without deleting an existing provider key", () => {
  const environment = { MIMO_API_KEY: "existing-token" };
  const report = loadProviderEnvironmentFromZsh({
    environment,
    platform: "darwin",
    runner: () => ({ status: 1, stdout: "", stderr: "zsh failed" }),
  });

  assert.equal(report.status, "failed");
  assert.equal(environment.MIMO_API_KEY, "existing-token");
  assert.deepEqual(report.detected, ["MIMO_API_KEY"]);
  assert.doesNotMatch(JSON.stringify(report), /existing-token/);
});
