import assert from "node:assert/strict";
import test from "node:test";
import { animationTemplateIds } from "../src/animation-system/template-registry.ts";
import { resolveAnimationProductionSurface } from "../src/animation-system/production-surface.ts";

test("every approved animation template has an opaque production canvas", () => {
  for (const templateId of animationTemplateIds) {
    const surface = resolveAnimationProductionSurface(templateId);
    assert.match(surface.backgroundColor, /^#[0-9A-F]{6}$/i);
    assert.equal(surface.opacity, 1);
    assert.equal(surface.isolation, "isolate");
  }
});
