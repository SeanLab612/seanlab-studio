import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { compareProjectFixture, validateRegressionRegistry } from "../../src/regression-fixtures/index.ts";

const config = JSON.parse(await readFile(resolve(process.argv[2] ?? "config/workflow-test.json"), "utf8"));
const outputPath = resolve(config.regression?.reportFile ?? `${config.editDir}/regression/report.json`);
const reviewPath = resolve(config.regression?.reviewFile ?? `${config.editDir}/regression/review.md`);
await mkdir(dirname(outputPath), { recursive: true });

if (config.regression?.enabled === false || !config.regression) {
  const skipped = { schemaVersion: "1.0", projectId: config.projectId, status: "skipped", findings: [] };
  skipped.reportSha256 = createHash("sha256").update(JSON.stringify(skipped)).digest("hex");
  await writeFile(outputPath, `${JSON.stringify(skipped, null, 2)}\n`);
  await writeFile(reviewPath, "# Regression fixture check\n\nSkipped by project manifest.\n");
  console.log(`${outputPath}: skipped`);
  process.exit(0);
}

const registry = JSON.parse(await readFile(resolve(config.regression.registryFile), "utf8"));
validateRegressionRegistry(registry, { verifyFiles: config.regression.verifyLocalSources ? "all" : "tracked" });
const fixture = registry.fixtures.find((item) => item.id === config.regression.fixtureId);
if (!fixture) throw new Error(`Unknown regression fixture: ${config.regression.fixtureId}`);
const expected = JSON.parse(await readFile(resolve(config.regression.expectedManifestFile), "utf8"));
const plan = JSON.parse(await readFile(resolve(config.planningFile), "utf8"));
const captions = JSON.parse(await readFile(resolve(config.editDir, "captions-verbatim.json"), "utf8"));
const terminology = JSON.parse(await readFile(resolve(config.terminologyProfileFile), "utf8"));
const qa = JSON.parse(await readFile(resolve(config.visualQa.reportFile), "utf8"));
const { findings, summary } = compareProjectFixture({ expected, plan, captions, terminology, qa });
const report = {
  schemaVersion: "1.0",
  profileId: registry.profileId,
  projectId: config.projectId,
  fixtureId: fixture.id,
  canvas: { width: 1920, height: 1080 },
  status: summary.errors ? "failed" : summary.warnings ? "warning" : "passed",
  summary,
  artifacts: {
    expectedManifest: resolve(config.regression.expectedManifestFile),
    visualQaReport: resolve(config.visualQa.reportFile),
    planning: resolve(config.planningFile),
  },
  findings,
};
report.reportSha256 = createHash("sha256").update(JSON.stringify(report)).digest("hex");
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
await writeFile(
  reviewPath,
  `# Regression fixture check — ${report.projectId}\n\n- Fixture: ${report.fixtureId}\n- Status: ${report.status}\n- Expected/actual cues: ${summary.expectedCues}/${summary.actualCues}\n- Errors: ${summary.errors}\n- Warnings: ${summary.warnings}\n- Report SHA: ${report.reportSha256}\n`,
);
console.log(`${outputPath}: ${report.status}, ${summary.errors} errors, ${summary.warnings} warnings`);
if (summary.errors) process.exitCode = 2;
