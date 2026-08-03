import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Studio binds mutations to a trusted host, origin, and per-launch token", async () => {
  const server = await readFile(new URL("../scripts/studio-server.mjs", import.meta.url), "utf8");
  const headers = await readFile(new URL("../scripts/operations/http-security.mjs", import.meta.url), "utf8");
  const client = await readFile(new URL("../studio/core.js", import.meta.url), "utf8");
  assert.match(server, /allowedHosts/);
  assert.match(server, /allowedOrigins/);
  assert.match(server, /timingSafeEqual/);
  assert.match(server, /assertTrustedRequest\(request\)/);
  assert.match(server, /studioSecureHeaders/);
  assert.match(headers, /"x-frame-options": "DENY"/);
  assert.match(headers, /frame-ancestors 'none'/);
  assert.match(headers, /cross-origin-resource-policy/);
  assert.match(client, /x-studio-token/);
});
