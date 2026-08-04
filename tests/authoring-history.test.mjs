import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";

const narration = (title) => ({
  schemaVersion: "1.0",
  title,
  opening: "一个本地视频工作流怎样保留修改历史？",
  overview: "这一期看清一个本地视频工作流。",
  sections: [
    {
      id: "workflow",
      title: "工作流",
      narration: "它把写稿、拍摄和审核接成一个流程。",
      visualIntent: "semantic-visual",
      visualOpportunities: [],
      materialIds: [],
      recordingInstruction: null,
    },
    {
      id: "review",
      title: "人工审核",
      narration: "每个关键节点都保留人工确认。",
      visualIntent: "semantic-visual",
      visualOpportunities: [],
      materialIds: [],
      recordingInstruction: null,
    },
  ],
  conclusion: "最后仍然由创作者决定是否交付。",
  fullScript:
    "一个本地视频工作流怎样保留修改历史？\n\n这一期看清一个本地视频工作流。\n\n它把写稿、拍摄和审核接成一个流程。\n\n每个关键节点都保留人工确认。\n\n最后仍然由创作者决定是否交付。",
  shootingGuide: ["保持人物口播稳定。"],
});

test("narration saves and restores immutable attempts without overwriting history", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "remotion-md-authoring-"));
  process.env.REMOTION_MD_CREATOR_ROOT = root;
  const store = await import(`../scripts/creator/project-store.mjs?root=${Date.now()}`);
  const history = await import(`../scripts/creator/authoring-history.mjs?root=${Date.now()}`);
  const authoring = await import(`../scripts/creator/narration.mjs?root=${Date.now()}`);
  const handoff = await import(`../scripts/creator/lock-handoff.mjs?root=${Date.now()}`);
  try {
    const project = await store.createCreatorProject({
      id: "history-test",
      title: "历史测试",
      topic: "测试口播版本",
      category: "other",
      agentId: "codex-cli",
    });
    project.authoring.state = "drafted";
    await store.saveCreatorProject(project);
    await authoring.saveNarrationDraft("history-test", narration("第一版"));
    await authoring.saveNarrationDraft("history-test", narration("第二版"));
    const before = await history.listNarrationAttempts("history-test");
    assert.equal(before.length, 2);
    assert.equal(new Set(before.map((attempt) => attempt.attemptId)).size, 2);
    const current = await store.loadCreatorProject("history-test");
    const first = before.find((attempt) => attempt.attemptId !== current.authoring.currentAttemptId);
    assert.ok(first);
    const restored = await history.restoreNarrationAttempt("history-test", first.attemptId);
    assert.equal(restored.narration.title, "第一版");
    const after = await history.listNarrationAttempts("history-test");
    assert.equal(after.length, 3);
    assert.equal(restored.attempt.kind, "restore");
    assert.equal(restored.attempt.parentAttemptId, current.authoring.currentAttemptId);
    assert.equal(restored.attempt.changeSummary.titleChanged, true);
    assert.deepEqual(restored.attempt.changeSummary.changedSectionIds, []);
    assert.match(await readFile(resolve(root, "history-test/authoring/draft-script.md"), "utf8"), /第一版/);
    await handoff.lockNarration("history-test");
    const locked = await store.loadCreatorProject("history-test");
    assert.equal(locked.authoring.lockedAttemptId, restored.attempt.attemptId);
    assert.equal(locked.authoring.lockedAttemptSha256, restored.attempt.outputSha256);
    const visualPlan = JSON.parse(
      await readFile(resolve(root, "history-test/authoring/authored-visual-plan.json"), "utf8"),
    );
    assert.deepEqual(
      visualPlan.sections.map((section) => section.sectionId),
      ["opening", "overview", "workflow", "review", "conclusion"],
    );
    const storyboard = JSON.parse(
      await readFile(resolve(root, "history-test/authoring/visual-storyboard.json"), "utf8"),
    );
    assert.ok(Object.values(storyboard.sections).every((section) => section.status === "confirmed"));

    storyboard.sections.workflow = {
      mode: "auto",
      status: "confirmed",
      beats: [
        {
          id: "workflow-beat-1",
          exactSpokenQuote: "它把写稿、拍摄和审核接成一个流程",
          status: "confirmed",
          primaryVisualType: "component",
          semanticForm: "ordered-progression",
          takeover: "partial",
          speakerPresence: "full",
        },
      ],
    };
    const visual = await import(`../scripts/creator/visual-storyboard.mjs?root=${Date.now()}`);
    await visual.saveVisualStoryboard("history-test", storyboard, await authoring.loadNarration("history-test"));
    const speakerSource = resolve(root, "speaker.mp4");
    await writeFile(speakerSource, "speaker fixture");
    const speaker = await store.importCreatorAsset({
      projectId: "history-test",
      sourcePath: speakerSource,
      kind: "speaker-video",
      label: "speaker",
    });
    await handoff.createVideoHandoff("history-test", { speakerAssetId: speaker.assetId });
    const refreshedPlan = JSON.parse(
      await readFile(resolve(root, "history-test/authoring/authored-visual-plan.json"), "utf8"),
    );
    assert.deepEqual(refreshedPlan.beats.map((beat) => beat.id), ["workflow-beat-1"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
