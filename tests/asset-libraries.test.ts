import assert from "node:assert/strict";
import test from "node:test";
import { visualPacingReviewDimensions } from "../scripts/workflow/render-dimensions.mjs";
import { designTokenRegistry } from "../src/design-tokens/registry.ts";
import {
  componentAccentTokens,
  getGlassRecipe,
  getScrimRecipe,
  normalizeComponentAccentProps,
  resolveComponentAccent,
  viewerTextEmphasisPolicy,
} from "../src/design-tokens/tokens.ts";
import {
  layoutFixtureRegistry,
  layoutTemplateRegistry,
  validateLayoutTemplate,
} from "../src/layout-templates/registry.ts";
import { selectContentScale, selectLayoutTemplate } from "../src/layout-templates/selector.ts";
import { countAtProgress, motionProgress, staggerDelay } from "../src/motion-primitives/progress.ts";
import { motionPrimitiveRegistry } from "../src/motion-primitives/registry.ts";
import { motionPack2PrimitiveRegistry } from "../src/motion-primitives/registry.ts";
import {
  approvedMotionRecipeRegistry,
  motionPack2RecipeRegistry,
  componentMotionProfiles,
} from "../src/motion-recipes/registry.ts";
import { selectMotionRecipe } from "../src/motion-recipes/selector.ts";

test("design-token registry contains six approved foundations", () => {
  assert.equal(designTokenRegistry.length, 6);
  assert.equal(new Set(designTokenRegistry.map((item) => item.id)).size, 6);
  assert.ok(
    designTokenRegistry.every((item) => item.status === "approved" && item.useWhen.length && item.avoidWhen.length),
  );
  assert.match(getGlassRecipe("card").backdropFilter, /blur/);
  assert.notEqual(getGlassRecipe("card", 0.5).background, getGlassRecipe("card").background);
  assert.match(getGlassRecipe("card", 0.5).background, /rgba\(5,8,12,0\.095\)/);
  assert.match(getScrimRecipe("left").background, /linear-gradient\(90deg/);
  assert.equal(getScrimRecipe("none").background, "none");
});

test("all semantic component accents resolve through the approved global palette", () => {
  assert.deepEqual(componentAccentTokens, ["#6EA8FF", "#59D98E", "#F3B545", "#B59CFF", "#FF626B", "#D8D7D2"]);
  assert.equal(resolveComponentAccent("#C887FF"), "#B59CFF");
  assert.equal(resolveComponentAccent("#7ce8c3"), "#59D98E");
  assert.equal(resolveComponentAccent("#123456"), "#6EA8FF");
  assert.deepEqual(
    normalizeComponentAccentProps({ accent: "#62A8FF", items: [{ color: "#FF5B6E" }, { accent: "#C887FF" }] }),
    { accent: "#6EA8FF", items: [{ color: "#FF626B" }, { accent: "#B59CFF" }] },
  );
});

test("viewer text stays neutral while semantic emphasis remains bounded", () => {
  assert.equal(viewerTextEmphasisPolicy.baseColor, "#F5F2EA");
  assert.equal(viewerTextEmphasisPolicy.maxAccentColorsPerComponent, 2);
  assert.equal(viewerTextEmphasisPolicy.maxAccentRunsPerComponent, 3);
  assert.deepEqual(viewerTextEmphasisPolicy.accentColors, ["#6EA8FF", "#59D98E", "#F3B545", "#B59CFF", "#FF626B"]);
});

test("motion primitives are seek-safe and reduced-motion aware", () => {
  assert.equal(motionPrimitiveRegistry.length, 16);
  assert.equal(new Set(motionPrimitiveRegistry.map((item) => item.id)).size, 16);
  assert.ok(
    motionPrimitiveRegistry.every(
      (item) => item.status === "approved" && item.bestDurationMs[1] > item.bestDurationMs[0],
    ),
  );
  assert.equal(motionProgress({ frame: -100, fps: 30 }), 0);
  assert.equal(motionProgress({ frame: 1000, fps: 30 }), 1);
  assert.equal(motionProgress({ frame: 0, fps: 30, reducedMotion: true }), 1);
  assert.equal(staggerDelay(3, 30, 100), 9);
  assert.equal(countAtProgress(0, 100, 1), 100);
});

test("approved motion pack 2 is available to production", () => {
  assert.equal(motionPack2PrimitiveRegistry.length, 6);
  assert.ok(motionPack2PrimitiveRegistry.every((item) => item.status === "approved"));
  assert.equal(motionPack2RecipeRegistry.length, 6);
  assert.ok(motionPack2RecipeRegistry.every((item) => item.status === "approved"));
  assert.equal(motionPrimitiveRegistry.length, 16);
});

test("every semantic component has a controlled motion profile", () => {
  assert.equal(componentMotionProfiles.length, 20);
  assert.ok(
    componentMotionProfiles.every((profile) =>
      approvedMotionRecipeRegistry.some((recipe) => recipe.id === profile.defaultRecipe),
    ),
  );
  assert.equal(selectMotionRecipe({ componentId: "ranked-metric-list", intent: "reorder" }), "rank-reorder");
});

test("six layout templates stay inside the canvas and protect face and subtitles", () => {
  assert.equal(layoutTemplateRegistry.length, 6);
  assert.equal(new Set(layoutTemplateRegistry.map((item) => item.id)).size, 6);
  assert.ok(layoutTemplateRegistry.every(validateLayoutTemplate));
});

test("speaker fixture metadata covers left, center, right, bright, and dark cases", () => {
  assert.equal(layoutFixtureRegistry.length, 4);
  assert.deepEqual(
    new Set(layoutFixtureRegistry.map((item) => item.speakerPosition)),
    new Set(["left", "center", "right"]),
  );
  assert.deepEqual(new Set(layoutFixtureRegistry.map((item) => item.luminance)), new Set(["dark", "bright"]));
  for (const fixture of layoutFixtureRegistry) assert.ok(fixture.src.length > 0);
});

test("semantic component and face position select a registered layout", () => {
  assert.equal(selectLayoutTemplate({ componentId: "binary-versus", faceCenterX: 0.5 }), "bilateral-comparison");
  assert.equal(selectLayoutTemplate({ componentId: "media-comparison", faceCenterX: 0.25 }), "media-evidence");
  assert.equal(
    selectLayoutTemplate({ componentId: "ranked-metric-list", faceCenterX: 0.75 }),
    "speaker-right-overlay-left",
  );
});

test("wide components shrink deterministically to the selected content zone", () => {
  const scenarioScale = selectContentScale({
    componentId: "scenario-branches",
    layoutTemplateId: "speaker-right-overlay-left",
  });
  const compactScale = selectContentScale({
    componentId: "binary-versus",
    layoutTemplateId: "speaker-right-overlay-left",
  });
  assert.ok(scenarioScale >= 0.82 && scenarioScale < compactScale);
  assert.ok(compactScale <= 1);
});

test("key statistics stay outside the centered speaker face zone", () => {
  const scale = selectContentScale({
    componentId: "key-stat-summary",
    layoutTemplateId: "speaker-center-left",
  });
  const componentRightEdge = (55 + 810) * scale;
  const faceLeftEdge = layoutTemplateRegistry.find((item) => item.id === "speaker-center-left")?.faceExclusion.x;
  assert.equal(scale, 0.82);
  assert.ok(faceLeftEdge !== undefined && componentRightEdge < faceLeftEdge);
});

test("the 720p pacing-review scale produces integer dimensions", () => {
  assert.deepEqual(visualPacingReviewDimensions({ width: 1920, height: 1080 }), { width: 1280, height: 720 });
});
