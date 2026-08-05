import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export const STAGE_STATUSES = ["pending", "running", "interrupted", "succeeded", "failed", "stale", "approved"];

export const fileExists = async (path) =>
  access(path)
    .then(() => true)
    .catch(() => false);

export const hashFile = async (path) => {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
};

export const signatureFor = async (values) => {
  const hash = createHash("sha256");
  for (const value of values) {
    if (typeof value === "string" && (await fileExists(value))) {
      const info = await stat(value);
      if (info.isFile()) for await (const chunk of createReadStream(value)) hash.update(chunk);
      else hash.update(JSON.stringify({ path: resolve(value), kind: info.isDirectory() ? "directory" : "other" }));
    } else hash.update(JSON.stringify(value));
  }
  return hash.digest("hex");
};

export const loadState = async ({ statePath, projectId, manifestPath, stageNames, conditionalStageNames = [] }) => {
  if (await fileExists(statePath)) {
    const state = JSON.parse(await readFile(statePath, "utf8"));
    for (const name of conditionalStageNames) if (!stageNames.includes(name)) delete state.stages[name];
    state.stageOrder = stageNames;
    for (const name of stageNames) state.stages[name] ??= { status: "pending" };
    return state;
  }
  return {
    schemaVersion: "1.0",
    projectId,
    manifestPath: resolve(manifestPath),
    updatedAt: new Date().toISOString(),
    stageOrder: stageNames,
    stages: Object.fromEntries(stageNames.map((name) => [name, { status: "pending" }])),
    events: [],
  };
};

export const saveState = async (statePath, state) => {
  state.updatedAt = new Date().toISOString();
  await mkdir(dirname(statePath), { recursive: true });
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`);
};

export const recordEvent = (state, event) => {
  state.events.push({ at: new Date().toISOString(), ...event });
  if (state.events.length > 500) state.events = state.events.slice(-500);
};

export const describeArtifact = async (path, stage) => {
  const info = await stat(path);
  return {
    path: resolve(path),
    stage,
    bytes: info.size,
    sha256: await hashFile(path),
    updatedAt: info.mtime.toISOString(),
  };
};

export const writeArtifactLedger = async (path, state) => {
  const artifacts = [];
  for (const [stage, value] of Object.entries(state.stages)) {
    for (const output of value.outputs ?? [])
      if (await fileExists(output)) artifacts.push(await describeArtifact(output, stage));
  }
  const qaReportArtifact = artifacts.find((item) => item.stage === "visual-qa" && item.path.endsWith("qa-report.json"));
  const regressionReportArtifact = artifacts.find(
    (item) => item.stage === "regression-fixtures" && item.path.endsWith("report.json"),
  );
  const preflightReportArtifact = artifacts.find(
    (item) => item.stage === "preflight" && item.path.endsWith("preflight-report.json"),
  );
  const visualDirectionReportArtifact = artifacts.find(
    (item) => item.stage === "visual-direction" && item.path.endsWith("visual-direction-report.json"),
  );
  const reviewEvidenceArtifact = artifacts.find(
    (item) => item.stage === "review-evidence" && item.path.endsWith("review-evidence.json"),
  );
  const recutCandidatesArtifact = artifacts.find(
    (item) => item.stage === "edit-plan" && item.path.endsWith("recut-candidates.json"),
  );
  const deliveryValidationArtifact = artifacts.find(
    (item) => item.stage === "delivery-validate" && item.path.endsWith("delivery-validation.json"),
  );
  let visualQa;
  let regression;
  let environment;
  let preflight;
  let visualDirection;
  let reviewEvidence;
  let deliveryValidation;
  let recut;
  if (qaReportArtifact) {
    const report = JSON.parse(await readFile(qaReportArtifact.path, "utf8"));
    environment = report.dependencies;
    visualQa = {
      status: report.status,
      reportSha256: report.reportSha256,
      summary: report.summary,
      findings: report.findings.map((finding) => ({
        id: finding.id,
        severity: finding.severity,
        rule: finding.rule,
        cueId: finding.cueId,
        componentId: finding.componentId,
        layoutId: finding.layoutId,
        phase: finding.phase,
        frame: finding.frame,
        timeSeconds: finding.timeSeconds,
        screenshot: finding.screenshot,
        message: finding.message,
      })),
    };
  }
  if (regressionReportArtifact) {
    const report = JSON.parse(await readFile(regressionReportArtifact.path, "utf8"));
    regression = {
      status: report.status,
      reportSha256: report.reportSha256,
      profileId: report.profileId,
      fixtureId: report.fixtureId,
      summary: report.summary,
      findings: report.findings,
    };
  }
  if (preflightReportArtifact) {
    const report = JSON.parse(await readFile(preflightReportArtifact.path, "utf8"));
    preflight = {
      status: report.status,
      summary: report.summary,
      profile: report.profile,
    };
  }
  if (visualDirectionReportArtifact) {
    const report = JSON.parse(await readFile(visualDirectionReportArtifact.path, "utf8"));
    visualDirection = {
      status: report.status,
      summary: report.summary,
      importanceUsage: report.importanceUsage,
      componentUsage: report.componentUsage,
      rhetoricUsage: report.rhetoricUsage,
    };
  }
  if (reviewEvidenceArtifact) {
    const report = JSON.parse(await readFile(reviewEvidenceArtifact.path, "utf8"));
    reviewEvidence = {
      status: report.qaStatus,
      reviewMode: report.reviewMode,
      approvalBindingSha256: report.approvalBindingSha256,
      summary: report.summary,
    };
  }
  if (deliveryValidationArtifact) {
    const report = JSON.parse(await readFile(deliveryValidationArtifact.path, "utf8"));
    deliveryValidation = {
      status: report.status,
      output: report.output,
      findings: report.findings,
    };
  }
  if (recutCandidatesArtifact) {
    const report = JSON.parse(await readFile(recutCandidatesArtifact.path, "utf8"));
    recut = {
      status: state.stages["recut-approval"]?.status ?? report.status,
      summary: report.summary,
      protectedRanges: report.protectedRanges?.length ?? 0,
      unresolvedProtectedAnchors: report.unresolvedProtectedAnchors ?? [],
      reviewSha256: state.stages["recut-approval"]?.reviewSha256,
    };
  }
  await writeFile(
    path,
    `${JSON.stringify(
      {
        schemaVersion: "1.0",
        projectId: state.projectId,
        generatedAt: new Date().toISOString(),
        stages: (state.stageOrder ?? Object.keys(state.stages)).map((name) => ({
          name,
          status: state.stages[name]?.status ?? "pending",
          elapsedMs: state.stages[name]?.elapsedMs,
          lastProgressAt: state.stages[name]?.lastProgressAt,
          failure: state.stages[name]?.failure,
        })),
        failures: (state.stageOrder ?? Object.keys(state.stages))
          .map((name) => ({ stage: name, failure: state.stages[name]?.failure }))
          .filter((item) => item.failure),
        environment,
        preflight,
        visualDirection,
        recut,
        reviewEvidence,
        approvalSnapshot: state.stages["human-approval"]?.snapshot,
        deliveryValidation,
        artifacts,
        visualQa,
        regression,
        revisions: state.revisions,
      },
      null,
      2,
    )}\n`,
  );
};
