import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const configPath = resolve(option("--config") ?? "config/workflow-test.json");
const approvedSha = option("--approve-report-sha");
const approvedBy = option("--approved-by");
if (!approvedSha || !approvedBy)
  throw new Error(
    "Usage: npm run qa:baseline -- --config <runtime-config> --approve-report-sha <sha> --approved-by <name>",
  );
const config = JSON.parse(await readFile(configPath, "utf8"));
const qaDir = resolve(config.visualQa?.outputDir ?? `${config.editDir}/visual-qa`);
const reportPath = resolve(config.visualQa?.reportFile ?? `${qaDir}/qa-report.json`);
const report = JSON.parse(await readFile(reportPath, "utf8"));
if (report.reportSha256 !== approvedSha) throw new Error("Approval SHA does not match the current QA report.");
const metrics = JSON.parse(await readFile(resolve(qaDir, "image-metrics.json"), "utf8"));
const entries = metrics.frames
  .filter((item) => item.phase === "stable" && !item.missing)
  .map((item) => ({
    cueId: item.cueId,
    componentId: item.componentId,
    layoutId: item.layoutId,
    frame: item.frame,
    timeSeconds: item.timeSeconds,
    dhash: item.dhash,
    screenshot: item.file,
  }));
const baselinePath = resolve(
  config.visualQa?.baselineFile ?? `visual-baselines/16x9/${config.projectId ?? "workflow-test"}.json`,
);
await mkdir(dirname(baselinePath), { recursive: true });
await writeFile(
  baselinePath,
  `${JSON.stringify({ schemaVersion: "1.0", projectId: report.projectId, canvas: report.canvas, approvedAt: new Date().toISOString(), approvedBy, sourceReportSha256: approvedSha, entries }, null, 2)}\n`,
);
console.log(baselinePath);
