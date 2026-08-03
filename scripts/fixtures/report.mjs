import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const registry = JSON.parse(
  await readFile(resolve(option("--registry") ?? "regression-fixtures/registry.json"), "utf8"),
);
const componentReport = JSON.parse(
  await readFile(
    resolve(option("--component-report") ?? "out/feature-0.1.13/component-regression-report.json"),
    "utf8",
  ),
);
const workflowReport = JSON.parse(
  await readFile(
    resolve(option("--workflow-report") ?? "projects/workflow-test/workspace/regression/report.json"),
    "utf8",
  ),
);
const outputJson = resolve(option("--json") ?? "out/feature-0.1.13/fixture-audit.json");
const outputMarkdown = resolve(option("--markdown") ?? "out/feature-0.1.13/fixture-audit.md");
const coverage = [...new Set(registry.fixtures.flatMap((item) => item.coverage))].sort();
const coverageMatrix = Object.fromEntries(
  coverage.map((tag) => [
    tag,
    registry.fixtures.filter((fixture) => fixture.coverage.includes(tag)).map((fixture) => fixture.id),
  ]),
);
const report = {
  schemaVersion: "1.0",
  profileId: registry.profileId,
  status:
    componentReport.summary.errors || workflowReport.summary?.errors
      ? "failed"
      : componentReport.baselineStatus === "awaiting-human-promotion"
        ? "awaiting-human-review"
        : "passed",
  fixtures: registry.fixtures.map(({ id, status, title, coverage, sources }) => ({
    id,
    status,
    title,
    coverage,
    sourcePolicies: sources.map(({ kind, gitPolicy, redistributable, rights }) => ({
      kind,
      gitPolicy,
      redistributable,
      rights,
    })),
  })),
  coverage,
  coverageMatrix,
  componentSuite: componentReport,
  workflowSuite: workflowReport,
  examples: {
    passing: { rule: "semantic.componentId", expected: "ranked-metric-list", actual: "ranked-metric-list" },
    failing: {
      rule: "baseline.changed",
      threshold: 10,
      exampleDistance: 18,
      action: "block promotion and inspect still",
    },
  },
};
report.reportSha256 = createHash("sha256").update(JSON.stringify(report)).digest("hex");
await mkdir(dirname(outputJson), { recursive: true });
await writeFile(outputJson, `${JSON.stringify(report, null, 2)}\n`);
const markdown = `# Regression fixture audit — feature-0.1.13

- Status: ${report.status}
- Registered fixture groups: ${registry.fixtures.length}
- Coverage tags: ${coverage.length}
- Component stills: ${componentReport.summary.rendered}/${componentReport.summary.cases}
- Component baseline: ${componentReport.baselineStatus}
- Workflow semantic cues: ${workflowReport.summary?.actualCues}/${workflowReport.summary?.expectedCues}
- Workflow errors/warnings: ${workflowReport.summary?.errors}/${workflowReport.summary?.warnings}
- Audit SHA: ${report.reportSha256}

## Privacy boundary

${registry.fixtures
  .map((fixture) => {
    const policies = [...new Set(fixture.sources.map((source) => source.gitPolicy))].join(", ");
    const redistributable = fixture.sources.every((source) => source.redistributable);
    return `- ${fixture.id}: ${fixture.sources.length} source(s); ${policies}; redistributable=${redistributable}`;
  })
  .join("\n")}

## Coverage matrix

${Object.entries(coverageMatrix)
  .map(([tag, fixtureIds]) => `- ${tag}: ${fixtureIds.join(", ")}`)
  .join("\n")}

## Review artifacts

- Component contact sheet: out/feature-0.1.13/component-contact-sheet.jpg
- Component structured report: out/feature-0.1.13/component-regression-report.json
- Workflow structured report: projects/workflow-test/workspace/regression/report.json

## Gate examples

- Passing: expected and actual semantic component ids match.
- Failing: a perceptual-hash distance above 10 blocks promotion until the still is reviewed.
`;
await writeFile(outputMarkdown, markdown);
console.log(JSON.stringify({ event: "fixtures.audit.written", status: report.status, outputJson, outputMarkdown }));
