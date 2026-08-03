import { copyFile, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { fileExists, hashFile } from "./state.mjs";

const tracked = (paths) => [
  ["semantic-narrative-plan.json", paths.semanticNarrativePlan, "semanticNarrativePlanFile"],
  ["semantic-provider-report.json", paths.semanticProviderReport, "semanticProviderReportFile"],
  ["component-candidates.json", paths.componentCandidates, "componentCandidatesFile"],
  ["visual-direction-plan.json", paths.visualDirectionPlan, "visualDirectionPlanFile"],
  ["visual-direction-report.json", paths.visualDirectionReport, "visualDirectionReportFile"],
  ["visual-direction-review.md", paths.visualDirectionReview, "visualDirectionReviewFile"],
  ["visual-direction-timeline.svg", paths.visualDirectionTimeline, "visualDirectionTimelineFile"],
  ["visual-brief.json", paths.planning, "planningFile"],
  ["review-props.json", paths.reviewProps, "reviewPropsFile"],
  ["validation-report.json", resolve(paths.workspace, "validation-report.json"), "validationReportFile"],
];

const copyExisting = async (entries, directory) => {
  const copied = [];
  for (const [name, source] of entries) {
    if (!source || !(await fileExists(source))) continue;
    const destination = resolve(directory, name);
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(source, destination);
    copied.push({ name, sha256: await hashFile(destination) });
  }
  return copied;
};

const loadJson = async (path) => {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return undefined;
  }
};

const summarize = async (directory) => {
  const semantic = await loadJson(resolve(directory, "semantic-narrative-plan.json"));
  const provider = await loadJson(resolve(directory, "semantic-provider-report.json"));
  const candidates = await loadJson(resolve(directory, "component-candidates.json"));
  const direction = await loadJson(resolve(directory, "visual-direction-report.json"));
  return {
    provider: provider
      ? {
          agentId: provider.agentId ?? provider.provider ?? null,
          model: provider.model ?? provider.generation?.model ?? null,
          cliVersion: provider.cliVersion ?? null,
          runtimeVersion: provider.runtimeVersion ?? null,
          contractVersion: provider.contractVersion ?? null,
          outputHash: provider.outputHash ?? null,
        }
      : null,
    semantic: semantic
      ? {
          segmentCount: semantic.segments?.length ?? 0,
          boundaries: (semantic.segments ?? []).map(({ startCue, endCue }) => [startCue, endCue]),
          rhetoric: (semantic.segments ?? []).map(({ rhetoric }) => rhetoric),
          titles: (semantic.segments ?? []).map((segment) => segment.narrative?.title ?? ""),
          videoIdentity: semantic.videoIdentity ?? null,
        }
      : null,
    components: candidates
      ? {
          candidateCount: candidates.candidates?.length ?? 0,
          selectedComponents: (candidates.candidates ?? [])
            .filter((candidate) => candidate.materializationStatus === "planned")
            .map((candidate) => candidate.overlayCue?.generatedVisual?.component?.id ?? null),
        }
      : null,
    direction: direction
      ? {
          selectedCount: direction.summary?.selectedCount ?? 0,
          skippedCount: direction.summary?.skippedCount ?? 0,
          visualCoverageRatio: direction.summary?.visualCoverageRatio ?? 0,
          componentUsage: direction.componentUsage ?? {},
        }
      : null,
  };
};

export const beginSemanticAttempt = async ({ paths, runtimeConfigPath }) => {
  const id = new Date().toISOString().replaceAll(/[:.]/g, "-");
  const directory = resolve(paths.workspace, "semantic-attempts", id);
  const previousDirectory = resolve(directory, "previous");
  const candidateDirectory = resolve(directory, "candidate");
  await mkdir(candidateDirectory, { recursive: true });
  const previous = await copyExisting(tracked(paths), previousDirectory);
  const runtime = JSON.parse(await readFile(runtimeConfigPath, "utf8"));
  const outputMap = new Map();
  for (const [name, destination, configKey] of tracked(paths)) {
    if (!destination) continue;
    const candidatePath = resolve(candidateDirectory, name);
    runtime[configKey] = candidatePath;
    outputMap.set(resolve(destination), candidatePath);
  }
  const attemptConfigPath = resolve(directory, "runtime-config.json");
  await writeFile(attemptConfigPath, `${JSON.stringify(runtime, null, 2)}\n`);
  await writeFile(
    resolve(directory, "attempt.json"),
    `${JSON.stringify({ schemaVersion: "1.0", id, status: "running", startedAt: new Date().toISOString(), previous }, null, 2)}\n`,
  );
  return { id, directory, previousDirectory, candidateDirectory, attemptConfigPath, outputMap };
};

export const resumeSemanticAttempt = async ({ paths, id }) => {
  if (typeof id !== "string" || !/^[0-9TZ-]{10,40}$/.test(id)) {
    throw new Error("--resume-semantic-attempt requires a valid attempt id");
  }
  const directory = resolve(paths.workspace, "semantic-attempts", id);
  const previousDirectory = resolve(directory, "previous");
  const candidateDirectory = resolve(directory, "candidate");
  const attemptConfigPath = resolve(directory, "runtime-config.json");
  const record = await loadJson(resolve(directory, "attempt.json"));
  if (!record || record.id !== id || record.status !== "failed") {
    throw new Error(`Semantic attempt ${id} is not a resumable failed attempt`);
  }
  if (!["component-props", "visual-direction", "validate"].includes(record.failedStage)) {
    throw new Error(`Semantic attempt ${id} failed before a complete provider result was available`);
  }
  for (const name of ["semantic-narrative-plan.json", "semantic-provider-report.json"]) {
    if (!(await fileExists(resolve(candidateDirectory, name)))) {
      throw new Error(`Semantic attempt ${id} is missing ${name}`);
    }
  }
  if (!(await fileExists(attemptConfigPath))) {
    throw new Error(`Semantic attempt ${id} is missing runtime-config.json`);
  }
  const outputMap = new Map(
    tracked(paths)
      .filter(([, destination]) => destination)
      .map(([name, destination]) => [resolve(destination), resolve(candidateDirectory, name)]),
  );
  return {
    id,
    directory,
    previousDirectory,
    candidateDirectory,
    attemptConfigPath,
    outputMap,
    failedStage: record.failedStage,
  };
};

export const candidateOutputsForStage = ({ attempt, outputs }) =>
  outputs.map((output) => attempt.outputMap.get(resolve(output)) ?? output);

export const failSemanticAttempt = async ({ attempt, stage, failure }) => {
  const attemptPath = resolve(attempt.directory, "attempt.json");
  const current = (await loadJson(attemptPath)) ?? { schemaVersion: "1.0", id: attempt.id };
  await writeFile(
    attemptPath,
    `${JSON.stringify(
      {
        ...current,
        status: "failed",
        failedAt: new Date().toISOString(),
        failedStage: stage,
        failure: {
          code: failure?.code ?? "STAGE_EXECUTION_FAILED",
          message: failure?.message ?? "Semantic replanning failed",
        },
      },
      null,
      2,
    )}\n`,
  );
};

export const promoteSemanticAttempt = async ({ attempt, paths }) => {
  const entries = tracked(paths).filter(([, destination]) => destination);
  for (const [name] of entries) {
    const candidate = resolve(attempt.candidateDirectory, name);
    if (!(await fileExists(candidate))) throw new Error(`Semantic attempt did not produce ${basename(candidate)}`);
  }
  const prepared = [];
  try {
    for (const [name, destination] of entries) {
      const candidate = resolve(attempt.candidateDirectory, name);
      const next = `${destination}.semantic-next-${attempt.id}`;
      await mkdir(dirname(destination), { recursive: true });
      await copyFile(candidate, next);
      prepared.push({ destination, next });
    }
    for (const { destination, next } of prepared) await rename(next, destination);
    await writeFile(
      resolve(attempt.directory, "attempt.json"),
      `${JSON.stringify({ schemaVersion: "1.0", id: attempt.id, status: "promoted", promotedAt: new Date().toISOString() }, null, 2)}\n`,
    );
  } catch (error) {
    await Promise.all(prepared.map(({ next }) => rm(next, { force: true })));
    for (const [name, destination] of entries) {
      const previous = resolve(attempt.previousDirectory, name);
      if (await fileExists(previous)) await copyFile(previous, destination);
      else await rm(destination, { force: true });
    }
    throw error;
  }
};

export const finalizeSemanticAttemptComparison = async ({ attempt }) => {
  const previous = await summarize(attempt.previousDirectory);
  const current = await summarize(attempt.candidateDirectory);
  const report = {
    schemaVersion: "1.0",
    attemptId: attempt.id,
    generatedAt: new Date().toISOString(),
    previous,
    current,
    changed: JSON.stringify(previous) !== JSON.stringify(current),
  };
  await writeFile(resolve(attempt.directory, "comparison.json"), `${JSON.stringify(report, null, 2)}\n`);
  const lines = [
    "# Semantic replanning comparison",
    "",
    `- Attempt: ${attempt.id}`,
    `- Changed: ${report.changed ? "yes" : "no"}`,
    `- Agent/model: ${previous.provider?.agentId ?? "none"} / ${previous.provider?.model ?? "none"} -> ${current.provider?.agentId ?? "none"} / ${current.provider?.model ?? "none"}`,
    `- Provider output hash: ${previous.provider?.outputHash ?? "none"} -> ${current.provider?.outputHash ?? "none"}`,
    `- Semantic segments: ${previous.semantic?.segmentCount ?? "none"} -> ${current.semantic?.segmentCount ?? "none"}`,
    `- Materialized components: ${previous.components?.selectedComponents?.length ?? "none"} -> ${current.components?.selectedComponents?.length ?? "none"}`,
    `- Directed visuals: ${previous.direction?.selectedCount ?? "none"} -> ${current.direction?.selectedCount ?? "none"}`,
    `- Visual coverage: ${previous.direction?.visualCoverageRatio ?? "none"} -> ${current.direction?.visualCoverageRatio ?? "none"}`,
    "",
  ];
  await writeFile(resolve(attempt.directory, "comparison.md"), lines.join("\n"));
  return report;
};
