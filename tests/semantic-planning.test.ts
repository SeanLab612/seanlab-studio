import assert from "node:assert/strict";
import test from "node:test";
import {
  assertRequiredImageEvidenceCoverage,
  boundImageEvidenceIntentToCaptions,
  boundSemanticIntentItems,
  effectForRoughAnnotationIntent,
  evaluateRequiredImageEvidenceCoverage,
  materializeSemanticIntent,
  normalizeSemanticItemOrder,
  normalizeRoutingIntent,
  parseSemanticNarrativePlan,
  resolveLocalRoughAnnotationPlan,
  resolveSpeakerRoughAnnotationPlan,
  type SemanticNarrativeSegment,
  semanticDensityRepairInstruction,
  semanticValidationRepairInstruction,
  semanticEvidenceStartSeconds,
  splitSemanticRange,
  splitSemanticRelationshipRange,
  withConfirmedComparisonItems,
} from "../src/semantic-planning/index.ts";

const emptyItem = {
  label: "",
  detail: "",
  value: null,
  displayValue: "",
  unit: "",
  timeLabel: "",
  entityId: "",
  entityKind: "none" as const,
  x: null,
  y: null,
  startCue: 0,
  endCue: 0,
};

const intent = (patch: Partial<SemanticNarrativeSegment>): SemanticNarrativeSegment => ({
  startCue: 0,
  endCue: 1,
  visualPriority: "high",
  rhetoric: "comparison",
  motionIntent: "compare",
  reason: "Two explicit alternatives are contrasted.",
  confidence: 0.9,
  narrative: {
    eyebrow: "AI PLATFORM",
    title: "平台取舍",
    subtitleZh: "根据任务边界选择工具",
    subtitleEn: "Choose tools by task boundaries",
    takeaway: "先理解任务，再选择工具",
  },
  items: [],
  timeSeries: [],
  matrix: { rows: [], columns: [], values: [], xLabel: "", yLabel: "" },
  quote: { text: "", sourceName: "", sourceRole: "" },
  mediaIntents: [],
  imageEvidence: null,
  ...patch,
});

const segment = { id: "segment-1", start: 0, end: 12, text: "完整语义段落。" };

test("global semantic plan rejects overlapping or reordered caption ranges", () => {
  assert.throws(
    () =>
      parseSemanticNarrativePlan(
        {
          schemaVersion: "1.0",
          analyzedThroughCue: 4,
          segments: [intent({ startCue: 1, endCue: 3 }), intent({ startCue: 3, endCue: 4 })],
        },
        Array.from({ length: 5 }, (_, index) => ({ start: index, end: index + 0.8 })),
      ),
    /overlaps or reorders/,
  );
});

test("production Agent must decide every reference beat and reach the configured visual coverage", () => {
  const captions = Array.from({ length: 10 }, (_, index) => ({
    start: index,
    end: index + 1,
    zh: index === 8 ? "最后展示录屏结果。" : `第${index + 1}步继续解释。`,
  }));
  const referenceBeats = [{ id: "screen-result", exactSpokenQuote: "最后展示录屏结果。" }];
  const base = {
    schemaVersion: "1.0",
    analyzedThroughCue: 9,
    visualDecisions: [{ beatId: "screen-result", action: "use", reason: "录屏直接证明运行结果" }],
    segments: [intent({ startCue: 0, endCue: 7 })],
  };
  assert.doesNotThrow(() => parseSemanticNarrativePlan(base, captions, 30, referenceBeats, 0.8));
  assert.throws(
    () => parseSemanticNarrativePlan({ ...base, visualDecisions: [] }, captions, 30, referenceBeats, 0.8),
    /missing reference beats/,
  );
  assert.throws(
    () =>
      parseSemanticNarrativePlan(
        { ...base, segments: [intent({ startCue: 0, endCue: 3 })] },
        captions,
        30,
        referenceBeats,
        0.8,
      ),
    /visual coverage/,
  );
});

test("animation remains auxiliary while component-led segments may cover the rest", () => {
  const captions = Array.from({ length: 10 }, (_, index) => ({
    start: index,
    end: index + 1,
    zh: index < 3 ? `动画阶段${index + 1}` : `组件说明${index + 1}`,
  }));
  const animationSegment = intent({
    startCue: 0,
    endCue: 2,
    animationIntent: {
      prototypeId: "causal-chain",
      styleProfileId: "paper-editorial",
      stages: [
        { label: "起点", detail: "第一步", spokenQuote: "动画阶段1" },
        { label: "结果", detail: "第三步", spokenQuote: "动画阶段3" },
      ],
      takeaway: "只展示必要变化",
    },
  });
  const plan = {
    schemaVersion: "1.0",
    analyzedThroughCue: 9,
    visualDecisions: [],
    materialAssignments: [],
    segments: [animationSegment, intent({ startCue: 3, endCue: 9 })],
  };
  assert.throws(
    () => parseSemanticNarrativePlan(plan, captions, 30, [], 0, new Set(), new Set(), 0.25),
    /animation coverage 30\.0% exceeds the auxiliary limit 25\.0%/,
  );
  assert.doesNotThrow(() => parseSemanticNarrativePlan(plan, captions, 30, [], 0, new Set(), new Set(), 0.3));
});

test("production Agent cannot reject a creator-registered recording as unavailable", () => {
  const captions = [{ start: 0, end: 4, zh: "录屏可以看到模型在浏览器里旋转。" }];
  const referenceBeats = [
    {
      id: "screen-result",
      exactSpokenQuote: "录屏可以看到模型在浏览器里旋转。",
      materialAssetIds: ["recording-1"],
    },
  ];
  assert.throws(
    () =>
      parseSemanticNarrativePlan(
        {
          schemaVersion: "1.0",
          analyzedThroughCue: 0,
          visualDecisions: [{ beatId: "screen-result", action: "skip", reason: "素材不在图片清单中，因此未登记。" }],
          segments: [intent({ startCue: 0, endCue: 0 })],
        },
        captions,
        30,
        referenceBeats,
        0,
        new Set(["recording-1"]),
      ),
    /incorrectly treats an available referenced material as missing/,
  );
});

test("production Agent must place every required material on an evidence-bounded timeline", () => {
  const captions = Array.from({ length: 6 }, (_, index) => ({
    start: index * 2,
    end: index * 2 + 2,
    zh: `素材证据${index + 1}`,
  }));
  const base = {
    schemaVersion: "1.0",
    analyzedThroughCue: 5,
    visualDecisions: [],
    segments: [intent({ startCue: 0, endCue: 1 })],
  };
  const available = new Set(["screenshot-1", "recording-1"]);
  const required = new Set(["screenshot-1", "recording-1"]);
  assert.throws(
    () => parseSemanticNarrativePlan(base, captions, 30, [], 0, available, required),
    /materialAssignments must be an array/,
  );
  const materialAssignments = [
    {
      assetId: "screenshot-1",
      kind: "image",
      startCue: 2,
      endCue: 3,
      order: 1,
      reason: "截图对应这段说明",
    },
    {
      assetId: "recording-1",
      kind: "screen-demo",
      startCue: 4,
      endCue: 5,
      order: 2,
      reason: "录屏对应操作结果",
    },
  ];
  assert.doesNotThrow(() =>
    parseSemanticNarrativePlan({ ...base, materialAssignments }, captions, 30, [], 0.8, available, required),
  );
  assert.throws(
    () =>
      parseSemanticNarrativePlan(
        { ...base, materialAssignments: materialAssignments.slice(0, 1) },
        captions,
        30,
        [],
        0,
        available,
        required,
      ),
    /missing required materials: recording-1/,
  );
});

test("material sequencing rejects ambiguous overlaps and animation collisions", () => {
  const captions = Array.from({ length: 6 }, (_, index) => ({
    start: index,
    end: index + 1,
    zh: index < 3 ? "第一段素材说明" : "第二段动画说明",
  }));
  const assignments = [
    { assetId: "image-1", kind: "image", startCue: 0, endCue: 2, order: 1, reason: "展示图片" },
    { assetId: "recording-1", kind: "screen-demo", startCue: 2, endCue: 3, order: 2, reason: "展示录屏" },
  ];
  assert.throws(
    () =>
      parseSemanticNarrativePlan(
        {
          schemaVersion: "1.0",
          analyzedThroughCue: 5,
          visualDecisions: [],
          materialAssignments: assignments,
          segments: [intent({ startCue: 4, endCue: 5 })],
        },
        captions,
        30,
        [],
        0,
        new Set(["image-1", "recording-1"]),
        new Set(["image-1", "recording-1"]),
      ),
    /overlapping materialAssignments/,
  );
  assert.throws(
    () =>
      parseSemanticNarrativePlan(
        {
          schemaVersion: "1.0",
          analyzedThroughCue: 5,
          visualDecisions: [],
          materialAssignments: [assignments[0]],
          segments: [
            intent({
              startCue: 1,
              endCue: 3,
              animationIntent: {
                prototypeId: "causal-chain",
                styleProfileId: "paper-editorial",
                stages: [
                  { label: "素材", detail: "第一段", spokenQuote: "第一段素材说明" },
                  { label: "动画", detail: "第二段", spokenQuote: "第二段动画说明" },
                ],
                takeaway: "素材与动画不能抢占同一时段",
              },
            }),
          ],
        },
        captions,
        30,
        [],
        0,
        new Set(["image-1"]),
        new Set(["image-1"]),
      ),
    /animation overlaps a required material assignment/,
  );
});

test("global semantic plan rejects a chapter-sized range even when the JSON schema accepts it", () => {
  assert.throws(
    () =>
      parseSemanticNarrativePlan(
        {
          schemaVersion: "1.0",
          analyzedThroughCue: 11,
          segments: [intent({ startCue: 0, endCue: 11 })],
        },
        Array.from({ length: 12 }, (_, index) => ({ start: index * 3.1, end: index * 3.1 + 2.3 })),
      ),
    /semantic density limit/,
  );
});

test("global semantic plan rejects item evidence outside its parent segment", () => {
  assert.throws(
    () =>
      parseSemanticNarrativePlan(
        {
          schemaVersion: "1.0",
          analyzedThroughCue: 2,
          segments: [
            intent({
              startCue: 1,
              endCue: 2,
              items: [{ ...emptyItem, label: "第二项", startCue: 0, endCue: 1 }],
            }),
          ],
        },
        Array.from({ length: 3 }, (_, index) => ({ start: index, end: index + 0.8 })),
      ),
    /item.*evidence is outside/i,
  );
});

test("normalizes fully bounded semantic items into spoken evidence order", () => {
  const plan = {
    schemaVersion: "1.0",
    analyzedThroughCue: 2,
    segments: [
      intent({
        startCue: 0,
        endCue: 2,
        items: [
          { ...emptyItem, label: "后说", startCue: 2, endCue: 2 },
          { ...emptyItem, label: "先说", startCue: 0, endCue: 1 },
        ],
      }),
    ],
  };
  const normalized = normalizeSemanticItemOrder(plan) as typeof plan;
  assert.deepEqual(
    normalized.segments[0].items.map((item) => item.label),
    ["先说", "后说"],
  );
  assert.deepEqual(
    plan.segments[0].items.map((item) => item.label),
    ["后说", "先说"],
  );
});

test("global semantic plan lets the downstream Agent choose one dominant relationship for mixed source wording", () => {
  const result = parseSemanticNarrativePlan(
    {
      schemaVersion: "1.0",
      analyzedThroughCue: 2,
      segments: [intent({ startCue: 0, endCue: 2, rhetoric: "factor-sequence" })],
    },
    [
      { start: 0, end: 2, zh: "先写稿，再拍摄，然后进入制作流程。" },
      { start: 2, end: 4, zh: "比如两种做法各有优缺点，可以左右对比。" },
      { start: 4, end: 6, zh: "最后逐项检查是不是自然。" },
    ],
  );
  assert.equal(result.segments[0].rhetoric, "factor-sequence");
});

test("semantic relationship validation does not treat 比较慢 as a comparison", () => {
  const result = parseSemanticNarrativePlan(
    {
      schemaVersion: "1.0",
      analyzedThroughCue: 0,
      segments: [
        intent({
          startCue: 0,
          endCue: 0,
          rhetoric: "factor-sequence",
          items: [{ ...emptyItem, label: "制作速度", detail: "可能显得比较慢" }],
        }),
      ],
    },
    [{ start: 0, end: 2.4, zh: "这套流程可能会显得比较慢。" }],
  );
  assert.equal(result.segments.length, 1);
});

test("semantic density repair proposes exact bounded caption ranges", () => {
  const captions = Array.from({ length: 11 }, (_, index) => ({ start: index * 3.2, end: index * 3.2 + 2.6 }));
  assert.deepEqual(splitSemanticRange({ startCue: 0, endCue: 10, captions, maximumCues: 8, maximumSeconds: 24 }), [
    { startCue: 0, endCue: 6 },
    { startCue: 7, endCue: 10 },
  ]);
  const instruction = semanticDensityRepairInstruction({ segments: [{ startCue: 0, endCue: 10 }] }, captions, 24);
  assert.match(instruction, /Replace segments\[0\]/);
  assert.match(instruction, /exactly these inclusive cue ranges: 0-6, 7-10/);
  assert.match(instruction, /based only on captions inside that range/);
});

test("semantic relationship repair proposes evidence-bounded ranges without fixture-specific cue numbers", () => {
  const captions = [
    { start: 0, end: 2, zh: "先上传图片，再完成模型生成。" },
    { start: 2, end: 4, zh: "中间这句补充产品背景。" },
    { start: 4, end: 6, zh: "左右两边可以对比原图与三维结果。" },
    { start: 6, end: 8, zh: "最后逐项检查是不是完整。" },
  ];
  assert.deepEqual(splitSemanticRelationshipRange({ startCue: 0, endCue: 3, captions }), [
    { startCue: 0, endCue: 1 },
    { startCue: 2, endCue: 2 },
    { startCue: 3, endCue: 3 },
  ]);
  const instruction = semanticValidationRepairInstruction({ segments: [{ startCue: 0, endCue: 3 }] }, captions, 24, {
    kind: "mixed-visual-relations",
    segmentIndex: 0,
    startCue: 0,
    endCue: 3,
    relations: ["process", "comparison", "checklist"],
    message: "mixed",
  });
  assert.match(instruction, /exactly these inclusive cue ranges: 0-1, 2-2, 3-3/);
  assert.match(instruction, /only one visual relationship/);
});

test("semantic relationship repair does not invent a split inside one atomic caption cue", () => {
  const captions = [{ start: 0, end: 3, zh: "先生成，再把两种做法左右对比。" }];
  assert.deepEqual(splitSemanticRelationshipRange({ startCue: 0, endCue: 0, captions }), []);
  const instruction = semanticValidationRepairInstruction({ segments: [{ startCue: 0, endCue: 0 }] }, captions, 24, {
    kind: "mixed-visual-relations",
    segmentIndex: 0,
    startCue: 0,
    endCue: 0,
    relations: ["process", "comparison"],
    message: "mixed",
  });
  assert.match(instruction, /single caption cue is atomic/i);
  assert.match(instruction, /choose the one most directly supported/i);
});

test("semantic relationship repair detects a process relationship spanning caption boundaries", () => {
  const captions = [
    { start: 0, end: 2, zh: "生成代码之前先把物体看清楚，" },
    { start: 2, end: 4, zh: "写成规格，再把建模拆成八个阶段，" },
    { start: 4, end: 6, zh: "每走一步都渲染对照复核，" },
    { start: 6, end: 8, zh: "不匹配就回去修改。" },
  ];
  assert.deepEqual(splitSemanticRelationshipRange({ startCue: 0, endCue: 3, captions }), [
    { startCue: 0, endCue: 1 },
    { startCue: 2, endCue: 3 },
  ]);
});

test("materializer refuses an empty capability matrix instead of rendering placeholders", () => {
  const result = materializeSemanticIntent(
    segment,
    intent({
      rhetoric: "capability-surface",
      items: [],
      matrix: { rows: ["Ollama", "ChatGPT"], columns: ["本地", "协作"], values: [], xLabel: "", yLabel: "" },
    }),
  );
  assert.equal(result.status, "skipped");
  if (result.status === "skipped") assert.match(result.reason, /complete.*matrix/i);
});

test("materializer accepts an evidence-ordered progression timeline without invented dates", () => {
  const result = materializeSemanticIntent(
    segment,
    intent({
      rhetoric: "historical-timeline",
      motionIntent: "progress",
      items: [
        { ...emptyItem, label: "写稿", detail: "确定口播内容", startCue: 0, endCue: 0 },
        { ...emptyItem, label: "拍摄", detail: "录制真人原片", startCue: 0, endCue: 0 },
        { ...emptyItem, label: "制作", detail: "融合画面效果", startCue: 1, endCue: 1 },
        { ...emptyItem, label: "交付", detail: "输出最终成片", startCue: 1, endCue: 1 },
      ],
    }),
  );
  assert.equal(result.status, "planned");
  if (result.status === "planned") {
    assert.equal(result.brief.component.id, "historical-timeline");
    assert.equal(result.brief.props.mode, "progression");
    assert.deepEqual(
      (result.brief.props.items as Array<{ marker: string }>).map((item) => item.marker),
      ["01", "02", "03", "04"],
    );
  }
});

test("materializer accepts explicit high-low bands for a qualitative decision matrix", () => {
  const result = materializeSemanticIntent(
    segment,
    intent({
      rhetoric: "decision-matrix",
      matrix: { rows: [], columns: [], values: [], xLabel: "实施难度", yLabel: "业务价值" },
      items: [
        { ...emptyItem, label: "方案 A", detail: "低难度、高价值", xBand: "low", yBand: "high" },
        { ...emptyItem, label: "方案 B", detail: "高难度、低价值", xBand: "high", yBand: "low" },
      ],
    }),
  );
  assert.equal(result.status, "planned");
  if (result.status === "planned") {
    assert.equal(result.brief.component.id, "decision-matrix");
    assert.equal(result.brief.props.mode, "qualitative");
    assert.deepEqual(
      (result.brief.props.points as Array<{ x: number | null; xBand?: string }>).map(({ x, xBand }) => ({
        x,
        xBand,
      })),
      [
        { x: null, xBand: "low" },
        { x: null, xBand: "high" },
      ],
    );
  }
});

test("materializer accepts a complete qualitative capability matrix", () => {
  const result = materializeSemanticIntent(
    segment,
    intent({
      rhetoric: "capability-surface",
      matrix: {
        rows: ["本地方案", "云端方案"],
        columns: ["数据可控", "部署速度"],
        values: [],
        states: [
          ["支持", "部分支持"],
          ["部分支持", "支持"],
        ],
        xLabel: "",
        yLabel: "",
      },
    }),
  );
  assert.equal(result.status, "planned");
  if (result.status === "planned") {
    assert.equal(result.brief.component.id, "capability-surface-grid");
    assert.equal(result.brief.props.mode, "qualitative");
    assert.deepEqual(result.brief.props.states, [
      ["支持", "部分支持"],
      ["部分支持", "支持"],
    ]);
  }
});

test("materializer accepts explicit directional tradeoffs without scale values", () => {
  const result = materializeSemanticIntent(
    segment,
    intent({
      rhetoric: "tradeoff",
      items: [
        { ...emptyItem, label: "制作速度", detail: "制作更快", displayValue: "更快", direction: "up" },
        { ...emptyItem, label: "调整空间", detail: "调整空间更少", displayValue: "更少", direction: "down" },
      ],
    }),
  );
  assert.equal(result.status, "planned");
  if (result.status === "planned") {
    assert.equal(result.brief.component.id, "tradeoff-scale");
    assert.equal(result.brief.props.mode, "directional");
    assert.deepEqual(
      (result.brief.props.items as Array<{ value: number | null; direction?: string }>).map(({ value, direction }) => ({
        value,
        direction,
      })),
      [
        { value: null, direction: "up" },
        { value: null, direction: "down" },
      ],
    );
  }
});

test("qualitative modes remain fail-closed when explicit states are incomplete", () => {
  const incompleteMatrix = materializeSemanticIntent(
    segment,
    intent({
      rhetoric: "capability-surface",
      matrix: {
        rows: ["本地方案", "云端方案"],
        columns: ["数据可控", "部署速度"],
        values: [],
        states: [["支持"], ["部分支持", "支持"]],
        xLabel: "",
        yLabel: "",
      },
    }),
  );
  assert.equal(incompleteMatrix.status, "skipped");

  const inferredTradeoff = materializeSemanticIntent(
    segment,
    intent({
      rhetoric: "tradeoff",
      items: [
        { ...emptyItem, label: "制作速度", detail: "速度可能变化" },
        { ...emptyItem, label: "调整空间", detail: "调整空间可能变化" },
      ],
    }),
  );
  assert.equal(inferredTradeoff.status, "skipped");
});

test("materializer deterministically fills legacy blank narrative fields without inventing facts", () => {
  const result = materializeSemanticIntent(
    segment,
    intent({
      rhetoric: "comparison",
      items: [
        { ...emptyItem, label: "以前", detail: "反复寻找画面" },
        { ...emptyItem, label: "现在", detail: "先理解再审核" },
      ],
      narrative: {
        eyebrow: "",
        title: "两种制作方式",
        subtitleZh: "",
        subtitleEn: "",
        takeaway: "先理解内容，再安排画面",
      },
    }),
  );
  assert.equal(result.status, "planned");
  if (result.status === "planned") {
    assert.equal(result.brief.narrative.eyebrow, "COMPARISON");
    assert.equal(result.brief.narrative.subtitleZh, "先理解内容，再安排画面");
    assert.equal(result.brief.narrative.subtitleEn, "COMPARISON");
  }
});

test("materializer deterministically fills legacy blank item details from their evidence labels", () => {
  const result = materializeSemanticIntent(
    segment,
    intent({
      rhetoric: "process-steps",
      items: [
        { ...emptyItem, label: "写稿", detail: "" },
        { ...emptyItem, label: "拍摄", detail: "" },
        { ...emptyItem, label: "审核", detail: "" },
      ],
    }),
  );
  assert.equal(result.status, "planned");
  if (result.status === "planned") {
    const items = result.brief.props.items as Array<{ title: string; detail: string }>;
    assert.deepEqual(
      items.map((item) => item.detail),
      ["写稿", "拍摄", "审核"],
    );
  }
});

test("key statistics retain explicit values when one approximate ASR item has no numeric value", () => {
  const result = materializeSemanticIntent(
    segment,
    intent({
      rhetoric: "key-stat",
      items: [
        { ...emptyItem, label: "生产画面", detail: "几十种", displayValue: "几十种" },
        { ...emptyItem, label: "图表表达", detail: "10种", value: 10, displayValue: "10种" },
        { ...emptyItem, label: "制作步骤", detail: "6步", value: 6, displayValue: "6步" },
      ],
    }),
  );
  assert.equal(result.status, "planned");
  if (result.status === "planned") {
    const items = result.brief.props.items as Array<{ value: string }>;
    assert.deepEqual(
      items.map((item) => item.value),
      ["10种", "6步"],
    );
  }
});

test("materializer creates renderer-ready time series only from complete explicit points", () => {
  const result = materializeSemanticIntent(
    segment,
    intent({
      rhetoric: "trend",
      motionIntent: "progress",
      timeSeries: [
        {
          name: "云端",
          valueLabel: "46%",
          points: [
            { timeLabel: "2024", value: 58 },
            { timeLabel: "2026", value: 46 },
          ],
        },
        {
          name: "本地",
          valueLabel: "48%",
          points: [
            { timeLabel: "2024", value: 20 },
            { timeLabel: "2026", value: 48 },
          ],
        },
      ],
    }),
  );
  assert.equal(result.status, "planned");
  if (result.status === "planned") {
    assert.equal(result.brief.component.id, "market-cap-lines");
    assert.deepEqual((result.brief.props.series as Array<{ points: number[] }>)[0].points, [58, 46]);
  }
});

test("ordered materialization derives an evidence-timed active item timeline", () => {
  const captions = [
    { start: 0, end: 2.5, zh: "先写稿" },
    { start: 2.5, end: 5, zh: "再拍摄" },
    { start: 5, end: 7.5, zh: "稍作说明" },
    { start: 7.5, end: 10, zh: "最后审核" },
  ];
  const orderedIntent = intent({
    startCue: 0,
    endCue: 3,
    rhetoric: "process-steps",
    motionIntent: "progress",
    items: [
      { ...emptyItem, label: "写稿", detail: "先确定内容", startCue: 0, endCue: 0 },
      { ...emptyItem, label: "拍摄", detail: "录制原片", startCue: 1, endCue: 1 },
      { ...emptyItem, label: "审核", detail: "检查结果", startCue: 3, endCue: 3 },
    ],
  });
  const originSeconds = semanticEvidenceStartSeconds(orderedIntent, captions, 0);
  const result = materializeSemanticIntent(
    { ...segment, end: 10, text: "先写稿，再拍摄，最后审核。" },
    orderedIntent,
    undefined,
    [],
    { captions, originSeconds },
  );
  assert.equal(result.status, "planned");
  if (result.status === "planned") {
    assert.equal(result.brief.component.id, "process-steps");
    assert.deepEqual(result.brief.props.activeIndexTimeline, [
      { at: 0, index: 0 },
      { at: 2.5, index: 1 },
      { at: 7.5, index: 2 },
    ]);
  }
});

test("materializer resolves image evidence only through the probed local inventory", () => {
  const planned = materializeSemanticIntent(
    segment,
    intent({
      rhetoric: "image-evidence",
      motionIntent: "introduce",
      imageEvidence: { assetId: "asset-shot", purpose: "explain", caption: "界面中的三个阶段" },
    }),
    undefined,
    [
      {
        id: "asset-shot",
        publicSrc: "projects/demo/image-evidence/asset-shot.png",
        description: "工作流界面",
        sourceLabel: "SeanLab Studio",
        orientation: "landscape",
        fit: "contain",
        focalPoint: { x: 0.5, y: 0.5 },
      },
    ],
  );
  assert.equal(planned.status, "planned");
  if (planned.status === "planned") {
    assert.equal(planned.brief.component.id, "image-evidence-inset");
    assert.equal(planned.brief.props.assetId, "asset-shot");
    assert.equal(planned.brief.props.imageSrc, "projects/demo/image-evidence/asset-shot.png");
  }
  assert.throws(
    () =>
      materializeSemanticIntent(
        segment,
        intent({
          rhetoric: "image-evidence",
          imageEvidence: { assetId: "invented", purpose: "show", caption: "不存在" },
        }),
        undefined,
        [],
      ),
    /Unknown image evidence asset/,
  );
});

test("local image evidence binding clamps timing and viewer copy to the anchored caption", () => {
  const bounded = boundImageEvidenceIntentToCaptions(
    intent({
      startCue: 0,
      endCue: 1,
      rhetoric: "image-evidence",
      motionIntent: "introduce",
      narrative: {
        eyebrow: "GITHUB PROJECT",
        title: "约四千星，内含多种视频模板",
        subtitleZh: "社区关注度与项目内容一目了然",
        subtitleEn: "About 4K stars with multiple video templates",
        takeaway: "项目约有四千星并提供多种视频模板",
      },
      items: [
        { ...emptyItem, label: "GitHub 星标", detail: "项目已有大约四千个星", displayValue: "约 4,000" },
        { ...emptyItem, label: "视频模板", detail: "仓库内提供多种视频模板", displayValue: "多种" },
      ],
      imageEvidence: { assetId: "asset-shot", purpose: "prove", caption: "GitHub 页面显示约 4K Stars" },
    }),
    [
      {
        start: 0.38,
        end: 4.12,
        zh: "这个项目在 GitHub 上已经大约有四千个星，",
        en: "This project has about four thousand stars on GitHub.",
      },
      {
        start: 4.12,
        end: 8.12,
        zh: "仓库里面提供了多种的视频模板。",
        en: "The repository provides multiple video templates.",
      },
    ],
    [
      {
        id: "asset-shot",
        anchorText: "大约有四千个星",
      },
    ],
  );
  assert.equal(bounded.status, "bounded");
  if (bounded.status === "bounded") {
    assert.equal(bounded.intent.startCue, 0);
    assert.equal(bounded.intent.endCue, 0);
    assert.equal(bounded.segment.start, 0.38);
    assert.equal(bounded.segment.end, 8.12);
    assert.equal(bounded.intent.narrative.title, "大约有四千个星");
    assert.doesNotMatch(bounded.intent.narrative.subtitleZh, /视频模板/);
    assert.doesNotMatch(bounded.segment.text, /视频模板/);
    assert.deepEqual(bounded.intent.items, []);
  }
});

test("image evidence binding accepts a conservative paraphrase and expands display time without expanding claims", () => {
  const bounded = boundImageEvidenceIntentToCaptions(
    intent({
      startCue: 0,
      endCue: 2,
      rhetoric: "image-evidence",
      imageEvidence: { assetId: "agent-settings", purpose: "show", caption: "固定 Agent" },
    }),
    [
      { start: 0, end: 3, zh: "项目创建时，还会选定参与内容理解的 Agent。" },
      { start: 3, end: 6, zh: "选定以后，它会跟着这个项目继续。" },
      { start: 6, end: 9, zh: "不会在制作途中自动切换。" },
    ],
    [{ id: "agent-settings", anchorText: "项目创建时固定 Agent" }],
  );
  assert.equal(bounded.status, "bounded");
  if (bounded.status === "bounded") {
    assert.equal(bounded.intent.startCue, 0);
    assert.equal(bounded.intent.endCue, 0);
    assert.equal(bounded.segment.end, 6);
    assert.match(bounded.intent.reason, /fuzzy anchor match/);
    assert.doesNotMatch(bounded.intent.narrative.subtitleZh, /跟着这个项目/);
  }
});

test("image evidence binding uses the registered description inside the Agent-selected range", () => {
  const bounded = boundImageEvidenceIntentToCaptions(
    intent({
      startCue: 0,
      endCue: 1,
      rhetoric: "image-evidence",
      imageEvidence: { assetId: "health", purpose: "show", caption: "健康检查" },
    }),
    [
      { start: 0, end: 3.3, zh: "正式生产前，系统会检查本地的系统环境" },
      { start: 3.3, end: 7.6, zh: "、Agent 登录、字体、磁盘空间的目录大小和权限。" },
    ],
    [
      {
        id: "health",
        anchorText: "先检查本机环境和健康状态",
        description: "展示本机环境、Agent、任务和存储健康检查",
      },
    ],
  );
  assert.notEqual(bounded.status, "blocked");
  if (bounded.status !== "blocked") {
    assert.match(bounded.intent.reason, /fuzzy anchor match/);
    assert.equal(bounded.segment.end, 7.6);
  }
});

test("image evidence binding fails closed when its registered anchor cannot be resolved", () => {
  const bounded = boundImageEvidenceIntentToCaptions(
    intent({
      rhetoric: "image-evidence",
      imageEvidence: { assetId: "asset-shot", purpose: "prove", caption: "截图证据" },
    }),
    [{ start: 0, end: 4, zh: "这里只讨论视频模板。", en: "Video templates." }],
    [{ id: "asset-shot", anchorText: "四千个星" }],
  );
  assert.equal(bounded.status, "blocked");
  if (bounded.status === "blocked") assert.match(bounded.reason, /anchor/i);
});

test("required image evidence coverage blocks review when a registered screenshot is not selected", () => {
  const assets = [
    { id: "shown", required: true },
    { id: "missing", required: true },
    { id: "optional", required: false },
  ];
  const cues = [
    {
      generatedVisual: {
        component: { id: "image-evidence-inset" },
        props: { assetId: "shown" },
      },
    },
  ];
  const report = evaluateRequiredImageEvidenceCoverage(assets, cues);
  assert.equal(report.status, "blocked");
  assert.deepEqual(report.missingRequiredAssetIds, ["missing"]);
  assert.throws(() => assertRequiredImageEvidenceCoverage(assets, cues), /missing/);
  assert.equal(assertRequiredImageEvidenceCoverage([assets[0]], cues).status, "passed");
});

test("required image evidence coverage includes direct and grouped authored image cues", () => {
  const assets = [
    { id: "image-a", required: true },
    { id: "image-b", required: true },
    { id: "image-c", required: true },
  ];
  const direct = [
    {
      assetId: "image-a",
      sources: [{ assetId: "image-a" }, { assetId: "image-b" }, { assetId: "image-c" }],
    },
  ];
  const report = assertRequiredImageEvidenceCoverage(assets, [], direct);
  assert.equal(report.status, "passed");
  assert.deepEqual(report.missingRequiredAssetIds, []);
});

test("required image evidence coverage treats ids for the same local file as one shown asset", () => {
  const assets = [
    { id: "image-a", path: "/project/assets/a.png", required: true },
    { id: "image-a-beat-1", path: "/project/assets/a.png", required: true },
  ];
  const direct = [{ assetId: "image-a-beat-1" }];
  const report = assertRequiredImageEvidenceCoverage(assets, [], direct);
  assert.equal(report.status, "passed");
  assert.deepEqual(report.missingRequiredAssetIds, []);
  assert.equal(report.selectedRequiredCount, 2);
});

test("required image evidence coverage includes a shared image frozen inside an animation stage", () => {
  const assets = [
    {
      id: "animation-recorder",
      required: true,
      sourceLabel: "动画素材库 · generated-recorder-paper",
    },
  ];
  const animationCues = [
    {
      animationIntent: {
        stages: [{ imageAssetId: "generated-recorder-paper" }],
      },
    },
  ];
  assert.equal(assertRequiredImageEvidenceCoverage(assets, [], [], animationCues).status, "passed");
  assert.equal(
    evaluateRequiredImageEvidenceCoverage(
      assets,
      [],
      [],
      [{ animationIntent: { stages: [{ imageAssetId: "another-image" }] } }],
    ).status,
    "blocked",
  );
});

test("materializer binds registered icon identities to a strict two-way comparison", () => {
  const result = materializeSemanticIntent(
    segment,
    intent({
      items: [
        { ...emptyItem, label: "GitHub", detail: "代码协作", entityId: "github", entityKind: "brand" },
        { ...emptyItem, label: "ChatGPT", detail: "团队协作", entityId: "chatgpt", entityKind: "ai" },
      ],
      mediaIntents: [
        { kind: "brand", entityId: "github" },
        { kind: "ai", entityId: "chatgpt" },
      ],
    }),
  );
  assert.equal(result.status, "planned");
  if (result.status === "planned") {
    const items = result.brief.props.items as Array<{ entityId?: string; iconId?: string }>;
    assert.deepEqual(
      items.map((item) => item.entityId ?? item.iconId),
      ["brand.github", "brand.chatgpt"],
    );
  }
});

test("deterministic routing corrects a two-entity classification into comparison", () => {
  const routed = normalizeRoutingIntent(
    intent({
      rhetoric: "model-classification",
      items: [
        { ...emptyItem, label: "Ollama", detail: "本地控制", entityId: "ollama", entityKind: "ai" },
        { ...emptyItem, label: "Hugging Face", detail: "开放资源", entityId: "hugging-face", entityKind: "ai" },
      ],
    }),
  );
  assert.equal(routed.rhetoric, "comparison");
});

test("deterministic routing recovers explicit comparison and ordered-flow examples from source wording", () => {
  assert.equal(
    normalizeRoutingIntent(
      intent({
        rhetoric: "none",
        items: [
          { ...emptyItem, label: "方案 A" },
          { ...emptyItem, label: "方案 B" },
        ],
      }),
      "讲两种方案的区别时，画面可以做成左右对比。",
    ).rhetoric,
    "comparison",
  );
  assert.equal(
    normalizeRoutingIntent(
      intent({
        rhetoric: "none",
        items: [
          { ...emptyItem, label: "开始" },
          { ...emptyItem, label: "完成" },
        ],
      }),
      "介绍完整流程时，步骤按照说话顺序逐个出现。",
    ).rhetoric,
    "comparison",
  );
});

test("deterministic routing recovers explicit checklist examples and preserves negation setup", () => {
  assert.equal(
    normalizeRoutingIntent(
      intent({
        rhetoric: "none",
        items: [
          { ...emptyItem, label: "字幕" },
          { ...emptyItem, label: "人物" },
          { ...emptyItem, label: "画面" },
        ],
      }),
      "屏幕上可以出现三个清晰的检查项。",
    ).rhetoric,
    "factor-sequence",
  );
  assert.equal(
    normalizeRoutingIntent(
      intent({
        rhetoric: "none",
        motionIntent: "introduce",
        items: [
          { ...emptyItem, label: "越多越好" },
          { ...emptyItem, label: "越复杂越好" },
        ],
      }),
      "先显示越多越好和越复杂越好。",
    ).rhetoric,
    "comparison",
  );
});

test("deterministic routing expands grouped model identities into individual icon-ready items", () => {
  const routed = normalizeRoutingIntent(
    intent({
      rhetoric: "model-classification",
      items: [
        {
          ...emptyItem,
          label: "ChatGPT与Claude Code",
          detail: "低门槛协作",
          entityId: "chatgpt-claude-code",
          entityKind: "ai",
        },
        {
          ...emptyItem,
          label: "DeepSeek与通义千问",
          detail: "中文任务",
          entityId: "deepseek-tongyi-qianwen",
          entityKind: "ai",
        },
      ],
      mediaIntents: [
        { kind: "ai", entityId: "chatgpt" },
        { kind: "ai", entityId: "claude-code" },
        { kind: "ai", entityId: "deepseek" },
        { kind: "ai", entityId: "tongyi-qianwen" },
      ],
    }),
  );
  assert.equal(routed.rhetoric, "model-classification");
  assert.deepEqual(
    routed.items.map((item) => item.entityId),
    ["chatgpt", "claude-code", "deepseek", "tongyi-qianwen"],
  );
});

test("materialized scenario compacts a long conditional sentence without mid-phrase truncation", () => {
  const result = materializeSemanticIntent(
    segment,
    intent({
      rhetoric: "scenario",
      items: [
        {
          ...emptyItem,
          label: "公开研究资源",
          detail: "处理Stanford、MIT或Broad Institute已公开的论文和开放模型时，借助Hugging Face扩展、检索与验证",
        },
        { ...emptyItem, label: "改用本地模型", detail: "在隐私任务中优先使用 Ollama" },
      ],
    }),
  );
  assert.equal(result.status, "planned");
  if (result.status === "planned") {
    const branches = result.brief.props.branches as Array<{ detail: string }>;
    assert.equal(branches[0].detail, "借助Hugging Face扩展、检索与验证");
  }
});

test("local rough annotation routing maps seven semantic intents without changing the Agent schema", () => {
  const cases = [
    ["强调", "真正重要的是证据", "strong-emphasis", "highlight"],
    ["轻量", "这里需要注意边界", "light-emphasis", "underline"],
    ["概念", "所谓语义证据，就是可追溯的依据", "focus-concept", "circle"],
    ["结论", "核心是本地确定性", "bounded-conclusion", "box"],
    ["否定", "不是越多越好，不是越高越好", "negation", "crossed-off"],
    ["纠正", "把 Agent 直接选组件改成本地路由", "correction", "strike-through"],
    ["分组", "这一组包括文字、标题和证据", "grouping", "bracket"],
  ] as const;

  for (const [label, text, semantic, effect] of cases) {
    const planned = resolveLocalRoughAnnotationPlan(
      text,
      intent({
        motionIntent: "emphasize",
        visualPriority: label === "强调" ? "high" : "normal",
        narrative: {
          eyebrow: "LOCAL ROUTER",
          title: label === "结论" ? "本地确定性" : label,
          subtitleZh: text,
          subtitleEn: label,
          takeaway: label,
        },
        items:
          label === "分组"
            ? [
                { ...emptyItem, label: "文字" },
                { ...emptyItem, label: "标题" },
                { ...emptyItem, label: "证据" },
              ]
            : [{ ...emptyItem, label }],
      }),
    );
    assert.equal(planned?.intent, semantic);
    assert.equal(effectForRoughAnnotationIntent(semantic), effect);
  }
});

test("materializer turns explicit repeated negation into one bounded annotation component", () => {
  const result = materializeSemanticIntent(
    { ...segment, text: "不是越多越好，不是越高越好。" },
    intent({
      rhetoric: "comparison",
      motionIntent: "compare",
      items: [
        { ...emptyItem, label: "组件数量", detail: "不能脱离证据" },
        { ...emptyItem, label: "覆盖率", detail: "不能独立决定质量" },
      ],
    }),
  );
  assert.equal(result.status, "planned");
  if (result.status === "planned") {
    assert.equal(result.brief.component.id, "rough-annotation");
    assert.deepEqual(
      (result.brief.props.items as Array<{ text: string; effect: string }>).map(({ text, effect }) => [text, effect]),
      [
        ["越多越好", "crossed-off"],
        ["越高越好", "crossed-off"],
      ],
    );
  }
});

test("a confirmed component route preserves its explicit rhetoric over automatic annotation inference", () => {
  const result = materializeSemanticIntent(
    { ...segment, text: "它不是摄影测量，而是让 Agent 用代码重建。" },
    intent({
      rhetoric: "comparison",
      motionIntent: "compare",
      items: [
        { ...emptyItem, label: "摄影测量", detail: "未采用" },
        { ...emptyItem, label: "代码重建", detail: "实际方式" },
      ],
    }),
    undefined,
    [],
    { captions: [], originSeconds: 0, preserveExplicitRhetoric: true },
  );
  assert.equal(result.status, "planned");
  if (result.status === "planned") assert.equal(result.brief.component.id, "binary-versus");
});

test("a confirmed component beat consumes only evidence items inside its caption range", () => {
  const bounded = boundSemanticIntentItems(
    intent({
      startCue: 14,
      endCue: 16,
      items: [
        { ...emptyItem, label: "输入参考", startCue: 14, endCue: 14 },
        { ...emptyItem, label: "未采用方式", startCue: 15, endCue: 15 },
        { ...emptyItem, label: "实际方式", startCue: 16, endCue: 16 },
      ],
    }),
    15,
    16,
  );
  assert.equal(bounded.startCue, 15);
  assert.equal(bounded.endCue, 16);
  assert.deepEqual(
    bounded.items.map((item) => item.label),
    ["未采用方式", "实际方式"],
  );
});

test("a confirmed binary comparison can derive two exact clauses when the Agent grouped them as one item", () => {
  const compared = withConfirmedComparisonItems(
    intent({
      rhetoric: "comparison",
      items: [{ ...emptyItem, label: "保留交互入口", startCue: 53, endCue: 54 }],
    }),
    "它不是只有一个能转圈观看的外壳，内部结构已经为后续交互留下了入口。",
    53,
    54,
  );
  assert.deepEqual(
    compared.items.map((item) => [item.label, item.detail]),
    [
      ["外壳", "一个能转圈观看的外壳"],
      ["内部结构", "内部结构已经为后续交互留下了入口"],
    ],
  );
  const choice = withConfirmedComparisonItems(
    intent({
      rhetoric: "comparison",
      items: [{ ...emptyItem, label: "控制权归属", startCue: 55, endCue: 56 }],
    }),
    "控制权应该留在模型公司手里，还是交给拿到模型的某一个人。",
    55,
    56,
  );
  assert.deepEqual(
    choice.items.map((item) => item.detail),
    ["控制权应该留在模型公司手里", "交给拿到模型的某一个人"],
  );
});

test("explicit spoken instruction to cross out a phrase overrides a generic positioning rhetoric", () => {
  const routed = normalizeRoutingIntent(
    intent({
      rhetoric: "core-positioning",
      motionIntent: "transform",
      items: [
        { ...emptyItem, label: "越多越好", detail: "划掉" },
        { ...emptyItem, label: "相关", detail: "突出" },
        { ...emptyItem, label: "准确", detail: "突出" },
      ],
    }),
    "越多越好可以被直接划掉，真正重要的是相关和准确。",
  );
  assert.equal(routed.rhetoric, "rough-annotation");
  assert.deepEqual(routed.roughAnnotation?.targets, ["越多越好", "相关", "准确"]);
  assert.deepEqual(
    routed.roughAnnotation?.annotations?.map((item) => [item.target, item.intent]),
    [
      ["越多越好", "negation"],
      ["相关", "strong-emphasis"],
      ["准确", "strong-emphasis"],
    ],
  );
});

test("unconfirmed core positioning stays on speaker instead of reviving the retired component", () => {
  const result = materializeSemanticIntent(
    { ...segment, text: "系统承担重复工作，但不替作者决定表达。" },
    intent({
      rhetoric: "core-positioning",
      motionIntent: "introduce",
      items: [
        { ...emptyItem, label: "承担重复工作", detail: "固定耗时步骤" },
        { ...emptyItem, label: "保留作者表达", detail: "最终决定仍由作者完成" },
        { ...emptyItem, label: "继续人工审核", detail: "确认每一阶段结果" },
      ],
    }),
  );
  assert.equal(result.status, "skipped");
  if (result.status === "skipped") assert.match(result.reason, /layered-system animation/);
});

test("mixed rough annotation materializes crossed-off and highlighted phrases in one component", () => {
  const result = materializeSemanticIntent(
    { ...segment, text: "越多越好可以被直接划掉，真正重要的是相关和准确。" },
    intent({
      rhetoric: "core-positioning",
      motionIntent: "transform",
      items: [
        { ...emptyItem, label: "越多越好" },
        { ...emptyItem, label: "相关" },
        { ...emptyItem, label: "准确" },
      ],
    }),
  );
  assert.equal(result.status, "planned");
  if (result.status === "planned")
    assert.deepEqual(
      (result.brief.props.items as Array<{ text: string; effect: string }>).map((item) => [item.text, item.effect]),
      [
        ["越多越好", "crossed-off"],
        ["相关", "highlight"],
        ["准确", "highlight"],
      ],
    );
});

test("rough annotation never displaces registered image or quantitative evidence", () => {
  for (const rhetoric of ["image-evidence", "trend", "ranking", "key-stat"] as const) {
    assert.equal(
      resolveLocalRoughAnnotationPlan("不是越多越好，不是越高越好。", intent({ rhetoric, motionIntent: "emphasize" })),
      undefined,
    );
  }
});

test("rough annotation does not turn an interrogative quality check into a negation", () => {
  assert.equal(
    resolveLocalRoughAnnotationPlan(
      "检查说话节奏是不是自然。",
      intent({ rhetoric: "process-steps", motionIntent: "progress" }),
    ),
    undefined,
  );
});

test("rough annotation does not displace a structured sequence because one sentence contains a negation", () => {
  assert.equal(
    resolveLocalRoughAnnotationPlan(
      "动画不是随机添加，先写稿，再拍摄，最后审核。",
      intent({ rhetoric: "factor-sequence", motionIntent: "progress" }),
    ),
    undefined,
  );
});

test("rough annotation presentation starts at the cue that actually states its target", () => {
  const captions = [
    { start: 20, end: 24, zh: "以前做这种视频需要反复选择。" },
    { start: 24, end: 28, zh: "现在先把内容整理清楚。" },
    { start: 28, end: 32, zh: "它不是拍摄，而是一套制作流程。" },
  ];
  const routed = normalizeRoutingIntent(
    intent({ startCue: 0, endCue: 2, rhetoric: "comparison", motionIntent: "compare" }),
    captions.map((caption) => caption.zh).join(""),
  );
  assert.equal(routed.rhetoric, "rough-annotation");
  assert.equal(semanticEvidenceStartSeconds(routed, captions, 20), 28);
});

test("speaker fallback only annotates exact keywords grounded in the same spoken passage", () => {
  const planned = resolveSpeakerRoughAnnotationPlan(
    "SeanLab Video 会先理解口播，再把关键画面交给你审核。",
    intent({
      visualPriority: "skip",
      rhetoric: "none",
      motionIntent: "introduce",
      narrative: {
        eyebrow: "",
        title: "SeanLab Video",
        subtitleZh: "",
        subtitleEn: "",
        takeaway: "关键画面需要审核",
      },
      items: [{ ...emptyItem, label: "SeanLab Video" }],
    }),
  );
  assert.deepEqual(planned?.targets, ["SeanLab Video"]);
  assert.equal(planned?.intent, "strong-emphasis");
});

test("speaker fallback refuses an ungrounded paraphrased title", () => {
  const planned = resolveSpeakerRoughAnnotationPlan(
    "这一段只是继续解释前面的背景。",
    intent({
      visualPriority: "skip",
      rhetoric: "none",
      motionIntent: "introduce",
      narrative: {
        eyebrow: "",
        title: "全自动视觉工作流",
        subtitleZh: "",
        subtitleEn: "",
        takeaway: "自动安排所有画面",
      },
      items: [],
    }),
  );
  assert.equal(planned, undefined);
});

test("speaker fallback can extract an exact emphasized phrase from an otherwise unstructured passage", () => {
  const planned = resolveSpeakerRoughAnnotationPlan(
    "如果你想立刻得到一条完全无人参与的自动成片，这条流程可能就会显得比较慢。",
    intent({
      visualPriority: "normal",
      rhetoric: "core-positioning",
      motionIntent: "emphasize",
      narrative: {
        eyebrow: "",
        title: "完全无人参与时可能显得较慢",
        subtitleZh: "",
        subtitleEn: "",
        takeaway: "自动成片仍有边界",
      },
      items: [],
    }),
  );
  assert.deepEqual(planned?.targets, ["完全无人参与的自动成片"]);
});

test("coverage fallback can reuse a short exact spoken clause without inventing copy", () => {
  const planned = resolveSpeakerRoughAnnotationPlan(
    "图片看不到背面、隐藏结构只能推断，不能假装确定。",
    intent({ rhetoric: "core-positioning", motionIntent: "introduce", items: [] }),
    { allowClauseFallback: true },
  );
  assert.deepEqual(planned?.targets, ["图片看不到背面", "隐藏结构只能推断", "不能假装确定"]);
});
