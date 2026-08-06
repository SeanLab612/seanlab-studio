import assert from "node:assert/strict";
import test from "node:test";
import { applyEditorialStatementPolicy } from "../src/visual-direction/editorial-statement-policy.ts";
import { materializeSemanticIntent, normalizeRoutingIntent } from "../src/semantic-planning/materialize.ts";
import { validateComponentProps } from "../src/visual-brief/generator.ts";

const baseIntent = {
  startCue: 0,
  endCue: 0,
  visualPriority: "normal" as const,
  rhetoric: "none" as const,
  motionIntent: "introduce" as const,
  reason: "plain claim",
  confidence: 0.9,
  narrative: {
    eyebrow: "PLAIN LANGUAGE",
    title: "代码重新搭建模型",
    subtitleZh: "它不是提取网格，而是用代码重新搭建",
    subtitleEn: "The model is rebuilt in code.",
    takeaway: "模型仍然可以继续编辑和动画",
  },
  items: [],
  timeSeries: [],
  matrix: { rows: [], columns: [], values: [], states: [], xLabel: "", yLabel: "" },
  quote: { text: "", sourceName: "", sourceRole: "" },
  mediaIntents: [],
  imageEvidence: null,
  animationIntent: null,
};

test("plain-language claims route to the approved editorial statement", () => {
  const routed = normalizeRoutingIntent(baseIntent, "它不是提取现成网格，而是用代码重新搭建模型。");
  assert.equal(routed.rhetoric, "editorial-statement");
  const result = materializeSemanticIntent(
    { id: "plain", start: 0, end: 6, text: "它不是提取现成网格，而是用代码重新搭建模型。" },
    baseIntent,
  );
  assert.equal(result.status, "planned");
  if (result.status !== "planned") return;
  assert.equal(result.brief.component.id, "editorial-statement");
  assert.equal(result.brief.props.denied, "提取现成网格");
  assert.equal(result.brief.props.emphasis, "用代码重新搭建模型");
});

test("editorial statement copy stays inside its approved capacity", () => {
  assert.equal(
    validateComponentProps("editorial-statement", {
      leadIn: "它不是从图片里",
      denied: "提取现成网格",
      prefix: "而是",
      emphasis: "用代码重新搭建",
      support: "模型仍可继续编辑交互和动画",
    }),
    undefined,
  );
  assert.throws(
    () => validateComponentProps("editorial-statement", { emphasis: "这是一句明显超过十八个展示字符的观点陈述文字" }),
    /component-text-overflow/,
  );
});

test("editorial statement policy caps share and consecutive use without failing production", () => {
  const cue = (id: string, start: number, end: number, componentId = "editorial-statement") => ({
    start,
    end,
    generatedVisual: { component: { id: componentId }, segment: { id } },
  });
  const result = applyEditorialStatementPolicy(
    [cue("a", 0, 8), cue("b", 8, 16), cue("c", 16, 24), cue("specialized", 24, 30, "process-steps"), cue("d", 30, 38)],
    80,
    { maximumCoverageRatio: 0.25 },
  );
  assert.deepEqual(
    result.cues.map((item) => item.generatedVisual.segment.id),
    ["a", "b", "specialized", "d"],
  );
  assert.deepEqual(result.suppressedCueIds, ["c"]);
  assert.equal(result.coverageRatio, 0.25);
});

test("a real primary visual resets the editorial consecutive-use counter", () => {
  const cue = (id: string, start: number, end: number) => ({
    start,
    end,
    generatedVisual: { component: { id: "editorial-statement" }, segment: { id } },
  });
  const result = applyEditorialStatementPolicy([cue("a", 0, 5), cue("b", 5, 10), cue("c", 15, 20)], 100, {
    resetIntervals: [{ start: 10, end: 15 }],
  });
  assert.deepEqual(
    result.cues.map((item) => item.generatedVisual.segment.id),
    ["a", "b", "c"],
  );
});
