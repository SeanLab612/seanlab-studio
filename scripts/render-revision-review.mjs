import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { allowedOperatorActions, recommendResume } from "../src/operator-control/contract.ts";
import { applyRevision } from "./operations/revisions.mjs";
import { createManifest, readManifest, writeManifest } from "./workflow/manifest.mjs";
import { CONDITIONAL_STAGE_NAMES, createStages, signatureConfigForStage } from "./workflow/stages.mjs";
import { hashFile, loadState, saveState, signatureFor } from "./workflow/state.mjs";

const execFileAsync = promisify(execFile);
const outputDir = resolve("out/feature-0.1.15");
await mkdir(outputDir, { recursive: true });
const root = await mkdtemp(join(tmpdir(), "remotion-revision-review-"));
const manifestPath = join(root, "project/project.json");
const source = join(root, "source.mp4");
const transcript = join(root, "transcript.json");
await writeFile(source, "review-source-placeholder");
await writeFile(transcript, JSON.stringify({ words: [] }));
const manifest = createManifest({
  id: "revision-review",
  title: "Revision review fixture",
  source,
  transcript,
  outputPath: manifestPath,
});
manifest.providers.translation.provider = "offline";
manifest.providers.semanticPlanning.provider = "fixture";
await writeManifest(manifest, manifestPath);
const context = await readManifest(manifestPath);
await mkdir(context.paths.workspace, { recursive: true });

const cue = {
  start: 10,
  end: 18,
  eyebrow: "WORKFLOW",
  title: "生成之后仍可精确修订",
  subtitle: "每次修改都保留明确边界",
  subtitleEn: "Every revision keeps an explicit boundary",
  accent: "#6EA8FF",
  layoutTemplateId: "speaker-center-left",
  generatedVisual: {
    schemaVersion: "1.0",
    segment: { id: "revision-boundary", start: 10, end: 18, text: "生成之后仍然需要安全修订" },
    analysis: { rhetoric: "historical-timeline" },
    component: { id: "historical-timeline", status: "approved", selectionReason: "Review fixture" },
    narrative: {
      eyebrow: "WORKFLOW",
      title: "生成之后仍可精确修订",
      subtitleZh: "每次修改都保留明确边界",
      subtitleEn: "Every revision keeps an explicit boundary",
    },
    props: { items: [{ label: "生成" }, { label: "检查" }, { label: "修订" }] },
  },
};
const captions = [
  {
    start: 10,
    end: 18,
    zh: "生成之后仍然需要安全修订",
    en: "Generated work still needs safe revision",
    role: "caption",
  },
];
await writeFile(
  context.paths.planning,
  `${JSON.stringify({ schemaVersion: "1.0", status: "review", overlayCues: [cue] }, null, 2)}\n`,
);
await writeFile(
  context.paths.reviewProps,
  `${JSON.stringify({ overlayCues: [cue], subtitleCues: captions }, null, 2)}\n`,
);
await writeFile(resolve(context.paths.workspace, "captions-verbatim.json"), `${JSON.stringify(captions, null, 2)}\n`);
await writeFile(context.paths.captionsSource, `${JSON.stringify(captions, null, 2)}\n`);
await mkdir(resolve(context.paths.workspace, "visual-qa"), { recursive: true });
await mkdir(resolve(context.paths.workspace, "regression"), { recursive: true });
await writeFile(context.paths.reviewEvidence, JSON.stringify({ kind: "review-evidence" }));
await writeFile(resolve(context.paths.workspace, "visual-qa/qa-report.json"), JSON.stringify({ status: "passed" }));
await writeFile(context.paths.regressionReport, JSON.stringify({ status: "passed" }));
const repositoryRoot = resolve(".");
process.chdir(root);
const stages = createStages(context);
process.chdir(repositoryRoot);
const state = await loadState({
  statePath: context.paths.state,
  projectId: manifest.project.id,
  manifestPath,
  stageNames: stages.map(({ name }) => name),
  conditionalStageNames: CONDITIONAL_STAGE_NAMES,
});
for (const name of state.stageOrder) state.stages[name].status = name === "human-approval" ? "approved" : "succeeded";
const reviewBaseStage = stages.find(({ name }) => name === "review-base");
await mkdir(dirname(reviewBaseStage.outputs[0]), { recursive: true });
await writeFile(reviewBaseStage.outputs[0], "review-base-placeholder");
state.stages["review-base"].outputs = reviewBaseStage.outputs;
state.stages["review-base"].inputSignature = await signatureFor([
  manifest.schemaVersion,
  reviewBaseStage.name,
  reviewBaseStage.inputs,
  ...reviewBaseStage.inputs,
  signatureConfigForStage(manifest, reviewBaseStage.name),
]);
state.stages["review-base"].outputSignature = await signatureFor(reviewBaseStage.outputs);
await saveState(context.paths.state, state);

const rejectionRequest = {
  schemaVersion: "1.0",
  revisionId: "review-rejected-001",
  projectId: "revision-review",
  reviewer: "Release reviewer",
  reason: "The first title is too long and the overlay should move away from the speaker.",
  decision: "rejected",
  expected: {
    reviewEvidenceSha256: await hashFile(context.paths.reviewEvidence),
    visualQaReportSha256: await hashFile(resolve(context.paths.workspace, "visual-qa/qa-report.json")),
    regressionReportSha256: await hashFile(context.paths.regressionReport),
  },
  operations: [],
};
const rejectionPath = join(root, "rejection.json");
await writeFile(rejectionPath, JSON.stringify(rejectionRequest));
const rejection = await applyRevision({ manifestPath, revisionPath: rejectionPath });

const beforeCue = JSON.parse(await readFile(context.paths.planning, "utf8")).overlayCues[0];
const revisionRequest = {
  schemaVersion: "1.0",
  revisionId: "visual-revision-001",
  projectId: "revision-review",
  reviewer: "Release reviewer",
  reason: "Use concise viewer copy and the reviewed right-side layout.",
  decision: "revision-requested",
  expected: {
    planningSha256: await hashFile(context.paths.planning),
    reviewPropsSha256: await hashFile(context.paths.reviewProps),
  },
  operations: [
    {
      type: "visual-cue.update",
      cueIndex: 0,
      expectedSegmentId: "revision-boundary",
      patch: { title: "修改只重跑必要阶段", layoutTemplateId: "speaker-center-right", start: 10.4, end: 17.6 },
    },
  ],
};
const revisionPath = join(root, "revision.json");
await writeFile(revisionPath, JSON.stringify(revisionRequest));
const revision = await applyRevision({ manifestPath, revisionPath });
const afterCue = JSON.parse(await readFile(context.paths.planning, "utf8")).overlayCues[0];
const finalState = JSON.parse(await readFile(context.paths.state, "utf8"));
const statusStages = finalState.stageOrder.map((name) => ({ name, status: finalState.stages[name].status }));
const { stdout } = await execFileAsync(
  process.execPath,
  [
    resolve(repositoryRoot, "scripts/workflow.mjs"),
    "--project",
    manifestPath,
    "--from",
    "component-props",
    "--until",
    "review",
    "--dry-run",
  ],
  { cwd: root, maxBuffer: 10 * 1024 * 1024 },
);
const dryRunEvents = stdout
  .trim()
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => JSON.parse(line))
  .filter(({ event }) => event === "stage.planned");
const report = {
  schemaVersion: "1.0",
  feature: "feature-0.1.15",
  generatedAt: new Date().toISOString(),
  status: "passed",
  rejection,
  revision,
  cueDiff: {
    before: {
      start: beforeCue.start,
      end: beforeCue.end,
      title: beforeCue.title,
      layoutTemplateId: beforeCue.layoutTemplateId,
    },
    after: {
      start: afterCue.start,
      end: afterCue.end,
      title: afterCue.title,
      layoutTemplateId: afterCue.layoutTemplateId,
    },
  },
  preservedStages: statusStages.filter(({ status }) => status === "succeeded").map(({ name }) => name),
  resume: recommendResume(statusStages),
  dryRunEvents,
  allowedActions: allowedOperatorActions({ hasState: true, reviewReady: false, approved: false }),
};
await writeFile(resolve(outputDir, "revision-review.json"), `${JSON.stringify(report, null, 2)}\n`);
await writeFile(
  resolve(outputDir, "revision-review.md"),
  `# Review revision 0.1.15\n\n- Status: ${report.status}\n- Rejection: ${rejection.revisionId} -> ${rejection.earliestStaleStage}\n- Revision: ${revision.revisionId} -> ${revision.earliestStaleStage}\n- Approval revoked by rejection: ${rejection.approvalRevoked}\n- Before: ${report.cueDiff.before.title} / ${report.cueDiff.before.layoutTemplateId} / ${report.cueDiff.before.start}-${report.cueDiff.before.end}s\n- After: ${report.cueDiff.after.title} / ${report.cueDiff.after.layoutTemplateId} / ${report.cueDiff.after.start}-${report.cueDiff.after.end}s\n- Narrow resume: ${report.resume?.fromStage} -> ${report.resume?.target}\n- Preserved stages: ${report.preservedStages.join(", ")}\n- Planned downstream stages: ${dryRunEvents.map(({ stage }) => stage).join(", ")}\n`,
);
console.log(JSON.stringify({ status: "passed", outputDir, report: resolve(outputDir, "revision-review.json") }));
