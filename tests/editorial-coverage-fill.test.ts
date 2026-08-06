import assert from "node:assert/strict";
import test from "node:test";
import { planEditorialCoverageFill } from "../src/visual-direction/editorial-coverage-fill.ts";

const captions = Array.from({ length: 20 }, (_, index) => ({
  start: index * 5,
  end: index * 5 + 4.5,
  zh: `第${index + 1}段口播只陈述一个普通观点。`,
  en: `Plain statement ${index + 1}.`,
}));

test("deterministic editorial filler closes an eligible coverage deficit", () => {
  const result = planEditorialCoverageFill({
    captions,
    coveredIntervals: [{ start: 0, end: 74 }],
    durationSeconds: 100,
    minimumCoverageRatio: 0.8,
  });
  assert.equal(result.report.status, "filled");
  assert.ok(result.report.plannedSeconds >= 6);
  assert.ok(result.report.predictedCoveredSeconds >= 80);
  assert.ok(result.cues.every((cue) => cue.start >= 74 && cue.generatedVisual.component.id === "editorial-statement"));
});

test("filler never overlaps established visual intervals and preserves exact caption evidence", () => {
  const result = planEditorialCoverageFill({
    captions,
    coveredIntervals: [
      { start: 0, end: 20 },
      { start: 30, end: 80 },
    ],
    durationSeconds: 100,
    minimumCoverageRatio: 0.86,
  });
  assert.ok(
    result.cues.every((cue) =>
      [
        { start: 0, end: 20 },
        { start: 30, end: 80 },
      ].every((interval) => cue.end <= interval.start || cue.start >= interval.end),
    ),
  );
  for (const cue of result.cues) {
    const source = captions
      .filter((caption) => caption.start >= cue.start - 0.001 && caption.start < cue.end)
      .map((caption) => caption.zh)
      .join("");
    assert.ok(source.startsWith(cue.generatedVisual.segment.text));
    assert.equal(cue.coverageFill, true);
  }
});

test("filler respects the editorial share budget and three-cue gap limit", () => {
  const result = planEditorialCoverageFill({
    captions,
    coveredIntervals: [],
    existingEditorialCues: [{ start: 90, end: 100 }],
    durationSeconds: 100,
    minimumCoverageRatio: 0.8,
    maximumEditorialCoverageRatio: 0.25,
  });
  assert.ok(result.report.plannedSeconds <= 15.001);
  assert.ok(result.cues.length <= 3);
  assert.equal(result.report.status, "partially-filled");
});

test("filler is a no-op when the coverage target is already satisfied", () => {
  const result = planEditorialCoverageFill({
    captions,
    coveredIntervals: [{ start: 0, end: 82 }],
    durationSeconds: 100,
    minimumCoverageRatio: 0.8,
  });
  assert.equal(result.report.status, "not-needed");
  assert.deepEqual(result.cues, []);
});

test("filler may close a long speaker-only gap after minimum coverage is already satisfied", () => {
  const result = planEditorialCoverageFill({
    captions,
    coveredIntervals: [
      { start: 0, end: 80 },
      { start: 98, end: 100 },
    ],
    durationSeconds: 100,
    minimumCoverageRatio: 0.8,
    maximumSpeakerOnlyGapSeconds: 15,
  });
  assert.equal(result.report.deficitSeconds, 0);
  assert.equal(result.report.longGapFillSeconds, 3);
  assert.ok(result.cues.length >= 1);
  assert.ok(result.report.predictedCoveredSeconds > 82);
});

test("filler derives a complete bounded narrative title instead of copying truncated component text", () => {
  const result = planEditorialCoverageFill({
    captions: [
      {
        start: 0,
        end: 5,
        zh: "流程卡住后还得自己改代码。所以我把资料理解、写稿和制作连在了一起。",
        en: "When the workflow stalls, creators still have to edit code themselves.",
      },
    ],
    coveredIntervals: [],
    durationSeconds: 5,
    minimumCoverageRatio: 1,
  });
  assert.equal(result.cues[0]?.generatedVisual.narrative.title, "流程卡住后还得自己改代码");
  assert.doesNotMatch(result.cues[0]?.generatedVisual.narrative.title ?? "", /…/);
  assert.ok((result.cues[0]?.generatedVisual.narrative.title.length ?? 99) <= 18);
});

test("one filler may use the available window to close a remaining deficit", () => {
  const result = planEditorialCoverageFill({
    captions: Array.from({ length: 4 }, (_, index) => ({
      start: index * 2,
      end: index * 2 + 2,
      zh: `这是第${index + 1}句连续观点。`,
      en: `Statement ${index + 1}.`,
    })),
    coveredIntervals: [],
    durationSeconds: 10,
    minimumCoverageRatio: 0.6,
    maximumConsecutive: 1,
  });
  assert.equal(result.cues.length, 1);
  assert.equal(result.cues[0]?.end - (result.cues[0]?.start ?? 0), 6);
  assert.equal(result.report.status, "filled");
  assert.ok(result.report.predictedCoveredSeconds >= 6);
});

test("coverage mode may use a third consecutive filler when two leave a sub-two-second deficit", () => {
  const result = planEditorialCoverageFill({
    captions: Array.from({ length: 6 }, (_, index) => ({
      start: index * 2,
      end: index * 2 + 2,
      zh: `连续观点第${index + 1}句。`,
      en: `Consecutive statement ${index + 1}.`,
    })),
    coveredIntervals: [],
    durationSeconds: 15,
    minimumCoverageRatio: 0.8,
    minimumDurationSeconds: 2,
    maximumDurationSeconds: 5,
    maximumConsecutive: 3,
  });
  assert.equal(result.cues.length, 3);
  assert.equal(result.report.status, "filled");
  assert.ok(result.report.predictedCoveredSeconds >= 12);
});
