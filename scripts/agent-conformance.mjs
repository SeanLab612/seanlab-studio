import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  evaluateNarrationConformance,
  evaluateRecutConformance,
  evaluateSemanticConformance,
  pairwiseMinimumSimilarity,
  sha256Json,
} from "../src/agents/conformance.ts";
import { detectAgent } from "../src/agents/registry.ts";
import { composeNarrationScript, validateNarrationScriptPackage } from "../src/creator-workflow/contract.ts";
import { createRecutPlanningPrompt, parseRecutProviderPlan } from "../src/recut-planning/index.ts";
import {
  boundImageEvidenceIntentToCaptions,
  createSemanticNarrativePrompt,
  materializeSemanticIntent,
  parseSemanticNarrativePlan,
  validateMaterializedBriefContent,
} from "../src/semantic-planning/index.ts";
import { validateViewerFacingNarrative } from "../src/visual-brief/generator.ts";
import { directVisualPacing } from "../src/visual-direction/index.ts";
import { buildNarrationPrompt } from "./creator/narration.mjs";
import { createStructuredAgentJsonAdapter, isStructuredAgentProvider } from "./workflow/agent-json-adapter.mjs";

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};
const required = (name) => {
  const value = option(name);
  if (!value) throw new Error(`Missing required option ${name}`);
  return value;
};

const fixturePath = resolve(required("--fixture"));
const agentId = required("--agent");
const requestedModel = option("--model", null);
const repetitions = Number(option("--repetitions", "1"));
const timeoutSeconds = Number(option("--timeout-seconds", "600"));
const replayDirectory = option("--replay-from", null);
if (!isStructuredAgentProvider(agentId)) throw new Error("--agent must be codex-cli or claude-code");
if (!Number.isInteger(repetitions) || repetitions < 1 || repetitions > 10)
  throw new Error("--repetitions must be an integer between 1 and 10");
if (!(timeoutSeconds > 0 && timeoutSeconds <= 1_800)) throw new Error("--timeout-seconds must be between 1 and 1800");

const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
if (fixture.schemaVersion !== "1.0" || !fixture.id) throw new Error("Unsupported Agent conformance fixture");
const fixtureHash = sha256Json(fixture);
let replayReport;
if (replayDirectory) {
  replayReport = JSON.parse(await readFile(resolve(replayDirectory, "report.json"), "utf8"));
  if (replayReport.fixtureId !== fixture.id || replayReport.inputHash !== fixtureHash)
    throw new Error("Replay report does not match the frozen fixture");
  if (replayReport.agent?.id !== agentId) throw new Error("Replay report Agent does not match --agent");
  if (replayReport.agent.requestedModel !== requestedModel)
    throw new Error("Replay must preserve the original explicitly requested model identity");
  if (replayReport.summary?.repetitions !== repetitions)
    throw new Error("Replay report repetitions do not match --repetitions");
}
const detectedAgent = replayReport
  ? { available: true, version: replayReport.agent.cliVersion }
  : await detectAgent(agentId);
if (!detectedAgent.available) throw new Error(detectedAgent.remediation ?? `Agent is unavailable: ${agentId}`);
const generatedAt = new Date().toISOString();
const outputDirectory = resolve(
  option(
    "--output",
    `out/agent-conformance/${fixture.id}/${agentId}-${generatedAt.replaceAll(":", "-").replaceAll(".", "-")}`,
  ),
);
await mkdir(outputDirectory, { recursive: true });

const adapterFor = (schemaPath) =>
  createStructuredAgentJsonAdapter({
    config: {
      provider: agentId,
      ...(requestedModel ? { model: requestedModel } : {}),
      timeoutSeconds,
      maxRetries: 1,
    },
    schemaPath: resolve(schemaPath),
  });

const writeJson = async (path, value) => writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
const attempts = [];

const runStage = async ({ repetition, stage, schemaPath, prompt, parse, evaluate }) => {
  const stageDirectory = resolve(outputDirectory, `run-${String(repetition).padStart(2, "0")}`, stage);
  await mkdir(stageDirectory, { recursive: true });
  let startedAt = new Date().toISOString();
  const started = performance.now();
  let adapter;
  let replayAttempt;
  try {
    let raw;
    if (replayDirectory) {
      const replayStageDirectory = resolve(replayDirectory, `run-${String(repetition).padStart(2, "0")}`, stage);
      raw = JSON.parse(await readFile(resolve(replayStageDirectory, "raw-output.json"), "utf8"));
      replayAttempt = JSON.parse(await readFile(resolve(replayStageDirectory, "attempt.json"), "utf8"));
      startedAt = replayAttempt.startedAt;
    } else {
      adapter = adapterFor(schemaPath);
      raw = await adapter.completeJson(prompt);
    }
    await writeJson(resolve(stageDirectory, "raw-output.json"), raw);
    const output = parse(raw);
    await writeJson(resolve(stageDirectory, "validated-output.json"), output);
    const metrics = evaluate(output);
    const metadata = replayAttempt?.provider ?? adapter?.getLastRunMetadata() ?? {};
    const attempt = {
      repetition,
      stage,
      status: metrics.passed ? "passed" : "blocked",
      startedAt,
      elapsedMs: replayAttempt?.elapsedMs ?? Math.round(performance.now() - started),
      outputHash: sha256Json(output),
      provider: metadata,
      metrics,
      artifactDirectory: stageDirectory,
      ...(replayDirectory ? { replayedFrom: resolve(replayDirectory) } : {}),
    };
    await writeJson(resolve(stageDirectory, "attempt.json"), attempt);
    attempts.push(attempt);
    return attempt;
  } catch (error) {
    const metadata = replayAttempt?.provider ?? adapter?.getLastRunMetadata() ?? {};
    const attempt = {
      repetition,
      stage,
      status: error?.name === "AbortError" ? "cancelled" : "failed",
      startedAt,
      elapsedMs: replayAttempt?.elapsedMs ?? Math.round(performance.now() - started),
      outputHash: null,
      provider: metadata,
      failure: {
        name: error instanceof Error ? error.name : "Error",
        message: error instanceof Error ? error.message : String(error),
      },
      metrics: { passed: false },
      artifactDirectory: stageDirectory,
      ...(replayDirectory ? { replayedFrom: resolve(replayDirectory) } : {}),
    };
    await writeJson(resolve(stageDirectory, "attempt.json"), attempt);
    attempts.push(attempt);
    return attempt;
  }
};

const narrationProject = {
  brief: fixture.project.brief,
  materials: fixture.project.materials,
};
const narrationPrompt = {
  system: "You write natural Chinese creator narration and production guidance for SeanLab.",
  user: buildNarrationPrompt(narrationProject, fixture.project.sourceContext),
};
const recutPrompt = createRecutPlanningPrompt(fixture.recut.transcript);
const sourceGroundingText = [
  fixture.project.brief.topic,
  ...fixture.project.sourceContext
    .filter((source) => source.status === "resolved")
    .flatMap((source) => [source.label, source.content]),
  ...fixture.semantic.captions.flatMap((cue) => [cue.zh, cue.en]),
]
  .filter((value) => typeof value === "string" && value.trim())
  .join("\n");
const semanticPrompt = createSemanticNarrativePrompt(
  fixture.semantic.captions,
  fixture.semantic.terminologyProfile ?? undefined,
  fixture.semantic.imageEvidence,
);

for (let repetition = 1; repetition <= repetitions; repetition += 1) {
  await runStage({
    repetition,
    stage: "narration",
    schemaPath: "schemas/narration-script-package.schema.json",
    prompt: narrationPrompt,
    parse: (raw) =>
      validateNarrationScriptPackage({
        ...raw,
        fullScript: composeNarrationScript(raw),
      }),
    evaluate: (narration) =>
      evaluateNarrationConformance({
        narration,
        requiredTerms: fixture.narration.requiredTerms,
        forbiddenTerms: fixture.narration.forbiddenTerms,
        sourceGroundingText,
        registeredMaterialIds: fixture.project.materials.map((item) => item.id),
      }),
  });

  await runStage({
    repetition,
    stage: "recut",
    schemaPath: "schemas/recut-provider-plan.schema.json",
    prompt: recutPrompt,
    parse: (raw) => parseRecutProviderPlan(raw, fixture.recut.transcript),
    evaluate: (plan) =>
      evaluateRecutConformance({
        plan,
        acceptableCandidateSets: fixture.recut.acceptableCandidateSets,
        protectedWordRanges: fixture.recut.protectedWordRanges,
      }),
  });

  await runStage({
    repetition,
    stage: "semantic-plan",
    schemaPath: "schemas/semantic-narrative-plan.schema.json",
    prompt: semanticPrompt,
    parse: (raw) => parseSemanticNarrativePlan(raw, fixture.semantic.captions),
    evaluate: (plan) => {
      let viewerCopyPassCount = 0;
      let layoutCapacityPassCount = 0;
      const candidates = plan.segments.map((intent, semanticIndex) => {
        const evidenceBounds = boundImageEvidenceIntentToCaptions(
          intent,
          fixture.semantic.captions,
          fixture.semantic.imageEvidence,
          `semantic-${semanticIndex + 1}`,
        );
        if (evidenceBounds.status === "blocked")
          return {
            id: `semantic-${semanticIndex + 1}`,
            semanticIndex,
            startCue: intent.startCue,
            endCue: intent.endCue,
            start: fixture.semantic.captions[intent.startCue].start,
            end: fixture.semantic.captions[intent.endCue].end,
            visualPriority: intent.visualPriority,
            confidence: intent.confidence,
            rhetoric: intent.rhetoric,
            reason: intent.reason,
            materializationStatus: "blocked",
            materializationReason: evidenceBounds.reason,
          };
        const boundedIntent = evidenceBounds.intent;
        const segment = evidenceBounds.segment;
        let result;
        try {
          result = materializeSemanticIntent(
            segment,
            boundedIntent,
            fixture.semantic.terminologyProfile ?? undefined,
            fixture.semantic.imageEvidence,
          );
        } catch (error) {
          return {
            id: segment.id,
            semanticIndex,
            startCue: boundedIntent.startCue,
            endCue: boundedIntent.endCue,
            start: segment.start,
            end: segment.end,
            visualPriority: boundedIntent.visualPriority,
            confidence: boundedIntent.confidence,
            rhetoric: boundedIntent.rhetoric,
            reason: boundedIntent.reason,
            materializationStatus: "blocked",
            materializationReason: error instanceof Error ? error.message : String(error),
          };
        }
        if (result.status === "skipped")
          return {
            id: segment.id,
            semanticIndex,
            startCue: boundedIntent.startCue,
            endCue: boundedIntent.endCue,
            start: segment.start,
            end: segment.end,
            visualPriority: boundedIntent.visualPriority,
            confidence: boundedIntent.confidence,
            rhetoric: boundedIntent.rhetoric,
            reason: boundedIntent.reason,
            materializationStatus: "skipped",
            materializationReason: result.reason,
          };
        try {
          validateViewerFacingNarrative(result.brief.narrative);
          viewerCopyPassCount += 1;
        } catch {}
        try {
          validateMaterializedBriefContent(result.brief);
          layoutCapacityPassCount += 1;
        } catch {}
        return {
          id: segment.id,
          semanticIndex,
          startCue: boundedIntent.startCue,
          endCue: boundedIntent.endCue,
          start: segment.start,
          end: segment.end,
          visualPriority: boundedIntent.visualPriority,
          confidence: boundedIntent.confidence,
          rhetoric: boundedIntent.rhetoric,
          reason: boundedIntent.reason,
          materializationStatus: "planned",
          overlayCue: {
            start: segment.start,
            end: segment.end,
            eyebrow: result.brief.narrative.eyebrow,
            title: result.brief.narrative.title,
            subtitle: result.brief.narrative.subtitleZh,
            subtitleEn: result.brief.narrative.subtitleEn,
            accent: "#59D98E",
            generatedVisual: result.brief,
            layoutTemplateId: "speaker-right-overlay-left",
            contentScale: 1,
          },
        };
      });
      const materializedCandidateCount = candidates.filter(
        (candidate) => candidate.materializationStatus === "planned",
      ).length;
      const validationCandidateCount = candidates.filter(
        (candidate) => candidate.materializationStatus !== "skipped",
      ).length;
      const direction = directVisualPacing({
        candidates: candidates.filter((candidate) => candidate.materializationStatus === "planned"),
        durationSeconds: fixture.semantic.captions.at(-1).end,
      });
      return {
        ...evaluateSemanticConformance({
          plan,
          expectedEvidenceRanges: fixture.semantic.expectedEvidenceRanges,
          forbiddenTerms: fixture.semantic.forbiddenTerms,
          sourceGroundingText,
          registeredImageIds: fixture.semantic.imageEvidence.map((item) => item.id),
          materializedCandidateCount,
          validationCandidateCount,
          viewerCopyPassCount,
          layoutCapacityPassCount,
        }),
        selectedComponentCount: direction.decisions.filter((decision) => decision.action === "show").length,
        candidateComponentIds: candidates
          .filter((candidate) => candidate.overlayCue)
          .map((candidate) => candidate.overlayCue.generatedVisual.component.id),
      };
    },
  });
}

const stages = ["narration", "recut", "semantic-plan"];
const averageMetric = (values, metric) => {
  const measured = values.map((attempt) => attempt.metrics?.[metric]).filter((value) => Number.isFinite(value));
  return measured.length ? measured.reduce((total, value) => total + value, 0) / measured.length : 0;
};
const stageSummary = Object.fromEntries(
  stages.map((stage) => {
    const values = attempts.filter((attempt) => attempt.stage === stage);
    return [
      stage,
      {
        runs: values.length,
        passed: values.filter((attempt) => attempt.status === "passed").length,
        blocked: values.filter((attempt) => attempt.status === "blocked").length,
        failed: values.filter((attempt) => attempt.status === "failed").length,
        cancelled: values.filter((attempt) => attempt.status === "cancelled").length,
        schemaSuccessRate: values.length
          ? values.filter((attempt) => ["passed", "blocked"].includes(attempt.status)).length / values.length
          : 0,
        averageElapsedMs: values.length
          ? Math.round(values.reduce((total, attempt) => total + attempt.elapsedMs, 0) / values.length)
          : 0,
      },
    ];
  }),
);
const semanticRangeSets = await Promise.all(
  attempts
    .filter((attempt) => attempt.stage === "semantic-plan" && attempt.outputHash)
    .map(async (attempt) => {
      const output = JSON.parse(await readFile(resolve(attempt.artifactDirectory, "validated-output.json"), "utf8"));
      return output.segments.map((segment) => `${segment.startCue}-${segment.endCue}`);
    }),
);
const observedModels = [
  ...new Set(
    attempts
      .map((attempt) => attempt.provider?.model)
      .filter((model) => typeof model === "string" && model !== "unknown"),
  ),
];
const minimumSemanticRangeSimilarity = pairwiseMinimumSimilarity(semanticRangeSets);
const narrationAttempts = attempts.filter((attempt) => attempt.stage === "narration");
const recutAttempts = attempts.filter((attempt) => attempt.stage === "recut");
const semanticAttempts = attempts.filter((attempt) => attempt.stage === "semantic-plan");
const semanticOutputHashes = semanticAttempts
  .map((attempt) => attempt.outputHash)
  .filter((hash) => typeof hash === "string");
const status =
  attempts.length === repetitions * stages.length &&
  attempts.every((attempt) => attempt.status === "passed") &&
  minimumSemanticRangeSimilarity >= 0.75
    ? "passed"
    : "blocked";
const report = {
  schemaVersion: "1.0",
  contractVersion: "agent-conformance-1.0",
  fixtureId: fixture.id,
  generatedAt,
  agent: {
    id: agentId,
    cliVersion: detectedAgent.version ?? "unknown",
    requestedModel,
    observedModels,
  },
  inputHash: fixtureHash,
  attempts,
  summary: {
    repetitions,
    stages: stageSummary,
    minimumSemanticRangeSimilarity,
    semanticUniqueOutputHashes: new Set(semanticOutputHashes).size,
    narration: {
      requiredTermCoverage: averageMetric(narrationAttempts, "requiredTermCoverage"),
      unsupportedFactBlockRate: narrationAttempts.length
        ? narrationAttempts.filter(
            (attempt) =>
              (attempt.metrics?.forbiddenHits?.length ?? 1) === 0 &&
              (attempt.metrics?.unsupportedSourceTerms?.length ?? 1) === 0,
          ).length / narrationAttempts.length
        : 0,
    },
    recut: {
      precision: averageMetric(recutAttempts, "precision"),
      recall: averageMetric(recutAttempts, "recall"),
      protectedViolationCount: recutAttempts.reduce(
        (total, attempt) => total + (attempt.metrics?.protectedViolationCount ?? 0),
        0,
      ),
    },
    semantic: {
      evidencePrecision: averageMetric(semanticAttempts, "evidencePrecision"),
      evidenceRecall: averageMetric(semanticAttempts, "evidenceRecall"),
      unsupportedFactBlockRate: semanticAttempts.length
        ? semanticAttempts.filter(
            (attempt) =>
              (attempt.metrics?.forbiddenHits?.length ?? 1) === 0 &&
              (attempt.metrics?.unsupportedSourceTerms?.length ?? 1) === 0,
          ).length / semanticAttempts.length
        : 0,
      averageCandidateComponentCount: averageMetric(semanticAttempts, "materializedCandidateCount"),
      averageSelectedComponentCount: averageMetric(semanticAttempts, "selectedComponentCount"),
      viewerCopyPassRate: averageMetric(semanticAttempts, "viewerCopyPassRate"),
      layoutCapacityPassRate: averageMetric(semanticAttempts, "layoutCapacityPassRate"),
    },
    execution: {
      failedAttempts: attempts.filter((attempt) => attempt.status === "failed").length,
      cancelledAttempts: attempts.filter((attempt) => attempt.status === "cancelled").length,
      timeoutAttempts: attempts.filter((attempt) => /timed out/i.test(attempt.failure?.message ?? "")).length,
    },
  },
  status,
};
await writeJson(resolve(outputDirectory, "report.json"), report);
await writeFile(
  resolve(outputDirectory, "report.md"),
  `# Agent conformance report

- Fixture: ${fixture.id}
- Agent: ${agentId}
- Requested model: ${requestedModel ?? "Agent default"}
- Observed models: ${observedModels.join(", ") || "unreported"}
- Repetitions: ${repetitions}
- Status: ${status}
- Minimum semantic-range similarity: ${minimumSemanticRangeSimilarity.toFixed(3)}
- Narration term coverage: ${report.summary.narration.requiredTermCoverage.toFixed(3)}
- Recut precision / recall: ${report.summary.recut.precision.toFixed(3)} / ${report.summary.recut.recall.toFixed(3)}
- Semantic evidence precision / recall: ${report.summary.semantic.evidencePrecision.toFixed(3)} / ${report.summary.semantic.evidenceRecall.toFixed(3)}
- Viewer copy / layout capacity pass rate: ${report.summary.semantic.viewerCopyPassRate.toFixed(3)} / ${report.summary.semantic.layoutCapacityPassRate.toFixed(3)}

| Stage | Passed | Blocked | Failed | Cancelled | Schema success | Average |
|---|---:|---:|---:|---:|---:|---:|
${stages
  .map((stage) => {
    const value = stageSummary[stage];
    return `| ${stage} | ${value.passed} | ${value.blocked} | ${value.failed} | ${value.cancelled} | ${value.schemaSuccessRate.toFixed(3)} | ${value.averageElapsedMs} ms |`;
  })
  .join("\n")}

Candidate and selected component counts are observations only. They are not minimum-density gates.
`,
);
console.log(JSON.stringify({ outputDirectory, report: resolve(outputDirectory, "report.json"), status }));
if (status !== "passed") process.exitCode = 2;
