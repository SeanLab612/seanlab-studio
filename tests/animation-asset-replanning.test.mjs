import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";

const narration = {
  schemaVersion: "1.0",
  title: "动画素材重规划",
  opening: "动画素材为什么需要重新规划？",
  overview: "这一期看清动画素材如何重新规划。",
  sections: [
    {
      id: "workflow",
      title: "工作流",
      narration: "先打开录音机，然后进入人工审核。",
      visualIntent: "semantic-visual",
      visualOpportunities: [],
      materialIds: [],
      recordingInstruction: null,
    },
    {
      id: "result",
      title: "结果",
      narration: "确认之前不会替换当前分镜。",
      visualIntent: "speaker",
      visualOpportunities: [],
      materialIds: [],
      recordingInstruction: null,
    },
  ],
  conclusion: "最终仍然由创作者确认。",
  fullScript:
    "动画素材为什么需要重新规划？\n\n这一期看清动画素材如何重新规划。\n\n先打开录音机，然后进入人工审核。\n\n确认之前不会替换当前分镜。\n\n最终仍然由创作者确认。",
  shootingGuide: ["保持人物口播稳定。"],
};

const storyboard = {
  schemaVersion: "3.0",
  sections: {
    workflow: {
      mode: "animation",
      status: "suggested",
      animationIntent: {
        prototypeId: "process-flow",
        styleProfileId: "paper-editorial",
        takeaway: "录音后审核",
        stages: [
          { id: "record", spokenQuote: "先打开录音机", action: "start", label: "录音机" },
          { id: "review", spokenQuote: "然后进入人工审核", action: "finish", label: "人工审核" },
        ],
      },
    },
  },
};

test("animation asset replanning preserves a draft until human promotion and keeps immutable evidence", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "seanlab-animation-replan-"));
  const previousRoot = process.env.REMOTION_MD_CREATOR_ROOT;
  process.env.REMOTION_MD_CREATOR_ROOT = root;
  try {
    await mkdir(resolve(root, ".asset-library/images"), { recursive: true });
    await writeFile(
      resolve(root, ".asset-library/images/registry.json"),
      JSON.stringify({
        schemaVersion: "1.0",
        assets: [
          {
            id: "recorder-paper",
            subject: "纸张录音机",
            description: "用于录音流程动画",
            keywords: ["录音机", "录音"],
            templateId: "paper-editorial",
            file: "recorder-paper/asset.png",
          },
        ],
      }),
    );
    const store = await import(`../scripts/creator/project-store.mjs?replan=${Date.now()}`);
    const authoring = await import(`../scripts/creator/narration.mjs?replan=${Date.now()}`);
    const visual = await import(`../scripts/creator/visual-storyboard.mjs?replan=${Date.now()}`);
    const replanning = await import(`../scripts/creator/animation-asset-replanning.mjs?replan=${Date.now()}`);
    const project = await store.createCreatorProject({
      id: "replan-test",
      title: "动画素材重规划",
      topic: "测试动画素材重新规划",
      category: "other",
      agentId: "fixture",
    });
    project.authoring.state = "drafted";
    await store.saveCreatorProject(project);
    await authoring.saveNarrationDraft("replan-test", narration);
    await visual.saveVisualStoryboard("replan-test", storyboard, narration);

    const draft = await replanning.replanAnimationAssets("replan-test");
    assert.equal(draft.status, "suggested");
    assert.equal(draft.targetCount, 2);
    assert.ok(draft.changedCount >= 1);
    const beforeConfirmation = await visual.loadVisualStoryboard("replan-test", narration);
    assert.equal(beforeConfirmation.sections.workflow.animationIntent.stages[0].imageAssetId, undefined);

    const attemptDirectory = resolve(
      root,
      "replan-test/authoring/animation-asset-attempts",
      draft.attemptId,
    );
    const metadataBefore = await readFile(resolve(attemptDirectory, "metadata.json"), "utf8");
    const result = await replanning.confirmAnimationAssetReplan({
      projectId: "replan-test",
      attemptId: draft.attemptId,
      candidateStoryboardSha256: draft.candidateStoryboardSha256,
      confirmation: "human-confirm-animation-asset-replan",
    });
    assert.equal(
      result.storyboard.sections.workflow.animationIntent.stages[0].imageAssetId,
      "recorder-paper",
    );
    assert.equal(await readFile(resolve(attemptDirectory, "metadata.json"), "utf8"), metadataBefore);
    const promotion = JSON.parse(await readFile(resolve(attemptDirectory, "promotion.json"), "utf8"));
    assert.equal(promotion.attemptId, draft.attemptId);
    const state = await replanning.loadAnimationAssetReplanning("replan-test");
    assert.equal(state.draft.status, "confirmed");
    assert.equal(state.attempts.length, 1);
    assert.ok(state.attempts[0].promotedAt);

    const unchangedDraft = await replanning.replanAnimationAssets("replan-test");
    assert.equal(unchangedDraft.changedCount, 0);
    const unchangedConfirmation = await replanning.confirmAnimationAssetReplan({
      projectId: "replan-test",
      attemptId: unchangedDraft.attemptId,
      candidateStoryboardSha256: unchangedDraft.candidateStoryboardSha256,
      confirmation: "human-confirm-animation-asset-replan",
    });
    assert.equal(unchangedConfirmation.draft.status, "confirmed");
    assert.equal((await replanning.listAnimationAssetReplanningAttempts("replan-test")).length, 2);
  } finally {
    if (previousRoot === undefined) delete process.env.REMOTION_MD_CREATOR_ROOT;
    else process.env.REMOTION_MD_CREATOR_ROOT = previousRoot;
    await rm(root, { recursive: true, force: true });
  }
});
