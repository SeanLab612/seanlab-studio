import assert from "node:assert/strict";
import test from "node:test";
import {
  generateVisualBriefFromDraft,
  parseVisualBriefDraft,
  selectVisualComponent,
  validateComponentProps,
  compactComponentProps,
  validateViewerFacingNarrative,
} from "../src/visual-brief/generator.ts";

test("selects ranking only for a shared metric with 3-8 entities", () => {
  assert.equal(
    selectVisualComponent({ rhetoric: "ranking", entityCount: 5, sharedMetric: true }, "production").id,
    "ranked-metric-list",
  );
  assert.equal(
    selectVisualComponent({ rhetoric: "ranking", entityCount: 2, sharedMetric: true }, "production").id,
    "distribution-bars",
  );
});

test("distinguishes strict process steps from unordered factors", () => {
  assert.equal(selectVisualComponent({ rhetoric: "process-steps", stepCount: 5 }, "production").id, "process-steps");
  assert.equal(
    selectVisualComponent({ rhetoric: "factor-sequence", factorCount: 4 }, "production").id,
    "factor-sequence",
  );
});

test("retired core positioning fails closed instead of being misread as a factor sequence", () => {
  assert.throws(
    () => selectVisualComponent({ rhetoric: "core-positioning", nodeCount: 4 }, "production"),
    /No approved component currently covers core-positioning/,
  );
});

test("selects time series before point-in-time comparison", () => {
  assert.equal(
    selectVisualComponent({ rhetoric: "comparison", entityCount: 5, hasTimeSeries: true }, "production").id,
    "market-cap-lines",
  );
});

test("validates dynamic component bounds", () => {
  assert.doesNotThrow(() => validateComponentProps("ranked-metric-list", { items: [{}, {}, {}, {}, {}] }));
  assert.throws(() => validateComponentProps("ranked-metric-list", { items: [{}, {}] }), /3-8 items/);
  assert.throws(() => validateComponentProps("binary-versus", { items: [{}, {}, {}] }), /2-2 items/);
});

test("binary-versus text capacity blocks the overflow seen in final delivery", () => {
  const overflow = {
    items: [
      {
        label: "更短路径",
        metric: "内容生成视觉、继续修改、最后导出",
        detail: "内容生成视觉、继续修改、最后导出，连成一条更短路径",
      },
      { label: "适合结构化内容", metric: "知识讲解、产品介绍、数据大字报、结构化内容" },
    ],
  };
  assert.throws(() => validateComponentProps("binary-versus", overflow), /component-text-overflow/);
  const compacted = compactComponentProps("binary-versus", overflow);
  assert.doesNotThrow(() => validateComponentProps("binary-versus", compacted));
});

test("blocks workflow metadata from viewer-facing copy", () => {
  assert.throws(
    () => validateViewerFacingNarrative({ eyebrow: "MVP", title: "标题", subtitleZh: "原文", subtitleEn: "Text" }),
    /production terminology/,
  );
  assert.doesNotThrow(() =>
    validateViewerFacingNarrative({
      eyebrow: "PROJECT",
      title: "Start from a template",
      subtitleZh: "仓库提供多种视频模板",
      subtitleEn: "Choose a product template before rendering",
    }),
  );
  assert.doesNotThrow(() =>
    validateViewerFacingNarrative({
      eyebrow: "MODEL STRUCTURE",
      title: "组件层级写入规格",
      subtitleZh: "每个组件都对应真实结构",
      subtitleEn: "Each component maps to a real structure.",
    }),
  );
  assert.throws(
    () =>
      validateViewerFacingNarrative({
        eyebrow: "WORKFLOW",
        title: "选择组件",
        subtitleZh: "使用组件完成画面",
        subtitleEn: "Choose a visual component",
      }),
    /production terminology/,
  );
  assert.doesNotThrow(() =>
    validateViewerFacingNarrative(
      {
        eyebrow: "RESOURCE LIBRARY",
        title: "19 个信息组件",
        subtitleZh: "可复用的信息组件",
        subtitleEn: "19 reusable information components",
      },
      "项目登记的视觉资源库包含十九个信息组件。",
    ),
  );
  assert.throws(
    () =>
      validateViewerFacingNarrative({
        eyebrow: "CONTENT-LED VISUALS",
        title: "不同内容采用不同呈现方式",
        subtitleZh: "根据口播证据选择画面",
        subtitleEn: "Use evidence-bound presentation",
      }),
    /production terminology/,
  );
  assert.doesNotThrow(() =>
    validateViewerFacingNarrative({
      eyebrow: "WORKFLOW",
      title: "Review each component",
      subtitleZh: "逐页检查并修改内容",
      subtitleEn: "Review and revise each page",
    }),
  );
  assert.doesNotThrow(() =>
    validateViewerFacingNarrative({
      eyebrow: "WORKFLOW",
      title: "审核后再生成",
      subtitleZh: "静态审核通过后再生成最终成片",
      subtitleEn: "Generate the final video after review",
    }),
  );
  assert.throws(
    () =>
      validateViewerFacingNarrative({
        eyebrow: "WORKFLOW",
        title: "内部审核帧",
        subtitleZh: "展示审核帧",
        subtitleEn: "Review frame",
      }),
    /production terminology/,
  );
});

test("media intent stores semantic identity only and never a file URL", () => {
  const draft = {
    analysis: {
      rhetoric: "person-evidence",
      entityCount: 1,
      mediaIntents: [{ kind: "person", entityId: "sam_altman", preferredVariant: "circle" }],
    },
    narrative: { eyebrow: "AI GOVERNANCE", title: "关键人物", subtitleZh: "政策讨论", subtitleEn: "Policy discussion" },
    props: { name: "Sam Altman", role: "OpenAI CEO" },
  };
  const brief = generateVisualBriefFromDraft(
    { id: "s1", start: 0, end: 8, text: "Sam Altman 参与了人工智能治理讨论。" },
    draft,
    "production",
  );
  assert.equal(brief.analysis.mediaIntents?.[0].entityId, "sam_altman");
  assert.throws(
    () =>
      parseVisualBriefDraft({
        ...draft,
        analysis: {
          ...draft.analysis,
          mediaIntents: [{ kind: "person", entityId: "sam_altman", url: "https://example.com/a.jpg" }],
        },
      }),
    /never a remote file or path/,
  );
});
