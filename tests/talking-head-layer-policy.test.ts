import assert from "node:assert/strict";
import test from "node:test";
import {
  hasManagedProductionTimeline,
  shouldRenderLegacyFallback,
} from "../src/compositions/talking-head-layer-policy.ts";

test("a title-only production timeline suppresses the legacy sample title", () => {
  const timeline = { overlayCues: [], titleCues: [{ id: "title-1" }] };
  assert.equal(hasManagedProductionTimeline(timeline), true);
  assert.equal(shouldRenderLegacyFallback(timeline, false), false);
});

test("any managed production layer suppresses legacy fallback copy", () => {
  for (const key of ["overlayCues", "subtitleCues", "screenScenes", "animationCues", "annotationCues", "imageCues"])
    assert.equal(shouldRenderLegacyFallback({ [key]: [{}] }, false), false, key);
});

test("legacy sample props still render their fallback when no production timeline exists", () => {
  assert.equal(shouldRenderLegacyFallback({}, false), true);
  assert.equal(shouldRenderLegacyFallback({}, true), false);
});
