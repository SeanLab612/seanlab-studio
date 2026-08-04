import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";

test("rejected narration output is preserved without becoming a usable draft", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "seanlab-rejected-narration-"));
  process.env.REMOTION_MD_CREATOR_ROOT = root;
  const history = await import(`../scripts/creator/authoring-history.mjs?rejected=${Date.now()}`);
  try {
    const projectId = "rejected-draft";
    const project = {
      agent: { id: "codex-cli", model: "gpt-test", authoringContractVersion: "1.0" },
      authoring: { state: "not-started" },
      materials: [],
    };
    const rejectedOutput = { title: "被拒绝的草稿", overview: "含有无法证明的免费结论" };
    const attempt = await history.recordNarrationAttempt({
      project,
      projectId,
      rejectedOutput,
      report: { provider: "fake", validationRepairRound: 1 },
      kind: "automatic-repair",
      status: "failed",
      error: new Error("Agent 口播稿包含来源外事实：免费"),
    });
    const directory = resolve(root, projectId, "authoring/attempts", attempt.attemptId);
    assert.deepEqual(JSON.parse(await readFile(resolve(directory, "rejected-output.json"), "utf8")), rejectedOutput);
    assert.equal(attempt.outputSha256, null);
    assert.ok(attempt.rejectedOutputSha256);
    await assert.rejects(readFile(resolve(directory, "narration-package.json"), "utf8"), /ENOENT/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
