import assert from "node:assert/strict";
import test from "node:test";
import { dedupeAgentRoughAnnotations } from "../src/visual-production/annotation-dedupe.ts";

const cue = (items: Array<{ id: string; text: string; effect: string }>) => ({
  start: 2,
  end: 6,
  generatedVisual: {
    component: { id: "rough-annotation" },
    segment: { id: "rough-1" },
    props: {
      items,
      activeIndex: 0,
      activeIndexTimeline: items.map((_, index) => ({ at: index, index })),
    },
  },
});

const userAnnotation = {
  id: "user-note",
  sectionId: "overview",
  exactSpokenQuote: "只保留一次",
  status: "confirmed" as const,
  origin: "user" as const,
  executionPolicy: "locked" as const,
  effect: "circle" as const,
  start: 3,
  end: 5,
  startCue: 1,
  endCue: 2,
};

test("user annotation wins while unrelated Agent annotation items remain", () => {
  const result = dedupeAgentRoughAnnotations({
    overlayCues: [
      cue([
        { id: "same", text: "只保留一次", effect: "underline" },
        { id: "extra", text: "下游补充", effect: "box" },
      ]),
    ],
    userAnnotations: [userAnnotation],
  });
  assert.equal(result.removedItemCount, 1);
  assert.equal(result.removedCueCount, 0);
  assert.deepEqual(result.overlayCues[0].generatedVisual.props.items, [
    { id: "extra", text: "下游补充", effect: "box" },
  ]);
  assert.deepEqual(result.overlayCues[0].generatedVisual.props.activeIndexTimeline, [{ at: 1, index: 0 }]);
});

test("a fully duplicated Agent annotation cue is removed", () => {
  const result = dedupeAgentRoughAnnotations({
    overlayCues: [cue([{ id: "same", text: "只 保留一次！", effect: "underline" }])],
    userAnnotations: [userAnnotation],
  });
  assert.equal(result.removedItemCount, 1);
  assert.equal(result.removedCueCount, 1);
  assert.deepEqual(result.removedCueIds, ["rough-1"]);
  assert.deepEqual(result.overlayCues, []);
});

test("same words outside the user annotation interval are not removed", () => {
  const result = dedupeAgentRoughAnnotations({
    overlayCues: [{ ...cue([{ id: "same", text: "只保留一次", effect: "underline" }]), start: 8, end: 10 }],
    userAnnotations: [userAnnotation],
  });
  assert.equal(result.removedItemCount, 0);
  assert.equal(result.overlayCues.length, 1);
});
