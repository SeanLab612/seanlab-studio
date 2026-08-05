import assert from "node:assert/strict";
import test from "node:test";
import type { OverlayCue } from "../src/data/sample-props.ts";
import {
  componentQaContracts,
  getComponentQaContract,
  layoutQaContracts,
  textAnnotationQaComponentId,
} from "../src/visual-qa/contracts.ts";
import { createQaFramePlan } from "../src/visual-qa/frame-plan.ts";

test("visual QA contracts cover 20 components and six landscape layouts", () => {
  assert.equal(componentQaContracts.length, 20);
  assert.equal(new Set(componentQaContracts.map((item) => item.componentId)).size, 20);
  assert.ok(componentQaContracts.every((item) => item.minimumFontPx >= 12));
  assert.equal(layoutQaContracts.length, 6);
  assert.ok(layoutQaContracts.every((item) => item.canvas.width === 1920 && item.canvas.height === 1080));
  assert.ok(layoutQaContracts.every((item) => item.titleBounds.height <= 96));
});

test("QA bounds match the current rendered widths of adaptive components", () => {
  for (const componentId of ["image-evidence-inset", "causal-chain", "binary-versus"] as const) {
    const contract = componentQaContracts.find((item) => item.componentId === componentId);
    assert.ok(contract);
    assert.equal(contract.contentBounds.width, 740);
  }
});

test("manual text annotations reuse the approved rough-annotation QA contract", () => {
  assert.equal(textAnnotationQaComponentId, "rough-annotation");
  const contract = getComponentQaContract(textAnnotationQaComponentId);
  assert.equal(contract.minimumFontPx, 24);
  assert.deepEqual(contract.contentBounds, { x: 55, y: 195, width: 790, height: 610 });
});

test("QA frame planner emits entry, transition, stable, and exit-risk frames in order", () => {
  const cue = {
    start: 10,
    end: 18,
    eyebrow: "LAB",
    title: "流动相更换",
    accent: "#fff",
    layoutTemplateId: "speaker-right-overlay-left",
    generatedVisual: {
      schemaVersion: "1.0",
      segment: { id: "mobile-phase", start: 10, end: 18, text: "更换流动相" },
      analysis: { rhetoric: "process-steps" },
      component: { id: "process-steps", status: "approved", selectionReason: "ordered procedure" },
      narrative: { eyebrow: "LAB", title: "流动相更换", subtitleZh: "更换流动相", subtitleEn: "Replace mobile phase" },
      props: { items: [{}, {}, {}] },
    },
  } satisfies OverlayCue;
  const frames = createQaFramePlan([cue], 30);
  assert.deepEqual(
    frames.map((item) => item.phase),
    ["entry", "transition", "stable", "exit-risk"],
  );
  assert.equal(frames.length, 4);
  assert.ok(frames.every((item, index) => index === 0 || item.frame > frames[index - 1].frame));
  assert.ok(frames[0].timeSeconds >= cue.start && frames.at(-1).timeSeconds < cue.end);
  const sixtyFpsFrames = createQaFramePlan([cue], 60);
  assert.equal(sixtyFpsFrames[2].frame, frames[2].frame * 2);
});
