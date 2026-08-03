import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { runEnvironmentDoctor } from "./operations/doctor.mjs";
import { readManifest } from "./workflow/manifest.mjs";
import { loadProviderEnvironmentFromZsh } from "./workflow/shell-environment.mjs";

loadProviderEnvironmentFromZsh();

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const projectPath = option("--project");
let sourcePath = option("--source");
let workspacePath = option("--workspace") ?? process.cwd();
let requireMimo = true;
let requireCodex = false;
let requireClaude = false;
const requiredAgent = option("--agent");
if (requiredAgent && !["codex-cli", "claude-code"].includes(requiredAgent))
  throw new Error("--agent must be codex-cli or claude-code");
if (requiredAgent === "codex-cli") requireCodex = true;
if (requiredAgent === "claude-code") requireClaude = true;
if (args.includes("--no-mimo")) requireMimo = false;
if (projectPath) {
  const context = await readManifest(projectPath);
  sourcePath = context.paths.source;
  workspacePath = context.paths.workspace;
  requireMimo =
    context.manifest.providers.translation.provider === "mimo" ||
    context.manifest.providers.semanticPlanning.provider === "mimo";
  requireCodex =
    requireCodex ||
    context.manifest.providers.translation.provider === "codex-cli" ||
    context.manifest.providers.semanticPlanning.provider === "codex-cli" ||
    context.manifest.providers.recutPlanning?.provider === "codex-cli";
  requireClaude =
    requireClaude ||
    context.manifest.providers.translation.provider === "claude-code" ||
    context.manifest.providers.semanticPlanning.provider === "claude-code" ||
    context.manifest.providers.recutPlanning?.provider === "claude-code";
}
const report = await runEnvironmentDoctor({ sourcePath, workspacePath, requireMimo, requireCodex, requireClaude });
const output = option("--output");
if (output) {
  await mkdir(dirname(resolve(output)), { recursive: true });
  await writeFile(resolve(output), `${JSON.stringify(report, null, 2)}\n`);
}

if (args.includes("--json")) console.log(JSON.stringify(report));
else {
  console.log(`Environment Doctor: ${report.status.toUpperCase()}`);
  for (const item of report.checks)
    console.log(`${item.status.toUpperCase().padEnd(7)} ${item.label.padEnd(28)} ${item.summary}`);
  if (output) console.log(`Report: ${resolve(output)}`);
}
if (report.status === "failed") process.exitCode = 2;
