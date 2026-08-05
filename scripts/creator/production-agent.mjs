import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { agentDefinition } from "../../src/agents/registry.ts";
import { loadCreatorProject, projectDir, writeJsonAtomic } from "./project-store.mjs";

const states = new Set([
  "not-started",
  "active",
  "diagnosing",
  "recovering",
  "waiting-human",
  "starting-delivery",
  "exited",
  "failed",
]);
const automaticResumeReasons = new Set([
  "automatic-resume",
  "automatic-recheck-resume",
  "automatic-provider-env-refresh",
  "automatic-source-repair",
  "automatic-binding-repair",
  "automatic-visual-contract-repair",
  "automatic-semantic-plan-repair",
]);

export const productionAgentStateFile = (projectId) =>
  resolve(projectDir(projectId), "review", "production-agent.json");

export const loadProductionAgentState = async (projectId) => {
  try {
    return JSON.parse(await readFile(productionAgentStateFile(projectId), "utf8"));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    const project = await loadCreatorProject(projectId);
    const capabilities = agentDefinition(project.agent.id).capabilities;
    return {
      schemaVersion: "1.0",
      projectId,
      agent: {
        id: project.agent.id,
        ...(project.agent.model ? { model: project.agent.model } : {}),
        fallback: "none",
        capabilities: {
          productionOrchestration: capabilities.productionOrchestration,
          imageProviderOrchestration: capabilities.imageProviderOrchestration,
          imageGeneration: capabilities.imageGeneration,
        },
      },
      state: "not-started",
      updatedAt: null,
      history: [],
    };
  }
};

export const transitionProductionAgent = async ({ projectId, state, reason, metadata = {} }) => {
  if (!states.has(state)) throw new Error(`Unsupported production Agent state: ${state}`);
  const current = await loadProductionAgentState(projectId);
  const now = new Date().toISOString();
  const event = { state, reason, at: now, ...metadata };
  const next = {
    ...current,
    state,
    updatedAt: now,
    ...(state === "active" && !current.enteredAt ? { enteredAt: now } : {}),
    ...(state === "exited" ? { exitedAt: now } : {}),
    history: [...(current.history ?? []), event].slice(-100),
  };
  await writeJsonAtomic(productionAgentStateFile(projectId), next);
  return next;
};

export const automaticProductionRecoveryAttempts = (state) =>
  (state.history ?? []).filter((event) => automaticResumeReasons.has(event.reason)).length;

export const recordProductionAgentDiagnosis = async ({
  projectId,
  recovery,
  diagnosis,
  decision,
  provider,
  failedJobId,
}) => {
  const createdAt = new Date().toISOString();
  const record = {
    schemaVersion: "1.0",
    kind: "production-agent-diagnosis",
    projectId,
    createdAt,
    failedJobId,
    recoverySha256: recovery.recoverySha256,
    failure: recovery.failure,
    preserved: recovery.preserved,
    diagnosis,
    decision,
    provider,
  };
  const fileName = `${createdAt.replaceAll(/[:.]/g, "-")}-${failedJobId}.json`;
  const path = resolve(projectDir(projectId), "review", "production-agent-diagnoses", fileName);
  await writeJsonAtomic(path, record);
  return { ...record, path };
};

export const enterProductionAgent = (projectId, reason = "rough-cut-completed") =>
  transitionProductionAgent({ projectId, state: "active", reason });

export const exitProductionAgentForDelivery = (projectId, metadata = {}) =>
  transitionProductionAgent({
    projectId,
    state: "exited",
    reason: "delivery-validated",
    metadata,
  });
