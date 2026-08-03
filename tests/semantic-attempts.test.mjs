import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import {
  beginSemanticAttempt,
  candidateOutputsForStage,
  failSemanticAttempt,
  finalizeSemanticAttemptComparison,
  promoteSemanticAttempt,
  resumeSemanticAttempt,
} from "../scripts/workflow/semantic-attempts.mjs";

const artifactNames = {
  semanticNarrativePlan: "semantic-narrative-plan.json",
  semanticProviderReport: "semantic-provider-report.json",
  componentCandidates: "component-candidates.json",
  visualDirectionPlan: "visual-direction-plan.json",
  visualDirectionReport: "visual-direction-report.json",
  visualDirectionReview: "visual-direction-review.md",
  visualDirectionTimeline: "visual-direction-timeline.svg",
  planning: "visual-brief.json",
  reviewProps: "review-props.json",
};

test("semantic replanning compares a complete isolated transaction before promotion", async () => {
  const workspace = await mkdtemp(resolve(tmpdir(), "remotion-md-semantic-attempt-"));
  const paths = { workspace };
  for (const [key, name] of Object.entries(artifactNames)) paths[key] = resolve(workspace, name);
  const validationReport = resolve(workspace, "validation-report.json");
  const runtimeConfigPath = resolve(workspace, "runtime-config.json");
  await writeFile(
    runtimeConfigPath,
    JSON.stringify({
      semanticNarrativePlanFile: paths.semanticNarrativePlan,
      semanticProviderReportFile: paths.semanticProviderReport,
      componentCandidatesFile: paths.componentCandidates,
      visualDirectionPlanFile: paths.visualDirectionPlan,
      visualDirectionReportFile: paths.visualDirectionReport,
      visualDirectionReviewFile: paths.visualDirectionReview,
      visualDirectionTimelineFile: paths.visualDirectionTimeline,
      planningFile: paths.planning,
      reviewPropsFile: paths.reviewProps,
      validationReportFile: validationReport,
    }),
  );
  await writeFile(
    paths.semanticNarrativePlan,
    JSON.stringify({ segments: [{ startCue: 0, endCue: 1, rhetoric: "none", narrative: { title: "旧计划" } }] }),
  );
  await writeFile(
    paths.semanticProviderReport,
    JSON.stringify({ agentId: "codex-cli", model: "old", contractVersion: "semantic-1", outputHash: "old-hash" }),
  );
  const attempt = await beginSemanticAttempt({ paths, runtimeConfigPath });
  const candidateValues = {
    "semantic-narrative-plan.json": {
      segments: [
        { startCue: 0, endCue: 2, rhetoric: "core-positioning", narrative: { title: "新计划" } },
        { startCue: 3, endCue: 4, rhetoric: "comparison", narrative: { title: "对比" } },
      ],
    },
    "semantic-provider-report.json": {
      agentId: "claude-code",
      model: "new",
      contractVersion: "semantic-1",
      outputHash: "new-hash",
    },
    "component-candidates.json": { candidates: [] },
    "visual-direction-plan.json": { decisions: [] },
    "visual-direction-report.json": {
      summary: { selectedCount: 0, skippedCount: 2, visualCoverageRatio: 0 },
      componentUsage: {},
    },
    "visual-direction-review.md": "# review",
    "visual-direction-timeline.svg": "<svg/>",
    "visual-brief.json": { cues: [] },
    "review-props.json": { overlayCues: [] },
    "validation-report.json": { status: "passed" },
  };
  for (const [name, value] of Object.entries(candidateValues))
    await writeFile(resolve(attempt.candidateDirectory, name), typeof value === "string" ? value : JSON.stringify(value));

  const report = await finalizeSemanticAttemptComparison({ attempt });
  assert.equal(report.previous.semantic.segmentCount, 1);
  assert.equal(report.current.semantic.segmentCount, 2);
  assert.equal(report.previous.provider.agentId, "codex-cli");
  assert.equal(report.current.provider.agentId, "claude-code");
  assert.equal(report.previous.provider.outputHash, "old-hash");
  assert.equal(report.current.provider.outputHash, "new-hash");
  assert.equal(report.changed, true);
  assert.match(await readFile(paths.semanticNarrativePlan, "utf8"), /旧计划/);
  assert.equal(
    candidateOutputsForStage({ attempt, outputs: [paths.semanticNarrativePlan] })[0],
    resolve(attempt.candidateDirectory, "semantic-narrative-plan.json"),
  );

  await promoteSemanticAttempt({ attempt, paths });
  assert.match(await readFile(paths.semanticNarrativePlan, "utf8"), /新计划/);
  assert.match(await readFile(resolve(attempt.previousDirectory, "semantic-narrative-plan.json"), "utf8"), /旧计划/);
});

test("an incomplete semantic transaction cannot replace the last valid plan", async () => {
  const workspace = await mkdtemp(resolve(tmpdir(), "remotion-md-semantic-failure-"));
  const paths = { workspace };
  for (const [key, name] of Object.entries(artifactNames)) paths[key] = resolve(workspace, name);
  const runtimeConfigPath = resolve(workspace, "runtime-config.json");
  await writeFile(runtimeConfigPath, JSON.stringify({ semanticNarrativePlanFile: paths.semanticNarrativePlan }));
  await writeFile(paths.semanticNarrativePlan, JSON.stringify({ segments: [], marker: "approved" }));
  const attempt = await beginSemanticAttempt({ paths, runtimeConfigPath });
  await writeFile(
    resolve(attempt.candidateDirectory, "semantic-narrative-plan.json"),
    JSON.stringify({ segments: [], marker: "candidate" }),
  );
  await assert.rejects(() => promoteSemanticAttempt({ attempt, paths }), /did not produce/);
  await failSemanticAttempt({
    attempt,
    stage: "semantic-plan",
    failure: { code: "STAGE_EXECUTION_FAILED", message: "semantic density limit exceeded" },
  });
  assert.match(await readFile(paths.semanticNarrativePlan, "utf8"), /approved/);
  const record = JSON.parse(await readFile(resolve(attempt.directory, "attempt.json"), "utf8"));
  assert.equal(record.status, "failed");
  assert.equal(record.failedStage, "semantic-plan");
  assert.equal(record.failure.message, "semantic density limit exceeded");
});

test("a failed local semantic transaction resumes from its isolated provider result", async () => {
  const workspace = await mkdtemp(resolve(tmpdir(), "remotion-md-semantic-resume-"));
  const paths = { workspace };
  for (const [key, name] of Object.entries(artifactNames)) paths[key] = resolve(workspace, name);
  const runtimeConfigPath = resolve(workspace, "runtime-config.json");
  await writeFile(
    runtimeConfigPath,
    JSON.stringify({
      semanticNarrativePlanFile: paths.semanticNarrativePlan,
      semanticProviderReportFile: paths.semanticProviderReport,
    }),
  );
  const attempt = await beginSemanticAttempt({ paths, runtimeConfigPath });
  await writeFile(resolve(attempt.candidateDirectory, "semantic-narrative-plan.json"), JSON.stringify({ segments: [] }));
  await writeFile(
    resolve(attempt.candidateDirectory, "semantic-provider-report.json"),
    JSON.stringify({ status: "succeeded" }),
  );
  await failSemanticAttempt({
    attempt,
    stage: "component-props",
    failure: { code: "SEMANTIC_PLAN_INVALID", message: "local materialization failed" },
  });
  const resumed = await resumeSemanticAttempt({ paths, id: attempt.id });
  assert.equal(resumed.id, attempt.id);
  assert.equal(resumed.failedStage, "component-props");
  assert.equal(
    candidateOutputsForStage({ attempt: resumed, outputs: [paths.semanticNarrativePlan] })[0],
    resolve(attempt.candidateDirectory, "semantic-narrative-plan.json"),
  );
});
