import { execFile } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const suitePath = resolve(option("--suite") ?? "regression-fixtures/expected/component-suite.json");
const outputDir = resolve(option("--output") ?? "out/feature-0.1.13/component-current");
const reportPath = resolve(option("--report") ?? "out/feature-0.1.13/component-regression-report.json");
const contactSheetPath = resolve(option("--contact-sheet") ?? "out/feature-0.1.13/component-contact-sheet.jpg");
const baselinePath = resolve(option("--baseline") ?? "regression-fixtures/baselines/components-16x9.json");
const suite = JSON.parse(await readFile(suitePath, "utf8"));
await mkdir(outputDir, { recursive: true });

if (!args.includes("--skip-render")) {
  let cursor = 0;
  const worker = async () => {
    while (cursor < suite.cases.length) {
      const index = cursor++;
      const item = suite.cases[index];
      const output = resolve(outputDir, `${item.id}.png`);
      await run("npx", ["remotion", "still", "src/index.ts", item.composition, output, "--frame", String(item.frame)], {
        maxBuffer: 24 * 1024 * 1024,
      });
      console.log(`${index + 1}/${suite.cases.length} ${item.id}`);
    }
  };
  await Promise.all([worker(), worker(), worker()]);
}

await run("python3", [
  "scripts/regression_fixture_images.py",
  "analyze",
  suitePath,
  outputDir,
  baselinePath,
  reportPath,
  contactSheetPath,
]);
console.log(JSON.stringify({ event: "fixtures.component-suite.finished", reportPath, contactSheetPath }));
