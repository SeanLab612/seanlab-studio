import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

const args = process.argv.slice(2);
const reports = args.flatMap((value, index) => (value === "--report" ? [args[index + 1]] : [])).filter(Boolean);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};
if (reports.length < 2) throw new Error("Provide at least two --report paths");

const generatedAt = new Date().toISOString();
const outputDirectory = resolve(
  option("--output", `out/agent-conformance/comparisons/${generatedAt.replaceAll(":", "-").replaceAll(".", "-")}`),
);
await mkdir(outputDirectory, { recursive: true });

const entries = await Promise.all(
  reports.map(async (path) => {
    const absolutePath = resolve(path);
    const bytes = await readFile(absolutePath);
    const report = JSON.parse(bytes.toString("utf8"));
    if (report.schemaVersion !== "1.0" || report.contractVersion !== "agent-conformance-1.0")
      throw new Error(`Unsupported conformance report: ${path}`);
    return {
      path: absolutePath,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      fixtureId: report.fixtureId,
      agentId: report.agent.id,
      requestedModel: report.agent.requestedModel,
      observedModels: report.agent.observedModels,
      status: report.status,
      repetitions: report.summary.repetitions,
      metrics: {
        narrationSchemaSuccessRate: report.summary.stages.narration.schemaSuccessRate,
        narrationCoverage: report.summary.narration.requiredTermCoverage,
        recutSchemaSuccessRate: report.summary.stages.recut.schemaSuccessRate,
        recutPrecision: report.summary.recut.precision,
        recutRecall: report.summary.recut.recall,
        semanticSchemaSuccessRate: report.summary.stages["semantic-plan"].schemaSuccessRate,
        evidencePrecision: report.summary.semantic.evidencePrecision,
        evidenceRecall: report.summary.semantic.evidenceRecall,
        unsupportedFactBlockRate: report.summary.semantic.unsupportedFactBlockRate,
        averageCandidateComponentCount: report.summary.semantic.averageCandidateComponentCount,
        averageSelectedComponentCount: report.summary.semantic.averageSelectedComponentCount,
        viewerCopyPassRate: report.summary.semantic.viewerCopyPassRate,
        layoutCapacityPassRate: report.summary.semantic.layoutCapacityPassRate,
        minimumSemanticRangeSimilarity: report.summary.minimumSemanticRangeSimilarity,
        failedAttempts: report.summary.execution.failedAttempts,
        cancelledAttempts: report.summary.execution.cancelledAttempts,
        timeoutAttempts: report.summary.execution.timeoutAttempts,
        averageTotalElapsedMs: Math.round(
          Object.values(report.summary.stages).reduce((total, stage) => total + stage.averageElapsedMs, 0),
        ),
      },
    };
  }),
);
if (new Set(entries.map((entry) => entry.fixtureId)).size !== 1)
  throw new Error("Comparison reports must use the same fixture");

const comparison = {
  schemaVersion: "1.0",
  contractVersion: "agent-conformance-comparison-1.0",
  generatedAt,
  fixtureId: entries[0].fixtureId,
  entries,
  decision: null,
  note: "Component counts are observations, not minimum-density gates. Human review is required.",
};
await writeFile(resolve(outputDirectory, "comparison.json"), `${JSON.stringify(comparison, null, 2)}\n`);

const metricRows = [
  ["Status", (entry) => entry.status],
  ["Narration schema success", (entry) => entry.metrics.narrationSchemaSuccessRate.toFixed(3)],
  ["Narration term coverage", (entry) => entry.metrics.narrationCoverage.toFixed(3)],
  ["Recut precision", (entry) => entry.metrics.recutPrecision.toFixed(3)],
  ["Recut recall", (entry) => entry.metrics.recutRecall.toFixed(3)],
  ["Evidence precision", (entry) => entry.metrics.evidencePrecision.toFixed(3)],
  ["Evidence recall", (entry) => entry.metrics.evidenceRecall.toFixed(3)],
  ["Unsupported fact block", (entry) => entry.metrics.unsupportedFactBlockRate.toFixed(3)],
  ["Candidate components", (entry) => entry.metrics.averageCandidateComponentCount.toFixed(2)],
  ["Selected components", (entry) => entry.metrics.averageSelectedComponentCount.toFixed(2)],
  ["Viewer copy pass", (entry) => entry.metrics.viewerCopyPassRate.toFixed(3)],
  ["Layout capacity pass", (entry) => entry.metrics.layoutCapacityPassRate.toFixed(3)],
  ["Minimum range similarity", (entry) => entry.metrics.minimumSemanticRangeSimilarity.toFixed(3)],
  [
    "Failed / cancelled / timeout",
    (entry) =>
      `${entry.metrics.failedAttempts} / ${entry.metrics.cancelledAttempts} / ${entry.metrics.timeoutAttempts}`,
  ],
  ["Average three-stage latency", (entry) => `${entry.metrics.averageTotalElapsedMs} ms`],
];
const headers = entries.map(
  (entry) => `${entry.agentId} / ${entry.requestedModel ?? (entry.observedModels.join(",") || "unreported")}`,
);
await writeFile(
  resolve(outputDirectory, "comparison.md"),
  `# Agent/model conformance comparison

- Fixture: ${entries[0].fixtureId}
- Generated: ${generatedAt}
- Decision: pending human review

| Metric | ${headers.join(" | ")} |
|---|${entries.map(() => "---:").join("|")}|
${metricRows.map(([label, render]) => `| ${label} | ${entries.map(render).join(" | ")} |`).join("\n")}

## Evidence files

${entries.map((entry) => `- ${basename(entry.path)} · SHA-256 \`${entry.sha256}\``).join("\n")}

Component counts are observations only. This comparison does not auto-select or auto-approve a model.
`,
);
console.log(
  JSON.stringify({
    outputDirectory,
    comparison: resolve(outputDirectory, "comparison.json"),
    review: resolve(outputDirectory, "comparison.md"),
  }),
);
