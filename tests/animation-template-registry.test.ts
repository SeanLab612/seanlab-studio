import assert from "node:assert/strict";
import test from "node:test";
import {
  animationTemplateIds,
  animationTemplateRegistry,
  resolveAnimationTemplate,
} from "../src/animation-system/template-registry.ts";

test("animation template registry exposes all approved animation styles", () => {
  assert.deepEqual(animationTemplateIds, ["paper-editorial", "stop-motion-machine", "research-archive"]);
  assert.equal(animationTemplateRegistry.length, 3);
  assert.equal(resolveAnimationTemplate("stop-motion-machine").previewSeconds, 10);
  assert.match(resolveAnimationTemplate("stop-motion-machine").previewUrl, /stop-motion-machine-preview-v1\.mp4$/);
  assert.match(resolveAnimationTemplate("research-archive").previewUrl, /research-archive-preview-v1\.mp4$/);
});
