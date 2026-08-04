import assert from "node:assert/strict";
import test from "node:test";
import { brandIconGraphics } from "../src/icons/brand-graphics.ts";
import { resolveFunctionalIconId } from "../src/icons/resolve-functional-icon.ts";
import { iconRegistry, isIconId, systemIconRegistry } from "../src/icons/registry.ts";

test("brand artwork is admitted explicitly and missing marks retain a registered fallback", () => {
  assert.equal(brandIconGraphics["brand.github"]?.upstream, "simple-icons");
  assert.equal(brandIconGraphics["brand.anthropic"]?.upstream, "simple-icons");
  assert.equal(brandIconGraphics["brand.openai"], undefined);
  assert.equal(iconRegistry["brand.openai"].shortLabel, "OA");
});

test("functional icon fallback uses semantic matches before deterministic random selection", () => {
  assert.equal(resolveFunctionalIconId(undefined, "录屏素材"), "system.video");
  assert.equal(resolveFunctionalIconId(undefined, "口播音频"), "system.microphone");
  assert.equal(resolveFunctionalIconId(undefined, "动画制作"), "system.animation");
  assert.equal(resolveFunctionalIconId(undefined, "交付成片"), "system.download");
  assert.equal(resolveFunctionalIconId(undefined, "发现记录缺失"), "system.warning");
  assert.equal(resolveFunctionalIconId(undefined, "视觉编排"), "system.design");
  assert.equal(resolveFunctionalIconId(undefined, "分析结果趋势"), "system.line-chart");
  assert.equal(resolveFunctionalIconId(undefined, "理解产品需求"), "system.search");
  assert.equal(resolveFunctionalIconId(undefined, "整理文章内容"), "system.document");
  assert.equal(resolveFunctionalIconId(undefined, "锁定口播锚点"), "system.link");
  assert.equal(resolveFunctionalIconId(undefined, "系统分层结构"), "system.layers");
  assert.equal(resolveFunctionalIconId(undefined, "满足条件才允许放行"), "system.security");
  assert.equal(resolveFunctionalIconId(undefined, "进入正式制作"), "system.flow");

  const first = resolveFunctionalIconId("unknown.component", "没有明确匹配的内容");
  const second = resolveFunctionalIconId("unknown.component", "没有明确匹配的内容");
  assert.equal(first, second);
  assert.ok(first in systemIconRegistry);
  assert.ok(isIconId(first));
});
