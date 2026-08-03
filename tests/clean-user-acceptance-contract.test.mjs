import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("offline clean-user acceptance isolates credentials and keeps the fixed-Agent project contract", async () => {
  const source = await readFile(new URL("../scripts/clean-user-acceptance.mjs", import.meta.url), "utf8");

  assert.match(source, /--offline-core/);
  assert.match(source, /delete process\.env\.CODEX_HOME/);
  assert.match(source, /delete process\.env\.MIMO_API_KEY/);
  assert.match(source, /availabilityRequired: !offlineCore/);
  assert.match(source, /creationSurface = "deterministic-project-store"/);
  assert.match(source, /fallback !== "none"/);
  assert.match(source, /providerCredentialsRequired: !offlineCore/);
});
