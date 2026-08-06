import { execFile } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { promisify } from "node:util";

const run = promisify(execFile);
const outputDir = "out/component-emphasis-review";
await mkdir(outputDir, { recursive: true });

const cases = [
  ["01-distribution-bars", "ReviewDistributionBars", "180"],
  ["02-scenario-branches", "ReviewScenarioBranches", "180"],
  ["03-market-cap-lines", "ReviewMarketCapLines", "180"],
  ["04-person-evidence-card", "ReviewPersonEvidenceCard", "180"],
  ["05-factor-sequence", "ReviewFactorSequenceFour", "180"],
  ["06-ranked-metric-list", "ReviewRankedMetricScore", "180"],
  ["07-binary-versus", "ReviewBinaryVersus", "180"],
  ["08-key-stat-summary", "ReviewKeyStatSummary", "180"],
  ["09-media-comparison", "ReviewMediaComparisonTwo", "180"],
  ["10-image-evidence-inset", "ReviewImageEvidenceLandscape", "150"],
  ["11-process-steps", "ReviewProcessSteps", "180"],
  ["12-causal-chain", "ReviewCausalChain", "180"],
  ["13-quote-source-card", "ReviewQuoteSourceReport", "180"],
  ["14-historical-timeline", "ReviewHistoricalTimeline", "180"],
  ["15-decision-matrix", "ReviewDecisionMatrix", "180"],
  ["16-model-classification-map", "ReviewModelClassificationMap", "180"],
  ["17-capability-surface-grid", "ReviewCapabilitySurfaceGrid", "180"],
  ["18-tradeoff-scale", "ReviewTradeoffScale", "180"],
  ["19-rough-annotation", "ReviewRoughAnnotationNegation", "90"],
  ["20-editorial-statement", "ReviewEditorialStatement", "120"],
];

let cursor = 0;
const worker = async () => {
  while (cursor < cases.length) {
    const index = cursor++;
    const [id, composition, frame] = cases[index];
    await run("npx", ["remotion", "still", "src/index.ts", composition, `${outputDir}/${id}.png`, "--frame", frame], {
      maxBuffer: 20 * 1024 * 1024,
    });
    console.log(`${index + 1}/${cases.length} ${id}`);
  }
};

await Promise.all([worker(), worker(), worker()]);
console.log(`${cases.length} emphasis-review stills rendered to ${outputDir}`);
