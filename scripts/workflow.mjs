import { spawn } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { validateArtifactSchema } from "./operations/artifact-schema.mjs";
import { classifyOperationalError, OperationalError, redactSecrets, summarizeStageLog } from "./operations/errors.mjs";
import { runProjectPreflight } from "./operations/preflight.mjs";
import { verifyReviewEvidence } from "./operations/review-evidence.mjs";
import { createApprovalSnapshot, verifyAndRestoreApprovalSnapshot } from "./workflow/approval-snapshot.mjs";
import {
  contextWithDeliveryProfileOverride,
  deliveryProfileOverrideFromOptions,
} from "./workflow/delivery-profile-override.mjs";
import { CURRENT_ASSET_PROFILE, readManifest, toRuntimeConfig } from "./workflow/manifest.mjs";
import { summarizeWorkflowPreview } from "./workflow/preview-summary.mjs";
import { isProcessTreeRunning, processTreeSpawnOptions, terminateProcessTree } from "./workflow/process-tree.mjs";
import {
  beginSemanticAttempt,
  candidateOutputsForStage,
  failSemanticAttempt,
  finalizeSemanticAttemptComparison,
  promoteSemanticAttempt,
  resumeSemanticAttempt,
} from "./workflow/semantic-attempts.mjs";
import { loadProviderEnvironmentFromZsh } from "./workflow/shell-environment.mjs";
import {
  approvedDeliveryStartIndex,
  assertQaApprovalAllowed,
  CONDITIONAL_STAGE_NAMES,
  createStages,
  dependentStageNames,
  executionClassForStage,
  hasPlannedDependency,
  shouldBlockImplicitSemanticReplan,
  signatureConfigForStage,
  TARGET_STAGE,
  timeoutPolicyForStage,
} from "./workflow/stages.mjs";
import { fileExists, loadState, recordEvent, saveState, signatureFor, writeArtifactLedger } from "./workflow/state.mjs";

loadProviderEnvironmentFromZsh();

let activeProjectId;
process.on("uncaughtException", (error) => {
  const failure = classifyOperationalError(error);
  console.error(
    JSON.stringify({ schemaVersion: "1.0", projectId: activeProjectId, event: "workflow.rejected", failure }),
  );
  process.exitCode = 1;
});

const values = process.argv.slice(2);
const flag = (name) => values.includes(name);
const option = (name) => {
  const index = values.indexOf(name);
  return index >= 0 ? values[index + 1] : undefined;
};
const manifestArg = option("--project");
if (!manifestArg)
  throw new Error(
    "Usage: npm run workflow -- --project <project.json> [--until recut|plan|review|delivery] [--from stage] [--force] [--replan-recut] [--replan-semantic] [--resume-semantic-attempt <id>] [--dry-run] [--approve-recut] [--approve] [--waive-qa <reason>] [--delivery-resolution 1080p|2k|4k|source --delivery-frame-rate 30|60|source]",
  );
const dryRun = flag("--dry-run");
const replanSemantic = flag("--replan-semantic");
const resumeSemanticAttemptId = option("--resume-semantic-attempt");
const replanRecut = flag("--replan-recut");
const approveRecut = flag("--approve-recut");

const baseContext = await readManifest(manifestArg);
const requestedUntilValue = option("--until") ?? baseContext.manifest.workflow.defaultTarget;
const deliveryProfileOverride = deliveryProfileOverrideFromOptions({
  resolution: option("--delivery-resolution"),
  frameRate: option("--delivery-frame-rate"),
  until: requestedUntilValue,
});
const context = contextWithDeliveryProfileOverride(baseContext, deliveryProfileOverride);
const { manifest, manifestPath, paths } = context;
activeProjectId = manifest.project.id;
if (!dryRun) {
  await mkdir(paths.workspace, { recursive: true });
  await mkdir(paths.logs, { recursive: true });
  await writeFile(paths.runtimeConfig, `${JSON.stringify(toRuntimeConfig(context), null, 2)}\n`);
}
const stages = createStages(context);
const state = await loadState({
  statePath: paths.state,
  projectId: manifest.project.id,
  manifestPath,
  stageNames: stages.map(({ name }) => name),
  conditionalStageNames: CONDITIONAL_STAGE_NAMES,
});
const emit = (event) => console.log(JSON.stringify({ projectId: manifest.project.id, ...event }));

if (approveRecut) {
  const approval = state.stages["recut-approval"];
  const reviewStage = stages.find(({ name }) => name === "recut-review");
  const approvalStage = stages.find(({ name }) => name === "recut-approval");
  if (!approval || !reviewStage || !approvalStage)
    throw new Error("This project does not enable conservative intelligent recut 2.0");
  if (state.stages["recut-review"].status !== "succeeded")
    throw new Error("A completed continuous recut preview is required before recut approval");
  const currentReviewSignature = await signatureFor(reviewStage.outputs);
  if (currentReviewSignature !== state.stages["recut-review"].outputSignature)
    throw new Error("Recut preview changed after capture; rerun recut review before approval");
  for (const input of approvalStage.inputs) await access(input);
  approval.status = "approved";
  approval.approvedAt = new Date().toISOString();
  approval.reviewSha256 = await signatureFor(approvalStage.inputs);
  approval.inputSignature = await signatureFor([
    manifest.schemaVersion,
    approvalStage.name,
    approvalStage.inputs,
    ...approvalStage.inputs,
    signatureConfigForStage(manifest, approvalStage.name),
  ]);
  approval.outputSignature = await signatureFor([]);
  recordEvent(state, { event: "recut.approved", stage: "recut-approval" });
  await saveState(paths.state, state);
  await writeArtifactLedger(paths.artifacts, state);
  emit({ event: "recut.approved", statePath: paths.state, reviewSha256: approval.reviewSha256 });
}

if (flag("--approve")) {
  const approval = state.stages["human-approval"];
  if (state.stages["review-evidence"].status !== "succeeded")
    throw new Error("A complete review evidence package is required before approval");
  if (state.stages["visual-qa"].status !== "succeeded")
    throw new Error("A completed visual QA report is required before approval");
  if (state.stages["regression-fixtures"].status !== "succeeded")
    throw new Error("A completed regression fixture report is required before approval");
  if (state.stages["agent-review"].status !== "succeeded")
    throw new Error("A passed production Agent self-review is required before approval");
  const reviewStage = stages.find(({ name }) => name === "review-evidence");
  const qaStage = stages.find(({ name }) => name === "visual-qa");
  const regressionStage = stages.find(({ name }) => name === "regression-fixtures");
  const agentReviewStage = stages.find(({ name }) => name === "agent-review");
  const currentReviewSignature = await signatureFor(reviewStage.outputs);
  const currentQaSignature = await signatureFor(qaStage.outputs);
  const currentRegressionSignature = await signatureFor(regressionStage.outputs);
  const currentAgentReviewSignature = await signatureFor(agentReviewStage.outputs);
  if (currentReviewSignature !== state.stages["review-evidence"].outputSignature)
    throw new Error("Review evidence changed after capture; rerun review before approval");
  const reviewEvidence = await verifyReviewEvidence({ evidencePath: paths.reviewEvidence, workspace: paths.workspace });
  await validateArtifactSchema({
    schemaPath: "schemas/review-evidence.schema.json",
    artifact: reviewEvidence,
    label: "Review evidence",
  });
  if (currentQaSignature !== state.stages["visual-qa"].outputSignature)
    throw new Error("Visual QA output changed after analysis; rerun QA before approval");
  if (currentRegressionSignature !== state.stages["regression-fixtures"].outputSignature)
    throw new Error("Regression fixture output changed after analysis; rerun review before approval");
  if (currentAgentReviewSignature !== state.stages["agent-review"].outputSignature)
    throw new Error("Production Agent review changed after analysis; rerun review before approval");
  const qaReport = JSON.parse(
    await import("node:fs/promises").then(({ readFile }) => readFile(qaStage.outputs[0], "utf8")),
  );
  await validateArtifactSchema({
    schemaPath: "schemas/visual-qa-report.schema.json",
    artifact: qaReport,
    label: "Visual QA report",
  });
  const qaWaiverReason = option("--waive-qa");
  assertQaApprovalAllowed(qaReport, qaWaiverReason);
  approval.status = "approved";
  approval.approvedAt = new Date().toISOString();
  approval.reviewSha256 = currentReviewSignature;
  approval.reviewEvidenceSha256 = reviewEvidence.approvalBindingSha256;
  approval.reviewMode = reviewEvidence.reviewMode;
  approval.qaSha256 = currentQaSignature;
  approval.regressionSha256 = currentRegressionSignature;
  approval.agentReviewSha256 = currentAgentReviewSignature;
  approval.qaReportSha256 = qaReport.reportSha256;
  approval.snapshot = await createApprovalSnapshot({ paths, reviewEvidence });
  if (qaWaiverReason) approval.qaWaiver = { reason: qaWaiverReason, recordedAt: new Date().toISOString() };
  recordEvent(state, { event: "review.approved", stage: "human-approval" });
  await saveState(paths.state, state);
  await writeArtifactLedger(paths.artifacts, state);
  emit({ event: "review.approved", statePath: paths.state, snapshot: approval.snapshot });
  process.exit(0);
}

const untilValue = option("--until") ?? (approveRecut ? "edit-promote" : requestedUntilValue);
const untilStage = TARGET_STAGE[untilValue] ?? untilValue;
const endIndex = stages.findIndex(({ name }) => name === untilStage);
if (endIndex < 0) throw new Error(`Unknown --until target: ${untilValue}`);
const fromValue = option("--from");
let startIndex = fromValue ? stages.findIndex(({ name }) => name === fromValue) : 0;
if (startIndex < 0) throw new Error(`Unknown --from stage: ${fromValue}`);
const force = flag("--force");
const recutStageIndex = stages.findIndex(({ name }) => name === "recut-plan");
const recutReviewStageIndex = stages.findIndex(({ name }) => name === "recut-review");
const semanticStageIndex = stages.findIndex(({ name }) => name === "semantic-plan");
const recutHasHistory =
  recutStageIndex >= 0 &&
  ((await fileExists(paths.recutProviderPlan)) ||
    state.events.some((event) => event.stage === "recut-plan" && event.event === "stage.succeeded"));
const semanticHasHistory =
  (await fileExists(paths.semanticNarrativePlan)) ||
  state.events.some((event) => event.stage === "semantic-plan" && event.event === "stage.succeeded");

startIndex = approvedDeliveryStartIndex({
  stages,
  requestedStartIndex: startIndex,
  fromValue,
  untilStage,
  approvalStatus: state.stages["human-approval"]?.status,
});
const readinessPreflight = dryRun
  ? await runProjectPreflight({
      context,
      stages,
      currentAssetProfile: CURRENT_ASSET_PROFILE,
    })
  : undefined;
const readinessScopeSignature = dryRun
  ? await signatureFor([
      manifestPath,
      ...stages
        .slice(startIndex, endIndex + 1)
        .flatMap((stage) => [stage.name, stage.inputs, ...stage.inputs, signatureConfigForStage(manifest, stage.name)]),
    ])
  : undefined;

const validateStageIndex = stages.findIndex(({ name }) => name === "validate");
if (replanSemantic && resumeSemanticAttemptId)
  throw new Error("--replan-semantic and --resume-semantic-attempt cannot be used together");
if (replanSemantic && (startIndex > semanticStageIndex || endIndex < validateStageIndex))
  throw new Error("--replan-semantic must include the complete semantic-plan through validate transaction");
if (resumeSemanticAttemptId && endIndex < validateStageIndex)
  throw new Error("--resume-semantic-attempt must continue through validate");
if (replanRecut && (recutStageIndex < 0 || startIndex > recutStageIndex || endIndex < recutReviewStageIndex))
  throw new Error(
    "--replan-recut requires an intelligent recut project and must include recut-plan through recut-review",
  );
const implicitRecutReplanBlocked = shouldBlockImplicitSemanticReplan({
  force,
  replanSemantic: replanRecut,
  semanticHasHistory: recutHasHistory,
  semanticStageIndex: recutStageIndex,
  startIndex,
  endIndex,
});
const implicitSemanticReplanBlocked = shouldBlockImplicitSemanticReplan({
  force,
  replanSemantic,
  semanticHasHistory,
  semanticStageIndex,
  startIndex,
  endIndex,
});
if (dryRun && (implicitRecutReplanBlocked || implicitSemanticReplanBlocked)) {
  const blockedPreview = [
    ...(implicitRecutReplanBlocked
      ? [{ stage: "recut-plan", action: "blocked", executionClass: executionClassForStage("recut-plan", manifest) }]
      : []),
    ...(implicitSemanticReplanBlocked
      ? [
          {
            stage: "semantic-plan",
            action: "blocked",
            executionClass: executionClassForStage("semantic-plan", manifest),
          },
        ]
      : []),
  ];
  emit({
    event: "workflow.preview",
    ...summarizeWorkflowPreview({
      preview: blockedPreview,
      targetStage: untilStage,
      preflight: readinessPreflight,
      scopeSignature: readinessScopeSignature,
    }),
    rejectionCode: implicitRecutReplanBlocked ? "RECUT_REPLAN_REQUIRED" : "SEMANTIC_REPLAN_REQUIRED",
  });
  emit({ event: "workflow.blocked", statePath: paths.state, artifactsPath: paths.artifacts });
  process.exit(2);
}
if (implicitRecutReplanBlocked)
  throw new OperationalError(
    "RECUT_REPLAN_REQUIRED",
    "--force would replace an existing provider-backed recut proposal; use --replan-recut --until recut",
    { details: { blockedBeforeExecution: true } },
  );
if (implicitSemanticReplanBlocked)
  throw new OperationalError(
    "SEMANTIC_REPLAN_REQUIRED",
    "--force would invalidate an existing semantic plan; use --replan-semantic or select an earlier --until target",
    { details: { blockedBeforeExecution: true } },
  );

if (
  !dryRun &&
  !fromValue &&
  untilStage === "delivery-validate" &&
  state.stages["human-approval"]?.status === "approved"
) {
  const restored = await verifyAndRestoreApprovalSnapshot({ paths, snapshot: state.stages["human-approval"].snapshot });
  emit({ event: "approval.snapshot.restored", restored: restored.restored, snapshotId: restored.manifest.createdAt });
}

const runCommand = async (stage, runtimeConfigPath = paths.runtimeConfig, onProgress = () => {}) => {
  if (stage.verifyOnly) {
    for (const input of stage.inputs) await access(input);
    return;
  }
  if (stage.approval)
    throw new Error(
      stage.approvalKind === "recut"
        ? "Recut approval required. Review recut-review.md and recut-preview-720p.mp4, then run with --approve-recut."
        : "Human approval required. Run with --approve after reviewing the evidence package.",
    );
  if (stage.delivery) {
    if (state.stages["human-approval"].status !== "approved")
      throw new Error("Delivery render is blocked until human approval is recorded");
    const reviewStage = stages.find(({ name }) => name === "review-evidence");
    const qaStage = stages.find(({ name }) => name === "visual-qa");
    const regressionStage = stages.find(({ name }) => name === "regression-fixtures");
    const agentReviewStage = stages.find(({ name }) => name === "agent-review");
    const currentReviewSignature = await signatureFor(reviewStage.outputs);
    const currentQaSignature = await signatureFor(qaStage.outputs);
    const currentRegressionSignature = await signatureFor(regressionStage.outputs);
    const currentAgentReviewSignature = await signatureFor(agentReviewStage.outputs);
    const reviewEvidence = await verifyReviewEvidence({
      evidencePath: paths.reviewEvidence,
      workspace: paths.workspace,
    });
    if (state.stages["human-approval"].reviewSha256 !== currentReviewSignature)
      throw new Error("Delivery is blocked because the approved review evidence has changed");
    if (state.stages["human-approval"].reviewEvidenceSha256 !== reviewEvidence.approvalBindingSha256)
      throw new Error("Delivery is blocked because the approved review artifacts no longer match their evidence");
    if (state.stages["human-approval"].qaSha256 !== currentQaSignature)
      throw new Error("Delivery is blocked because the approved visual QA report has changed");
    if (state.stages["human-approval"].regressionSha256 !== currentRegressionSignature)
      throw new Error("Delivery is blocked because the approved regression fixture report has changed");
    if (state.stages["human-approval"].agentReviewSha256 !== currentAgentReviewSignature)
      throw new Error("Delivery is blocked because the approved production Agent review has changed");
  }
  const [command, ...args] = stage.command;
  const commandArgs =
    stage.name === "review-render"
      ? [
          ...args,
          stage.outputs[0],
          "--props",
          paths.reviewProps,
          "--codec",
          manifest.render.review.codec,
          "--crf",
          String(manifest.render.review.crf),
        ]
      : [...args, runtimeConfigPath];
  const logPath = resolve(paths.logs, `${stage.name}.log`);
  const child = spawn(command, commandArgs, processTreeSpawnOptions({ cwd: process.cwd(), env: process.env }));
  let log = "";
  let lastProgressAt = Date.now();
  let termination;
  let escalationTimer;
  const markProgress = () => {
    lastProgressAt = Date.now();
    onProgress(new Date(lastProgressAt).toISOString());
  };
  child.stdout.on("data", (chunk) => {
    log += chunk;
    markProgress();
    process.stdout.write(chunk);
  });
  child.stderr.on("data", (chunk) => {
    log += chunk;
    markProgress();
    process.stderr.write(chunk);
  });
  const timeout = timeoutPolicyForStage(stage.name, manifest);
  const stop = (kind, limitMs) => {
    if (termination) return;
    termination = { kind, limitMs, lastProgressAt: new Date(lastProgressAt).toISOString() };
    terminateProcessTree(child, "SIGTERM");
    escalationTimer = setTimeout(() => {
      if (isProcessTreeRunning(child)) terminateProcessTree(child, "SIGKILL");
    }, 5_000);
    escalationTimer.unref();
  };
  const absoluteTimer = setTimeout(() => stop("timeout", timeout.timeoutMs), timeout.timeoutMs);
  absoluteTimer.unref();
  const idleTimer = timeout.idleTimeoutMs
    ? setInterval(() => {
        if (Date.now() - lastProgressAt >= timeout.idleTimeoutMs) stop("idle", timeout.idleTimeoutMs);
      }, 1_000)
    : undefined;
  idleTimer?.unref();
  const code = await new Promise((done) => {
    child.on("error", () => done(-1));
    child.on("close", done);
  });
  clearTimeout(absoluteTimer);
  if (idleTimer) clearInterval(idleTimer);
  const redactedLog = redactSecrets(log);
  await writeFile(logPath, redactedLog);
  if (termination) {
    const renderStage = executionClassForStage(stage.name, manifest).includes("render");
    const error = new OperationalError(
      renderStage && termination.kind === "idle" ? "RENDER_STALLED" : "STAGE_TIMEOUT",
      termination.kind === "idle"
        ? `${stage.name} stalled after ${Math.round(termination.limitMs / 1000)} seconds without progress`
        : `${stage.name} exceeded its ${Math.round(termination.limitMs / 1000)} second timeout`,
      { details: termination, exitCode: code },
    );
    error.logPath = logPath;
    throw error;
  }
  if (code !== 0) {
    if (stage.name === "preflight" && (await fileExists(paths.preflightReport))) {
      const report = JSON.parse(await readFile(paths.preflightReport, "utf8"));
      const failed = report.checks?.find((item) => item.status === "failed");
      const failureCodes = {
        source: "INPUT_SOURCE_MISSING",
        transcript: "INPUT_TRANSCRIPT_INVALID",
        providers: "PROVIDER_AUTH_MISSING",
        output: "IO_OUTPUT_UNWRITABLE",
        manifest: "CONFIG_MANIFEST_INVALID",
        "asset-profile": "CONFIG_MANIFEST_INVALID",
        regression: "CONFIG_MANIFEST_INVALID",
        resume: "CONFIG_MANIFEST_INVALID",
      };
      if (failed)
        throw new OperationalError(failureCodes[failed.id] ?? "CONFIG_MANIFEST_INVALID", failed.summary, {
          exitCode: code,
          details: { checkId: failed.id, remediation: failed.remediation },
        });
    }
    const logTail = summarizeStageLog(redactedLog);
    const error = new Error(`${stage.name} exited with code ${code}${logTail ? `: ${logTail}` : ""}`);
    error.exitCode = code;
    error.logPath = logPath;
    error.details = logTail ? { logTail } : undefined;
    throw error;
  }
};

let workflowFailed = false;
const dryRunPlannedStages = new Set();
const dryRunBlockedStages = new Set();
const preview = [];
let semanticAttempt;
if (resumeSemanticAttemptId) {
  semanticAttempt = await resumeSemanticAttempt({ paths, id: resumeSemanticAttemptId });
  const resumableStages = ["component-props", "visual-direction", "validate"];
  const requestedResumeIndex = resumableStages.indexOf(fromValue);
  const failedStageIndex = resumableStages.indexOf(semanticAttempt.failedStage);
  if (requestedResumeIndex < 0 || requestedResumeIndex > failedStageIndex) {
    throw new Error(
      `--resume-semantic-attempt ${resumeSemanticAttemptId} must resume from ${resumableStages
        .slice(0, failedStageIndex + 1)
        .join(", ")}`,
    );
  }
  semanticAttempt.previousStages = structuredClone(state.stages);
}
const semanticTransactionStages = new Set(["semantic-plan", "component-props", "visual-direction", "validate"]);
const recutTransactionStages = new Set(["recut-plan", "edit-plan", "recut-review"]);
const signatureForStageInput = (stage) =>
  signatureFor([
    manifest.schemaVersion,
    stage.name,
    stage.inputs,
    ...stage.inputs,
    signatureConfigForStage(manifest, stage.name),
  ]);
const nonReuseReasons = ({ entry, signature, outputsExist, currentOutputSignature, upstreamPlanned, forced }) => [
  ...(forced ? ["explicit-force"] : []),
  ...(upstreamPlanned ? ["upstream-stage-planned"] : []),
  ...(!["succeeded", "approved"].includes(entry.status) ? [`state-${entry.status}`] : []),
  ...(entry.inputSignature !== signature ? ["input-signature-changed"] : []),
  ...(!outputsExist ? ["output-missing"] : []),
  ...(outputsExist && entry.outputSignature !== currentOutputSignature ? ["output-signature-changed"] : []),
];
for (let index = 0; index <= endIndex; index++) {
  const stage = stages[index];
  if (index < startIndex) continue;
  if (!dryRun && replanSemantic && stage.name === "semantic-plan" && !semanticAttempt) {
    semanticAttempt = await beginSemanticAttempt({ paths, runtimeConfigPath: paths.runtimeConfig });
    semanticAttempt.previousStages = structuredClone(state.stages);
  }
  const entry = state.stages[stage.name] ?? { status: "pending" };
  const signature = await signatureForStageInput(stage);
  const transactionStage = Boolean(semanticAttempt) && semanticTransactionStages.has(stage.name);
  const stageOutputs = transactionStage
    ? candidateOutputsForStage({ attempt: semanticAttempt, outputs: stage.outputs ?? [] })
    : (stage.outputs ?? []);
  const outputsExist = await Promise.all(stageOutputs.map(fileExists)).then((checks) => checks.every(Boolean));
  const currentOutputSignature = outputsExist ? await signatureFor(stageOutputs) : undefined;
  const upstreamPlannedInDryRun = hasPlannedDependency(stage, dryRunPlannedStages);
  const stageForced =
    force ||
    (replanRecut && recutTransactionStages.has(stage.name)) ||
    ((replanSemantic || resumeSemanticAttemptId) && semanticTransactionStages.has(stage.name));
  const reusable =
    !stageForced &&
    !upstreamPlannedInDryRun &&
    ["succeeded", "approved"].includes(entry.status) &&
    entry.inputSignature === signature &&
    outputsExist &&
    entry.outputSignature === currentOutputSignature;
  if (reusable) {
    emit({ event: "stage.skipped", stage: stage.name, reason: "up-to-date" });
    preview.push({
      stage: stage.name,
      action: "reuse",
      executionClass: executionClassForStage(stage.name, manifest),
      inputSignature: signature,
    });
    continue;
  }
  const reasons = nonReuseReasons({
    entry,
    signature,
    outputsExist,
    currentOutputSignature,
    upstreamPlanned: upstreamPlannedInDryRun,
    forced: stageForced,
  });
  const semanticBlocked = stage.name === "semantic-plan" && semanticHasHistory && !replanSemantic;
  const upstreamBlockedInDryRun = (stage.dependsOn ?? []).some((dependency) => dryRunBlockedStages.has(dependency));
  if (dryRun) {
    const action = semanticBlocked || upstreamBlockedInDryRun ? "blocked" : "run";
    if (action === "blocked") dryRunBlockedStages.add(stage.name);
    else dryRunPlannedStages.add(stage.name);
    const executionClass = executionClassForStage(stage.name, manifest);
    preview.push({ stage: stage.name, action, executionClass, reasons, inputSignature: signature });
    emit({ event: "stage.planned", stage: stage.name, action, executionClass, reasons });
    continue;
  }
  if (semanticBlocked)
    throw new OperationalError(
      "SEMANTIC_REPLAN_REQUIRED",
      "semantic-plan already has a valid history; rerunning it requires explicit --replan-semantic",
      { details: { reasons } },
    );
  const started = Date.now();
  for (const downstreamName of dependentStageNames(stages, stage.name)) {
    const downstreamEntry = state.stages[downstreamName];
    if (downstreamEntry && ["succeeded", "approved"].includes(downstreamEntry.status)) downstreamEntry.status = "stale";
  }
  for (const key of ["failure", "error", "finishedAt", "elapsedMs", "lastProgressAt"]) delete entry[key];
  Object.assign(entry, {
    status: "running",
    inputSignature: signature,
    startedAt: new Date().toISOString(),
    outputs: stage.outputs,
  });
  state.stages[stage.name] = entry;
  recordEvent(state, { event: "stage.started", stage: stage.name });
  await saveState(paths.state, state);
  emit({ event: "stage.started", stage: stage.name });
  try {
    if (stage.name === "semantic-plan" && semanticAttempt) {
      entry.attemptPath = semanticAttempt.directory;
    }
    let lastProgressPersisted = 0;
    await runCommand(
      stage,
      transactionStage ? semanticAttempt.attemptConfigPath : paths.runtimeConfig,
      (lastProgressAt) => {
        entry.lastProgressAt = lastProgressAt;
        if (Date.now() - lastProgressPersisted > 15_000) {
          lastProgressPersisted = Date.now();
          saveState(paths.state, state).catch(() => {});
        }
      },
    );
    for (const output of stageOutputs) await access(output);
    if (transactionStage && stage.name === "validate") {
      await finalizeSemanticAttemptComparison({ attempt: semanticAttempt });
      await promoteSemanticAttempt({ attempt: semanticAttempt, paths });
      for (const transactionName of semanticTransactionStages) {
        const transactionDefinition = stages.find(({ name }) => name === transactionName);
        const transactionEntry = state.stages[transactionName];
        if (!transactionDefinition || !transactionEntry) continue;
        Object.assign(transactionEntry, {
          status: "succeeded",
          inputSignature: await signatureForStageInput(transactionDefinition),
          outputSignature: await signatureFor(transactionDefinition.outputs ?? []),
          finishedAt: new Date().toISOString(),
        });
      }
    }
    Object.assign(entry, {
      status: transactionStage && stage.name !== "validate" ? "running" : stage.approval ? "approved" : "succeeded",
      finishedAt: new Date().toISOString(),
      elapsedMs: Date.now() - started,
      outputSignature: await signatureFor(stageOutputs),
    });
    delete entry.error;
    delete entry.failure;
    const successEvent =
      transactionStage && stage.name !== "validate" ? "stage.candidate.succeeded" : "stage.succeeded";
    recordEvent(state, { event: successEvent, stage: stage.name, elapsedMs: entry.elapsedMs });
    emit({ event: successEvent, stage: stage.name, elapsedMs: entry.elapsedMs });
  } catch (error) {
    const failure = classifyOperationalError(error, {
      stage: stage.name,
      logPath: error.logPath ?? resolve(paths.logs, `${stage.name}.log`),
    });
    if (transactionStage && semanticAttempt?.previousStages) {
      await failSemanticAttempt({ attempt: semanticAttempt, stage: stage.name, failure });
      state.stages = semanticAttempt.previousStages;
      recordEvent(state, { event: "semantic-attempt.failed", stage: stage.name, failure });
    } else {
      Object.assign(entry, {
        status: stage.approval ? "pending" : "failed",
        finishedAt: new Date().toISOString(),
        elapsedMs: Date.now() - started,
        error: failure.message,
        failure,
      });
      recordEvent(state, { event: "stage.failed", stage: stage.name, failure });
    }
    await saveState(paths.state, state);
    emit({ event: "stage.failed", stage: stage.name, failure });
    workflowFailed = true;
    process.exitCode = 1;
    break;
  }
  await saveState(paths.state, state);
  await writeArtifactLedger(paths.artifacts, state);
}

if (!dryRun) {
  await saveState(paths.state, state);
  await writeArtifactLedger(paths.artifacts, state);
}
if (dryRun) {
  emit({
    event: "workflow.preview",
    ...summarizeWorkflowPreview({
      preview,
      targetStage: untilStage,
      preflight: readinessPreflight,
      scopeSignature: readinessScopeSignature,
    }),
  });
  if (dryRunBlockedStages.size || readinessPreflight?.status === "failed") process.exitCode = 2;
}
emit({
  event: workflowFailed
    ? "workflow.failed"
    : dryRunBlockedStages.size || (dryRun && readinessPreflight?.status === "failed")
      ? "workflow.blocked"
      : "workflow.finished",
  statePath: paths.state,
  artifactsPath: paths.artifacts,
});
