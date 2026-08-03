import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import { resolveAgentExecutable } from "../src/agents/registry.ts";

test("Agent discovery falls back to user-local bins outside the service PATH", async () => {
  const homeDirectory = await mkdtemp(resolve(tmpdir(), "remotion-md-agent-home-"));
  try {
    const binDirectory = resolve(homeDirectory, ".local/bin");
    const executable = resolve(binDirectory, "claude");
    await mkdir(binDirectory, { recursive: true });
    await writeFile(executable, "#!/bin/sh\nexit 0\n");
    await chmod(executable, 0o755);

    assert.equal(await resolveAgentExecutable("claude", { pathValue: "", homeDirectory }), executable);
  } finally {
    await rm(homeDirectory, { recursive: true, force: true });
  }
});

test("Agent discovery returns null when no executable exists", async () => {
  const homeDirectory = await mkdtemp(resolve(tmpdir(), "remotion-md-agent-home-"));
  try {
    assert.equal(await resolveAgentExecutable("missing-agent-command", { pathValue: "", homeDirectory }), null);
  } finally {
    await rm(homeDirectory, { recursive: true, force: true });
  }
});
