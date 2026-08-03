import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { runEnvironmentDoctor } from "./operations/doctor.mjs";
import { evaluateAcceptance, evaluateResumeEvents, inspectAcceptanceArtifacts } from "./operations/acceptance.mjs";
import { runProjectPreflight } from "./operations/preflight.mjs";
import { CURRENT_ASSET_PROFILE, readManifest } from "./workflow/manifest.mjs";
import { createStages } from "./workflow/stages.mjs";
import { loadProviderEnvironmentFromZsh } from "./workflow/shell-environment.mjs";

loadProviderEnvironmentFromZsh();

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const project = option("--project");
if (!project)
  throw new Error("Usage: npm run acceptance -- --project <project.json> [--verify-existing] [--output <report.json>]");
const context = await readManifest(project);

const runWorkflow = async (workflowArgs) => {
  const child = spawn(process.execPath, ["scripts/workflow.mjs", "--project", context.manifestPath, ...workflowArgs], {
    cwd: process.cwd(),
    env: process.env,
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
    process.stdout.write(chunk);
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
    process.stderr.write(chunk);
  });
  const exitCode = await new Promise((done) => {
    child.on("error", () => done(-1));
    child.on("close", done);
  });
  return {
    exitCode,
    stdout,
    stderr,
    events: stdout
      .split(/\r?\n/)
      .filter(Boolean)
      .flatMap((line) => {
        try {
          return [JSON.parse(line)];
        } catch {
          return [];
        }
      }),
  };
};

const doctor = await runEnvironmentDoctor({
  sourcePath: context.paths.source,
  workspacePath: context.paths.workspace,
  requireMimo:
    context.manifest.providers.translation.provider === "mimo" ||
    context.manifest.providers.semanticPlanning.provider === "mimo",
  requireCodex:
    context.manifest.providers.translation.provider === "codex-cli" ||
    context.manifest.providers.semanticPlanning.provider === "codex-cli" ||
    context.manifest.providers.recutPlanning?.provider === "codex-cli",
  requireClaude:
    context.manifest.providers.translation.provider === "claude-code" ||
    context.manifest.providers.semanticPlanning.provider === "claude-code" ||
    context.manifest.providers.recutPlanning?.provider === "claude-code",
});
const preflight = await runProjectPreflight({
  context,
  stages: createStages(context),
  currentAssetProfile: CURRENT_ASSET_PROFILE,
});
let workflowExitCode = 0;
if (!args.includes("--verify-existing")) {
  const run = await runWorkflow(["--until", "review"]);
  workflowExitCode = run.exitCode;
}
const resumeRun = await runWorkflow(["--until", "review", "--dry-run"]);
const resume = evaluateResumeEvents(resumeRun.events);
const artifacts = await inspectAcceptanceArtifacts(context);
const decision = evaluateAcceptance({ doctor, preflight, artifacts, resume, workflowExitCode });
const report = {
  schemaVersion: "1.0",
  kind: "workflow-acceptance",
  generatedAt: new Date().toISOString(),
  projectId: context.manifest.project.id,
  mode: args.includes("--verify-existing") ? "verify-existing" : "full",
  status: decision.status,
  summary: {
    doctor: doctor.status,
    preflight: preflight.status,
    requiredStages: artifacts.checks.length,
    passedStages: artifacts.checks.filter((item) => item.status === "passed").length,
    captions: artifacts.evidence.captions,
    semanticCues: artifacts.evidence.semanticCues,
    visualDirection: artifacts.evidence.visualDirection,
    reviewEvidence: artifacts.evidence.reviewEvidence,
    qa: artifacts.evidence.qa.status,
    regression: artifacts.evidence.regression.status,
    resumeMode: resume.mode,
  },
  doctor,
  preflight,
  artifacts,
  resume,
  findings: decision.findings,
};
const outputPath = resolve(option("--output") ?? `out/acceptance/${context.manifest.project.id}.json`);
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(
  JSON.stringify({
    event: "acceptance.finished",
    status: report.status,
    reportPath: outputPath,
    summary: report.summary,
  }),
);
if (report.status === "failed") process.exitCode = 2;
