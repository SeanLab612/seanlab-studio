import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { assertFixturePromotionAllowed } from "../../src/regression-fixtures/index.ts";

const run = promisify(execFile);
const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const reportPath = resolve(option("--report") ?? "out/feature-0.1.13/component-regression-report.json");
const approvedSha = option("--approve-report-sha");
const approvedBy = option("--approved-by");
const report = JSON.parse(await readFile(reportPath, "utf8"));
assertFixturePromotionAllowed(report, approvedSha, approvedBy);
const baselinePath = resolve(option("--baseline") ?? "regression-fixtures/baselines/components-16x9.json");
const goldenDir = resolve(option("--golden-dir") ?? "regression-fixtures/golden/16x9/components");
await run("python3", [
  "scripts/regression_fixture_images.py",
  "promote",
  reportPath,
  baselinePath,
  goldenDir,
  approvedBy,
]);
const registryPath = resolve(option("--registry") ?? "regression-fixtures/registry.json");
const registry = JSON.parse(await readFile(registryPath, "utf8"));
const fixture = registry.fixtures.find((item) => item.id === report.suiteId);
if (!fixture) throw new Error(`Missing registry fixture: ${report.suiteId}`);
fixture.status = "approved";
await writeFile(registryPath, `${JSON.stringify(registry, null, 2)}\n`);
console.log(JSON.stringify({ event: "fixtures.promoted", fixtureId: report.suiteId, baselinePath, approvedBy }));
