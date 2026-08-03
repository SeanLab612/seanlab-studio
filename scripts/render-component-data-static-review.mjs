import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { CHART_RECIPE_IDS } from "../src/charts/types.ts";

const run = promisify(execFile);
const remotion = resolve("node_modules/.bin/remotion");
const outputDir = resolve("out/component-data-borderless-review");
const componentDir = resolve(outputDir, "components");
const dataDir = resolve(outputDir, "data-effects");
const backgroundIndex = process.argv.indexOf("--background");
const localReviewBackground = backgroundIndex >= 0 ? process.argv[backgroundIndex + 1] : undefined;
if (backgroundIndex >= 0 && !localReviewBackground) {
  throw new Error("--background requires a public-relative image path.");
}
await Promise.all([mkdir(componentDir, { recursive: true }), mkdir(dataDir, { recursive: true })]);

const componentCases = [
  ["distribution-bars", "ReviewDistributionBars", 180],
  ["scenario-branches", "ReviewScenarioBranches", 180],
  ["market-cap-lines", "ReviewMarketCapLines", 180],
  ["person-evidence-card", "ReviewPersonEvidenceCard", 180],
  ["factor-sequence", "ReviewFactorSequenceFour", 180],
  ["ranked-metric-list", "ReviewRankedMetricScore", 180],
  ["binary-versus", "ReviewBinaryVersus", 180],
  ["key-stat-summary", "ReviewKeyStatSummary", 180],
  ["media-comparison", "ReviewMediaComparisonTwo", 180],
  ["image-evidence-inset", "ReviewImageEvidenceLandscape", 150],
  ["process-steps", "ReviewProcessSteps", 180],
  ["causal-chain", "ReviewCausalChain", 180],
  ["quote-source-card", "ReviewQuoteSourceReport", 180],
  ["historical-timeline", "ReviewHistoricalTimeline", 180],
  ["decision-matrix", "ReviewDecisionMatrix", 180],
  ["model-classification-map", "ReviewModelClassificationMap", 180],
  ["capability-surface-grid", "ReviewCapabilitySurfaceGrid", 180],
  ["tradeoff-scale", "ReviewTradeoffScale", 180],
  ["rough-annotation", "ReviewRoughAnnotationNegation", 90],
].map(([id, composition, frame]) => ({
  kind: "component",
  id,
  composition,
  frame,
  output: resolve(componentDir, `${id}.png`),
}));

const compositionId = (recipeId) =>
  `ReviewChart${recipeId
    .split("-")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("")}`;

const dataCases = CHART_RECIPE_IDS.map((id) => ({
  kind: "data-effect",
  id,
  composition: compositionId(id),
  frame: 120,
  output: resolve(dataDir, `${id}.png`),
}));

const cases = [...componentCases, ...dataCases];
let cursor = 0;
const worker = async () => {
  while (cursor < cases.length) {
    const index = cursor++;
    const item = cases[index];
    await run(
      remotion,
      [
        "still",
        "src/index.ts",
        item.composition,
        item.output,
        "--frame",
        String(item.frame),
        "--image-format",
        "png",
        ...(localReviewBackground ? ["--props", JSON.stringify({ backgroundSrc: localReviewBackground })] : []),
        "--log",
        "error",
      ],
      { maxBuffer: 16 * 1024 * 1024 },
    );
    console.log(`${index + 1}/${cases.length} ${item.kind} ${item.id}`);
  }
};

await Promise.all([worker(), worker(), worker()]);
await run("python3", ["scripts/static_component_data_contact_sheet.py", outputDir], {
  maxBuffer: 8 * 1024 * 1024,
});
await writeFile(
  resolve(outputDir, "manifest.json"),
  `${JSON.stringify(
    {
      schemaVersion: "1.0",
      canvas: { width: 1920, height: 1080, fps: 30 },
      fullVideoRendered: false,
      design: {
        iconFallback: "semantic-then-deterministic-random",
        iconContainer: false,
        cardContainer: false,
        typographyReference: "rough-annotation",
      },
      reviewBackground: localReviewBackground
        ? { path: localReviewBackground, gitPolicy: "local-only" }
        : { path: "registered-default", gitPolicy: "tracked" },
      frames: cases,
    },
    null,
    2,
  )}\n`,
);
console.log(`${cases.length} static frames -> ${outputDir}`);
