import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createStages } from "../workflow/stages.mjs";
import { fileExists, signatureFor } from "../workflow/state.mjs";

export const REQUIRED_ACCEPTANCE_STAGES = [
  "preflight",
  "ingest",
  "transcribe",
  "captions",
  "semantic-plan",
  "component-props",
  "visual-direction",
  "validate",
  "review-base",
  "qa-capture",
  "visual-qa",
  "review-evidence",
  "regression-fixtures",
];

export const requiredAcceptanceStages = (context) => [
  ...REQUIRED_ACCEPTANCE_STAGES,
  ...(context.paths.referenceScript ? ["transcript-conformance"] : []),
  ...(context.manifest.workflow.reviewMode === "full-video" || context.manifest.workflow.reviewMode === undefined
    ? ["review-render"]
    : []),
];

export const inspectAcceptanceArtifacts = async (context) => {
  const state = (await fileExists(context.paths.state))
    ? JSON.parse(await readFile(context.paths.state, "utf8"))
    : { stages: {} };
  const stages = createStages(context);
  const checks = [];
  for (const name of requiredAcceptanceStages(context)) {
    const stage = stages.find((item) => item.name === name);
    const entry = state.stages?.[name];
    if (!stage) {
      checks.push({ stage: name, status: "failed", reason: "stage is not registered" });
      continue;
    }
    const outputsExist = await Promise.all((stage.outputs ?? []).map(fileExists)).then((values) =>
      values.every(Boolean),
    );
    const outputSignature = outputsExist ? await signatureFor(stage.outputs ?? []) : undefined;
    const downstreamProvesPreservedArtifact =
      entry?.status === "failed" &&
      entry.finishedAt &&
      stages.some(
        (candidate) =>
          candidate.dependsOn?.includes(name) &&
          ["succeeded", "approved", "stale"].includes(state.stages?.[candidate.name]?.status) &&
          state.stages[candidate.name]?.finishedAt &&
          new Date(state.stages[candidate.name].finishedAt).getTime() > new Date(entry.finishedAt).getTime(),
      ) &&
      entry.outputSignature === outputSignature;
    const statusAccepted =
      ["succeeded", "approved", "stale"].includes(entry?.status) || downstreamProvesPreservedArtifact;
    checks.push({
      stage: name,
      status: statusAccepted && outputsExist ? "passed" : "failed",
      stateStatus: entry?.status ?? "missing",
      preservedAfterFailedAttempt: downstreamProvesPreservedArtifact || undefined,
      outputsExist,
      outputSignatureMatches:
        entry?.outputSignature === undefined || outputSignature === undefined
          ? undefined
          : entry.outputSignature === outputSignature,
      outputs: (stage.outputs ?? []).map((path) => resolve(path)),
    });
  }
  const captions = JSON.parse(await readFile(resolve(context.paths.workspace, "captions-verbatim.json"), "utf8"));
  const planning = JSON.parse(await readFile(context.paths.planning, "utf8"));
  const qa = JSON.parse(await readFile(resolve(context.paths.workspace, "visual-qa/qa-report.json"), "utf8"));
  const regression = JSON.parse(await readFile(context.paths.regressionReport, "utf8"));
  const visualDirection = (await fileExists(context.paths.visualDirectionReport))
    ? JSON.parse(await readFile(context.paths.visualDirectionReport, "utf8"))
    : null;
  const reviewEvidence = (await fileExists(context.paths.reviewEvidence))
    ? JSON.parse(await readFile(context.paths.reviewEvidence, "utf8"))
    : null;
  return {
    checks,
    evidence: {
      captions: captions.length,
      semanticCues: planning.overlayCues?.length ?? 0,
      visualDirection: visualDirection
        ? { status: visualDirection.status, summary: visualDirection.summary }
        : { status: "not-applicable" },
      reviewEvidence: reviewEvidence
        ? {
            status: reviewEvidence.qaStatus,
            reviewMode: reviewEvidence.reviewMode,
            summary: reviewEvidence.summary,
            approvalBindingSha256: reviewEvidence.approvalBindingSha256,
          }
        : { status: "missing" },
      qa: { status: qa.status, summary: qa.summary },
      regression: { status: regression.status, summary: regression.summary },
    },
  };
};

export const evaluateResumeEvents = (events) => {
  const skipped = events.filter((item) => item.event === "stage.skipped").map((item) => item.stage);
  const planned = events.filter((item) => item.event === "stage.planned").map((item) => item.stage);
  const failed = events.filter((item) => item.event === "stage.failed" || item.event === "workflow.rejected");
  return {
    status: failed.length ? "failed" : "passed",
    mode: planned.length ? "deterministic-rebuild-plan" : "stable-cache",
    skipped,
    planned,
    failed,
  };
};

export const evaluateAcceptance = ({ doctor, preflight, artifacts, resume, workflowExitCode = 0 }) => {
  const findings = [];
  if (doctor.summary.failed) findings.push({ rule: "doctor.failed", count: doctor.summary.failed });
  if (preflight.summary.failed) findings.push({ rule: "preflight.failed", count: preflight.summary.failed });
  if (workflowExitCode !== 0) findings.push({ rule: "workflow.exit", exitCode: workflowExitCode });
  for (const item of artifacts.checks)
    if (item.status !== "passed") findings.push({ rule: "artifact.stage", stage: item.stage, reason: item.reason });
  if (artifacts.evidence.captions <= 0) findings.push({ rule: "captions.empty" });
  if (artifacts.evidence.semanticCues <= 0) findings.push({ rule: "semantic.empty" });
  if (!["review", "not-applicable"].includes(artifacts.evidence.visualDirection?.status ?? "not-applicable"))
    findings.push({ rule: "visual-direction.invalid" });
  if (artifacts.evidence.qa.status !== "passed") findings.push({ rule: "qa.not-passed" });
  if (artifacts.evidence.reviewEvidence.status !== "passed") findings.push({ rule: "review-evidence.not-passed" });
  if (artifacts.evidence.regression.status !== "passed") findings.push({ rule: "regression.not-passed" });
  if (resume.status !== "passed") findings.push({ rule: "resume.failed" });
  return {
    status: findings.length ? "failed" : doctor.summary.warnings ? "warning" : "passed",
    findings,
  };
};
