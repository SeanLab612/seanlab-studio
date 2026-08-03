import assert from "node:assert/strict";
import test from "node:test";
import {
  MIN_PRODUCTION_COMPONENT_SCALE,
  resolveProductionComponentScale,
  resolveProductionScrimSide,
} from "../src/layout-templates/component-stage.ts";

test("every information component uses the hard-coded left stage scrim", () => {
  for (const layoutScrimSide of ["left", "right", "none"] as const) {
    assert.equal(resolveProductionScrimSide({ hasComponentCue: true, layoutScrimSide }), "left");
  }
});

test("non-component visuals preserve their layout scrim", () => {
  for (const layoutScrimSide of ["left", "right", "none"] as const) {
    assert.equal(resolveProductionScrimSide({ hasComponentCue: false, layoutScrimSide }), layoutScrimSide);
  }
});

test("information components cannot be reduced below the mobile production scale", () => {
  assert.equal(resolveProductionComponentScale({ hasComponentCue: true, requestedScale: 0.78 }), 1);
  assert.equal(resolveProductionComponentScale({ hasComponentCue: true, requestedScale: 1.08 }), 1.08);
  assert.equal(MIN_PRODUCTION_COMPONENT_SCALE, 1);
});

test("non-component visuals preserve the requested scale", () => {
  assert.equal(resolveProductionComponentScale({ hasComponentCue: false, requestedScale: 0.78 }), 0.78);
});
