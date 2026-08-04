import { readFile } from "node:fs/promises";
import { basename, isAbsolute, relative, resolve, sep } from "node:path";
import { readManifest } from "./workflow/manifest.mjs";
import { createStages } from "./workflow/stages.mjs";
import { fileExists } from "./workflow/state.mjs";
import { allowedOperatorActions, recommendResume } from "../src/operator-control/contract.ts";

const index = process.argv.indexOf("--project");
const manifestPath = index >= 0 ? process.argv[index + 1] : undefined;
if (!manifestPath) throw new Error("Usage: npm run workflow:status -- --project <project.json>");
const context = await readManifest(manifestPath);
const { manifest, manifestPath: absoluteManifestPath, paths } = context;
const state = (await fileExists(paths.state)) ? JSON.parse(await readFile(paths.state, "utf8")) : null;
const ledger = (await fileExists(paths.artifacts)) ? JSON.parse(await readFile(paths.artifacts, "utf8")) : null;
const terminology = (await fileExists(paths.terminologyReview))
  ? JSON.parse(await readFile(paths.terminologyReview, "utf8"))
  : null;
const regression = (await fileExists(paths.regressionReport))
  ? JSON.parse(await readFile(paths.regressionReport, "utf8"))
  : null;
const preflight = (await fileExists(paths.preflightReport))
  ? JSON.parse(await readFile(paths.preflightReport, "utf8"))
  : null;
const revisionHistory = (await fileExists(paths.revisionHistory))
  ? JSON.parse(await readFile(paths.revisionHistory, "utf8"))
  : null;
const stageDefinitions = createStages(context);
const supersededFailure = (name, value) => {
  if (value?.status !== "failed" || !value.finishedAt) return false;
  return stageDefinitions.some(
    (stage) =>
      stage.dependsOn?.includes(name) &&
      ["succeeded", "approved", "stale"].includes(state?.stages[stage.name]?.status) &&
      state?.stages[stage.name]?.finishedAt &&
      new Date(state.stages[stage.name].finishedAt).getTime() > new Date(value.finishedAt).getTime(),
  );
};
const stages = state
  ? stageDefinitions.map(({ name }) => {
      const value = state.stages[name] ?? { status: "pending" };
      const preserved = supersededFailure(name, value);
      return {
        name,
        status: preserved ? "succeeded" : value.status,
        preservedAfterFailedAttempt: preserved || undefined,
        lastAttemptFailure: preserved ? value.failure : undefined,
        elapsedMs: value.elapsedMs,
        error: preserved ? undefined : value.error,
        failure: preserved ? undefined : value.failure,
      };
    })
  : [];
const currentFailure = stages.find((stage) => stage.status === "failed")?.failure;
const reviewReady = ["review-evidence", "visual-qa", "regression-fixtures", "agent-review"].every(
  (name) => state?.stages[name]?.status === "succeeded",
);
const approved = state?.stages["human-approval"]?.status === "approved";
const recutReady = state?.stages["recut-review"]?.status === "succeeded";
const recutApproved = state?.stages["recut-approval"]?.status === "approved";
const repositoryRoot = resolve(import.meta.dirname, "..");
const publicPath = (value) => {
  if (!isAbsolute(value)) return value;
  const repositoryRelative = relative(repositoryRoot, value);
  if (!repositoryRelative.startsWith(`..${sep}`) && repositoryRelative !== "..")
    return `repository/${repositoryRelative}`;
  return `external/${basename(value)}`;
};
const sanitizeForOperator = (value) => {
  if (Array.isArray(value)) return value.map(sanitizeForOperator);
  if (value && typeof value === "object")
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitizeForOperator(item)]));
  return typeof value === "string" && isAbsolute(value) ? publicPath(value) : value;
};
console.log(
  JSON.stringify({
    schemaVersion: "1.1",
    project: manifest.project,
    manifestPath: publicPath(absoluteManifestPath),
    statePath: publicPath(paths.state),
    artifactLedgerPath: publicPath(paths.artifacts),
    localPathsRedacted: true,
    updatedAt: state?.updatedAt,
    stages: sanitizeForOperator(stages),
    allowedActions: allowedOperatorActions({
      hasState: Boolean(state),
      reviewReady,
      approved,
      recutReady,
      recutApproved,
    }),
    resume: reviewReady ? undefined : recommendResume(stages),
    currentFailure: sanitizeForOperator(currentFailure),
    preflight: sanitizeForOperator(preflight),
    artifacts: sanitizeForOperator(ledger?.artifacts ?? []),
    visualQa: sanitizeForOperator(ledger?.visualQa),
    visualDirection: sanitizeForOperator(ledger?.visualDirection),
    recut: sanitizeForOperator(ledger?.recut),
    reviewEvidence: sanitizeForOperator(ledger?.reviewEvidence),
    approvalSnapshot: sanitizeForOperator(ledger?.approvalSnapshot),
    deliveryValidation: sanitizeForOperator(ledger?.deliveryValidation),
    terminology: sanitizeForOperator(terminology),
    regression: sanitizeForOperator(regression),
    revisions: sanitizeForOperator({
      count: revisionHistory?.revisions?.length ?? 0,
      latest: revisionHistory?.revisions?.at(-1),
    }),
  }),
);
