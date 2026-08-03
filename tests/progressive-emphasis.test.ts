import assert from "node:assert/strict";
import test from "node:test";
import { resolveProgressiveEmphasis } from "../src/components/review/progressive-emphasis.ts";

test("progressive emphasis keeps all states visible and makes the active item strongest", () => {
  const completed = resolveProgressiveEmphasis({ index: 0, activeIndex: 1 });
  const active = resolveProgressiveEmphasis({ index: 1, activeIndex: 1 });
  const pending = resolveProgressiveEmphasis({ index: 2, activeIndex: 1 });

  assert.equal(completed.state, "completed");
  assert.equal(active.state, "active");
  assert.equal(pending.state, "pending");
  assert.ok(completed.opacity > 0);
  assert.ok(pending.opacity > 0);
  assert.ok(active.opacity > pending.opacity);
  assert.ok(pending.opacity > completed.opacity);
  assert.ok(active.brightness > pending.brightness);
  assert.ok(pending.brightness > completed.brightness);
});

test("active emphasis settles without exceeding the visual contract", () => {
  const entering = resolveProgressiveEmphasis({ index: 1, activeIndex: 1, activeProgress: 0 });
  const settled = resolveProgressiveEmphasis({ index: 1, activeIndex: 1, activeProgress: 1 });

  assert.ok(settled.opacity > entering.opacity);
  assert.equal(settled.opacity, 1);
  assert.equal(settled.brightness, 1);
  assert.equal(settled.saturation, 1);
  assert.equal(settled.scale, 1);
});
