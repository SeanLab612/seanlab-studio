import assert from "node:assert/strict";
import test from "node:test";
import { APPROVED_COMPONENT_IDS } from "../src/visual-brief/types.ts";
import {
  evaluateTopicRegressionFixture,
  validateTopicRegressionSuite,
  type TopicSelectionObservation,
} from "../src/regression-fixtures/topic-suite.ts";
import { MULTI_TOPIC_REGRESSION_SUITE } from "../src/regression-fixtures/topic-fixtures.ts";

test("multi-topic suite covers all component-backed visual forms and all 20 approved components with frozen real sources", () => {
  assert.equal(validateTopicRegressionSuite(MULTI_TOPIC_REGRESSION_SUITE, { verifyMaterials: true }), true);
  const covered = new Set(
    MULTI_TOPIC_REGRESSION_SUITE.fixtures.flatMap((fixture) =>
      fixture.expectations.flatMap((expectation) => expectation.expectedOneOf),
    ),
  );
  assert.deepEqual(covered, new Set(APPROVED_COMPONENT_IDS));
  assert.equal(MULTI_TOPIC_REGRESSION_SUITE.status, "candidate");
  assert.ok(
    MULTI_TOPIC_REGRESSION_SUITE.fixtures
      .flatMap((fixture) => fixture.expectations)
      .some((expectation) => expectation.expectedIconIds?.includes("brand.kimi")),
  );
  assert.ok(
    MULTI_TOPIC_REGRESSION_SUITE.fixtures
      .flatMap((fixture) => fixture.expectations)
      .some((expectation) => expectation.expectedIconIds?.includes("system.flow")),
  );
});

test("eligible observations pass without requiring one fixed component across unrelated topics", () => {
  for (const fixture of MULTI_TOPIC_REGRESSION_SUITE.fixtures) {
    const observations: TopicSelectionObservation[] = fixture.expectations.map((expectation, index) => ({
      expectationId: expectation.id,
      componentId: expectation.expectedOneOf[0],
      evidenceText: expectation.evidenceText,
      evidenceStart: index * 10,
      evidenceEnd: index * 10 + 6,
      visualStart: index * 10,
      visualEnd: index * 10 + 6,
      polarity: expectation.polarity,
      materialId: expectation.materialId,
      iconIds: expectation.expectedIconIds,
      viewerCopy: [expectation.evidenceText],
    }));
    const report = evaluateTopicRegressionFixture(fixture, observations);
    assert.equal(report.summary.errors, 0, JSON.stringify(report.findings));
    assert.equal(report.summary.warnings, 0, JSON.stringify(report.findings));
  }
});

test("topic evaluation catches semantic family, timing, polarity, icon and viewer-copy regressions", () => {
  const fixture = MULTI_TOPIC_REGRESSION_SUITE.fixtures.find((item) => item.id === "model-benchmark-real");
  assert.ok(fixture);
  const expectation = fixture.expectations.find((item) => item.id === "focus-k3-score");
  assert.ok(expectation);
  const report = evaluateTopicRegressionFixture(fixture, [
    {
      expectationId: expectation.id,
      componentId: "process-steps",
      evidenceText: expectation.evidenceText,
      evidenceStart: 20,
      evidenceEnd: 26,
      visualStart: 10,
      visualEnd: 30,
      polarity: "negated",
      iconIds: [],
      viewerCopy: ["process-steps"],
    },
  ]);
  const rules = new Set(report.findings.map((finding) => finding.rule));
  assert.ok(rules.has("selection.outside-eligible-family"));
  assert.ok(rules.has("timing.too-early"));
  assert.ok(rules.has("timing.too-late"));
  assert.ok(rules.has("evidence.polarity-mismatch"));
  assert.ok(rules.has("icon.required-missing"));
  assert.ok(rules.has("viewer-copy.internal-id"));
});
