import assert from "node:assert/strict";
import test from "node:test";
import { completeNarration } from "../scripts/creator/narration.mjs";

const narrationOutput = ({ overview }) => ({
  schemaVersion: "1.0",
  title: "交互式打字项目的入口",
  opening: "一个网站能不能从打出一个词开始？",
  overview,
  sections: [
    {
      id: "typing-entry",
      title: "从打字开始",
      narration: "访客可以在机器上输入英文词。",
      visualIntent: "semantic-visual",
      visualOpportunities: [],
      materialIds: [],
      recordingInstruction: null,
    },
    {
      id: "blender-boundary",
      title: "Blender 边界",
      narration: "普通网页开发不需要 Blender。",
      visualIntent: "semantic-visual",
      visualOpportunities: [],
      materialIds: [],
      recordingInstruction: null,
    },
  ],
  conclusion: "这个项目把打字变成了访问虚构世界的入口。",
  fullScript: "ignored because it is derived locally",
  shootingGuide: ["展示现有截图。"],
});

const project = {
  agent: { id: "codex-cli", model: "gpt-test", fallback: "none" },
  brief: { topic: "交互式打字项目的入口", category: "github-project" },
  sources: [],
  materials: [],
};

const sourceContext = [
  {
    id: "readme",
    label: "README",
    kind: "note",
    status: "resolved",
    content:
      "Visitors can type on the machine. Contributors do not need Blender for ordinary web development. The demo turns typing into the way visitors enter its world.",
  },
];

test("the pinned Agent independently audits semantic claims before the draft reaches the creator", async () => {
  const outputs = [
    narrationOutput({ overview: "这是一个免费的打字世界。" }),
    narrationOutput({ overview: "这里从真正打出一个词开始。" }),
  ];
  const prompts = [];
  const progress = [];
  let calls = 0;
  const result = await completeNarration({
    project,
    sourceContext,
    creatorWritingGuidance: [],
    onProgress: (item) => progress.push(item),
    adapterFactory: () => ({
      completeJson: async ({ user }) => {
        prompts.push(user);
        return outputs[calls++];
      },
      getLastRunMetadata: () => ({ provider: "fake", attempt: calls }),
    }),
  });

  assert.equal(calls, 2);
  assert.equal(result.report.evidenceReviewCount, 1);
  assert.equal(result.report.evidenceReviewChangedDraft, true);
  assert.equal(result.report.validationRepairCount, 0);
  assert.equal(result.repairHistory.length, 0);
  assert.equal(result.auditInput.narration.overview, "这是一个免费的打字世界。");
  assert.match(prompts[1], /独立第二遍事实审核/);
  assert.match(prompts[1], /允许中英文翻译、同义改写/);
  assert.match(prompts[1], /这是一个免费的打字世界/);
  assert.ok(progress.some((item) => item.phase === "evidence-review"));
  assert.match(result.narration.fullScript, /普通网页开发不需要 Blender/);
});

test("narration validation exposes every rejected draft for immutable history after repairs are exhausted", async () => {
  let calls = 0;
  await assert.rejects(
    completeNarration({
      project,
      sourceContext,
      creatorWritingGuidance: [],
      validationRepairRounds: 2,
      adapterFactory: () => ({
        completeJson: async () => {
          calls += 1;
          return narrationOutput({ overview: "这里共有 12 个入口。" });
        },
        getLastRunMetadata: () => ({ provider: "fake", attempt: calls }),
      }),
    }),
    (error) => {
      assert.match(error.message, /2 次自动修复/);
      assert.equal(error.repairHistory.length, 3);
      assert.ok(error.repairHistory.every((item) => item.output.overview.includes("12")));
      return true;
    },
  );
  assert.equal(calls, 3);
});

test("perspective review rewrites source-observer language without changing walkthrough structure", async () => {
  const outputs = [
    narrationOutput({ overview: "这里从真正打出一个词开始。" }),
    narrationOutput({ overview: "从上传的录屏中可以看到，访客可以输入英文词。" }),
    narrationOutput({ overview: "打开页面，访客可以直接输入英文词。" }),
  ];
  let calls = 0;
  const prompts = [];
  const result = await completeNarration({
    project,
    sourceContext,
    creatorWritingGuidance: [],
    adapterFactory: () => ({
      completeJson: async ({ user }) => {
        prompts.push(user);
        return outputs[calls++];
      },
      getLastRunMetadata: () => ({ provider: "fake", attempt: calls }),
    }),
  });

  assert.equal(calls, 3);
  assert.equal(result.report.perspectiveReviewCount, 1);
  assert.equal(result.report.perspectiveReviewChangedDraft, true);
  assert.equal(result.report.perspectiveReviewFallback, false);
  assert.match(prompts[2], /允许并保留演示型叙事/);
  assert.match(result.narration.overview, /打开页面/);
  assert.equal(result.perspectiveAuditInput.narration.overview, "从上传的录屏中可以看到，访客可以输入英文词。");
});

test("perspective review failure falls back to the validated evidence draft without blocking narration", async () => {
  const stable = narrationOutput({ overview: "从上传的录屏中可以看到，访客可以输入英文词。" });
  let calls = 0;
  const adapterConfigs = [];
  const result = await completeNarration({
    project,
    sourceContext,
    creatorWritingGuidance: [],
    adapterFactory: ({ config }) => {
      adapterConfigs.push(config);
      return {
      completeJson: async () => {
        calls += 1;
        if (calls === 1) return narrationOutput({ overview: "这里从真正打出一个词开始。" });
        if (calls === 2) return stable;
        throw new Error("temporary style review failure");
      },
      getLastRunMetadata: () => ({ provider: "fake", attempt: calls }),
      };
    },
  });

  assert.equal(calls, 3);
  assert.equal(result.report.perspectiveReviewFallback, true);
  assert.match(result.report.perspectiveReviewFallbackReason, /temporary style review failure/);
  assert.equal(result.narration.overview, stable.overview);
  assert.equal(result.perspectiveAuditInput, null);
  assert.equal(adapterConfigs[1].timeoutSeconds, 90);
  assert.equal(adapterConfigs[1].maxRetries, 0);
});
