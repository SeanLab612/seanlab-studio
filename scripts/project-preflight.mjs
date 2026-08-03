import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { CURRENT_ASSET_PROFILE, readManifest } from "./workflow/manifest.mjs";
import { createStages } from "./workflow/stages.mjs";
import { classifyOperationalError } from "./operations/errors.mjs";
import { runProjectPreflight } from "./operations/preflight.mjs";
import { loadProviderEnvironmentFromZsh } from "./workflow/shell-environment.mjs";

loadProviderEnvironmentFromZsh();

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

let manifestPath = option("--project");
let activeStage;
if (!manifestPath && args[0]) {
  const runtime = JSON.parse(await readFile(resolve(args[0]), "utf8"));
  manifestPath = runtime.manifestPath;
  activeStage = "preflight";
}
if (!manifestPath) throw new Error("Usage: npm run project:preflight -- --project <project.json> [--json]");

try {
  const context = await readManifest(manifestPath);
  const report = await runProjectPreflight({
    context,
    stages: createStages(context),
    currentAssetProfile: CURRENT_ASSET_PROFILE,
    activeStage,
  });
  const outputPath = resolve(option("--output") ?? context.paths.preflightReport);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  if (args.includes("--json") || activeStage) console.log(JSON.stringify(report));
  else {
    console.log(`Project preflight: ${report.status.toUpperCase()}`);
    for (const item of report.checks)
      console.log(`${item.status.toUpperCase().padEnd(7)} ${item.label.padEnd(28)} ${item.summary}`);
    console.log(`Report: ${outputPath}`);
  }
  if (report.status === "failed") process.exitCode = 2;
} catch (error) {
  const failure = classifyOperationalError(error, { stage: "preflight" });
  console.error(JSON.stringify({ schemaVersion: "1.0", event: "preflight.failed", failure }));
  process.exitCode = 2;
}
