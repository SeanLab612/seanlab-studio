import { execFile } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { promisify } from "node:util";

const run = promisify(execFile);
const outputDir = "out/component-regression-0.1.8";
await mkdir(outputDir, { recursive: true });

const cases = [
  ["distribution-bars", "ReviewDistributionBars", "180"],
  ["scenario-branches", "ReviewScenarioBranches", "180"],
  ["market-cap-lines", "ReviewMarketCapLines", "180"],
  ["person-evidence-card", "ReviewPersonEvidenceCard", "180"],
  ["factor-sequence", "ReviewFactorSequenceFour", "180"],
  ["ranked-metric-list", "ReviewRankedMetricScore", "180"],
  ["binary-versus", "ReviewBinaryVersus", "180"],
  ["key-stat-summary", "ReviewKeyStatSummary", "180"],
  ["media-comparison", "ReviewMediaComparisonTwo", "180"],
  ["image-evidence-inset", "ReviewImageEvidenceLandscape", "150"],
  ["process-steps", "ReviewProcessSteps", "180"],
  ["causal-chain", "ReviewCausalChain", "180"],
  ["quote-source-card", "ReviewQuoteSourceReport", "180"],
  ["historical-timeline", "ReviewHistoricalTimeline", "180"],
  ["decision-matrix", "ReviewDecisionMatrix", "180"],
  ["model-classification-map", "ReviewModelClassificationMap", "180"],
  ["capability-surface-grid", "ReviewCapabilitySurfaceGrid", "180"],
  ["tradeoff-scale", "ReviewTradeoffScale", "180"],
  ["rough-annotation", "ReviewRoughAnnotationNegation", "90"],
  ["editorial-statement", "ReviewEditorialStatement", "120"],
];

let cursor = 0;
const worker = async () => {
  while (cursor < cases.length) {
    const index = cursor++;
    const [id, composition, frame] = cases[index];
    const output = `${outputDir}/${id}.png`;
    await run("npx", ["remotion", "still", "src/index.ts", composition, output, "--frame", frame], {
      maxBuffer: 20 * 1024 * 1024,
    });
    console.log(`${index + 1}/${cases.length} ${id}`);
  }
};

await Promise.all([worker(), worker(), worker()]);
console.log(`${cases.length} approved component stills rendered to ${outputDir}`);
