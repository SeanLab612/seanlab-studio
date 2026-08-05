import assert from "node:assert/strict";
import test from "node:test";
import { APPROVED_COMPONENT_IDS, type ApprovedVisualComponentId } from "../src/visual-brief/types.ts";
import { getComponentQaContract } from "../src/visual-qa/contracts.ts";
import { usesMobilePersonEvidenceDensity } from "../src/visual-brief/component-density.ts";
import { PERSON_EVIDENCE_DENSITY } from "../src/components/review/person-evidence-density.ts";

const firstMobileBatch = {
  "ranked-metric-list": 18,
  "binary-versus": 20,
  "decision-matrix": 22,
  "capability-surface-grid": 24,
  "tradeoff-scale": 22,
} as const;

const thirdMobileBatch = {
  "scenario-branches": 22,
  "factor-sequence": 22,
  "process-steps": 22,
  "causal-chain": 22,
  "historical-timeline": 22,
} as const;

const fourthMobileBatch = {
  "decision-matrix": 22,
  "model-classification-map": 22,
  "capability-surface-grid": 24,
  "tradeoff-scale": 22,
} as const;

const fifthMobileBatch = {
  "distribution-bars": 22,
  "market-cap-lines": 24,
  "person-evidence-card": 22,
  "key-stat-summary": 22,
  "media-comparison": 22,
} as const;

const finalMobileBatch = {
  "image-evidence-inset": 22,
  "quote-source-card": 22,
  "rough-annotation": 24,
  "editorial-statement": 24,
} as const;

const mobileContracts = {
  ...firstMobileBatch,
  ...thirdMobileBatch,
  ...fourthMobileBatch,
  ...fifthMobileBatch,
  ...finalMobileBatch,
} satisfies Record<ApprovedVisualComponentId, number>;

test("mobile readability contracts cover all 20 approved components", () => {
  assert.deepEqual(Object.keys(mobileContracts).sort(), [...APPROVED_COMPONENT_IDS].sort());
});

test("mobile component batches have explicit readable font floors", () => {
  for (const [componentId, minimumFontPx] of Object.entries(mobileContracts)) {
    assert.equal(
      getComponentQaContract(componentId as ApprovedVisualComponentId).minimumFontPx,
      minimumFontPx,
      componentId,
    );
  }
});

test("the generated person evidence component always uses its mobile production density", () => {
  assert.equal(usesMobilePersonEvidenceDensity("person-evidence-card"), true);
  for (const componentId of APPROVED_COMPONENT_IDS)
    if (componentId !== "person-evidence-card") assert.equal(usesMobilePersonEvidenceDensity(componentId), false);
});

test("person evidence mobile density keeps every supporting label readable after phone downscaling", () => {
  const mobile = PERSON_EVIDENCE_DENSITY.mobile;
  assert.ok(mobile.portraitSize >= 200);
  assert.ok(mobile.nameFontSize >= 50);
  assert.ok(mobile.roleFontSize >= 30);
  assert.ok(mobile.quoteFontSize >= 34);
  assert.ok(mobile.evidenceEyebrowFontSize >= 28);
  assert.ok(mobile.evidenceTitleFontSize >= 34);
  assert.ok(mobile.evidenceMetaFontSize >= 28);
  assert.ok(mobile.timelineFontSize >= 28);
});
