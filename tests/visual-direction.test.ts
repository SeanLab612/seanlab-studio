import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  directVisualPacing,
  evaluateVisualDirectionQuality,
  planWholeVideoTitleCues,
  summarizeVisualDirection,
  type VisualDirectionCandidate,
  type VisualDirectionDecision,
  validateVisualDirectionPlan,
} from "../src/visual-direction/index.ts";

const qualityFixture = JSON.parse(
  readFileSync(resolve("tests/fixtures/visual-direction-quality.json"), "utf8"),
) as import("../src/visual-direction/types.ts").VisualDirectionPlan;

test("frozen semantic quality fixture reaches 80 percent eligible speaker coverage", () => {
  const report = evaluateVisualDirectionQuality({ plan: qualityFixture });
  assert.equal(report.status, "passed");
  assert.equal(report.metrics.eligibleCoverageRatio, 0.8);
  assert.equal(report.metrics.materializationRatio, 1);
  assert.equal(report.metrics.uniqueComponents, 4);
});

test("semantic quality reports low coverage without forcing irrelevant visuals", () => {
  const plan = structuredClone(qualityFixture);
  for (const decision of plan.decisions.slice(1)) {
    decision.action = "skip";
    decision.importance = "none";
    decision.displayStart = null;
    decision.displayEnd = null;
    decision.componentId = ["c2", "c3"].includes(decision.candidateId) ? null : "binary-versus";
  }
  const report = evaluateVisualDirectionQuality({ plan });
  assert.equal(report.status, "blocked");
  assert.ok(report.advisories.some((item) => item.rule === "visual-direction.eligible-coverage"));
  assert.equal(
    report.findings.some((item) => item.rule === "visual-direction.eligible-coverage"),
    false,
  );
  assert.ok(report.findings.some((item) => item.rule === "visual-direction.materialization"));
  assert.ok(report.advisories.some((item) => item.rule === "visual-direction.diversity"));
});

test("confirmed speaker-only passages are excluded from the component materialization denominator", () => {
  const plan = structuredClone(qualityFixture);
  const decision = plan.decisions[0];
  decision.action = "skip";
  decision.importance = "none";
  decision.componentId = null;
  decision.displayStart = null;
  decision.displayEnd = null;
  decision.reasons.push("Confirmed creator storyboard requires speaker-only video.");
  const report = evaluateVisualDirectionQuality({ plan });
  assert.equal(report.status, "passed");
  assert.equal(report.metrics.eligibleCandidateCount, qualityFixture.decisions.length - 1);
  assert.equal(report.metrics.materializationRatio, 1);
});

test("creator-confirmed animation reservations count as materialized primary visuals", () => {
  const plan = directVisualPacing({
    candidates: [candidate("candidate-1", 0, 20, { startCue: 0, endCue: 0 })],
    durationSeconds: 30,
  });
  const decision = plan.decisions[0];
  decision.action = "skip";
  decision.importance = "none";
  decision.componentId = null;
  decision.displayStart = null;
  decision.displayEnd = null;
  decision.reasons.push("Primary visual beat animation-workflow reserves this interval for animation.");
  const report = evaluateVisualDirectionQuality({
    plan,
    captions: [{ zh: "说到流程，画面就可以开始推进。" }],
  });
  assert.equal(report.status, "passed");
  assert.equal(report.metrics.materializationRatio, 1);
  assert.equal(report.metrics.explicitOpportunityCoverageRatio, 1);
  assert.equal(report.metrics.longestUnexplainedSpeakerGapSeconds, 10);
});

test("authored recording reservations cover explicit visual opportunities", () => {
  const plan = directVisualPacing({
    candidates: [candidate("candidate-1", 0, 20, { startCue: 0, endCue: 0 })],
    durationSeconds: 30,
  });
  const decision = plan.decisions[0];
  decision.action = "skip";
  decision.importance = "none";
  decision.componentId = null;
  decision.displayStart = null;
  decision.displayEnd = null;
  decision.reasons.push("Suppressed by authored recording scene scene-visual-plan.");
  const report = evaluateVisualDirectionQuality({
    plan,
    captions: [{ zh: "加入高亮、下划线、圈选或者框选。" }],
    screenScenes: [{ start: 0, end: 20 }],
  });
  assert.equal(report.status, "passed");
  assert.equal(report.metrics.explicitOpportunityCoverageRatio, 1);
});

test("semantic quality measures repetition only in visuals that will actually be shown", () => {
  const plan = structuredClone(qualityFixture);
  for (const decision of plan.decisions.slice(0, 3)) decision.componentId = "binary-versus";
  const repeated = evaluateVisualDirectionQuality({ plan });
  assert.ok(repeated.advisories.some((item) => item.rule === "visual-direction.repetition"));
  plan.decisions[1].action = "skip";
  plan.decisions[1].importance = "none";
  plan.decisions[1].displayStart = null;
  plan.decisions[1].displayEnd = null;
  const finalOutput = evaluateVisualDirectionQuality({ plan });
  assert.equal(finalOutput.metrics.longestComponentRepeat, 2);
  assert.equal(
    finalOutput.advisories.some((item) => item.rule === "visual-direction.repetition"),
    false,
  );
});

const candidate = (
  id: string,
  start: number,
  end: number,
  patch: Partial<VisualDirectionCandidate> = {},
): VisualDirectionCandidate => ({
  id,
  semanticIndex: Number(id.replace(/\D/g, "")) || 0,
  startCue: Math.floor(start),
  endCue: Math.floor(start) + 1,
  start,
  end,
  visualPriority: "normal",
  confidence: 0.8,
  rhetoric: "comparison",
  reason: "Evidence-backed visual candidate.",
  materializationStatus: "planned",
  overlayCue: {
    start,
    end,
    eyebrow: "AI WORKFLOW",
    title: `视觉${id}`,
    subtitle: "完整观点",
    subtitleEn: "Complete claim",
    accent: "#48a7ff",
    layoutTemplateId: "speaker-right-main",
    contentScale: 1,
    generatedVisual: {
      schemaVersion: "1.0",
      analysis: {
        claim: "完整观点",
        rhetoric: "comparison",
        visualPriority: "normal",
        metaphor: "binary-versus",
        confidence: 0.8,
      },
      narrative: {
        eyebrow: "AI WORKFLOW",
        title: `视觉${id}`,
        subtitleZh: "完整观点",
        subtitleEn: "Complete claim",
      },
      segment: { id, start, end, text: "完整观点" },
      component: { id: "binary-versus", status: "approved" },
      props: { items: [{ label: "甲" }, { label: "乙" }] },
      motion: { intent: "compare", recipeId: "crossfade-compare", status: "approved" },
    },
  },
  ...patch,
});

test("whole-video direction assigns importance and keeps audit-friendly caption boundaries", () => {
  const plan = directVisualPacing({
    candidates: [
      candidate("candidate-1", 0, 9, { visualPriority: "high", confidence: 0.95, startCue: 0, endCue: 2 }),
      candidate("candidate-2", 14, 22, { confidence: 0.4, startCue: 3, endCue: 3 }),
    ],
    durationSeconds: 30,
  });
  assert.equal(plan.decisions[0].importance, "hero");
  assert.equal(plan.decisions[0].action, "show");
  assert.ok(plan.decisions[0].boundaryActions.includes("merge-captions"));
  assert.equal(plan.decisions[1].action, "skip");
  assert.ok(plan.decisions[1].boundaryActions.includes("split-adjacent-claim"));
  assert.equal(validateVisualDirectionPlan(plan), true);
});

test("a configured minimum coverage keeps eligible visuals for their evidence-bounded passage", () => {
  const sparse = directVisualPacing({
    candidates: [candidate("candidate-1", 0, 20)],
    durationSeconds: 30,
  });
  const coverageDriven = directVisualPacing({
    candidates: [candidate("candidate-1", 0, 20)],
    durationSeconds: 30,
    policy: { minimumVisualCoverageRatio: 0.8 },
  });
  assert.equal(sparse.decisions[0].displayEnd, 12);
  assert.equal(coverageDriven.decisions[0].displayEnd, 20);
});

test("a configured minimum coverage removes artificial gaps between adjacent eligible visuals", () => {
  const plan = directVisualPacing({
    candidates: [candidate("candidate-1", 0, 8), candidate("candidate-2", 8, 16)],
    durationSeconds: 20,
    policy: { minimumVisualCoverageRatio: 0.8 },
  });
  assert.deepEqual(
    plan.decisions.map(({ displayStart, displayEnd }) => [displayStart, displayEnd]),
    [
      [0, 8],
      [8, 16],
    ],
  );
});

test("visual-direction validation rejects timing retained by a skipped decision", () => {
  const plan = directVisualPacing({ candidates: [candidate("candidate-1", 0, 8)], durationSeconds: 20 });
  plan.decisions[0].action = "skip";
  assert.throws(() => validateVisualDirectionPlan(plan), /must not retain display timing/);
});

test("whole-video direction never shows a blocked materialization", () => {
  const plan = directVisualPacing({
    candidates: [
      candidate("candidate-1", 0, 8, {
        materializationStatus: "blocked",
        materializationReason: "Required image evidence anchor was not resolved.",
        overlayCue: undefined,
      }),
    ],
    durationSeconds: 20,
  });
  assert.equal(plan.decisions[0].action, "skip");
  assert.equal(plan.decisions[0].importance, "none");
  assert.equal(plan.decisions[0].displayStart, null);
  assert.equal(plan.decisions[0].displayEnd, null);
  assert.match(plan.decisions[0].reasons.at(-1) ?? "", /image evidence anchor/);
  assert.equal(validateVisualDirectionPlan(plan), true);
});

test("whole-video direction skips materialized visuals that are too short to read", () => {
  const plan = directVisualPacing({
    candidates: [candidate("candidate-1", 0, 2)],
    durationSeconds: 20,
  });
  assert.equal(plan.decisions[0].action, "skip");
  assert.equal(plan.decisions[0].displayStart, null);
  assert.equal(plan.decisions[0].displayEnd, null);
  assert.match(plan.decisions[0].reasons.at(-1) ?? "", /minimum readable duration/);
  assert.equal(validateVisualDirectionPlan(plan), true);
});

test("whole-video direction accepts a minimum-duration cue despite floating point rounding", () => {
  const exact = candidate("candidate-exact", 10, 12.2);
  if (exact.overlayCue) exact.overlayCue.end = 12.19999999999999;
  const plan = directVisualPacing({
    candidates: [exact],
    durationSeconds: 20,
    policy: { minimumVisibleSeconds: 2.2 },
  });
  assert.equal(plan.decisions[0].action, "show");
  assert.doesNotThrow(() => validateVisualDirectionPlan(plan));
});

test("whole-video direction allows a repeated component when its evidence-bound content differs", () => {
  const plan = directVisualPacing({
    candidates: [candidate("candidate-1", 0, 8), candidate("candidate-2", 12, 20)],
    durationSeconds: 30,
  });
  assert.equal(plan.decisions[0].action, "show");
  assert.equal(plan.decisions[1].action, "show");
});

test("whole-video direction still suppresses exact duplicate visual content", () => {
  const repeated = candidate("candidate-2", 12, 20);
  if (repeated.overlayCue) {
    repeated.overlayCue.title = "视觉candidate-1";
    repeated.overlayCue.generatedVisual.narrative.title = "视觉candidate-1";
  }
  const plan = directVisualPacing({
    candidates: [candidate("candidate-1", 0, 8), repeated],
    durationSeconds: 30,
  });
  assert.equal(plan.decisions[1].action, "skip");
  assert.match(plan.decisions[1].reasons.at(-1) ?? "", /Duplicate visual content/);
});

test("semantic quality blocks an uncovered explicit visual example without forcing generic coverage", () => {
  const plan = directVisualPacing({
    candidates: [candidate("candidate-1", 0, 8, { startCue: 0, endCue: 0 })],
    durationSeconds: 20,
  });
  const report = evaluateVisualDirectionQuality({
    plan,
    captions: [
      { zh: "这里先介绍背景。" },
      { zh: "我说两种做法各有优缺点，画面就可以放在左右两边比较。" },
      { zh: "随后继续说明。" },
    ],
  });
  assert.equal(report.status, "blocked");
  assert.ok(report.findings.some((item) => item.rule === "visual-direction.explicit-opportunity-coverage"));
});

test("whole-video direction inserts a breathing gap when readable duration remains", () => {
  const second = candidate("candidate-2", 7, 16);
  if (second.overlayCue) second.overlayCue.generatedVisual.component.id = "key-stat-summary";
  const plan = directVisualPacing({
    candidates: [candidate("candidate-1", 0, 8), second],
    durationSeconds: 20,
    policy: { maximumVisualCoverageRatio: 1 },
  });
  assert.equal(plan.decisions[1].action, "show");
  assert.equal(plan.decisions[1].displayStart, 8.6);
  assert.ok(plan.decisions[1].adjustments.includes("delayed-for-breathing"));
});

test("whole-video direction groups discourse chapters and enforces a duration coverage budget", () => {
  const candidates = [
    candidate("candidate-1", 0, 18, { startCue: 0, endCue: 2 }),
    candidate("candidate-2", 20, 38, { startCue: 3, endCue: 5 }),
    candidate("candidate-3", 50, 68, { startCue: 9, endCue: 11 }),
  ];
  for (const [index, item] of candidates.entries())
    if (item.overlayCue) item.overlayCue.generatedVisual.component.id = `component-${index}`;
  const plan = directVisualPacing({
    candidates,
    durationSeconds: 70,
    policy: { maximumVisualCoverageRatio: 0.4, repetitionWindowSeconds: 1 },
  });
  assert.equal(plan.chapters.length, 2);
  const report = summarizeVisualDirection(plan);
  assert.ok(report.summary.visualCoverageRatio <= 0.4);
  assert.ok(report.summary.skippedCount >= 1);
});

test("hero visuals can replace lower-priority visuals when the density budget is full", () => {
  const hero = candidate("candidate-2", 20, 30, { visualPriority: "high", confidence: 0.96 });
  if (hero.overlayCue) hero.overlayCue.generatedVisual.component.id = "key-stat-summary";
  const plan = directVisualPacing({
    candidates: [candidate("candidate-1", 0, 8), hero],
    durationSeconds: 60,
    policy: { maximumVisualsPerMinute: 1 },
  });
  assert.equal(plan.decisions[0].action, "skip");
  assert.equal(plan.decisions[1].action, "show");
  const report = summarizeVisualDirection(plan);
  assert.equal(report.summary.selectedCount, 1);
  assert.equal(report.importanceUsage.hero, 1);
});

test("creator-confirmed components survive ordinary density and coverage pruning", () => {
  const confirmed = candidate("candidate-2", 20, 34, {
    visualPriority: "normal",
    confidence: 0.7,
    creatorConstraint: { sectionId: "section-2", mode: "information" },
  });
  if (confirmed.overlayCue) confirmed.overlayCue.generatedVisual.component.id = "process-steps";
  const plan = directVisualPacing({
    candidates: [candidate("candidate-1", 0, 14), confirmed],
    durationSeconds: 40,
    policy: { maximumVisualsPerMinute: 1, maximumVisualCoverageRatio: 0.4 },
  });
  const decision = plan.decisions.find((item) => item.candidateId === "candidate-2");
  assert.equal(decision?.action, "show");
  assert.equal(decision?.componentId, "process-steps");
});

test("short creator-confirmed components extend into the next safe gap instead of being skipped", () => {
  const confirmed = candidate("candidate-1", 10, 11.4, {
    creatorConstraint: {
      sectionId: "overview",
      mode: "information",
      visualBeatId: "overview-beat-3",
    },
  });
  const following = candidate("candidate-2", 15, 22);
  if (following.overlayCue) following.overlayCue.generatedVisual.component.id = "key-stat-summary";
  const plan = directVisualPacing({
    candidates: [confirmed, following],
    durationSeconds: 30,
  });
  const decision = plan.decisions[0];
  assert.equal(decision.action, "show");
  assert.equal(decision.displayStart, 10);
  assert.equal(decision.displayEnd, 12.2);
  assert.ok(decision.adjustments.includes("extended-for-readability"));
  assert.doesNotThrow(() => validateVisualDirectionPlan(plan));
});

test("a short creator-confirmed component can displace an overlapping automatic recommendation", () => {
  const confirmed = candidate("candidate-1", 0, 1.6, {
    creatorConstraint: { sectionId: "opening", mode: "information" },
  });
  const automatic = candidate("candidate-2", 1.9, 8);
  if (automatic.overlayCue) automatic.overlayCue.generatedVisual.component.id = "key-stat-summary";
  const plan = directVisualPacing({
    candidates: [confirmed, automatic],
    durationSeconds: 10,
  });
  assert.equal(plan.decisions[0].action, "show");
  assert.equal(plan.decisions[0].displayEnd, 2.2);
  assert.equal(plan.decisions[1].action, "show");
  assert.ok(Math.abs((plan.decisions[1].displayStart ?? 0) - 2.8) < 0.0001);
});

test("adjacent creator-confirmed visuals remain readable without an artificial gap", () => {
  const opening = candidate("opening", 2.25, 3.31, {
    creatorConstraint: { sectionId: "opening", mode: "information" },
  });
  const nextConfirmed = candidate("overview", 3.31, 5.81, {
    creatorConstraint: { sectionId: "overview", mode: "information" },
  });
  const plan = directVisualPacing({ candidates: [opening, nextConfirmed], durationSeconds: 10 });
  assert.equal(plan.decisions[0].action, "show");
  assert.ok(Math.abs((plan.decisions[0].displayStart ?? 0) - 1.11) < 0.0001);
  assert.equal(plan.decisions[0].displayEnd, 3.31);
  assert.ok(plan.decisions[0].adjustments.includes("extended-backward-for-readability"));
  assert.equal(plan.decisions[1].displayStart, 3.31);
});

test("confirmed annotated speaker passages keep a long keyword canvas instead of the normal support cap", () => {
  const annotatedSpeaker = candidate("candidate-1", 0, 28, {
    visualPriority: "normal",
    confidence: 0.74,
    creatorConstraint: { sectionId: "section-1", mode: "speaker" },
  });
  if (annotatedSpeaker.overlayCue) annotatedSpeaker.overlayCue.generatedVisual.component.id = "rough-annotation";
  const plan = directVisualPacing({ candidates: [annotatedSpeaker], durationSeconds: 30 });
  const decision = plan.decisions[0];
  assert.equal(decision.action, "show");
  assert.equal(decision.displayEnd, 28);
  assert.equal(decision.adjustments.includes("shortened-to-tier-budget"), false);
});

test("quality blocks a silently skipped creator-confirmed component", () => {
  const plan = structuredClone(qualityFixture);
  const decision = plan.decisions[0];
  decision.creatorConstraint = { sectionId: "section-1", mode: "information" };
  decision.action = "skip";
  decision.importance = "none";
  decision.displayStart = null;
  decision.displayEnd = null;
  const report = evaluateVisualDirectionQuality({ plan });
  assert.ok(report.findings.some((item) => item.rule === "visual-direction.creator-confirmed-component"));
});

test("quality advises on long speaker-only gaps without blocking downstream speaker fallback", () => {
  const plan = directVisualPacing({ candidates: [candidate("candidate-1", 0, 5)], durationSeconds: 30 });
  let report = evaluateVisualDirectionQuality({ plan, minimumEligibleCoverageRatio: 0 });
  assert.equal(report.status, "passed");
  assert.ok(report.advisories.some((item) => item.rule === "visual-direction.unexplained-speaker-gap"));
  plan.decisions.push({
    ...plan.decisions[0],
    candidateId: "strict-speaker",
    semanticIndex: 2,
    startCue: 2,
    endCue: 3,
    sourceStart: 5,
    sourceEnd: 30,
    displayStart: null,
    displayEnd: null,
    action: "skip",
    importance: "none",
    componentId: null,
    reasons: ["Confirmed creator storyboard requires speaker-only video (strict)."],
  });
  report = evaluateVisualDirectionQuality({ plan, minimumEligibleCoverageRatio: 0 });
  assert.equal(
    report.advisories.some((item) => item.rule === "visual-direction.unexplained-speaker-gap"),
    false,
  );
});

test("whole-video identity titles fill only eligible speaker-only gaps", () => {
  const titleCues = planWholeVideoTitleCues({
    identity: {
      eyebrow: "PROJECT OVERVIEW",
      title: "html-video 项目介绍",
      subject: "html-video",
      startCue: 0,
      endCue: 49,
      confidence: 0.9,
    },
    decisions: [
      {
        candidateId: "opening-gap",
        semanticIndex: 0,
        startCue: 0,
        endCue: 4,
        sourceStart: 0,
        sourceEnd: 14,
        displayStart: null,
        displayEnd: null,
        action: "skip",
        importance: "none",
        rhetoric: "none",
        componentId: null,
        chapterId: "chapter-1",
        boundaryActions: ["merge-captions"],
        adjustments: [],
        reasons: ["speaker-only"],
      },
      {
        candidateId: "screen-gap",
        semanticIndex: 1,
        startCue: 5,
        endCue: 9,
        sourceStart: 30,
        sourceEnd: 42,
        displayStart: null,
        displayEnd: null,
        action: "skip",
        importance: "none",
        rhetoric: "none",
        componentId: null,
        chapterId: "chapter-1",
        boundaryActions: ["merge-captions"],
        adjustments: [],
        reasons: ["authored screen"],
      },
    ],
    screenScenes: [{ start: 31, end: 41 } as never],
    durationSeconds: 80,
  });
  assert.equal(titleCues.length, 1);
  assert.equal(titleCues[0].title, "html-video 项目介绍");
  assert.ok(titleCues[0].start >= 5.5);
});

test("whole-video identity titles use eligible gaps without a fixed count or repeated titles", () => {
  const skip = (id: string, start: number, end: number): VisualDirectionDecision => ({
    candidateId: id,
    semanticIndex: 0,
    startCue: Math.floor(start),
    endCue: Math.ceil(end),
    sourceStart: start,
    sourceEnd: end,
    displayStart: null,
    displayEnd: null,
    action: "skip",
    importance: "none",
    rhetoric: "none",
    componentId: null,
    chapterId: "chapter-1",
    boundaryActions: [],
    adjustments: [],
    reasons: ["speaker-only"],
  });
  const titleCues = planWholeVideoTitleCues({
    identity: {
      eyebrow: "PROJECT OVERVIEW",
      title: "html-video 项目介绍",
      subject: "html-video",
      startCue: 0,
      endCue: 49,
      confidence: 0.9,
    },
    decisions: [skip("gap-1", 0, 14), skip("gap-2a", 30, 36), skip("gap-2b", 36.5, 44), skip("gap-3", 62, 72)],
    screenScenes: [],
    durationSeconds: 90,
  });
  assert.equal(titleCues.length, 2);
  assert.match(titleCues[1].placementReason, /gap-3/);
  assert.equal(
    titleCues.some((cue) => /gap-2a, gap-2b/.test(cue.placementReason)),
    false,
  );
  assert.ok(titleCues.every((cue, index) => index === 0 || cue.start - titleCues[index - 1].end >= 28));
});

test("whole-video identity titles fall back to a complete safe-area title", () => {
  const titleCues = planWholeVideoTitleCues({
    identity: {
      eyebrow: "PROJECT OVERVIEW",
      title: "把分散环节搭成一个本地运行的 SeanLab Studio",
      subject: "SeanLab Studio",
      startCue: 0,
      endCue: 20,
      confidence: 0.9,
    },
    decisions: [
      {
        candidateId: "long-title-gap",
        semanticIndex: 0,
        startCue: 0,
        endCue: 5,
        sourceStart: 0,
        sourceEnd: 14,
        displayStart: null,
        displayEnd: null,
        action: "skip",
        importance: "none",
        rhetoric: "none",
        componentId: null,
        chapterId: "chapter-1",
        boundaryActions: [],
        adjustments: [],
        reasons: ["speaker-only"],
      },
    ],
    screenScenes: [],
    durationSeconds: 40,
  });
  assert.equal(titleCues[0]?.title, "SeanLab Studio 项目概览");
  assert.ok(Array.from((titleCues[0]?.title ?? "").replace(/\s/g, "")).length <= 24);
});
