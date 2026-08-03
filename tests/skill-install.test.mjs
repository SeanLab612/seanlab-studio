import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readlink, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("skill installer links the creator, narration, and video workflows", async () => {
  const codexHome = await mkdtemp(resolve(tmpdir(), "remotion-md-codex-home-"));
  try {
    await execFileAsync(process.execPath, ["scripts/install-skill.mjs"], {
      cwd: repositoryRoot,
      env: { ...process.env, CODEX_HOME: codexHome },
    });
    for (const skillName of [
      "remotion-md-creator-workflow",
      "remotion-md-narration-script",
      "remotion-md-video-workflow",
    ]) {
      const target = resolve(codexHome, "skills", skillName);
      assert.equal(resolve(dirname(target), await readlink(target)), resolve(repositoryRoot, "skills", skillName));
    }
  } finally {
    await rm(codexHome, { recursive: true, force: true });
  }
});
