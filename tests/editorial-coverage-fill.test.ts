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

test("filler respects the editorial share budget and two-cue gap limit", () => {
  const result = planEditorialCoverageFill({
    captions,
    coveredIntervals: [],
    existingEditorialCues: [{ start: 90, end: 100 }],
    durationSeconds: 100,
    minimumCoverageRatio: 0.8,
    maximumEditorialCoverageRatio: 0.25,
  });
  assert.ok(result.report.plannedSeconds <= 15.001);
  assert.ok(result.cues.length <= 2);
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
