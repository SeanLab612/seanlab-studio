import assert from "node:assert/strict";
import test from "node:test";
import { animationStageLayout } from "../src/animation-system/layouts.ts";
import {
  animationPrototypeRegistry,
  applyAnimationStyleProfile,
  bindFrozenAnimationImageAssets,
  PAPER_EDITORIAL_STYLE,
  RESEARCH_ARCHIVE_STYLE,
  STOP_MOTION_MACHINE_STYLE,
  recommendAnimationIntent,
  recommendPrimaryVisualType,
  resolveLockedSectionAnimationTimeline,
  resolveLockedTextAnnotationTimeline,
  resolveLockedVisualBeatTimeline,
  resolvedAnimationCues,
  suppressCandidatesForPrimaryVisualIntervals,
  summarizeVisualCoverage,
  validateAnimationIntent,
} from "../src/visual-production/index.ts";

test("animation foundation exposes three approved styles and ten semantic prototypes", () => {
  assert.equal(PAPER_EDITORIAL_STYLE.id, "paper-editorial");
  assert.equal(PAPER_EDITORIAL_STYLE.speakerPip.preferredPosition, "top-right");
  assert.equal(STOP_MOTION_MACHINE_STYLE.id, "stop-motion-machine");
  assert.equal(STOP_MOTION_MACHINE_STYLE.speakerPip.preferredPosition, "top-right");
  assert.equal(RESEARCH_ARCHIVE_STYLE.id, "research-archive");
  assert.equal(RESEARCH_ARCHIVE_STYLE.speakerPip.preferredPosition, "top-right");
  assert.equal(Object.keys(animationPrototypeRegistry).length, 10);
  assert.ok(Object.values(animationPrototypeRegistry).every((item) => item.semanticStatus === "approved"));
  assert.ok(Object.values(animationPrototypeRegistry).every((item) => item.rendererStatus === "approved"));
  assert.ok(Object.values(animationPrototypeRegistry).every((item) => item.compatibleStyleIds.length >= 1));
  assert.ok(
    Object.values(animationPrototypeRegistry).every((item) => item.compatibleStyleIds.includes(item.defaultStyleId)),
  );
  const layouts = (Object.keys(animationPrototypeRegistry) as Array<keyof typeof animationPrototypeRegistry>).map(
    (prototypeId) => JSON.stringify(animationStageLayout(prototypeId, 4)),
  );
  assert.equal(new Set(layouts).size, 10);
});

test("coverage keeps five primary visual types mutually exclusive and reports PIP separately", () => {
  const report = summarizeVisualCoverage({
    durationSeconds: 20,
    intervals: [
      {
        id: "component",
        start: 2,
        end: 6,
        primaryVisualType: "component",
        takeover: "partial",
        speakerPresence: "full",
      },
      { id: "image", start: 7, end: 10, primaryVisualType: "image", takeover: "full", speakerPresence: "circle-pip" },
      {
        id: "screen",
        start: 11,
        end: 14,
        primaryVisualType: "screen-demo",
        takeover: "full",
        speakerPresence: "circle-pip",
      },
      {
        id: "animation",
        start: 15,
        end: 19,
        primaryVisualType: "animation",
        takeover: "full",
        speakerPresence: "circle-pip",
      },
    ],
  });
  assert.deepEqual(report.secondsByType, { speaker: 6, component: 4, image: 3, "screen-demo": 3, animation: 4 });
  assert.equal(report.componentCoverage, 0.2);
  assert.equal(report.realMaterialCoverage, 0.3);
  assert.equal(report.animationCoverage, 0.2);
  assert.equal(report.fullScreenTakeoverRatio, 0.5);
  assert.equal(report.speakerVisibleRatio, 0.8);
});

test("coverage rejects overlapping primary intervals", () => {
  assert.throws(
    () =>
      summarizeVisualCoverage({
        durationSeconds: 10,
        intervals: [
          { id: "one", start: 1, end: 5, primaryVisualType: "component", takeover: "partial", speakerPresence: "full" },
          {
            id: "two",
            start: 4,
            end: 8,
            primaryVisualType: "animation",
            takeover: "full",
            speakerPresence: "circle-pip",
          },
        ],
      }),
    /overlaps/,
  );
});

test("the local recommender promotes process narration to an automatic animation candidate", () => {
  const section = {
    id: "workflow",
    title: "制作流程",
    narration: "先写稿，再完成拍摄，最后生成交付文件。",
    visualOpportunities: [{ form: "ordered-progression", evidenceText: "先写稿，再完成拍摄，最后生成交付文件" }],
  };
  assert.equal(recommendPrimaryVisualType(section), "animation");
  assert.ok(section.visualOpportunities.some((item) => item.form === "ordered-progression"));
  const intent = recommendAnimationIntent(section);
  assert.equal(intent?.prototypeId, "process-flow");
  assert.equal(intent?.styleProfileId, "stop-motion-machine");
  assert.deepEqual(
    intent?.stages.map((stage) => stage.spokenQuote),
    ["先写稿", "完成拍摄", "生成交付文件"],
  );
});

test("animation direction stays primary when reusable image material is also present", () => {
  const section = {
    id: "workflow-with-image",
    title: "制作流程",
    narration: "先录音，再整理素材，最后完成动画。",
    visualIntent: "screenshot" as const,
    materialIds: ["legacy-library-image"],
    visualOpportunities: [{ form: "ordered-progression" as const, evidenceText: "先录音，再整理素材，最后完成动画" }],
  };
  assert.equal(recommendPrimaryVisualType(section), "animation");
});

test("authored animation stages preserve image asset bindings but reject runtime sources", () => {
  const intent = validateAnimationIntent(
    {
      prototypeId: "process-flow",
      styleProfileId: "paper-editorial",
      takeaway: "完成制作",
      stages: [
        {
          id: "stage-1",
          spokenQuote: "先录音",
          action: "输入",
          label: "录音机",
          imageAssetId: "generated-recorder-paper",
          imageAssetLabel: "录音机",
        },
        { id: "stage-2", spokenQuote: "再输出", action: "输出", label: "文件" },
      ],
    },
    "先录音，再输出",
  );
  assert.equal(intent.stages[0].imageAssetId, "generated-recorder-paper");
  assert.match(intent.stages[1].iconId ?? "", /^system\./);
  assert.throws(
    () =>
      validateAnimationIntent({
        ...intent,
        stages: [{ ...intent.stages[0], imageAssetSrc: "projects/example/asset.png" }, intent.stages[1]],
      }),
    /runtime image source/,
  );
});

test("frozen animation image assets become renderer sources while missing assets fail closed", () => {
  const cue = {
    id: "animation-1",
    sectionId: "section-1",
    startCue: 0,
    endCue: 1,
    start: 0,
    end: 2,
    primaryVisualType: "animation" as const,
    takeover: "full" as const,
    speakerPresence: "circle-pip" as const,
    styleProfileId: "paper-editorial" as const,
    animationIntent: {
      prototypeId: "process-flow" as const,
      styleProfileId: "paper-editorial" as const,
      takeaway: "完成制作",
      stages: [
        {
          id: "stage-1",
          spokenQuote: "先录音",
          action: "输入",
          label: "录音机",
          imageAssetId: "generated-recorder-paper",
        },
        { id: "stage-2", spokenQuote: "再输出", action: "输出", label: "文件", iconId: "system.document" as const },
      ],
    },
  };
  const [bound] = bindFrozenAnimationImageAssets(
    [cue],
    [
      {
        sourceLabel: "动画素材库 · generated-recorder-paper",
        publicSrc: "projects/demo/image-evidence/animation-recorder.png",
        description: "纸张录音机",
      },
    ],
  );
  assert.equal(bound.animationIntent.stages[0].imageAssetSrc, "projects/demo/image-evidence/animation-recorder.png");
  assert.equal(bound.animationIntent.stages[1].imageAssetSrc, undefined);
  assert.throws(() => bindFrozenAnimationImageAssets([cue], []), /no frozen public image asset/);
});

test("core-and-supports uses layered-system animation instead of a component", () => {
  const section = {
    id: "system",
    title: "核心与支撑",
    narration: "核心是稳定的视觉表达，同时需要语义规划、确定性渲染和人工审核。",
    visualOpportunities: [
      {
        form: "core-and-supports",
        evidenceText: "核心是稳定的视觉表达，同时需要语义规划、确定性渲染和人工审核",
      },
    ],
  };
  assert.equal(recommendPrimaryVisualType(section), "animation");
  const intent = recommendAnimationIntent(section);
  assert.equal(intent?.prototypeId, "layered-system");
  assert.equal(intent?.styleProfileId, "stop-motion-machine");
  assert.equal(
    recommendAnimationIntent(section, { styleProfileId: "paper-editorial" })?.styleProfileId,
    "paper-editorial",
  );
});

test("research archive semantics select four distinct structures from spoken evidence", () => {
  const cases = [
    {
      expected: "aggregate-decompose",
      title: "五类内容组成完整视频",
      narration: "口播、字幕、组件、动画和录屏，会组合成一条完整视频。",
      form: "progressive-explanation",
    },
    {
      expected: "focus-zoom",
      title: "从全局看关键细节",
      narration: "从整体工作流来看，真正关键的细节是语义匹配，然后再回到全局。",
      form: "core-and-supports",
    },
    {
      expected: "threshold-landing",
      title: "实际结果是否达到目标",
      narration: "我们的目标是转化率达到百分之十，实际结果是百分之十二，最终超过了标准。",
      form: "number-focus",
    },
    {
      expected: "converge-diffuse",
      title: "多条线索汇成结论",
      narration: "产品增长、服务提升和海外扩张这多个方面，共同推动营收提升，最终形成同一个结论。",
      form: "cause-to-result",
    },
  ] as const;
  for (const item of cases) {
    const section = {
      id: item.expected,
      title: item.title,
      narration: item.narration,
      visualOpportunities: [{ form: item.form, evidenceText: item.narration.replace(/。$/, "") }],
    };
    const intent = recommendAnimationIntent(section);
    assert.equal(intent?.prototypeId, item.expected);
    assert.equal(intent?.styleProfileId, "research-archive");
    assert.equal(recommendPrimaryVisualType(section), "animation");
  }
});

test("text emphasis remains eligible as the approved rough-annotation primary component", () => {
  assert.equal(
    recommendPrimaryVisualType({
      id: "emphasis",
      narration: "真正重要的是相关和准确。",
      visualOpportunities: [{ form: "text-emphasis", evidenceText: "相关和准确" }],
    }),
    "component",
  );
});

test("a locked section animation resolves as the primary interval and suppresses a generated component", () => {
  const animationIntent = {
    prototypeId: "process-flow" as const,
    styleProfileId: "paper-editorial" as const,
    takeaway: "写稿后锁稿",
    stages: [
      { id: "draft", spokenQuote: "先写稿", action: "start", label: "写稿" },
      { id: "lock", spokenQuote: "再锁稿", action: "finish", label: "锁稿" },
    ],
  };
  const intervals = resolveLockedSectionAnimationTimeline({
    plan: {
      sections: [
        {
          sectionId: "workflow",
          mode: "animation",
          anchorText: "先写稿",
          endAnchorText: "再锁稿",
          animationIntent,
        },
      ],
    },
    captions: [
      { start: 1, end: 2, zh: "先写稿，" },
      { start: 2, end: 3, zh: "再锁稿。" },
    ],
  });
  assert.equal(intervals[0].primaryVisualType, "animation");
  assert.equal(intervals[0].start, 1);
  const candidates = suppressCandidatesForPrimaryVisualIntervals(
    [{ start: 1.2, end: 2.8, materializationStatus: "planned", overlayCue: { id: "component" } }],
    intervals,
  );
  assert.equal(candidates[0].materializationStatus, "skipped");
});

test("text annotations resolve independently and do not reserve the primary visual interval", () => {
  const annotations = resolveLockedTextAnnotationTimeline({
    plan: {
      finalScriptSha256: "locked",
      annotations: [
        {
          id: "seanlab-name",
          sectionId: "intro",
          exactSpokenQuote: "SeanLab Video",
          status: "confirmed",
          effect: "circle",
          finalScriptSha256: "locked",
        },
      ],
    },
    captions: [
      { start: 0, end: 1.2, zh: "我叫 Sean。" },
      { start: 1.2, end: 2.8, zh: "SeanLab Video 是我的项目。" },
    ],
  });
  assert.deepEqual(
    annotations.map(({ start, end, effect }) => ({ start, end, effect })),
    [{ start: 1.2, end: 2.8, effect: "circle" }],
  );
  const component = [{ start: 1, end: 3, materializationStatus: "planned", overlayCue: { id: "person-card" } }];
  assert.deepEqual(component[0].materializationStatus, "planned");
});

test("locked text annotations reject stale final-script bindings", () => {
  assert.throws(
    () =>
      resolveLockedTextAnnotationTimeline({
        plan: {
          finalScriptSha256: "new-script",
          annotations: [
            {
              id: "stale-annotation",
              sectionId: "intro",
              exactSpokenQuote: "重点文字",
              status: "confirmed",
              effect: "underline",
              finalScriptSha256: "old-script",
            },
          ],
        },
        captions: [{ start: 0, end: 1, zh: "重点文字。" }],
      }),
    /hash binding is stale/,
  );
});

test("confirmed beats resolve against semantic captions and reserve the interval from components", () => {
  const animationIntent = {
    prototypeId: "process-flow" as const,
    styleProfileId: "paper-editorial" as const,
    stages: [
      { id: "stage-1", spokenQuote: "先写稿", action: "introduce", label: "写稿" },
      { id: "stage-2", spokenQuote: "再锁稿", action: "resolve", label: "锁稿" },
    ],
    takeaway: "先写稿，再锁稿",
  };
  const intervals = resolveLockedVisualBeatTimeline({
    plan: {
      finalScriptSha256: "locked-script",
      beats: [
        {
          id: "workflow-animation",
          sectionId: "section-1",
          exactSpokenQuote: "先写稿，再锁稿。",
          status: "confirmed",
          primaryVisualType: "animation",
          takeover: "full",
          speakerPresence: "circle-pip",
          animationIntent,
          finalScriptSha256: "locked-script",
        },
      ],
    },
    captions: [
      { start: 2, end: 3.2, zh: "先写稿，" },
      { start: 3.2, end: 4.6, zh: "再锁稿。" },
    ],
  });
  assert.deepEqual(
    intervals.map(({ start, end }) => ({ start, end })),
    [{ start: 2, end: 4.6 }],
  );
  assert.equal(resolvedAnimationCues(intervals)[0].styleProfileId, "paper-editorial");
  const stopMotionCues = applyAnimationStyleProfile(resolvedAnimationCues(intervals), "stop-motion-machine");
  assert.equal(stopMotionCues[0].styleProfileId, "stop-motion-machine");
  assert.equal(stopMotionCues[0].animationIntent.styleProfileId, "stop-motion-machine");
  const candidates = suppressCandidatesForPrimaryVisualIntervals(
    [{ start: 2.5, end: 4, materializationStatus: "planned", overlayCue: { id: "component" } }],
    intervals,
  );
  assert.equal(candidates[0].materializationStatus, "skipped");
  assert.equal(candidates[0].overlayCue, undefined);
  assert.match(candidates[0].materializationReason ?? "", /reserves this interval for animation/);
});

test("animation style changes fail closed when a renderer does not support the semantic structure", () => {
  assert.throws(
    () =>
      applyAnimationStyleProfile(
        [
          {
            id: "research-only",
            sectionId: "section",
            start: 0,
            end: 4,
            startCue: 0,
            endCue: 1,
            primaryVisualType: "animation",
            takeover: "full",
            speakerPresence: "circle-pip",
            styleProfileId: "research-archive",
            animationIntent: {
              prototypeId: "focus-zoom",
              styleProfileId: "research-archive",
              takeaway: "聚焦关键细节",
              stages: [
                { id: "whole", spokenQuote: "先看整体", action: "观察全局", label: "整体" },
                { id: "detail", spokenQuote: "再看细节", action: "聚焦细节", label: "细节" },
              ],
            },
          },
        ],
        "paper-editorial",
      ),
    /incompatible/,
  );
});

test("locked visual beats reject stale final-script bindings", () => {
  assert.throws(
    () =>
      resolveLockedVisualBeatTimeline({
        plan: {
          finalScriptSha256: "new-script",
          beats: [
            {
              id: "stale-beat",
              sectionId: "section-1",
              exactSpokenQuote: "精确原句。",
              status: "confirmed",
              primaryVisualType: "speaker",
              takeover: "none",
              speakerPresence: "full",
              finalScriptSha256: "old-script",
            },
          ],
        },
        captions: [{ start: 0, end: 1, zh: "精确原句。" }],
      }),
    /hash binding is stale/,
  );
});

test("repeated exact spoken anchors resolve the creator-confirmed occurrence", () => {
  const intervals = resolveLockedVisualBeatTimeline({
    plan: {
      finalScriptSha256: "locked",
      beats: [
        {
          id: "second-occurrence",
          sectionId: "section-1",
          exactSpokenQuote: "再确认一次。",
          quoteOccurrence: 2,
          status: "confirmed",
          primaryVisualType: "speaker",
          takeover: "none",
          speakerPresence: "full",
          finalScriptSha256: "locked",
        },
      ],
    },
    captions: [
      { start: 0, end: 1, zh: "再确认一次。" },
      { start: 1, end: 2, zh: "中间说明。" },
      { start: 2, end: 3, zh: "再确认一次。" },
    ],
  });
  assert.equal(intervals[0].start, 2);
  assert.equal(intervals[0].end, 3);
});

test("an image beat suppresses component candidates because the image renders as its own primary layer", () => {
  const candidates = suppressCandidatesForPrimaryVisualIntervals(
    [
      {
        start: 4,
        end: 7,
        materializationStatus: "planned",
        creatorConstraint: { visualBeatId: "image-beat" },
      },
      { start: 4.5, end: 6, materializationStatus: "planned" },
    ],
    [
      {
        id: "image-beat",
        start: 4,
        end: 7,
        primaryVisualType: "image",
        takeover: "full",
        speakerPresence: "circle-pip",
      },
    ],
  );
  assert.equal(candidates[0].materializationStatus, "skipped");
  assert.equal(candidates[1].materializationStatus, "skipped");
});

test("a component beat keeps only its exact owner and suppresses the overlapping default component", () => {
  const candidates = suppressCandidatesForPrimaryVisualIntervals(
    [
      {
        start: 4,
        end: 5.5,
        materializationStatus: "planned",
        creatorConstraint: { visualBeatId: "component-beat" },
      },
      { start: 3, end: 7, materializationStatus: "planned", overlayCue: { id: "default-component" } },
      { start: 7, end: 9, materializationStatus: "planned", overlayCue: { id: "following-component" } },
    ],
    [
      {
        id: "component-beat",
        start: 4,
        end: 5.5,
        primaryVisualType: "component",
        takeover: "partial",
        speakerPresence: "full",
      },
    ],
  );
  assert.equal(candidates[0].materializationStatus, "planned");
  assert.equal(candidates[1].materializationStatus, "skipped");
  assert.equal(candidates[1].overlayCue, undefined);
  assert.equal(candidates[2].materializationStatus, "planned");
});
