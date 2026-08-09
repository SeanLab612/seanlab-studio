import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { resolveStudioStaticFile } from "../scripts/operations/http-security.mjs";

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

test("Studio static files stay inside their canonical root", async () => {
  const temporary = await mkdtemp(join(tmpdir(), "seanlab-static-security-"));
  const root = join(temporary, "public");
  const outside = join(temporary, "private.txt");
  await mkdir(join(root, "assets"), { recursive: true });
  await writeFile(join(root, "assets", "safe.txt"), "safe");
  await writeFile(outside, "private");
  await symlink(outside, join(root, "assets", "outside-link.txt"));
  try {
    assert.equal(await resolveStudioStaticFile(root, "assets/safe.txt"), await realpath(join(root, "assets", "safe.txt")));
    await assert.rejects(resolveStudioStaticFile(root, "/etc/hosts"), /Not found/);
    await assert.rejects(resolveStudioStaticFile(root, "../private.txt"), /Not found/);
    await assert.rejects(resolveStudioStaticFile(root, "assets/outside-link.txt"), /Not found/);
    await assert.rejects(resolveStudioStaticFile(root, "assets/missing.txt"), /Not found/);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
