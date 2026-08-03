import assert from "node:assert/strict";
import test from "node:test";
import { validateChartQa } from "../src/charts/qa.ts";
import { chartRecipeRegistry, componentChartBindings, restrictedChartRecipes } from "../src/charts/registry.ts";
import { selectChartRecipe } from "../src/charts/selector.ts";
import { CHART_RECIPE_IDS } from "../src/charts/types.ts";
import { generateVisualBriefFromDraft } from "../src/visual-brief/generator.ts";

test("chart foundation registers ten approved recipes and keeps radar restricted", () => {
  assert.equal(CHART_RECIPE_IDS.length, 10);
  assert.equal(Object.keys(chartRecipeRegistry).length, 10);
  assert.ok(Object.values(chartRecipeRegistry).every((item) => item.status === "approved"));
  assert.equal(restrictedChartRecipes.radar.status, "restricted");
});

test("chart intent routes deterministic quantitative relationships", () => {
  assert.equal(selectChartRecipe({ relation: "time-series", entityCount: 3, metricCount: 1 }).id, "line-trend");
  assert.equal(selectChartRecipe({ relation: "proportion", entityCount: 1, metricCount: 1 }).id, "ring-ratio");
  assert.equal(
    selectChartRecipe({ relation: "bridge", entityCount: 5, metricCount: 1, hasNegativeValues: true }).id,
    "waterfall",
  );
  assert.equal(
    selectChartRecipe({ relation: "risk-return", entityCount: 5, metricCount: 2 }).id,
    "risk-return-quadrant",
  );
});

test("five approved semantic components have chart allowlists", () => {
  assert.deepEqual(
    Object.keys(componentChartBindings).sort(),
    ["decision-matrix", "distribution-bars", "key-stat-summary", "market-cap-lines", "ranked-metric-list"].sort(),
  );
});

test("chart QA detects invalid percentages, missing units, density, and empty end state", () => {
  const issues = validateChartQa({
    recipeId: "bar-comparison",
    model: {
      data: Array.from({ length: 13 }, (_, index) => ({
        id: `${index}`,
        label: index === 0 ? "这是一个明显过长并且无法在有限空间中安全展示的标签" : `项目 ${index}`,
        value: index === 12 ? 130 : index,
      })),
    },
    width: 500,
    declaredFontPx: 10,
    finalStateHasMarks: false,
  });
  const rules = new Set(issues.map((item) => item.rule));
  assert.ok(rules.has("chart.density.data"));
  assert.ok(rules.has("chart.capacity"));
  assert.ok(rules.has("chart.font.minimum"));
  assert.ok(rules.has("chart.label.long"));
  assert.ok(rules.has("chart.unit.missing"));
  assert.ok(rules.has("chart.end-state.empty"));
});

test("approved chart recipes are available through controlled production routing", () => {
  const segment = { id: "purity", start: 0, end: 8, text: "五种抗体主峰纯度对比" };
  const draft = {
    analysis: {
      rhetoric: "distribution",
      entityCount: 5,
      sharedMetric: true,
      chartIntent: { relation: "category-comparison", entityCount: 5, metricCount: 1 },
    },
    narrative: {
      eyebrow: "PURITY",
      title: "五种抗体纯度",
      subtitleZh: "抗体 B 最高",
      subtitleEn: "Antibody B is highest",
    },
    props: {
      bars: [
        { label: "A", value: 96 },
        { label: "B", value: 98 },
      ],
    },
  } as const;
  assert.equal(generateVisualBriefFromDraft(segment, draft, "production").chart?.recipeId, "bar-comparison");
  assert.equal(generateVisualBriefFromDraft(segment, draft, "review").chart?.recipeId, "bar-comparison");
});
