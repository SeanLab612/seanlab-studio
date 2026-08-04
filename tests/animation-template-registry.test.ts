import assert from "node:assert/strict";
import test from "node:test";
import {
  animationTemplateIds,
  animationTemplateRegistry,
  resolveAnimationTemplate,
} from "../src/animation-system/template-registry.ts";

test("animation template registry exposes the approved hand-drawn style", () => {
  assert.deepEqual(animationTemplateIds, ["paper-editorial"]);
  assert.equal(animationTemplateRegistry.length, 1);
  assert.equal(resolveAnimationTemplate("paper-editorial").previewSeconds, 10);
  assert.throws(() => resolveAnimationTemplate("stop-motion-machine"), /已批准列表/);
});
