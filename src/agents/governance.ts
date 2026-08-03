import type { AgentId } from "./types.ts";

export const CONFORMANCE_STAGES = ["narration", "recut", "semantic-plan"] as const;
export type ConformanceStage = (typeof CONFORMANCE_STAGES)[number];
export type AgentModelPairStatus = "candidate" | "approved" | "blocked";

export type AgentModelPair = {
  id: string;
  agentId: Exclude<AgentId, "fixture">;
  model: string;
  status: AgentModelPairStatus;
  testedStages: ConformanceStage[];
  conformanceReportSha256: string | null;
  review: {
    reviewer: string;
    reviewedAt: string;
    reason: string;
  } | null;
};

export type AgentModelGovernance = {
  schemaVersion: "1.0";
  contractVersion: "agent-model-governance-1.0";
  pairs: AgentModelPair[];
};

const safeId = /^[a-z0-9][a-z0-9._-]{2,127}$/;
const safeModel = /^[A-Za-z0-9._[\]-]+$/;
const sha256 = /^[a-f0-9]{64}$/;
const requiredStages = new Set<ConformanceStage>(CONFORMANCE_STAGES);

export type ConformanceReportEvidence = {
  schemaVersion: "1.0";
  contractVersion: "agent-conformance-1.0";
  agent: {
    id: AgentModelPair["agentId"];
    requestedModel: string | null;
    observedModels: string[];
  };
  summary: {
    stages: Record<ConformanceStage, { runs: number; passed: number; blocked: number; failed: number }>;
  };
  attempts?: Array<{ replayedFrom?: string }>;
  status: "passed" | "blocked";
};

export const validateAgentModelGovernance = (input: unknown): AgentModelGovernance => {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Agent model governance must be an object");
  const value = input as AgentModelGovernance;
  if (value.schemaVersion !== "1.0" || value.contractVersion !== "agent-model-governance-1.0")
    throw new Error("Agent model governance version is unsupported");
  if (!Array.isArray(value.pairs)) throw new Error("Agent model governance pairs must be an array");
  const ids = new Set<string>();
  const pairKeys = new Set<string>();
  for (const pair of value.pairs) {
    if (!safeId.test(pair.id) || ids.has(pair.id))
      throw new Error(`Invalid or duplicate Agent/model pair id: ${pair.id}`);
    ids.add(pair.id);
    if (!["codex-cli", "claude-code"].includes(pair.agentId))
      throw new Error(`Unsupported governed Agent: ${pair.agentId}`);
    if (!safeModel.test(pair.model) || pair.model.length > 128)
      throw new Error(`Invalid governed model: ${pair.model}`);
    const key = `${pair.agentId}:${pair.model}`;
    if (pairKeys.has(key)) throw new Error(`Duplicate governed Agent/model pair: ${key}`);
    pairKeys.add(key);
    if (!["candidate", "approved", "blocked"].includes(pair.status))
      throw new Error(`Invalid governance status for ${pair.id}`);
    if (
      !Array.isArray(pair.testedStages) ||
      pair.testedStages.some((stage) => !CONFORMANCE_STAGES.includes(stage)) ||
      new Set(pair.testedStages).size !== pair.testedStages.length
    )
      throw new Error(`Invalid tested stages for ${pair.id}`);
    if (pair.conformanceReportSha256 !== null && !sha256.test(pair.conformanceReportSha256))
      throw new Error(`Invalid conformance report hash for ${pair.id}`);
    if (pair.review && Number.isNaN(Date.parse(pair.review.reviewedAt)))
      throw new Error(`Invalid review timestamp for ${pair.id}`);
    if (pair.status === "candidate" && pair.review !== null)
      throw new Error(`Candidate pair ${pair.id} cannot contain a review decision`);
    if (pair.status === "approved" || pair.status === "blocked") {
      if (
        pair.testedStages.length !== CONFORMANCE_STAGES.length ||
        !pair.conformanceReportSha256 ||
        !pair.review?.reviewer.trim() ||
        !pair.review?.reviewedAt ||
        !pair.review?.reason.trim()
      )
        throw new Error(`Reviewed pair ${pair.id} lacks complete conformance evidence`);
    }
  }
  return value;
};

export const approvedAgentModelPairs = (registry: AgentModelGovernance, agentId?: AgentModelPair["agentId"]) =>
  validateAgentModelGovernance(registry).pairs.filter(
    (pair) => pair.status === "approved" && (!agentId || pair.agentId === agentId),
  );

export const assertApprovedAgentModel = (
  registry: AgentModelGovernance,
  agentId: AgentModelPair["agentId"],
  model: string,
) => {
  const pair = approvedAgentModelPairs(registry, agentId).find((item) => item.model === model);
  if (!pair) throw new Error(`Agent/model pair is not approved: ${agentId}/${model}`);
  return pair;
};

export const validatePassingConformanceEvidence = (input: unknown): ConformanceReportEvidence => {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Agent conformance report must be an object");
  const report = input as ConformanceReportEvidence;
  if (report.schemaVersion !== "1.0" || report.contractVersion !== "agent-conformance-1.0")
    throw new Error("Agent conformance report version is unsupported");
  if (report.status !== "passed") throw new Error("Only a passing conformance report can become a candidate");
  if (!["codex-cli", "claude-code"].includes(report.agent?.id))
    throw new Error("Conformance report Agent is unsupported");
  if (!report.agent.requestedModel || !safeModel.test(report.agent.requestedModel))
    throw new Error("Conformance report must pin an explicit safe model");
  if (
    !Array.isArray(report.agent.observedModels) ||
    report.agent.observedModels.length !== 1 ||
    report.agent.observedModels[0] !== report.agent.requestedModel
  )
    throw new Error("Requested and executor-observed models must match exactly");
  if (report.attempts?.some((attempt) => attempt.replayedFrom))
    throw new Error("Offline replay reports cannot become Agent/model candidates");
  for (const stage of requiredStages) {
    const summary = report.summary?.stages?.[stage];
    if (
      !summary ||
      summary.runs < 1 ||
      summary.passed !== summary.runs ||
      summary.blocked !== 0 ||
      summary.failed !== 0
    )
      throw new Error(`Conformance stage did not pass every run: ${stage}`);
  }
  return report;
};

export const registerConformanceCandidate = ({
  registry,
  report: input,
  reportSha256,
}: {
  registry: AgentModelGovernance;
  report: unknown;
  reportSha256: string;
}): AgentModelGovernance => {
  const current = validateAgentModelGovernance(registry);
  const report = validatePassingConformanceEvidence(input);
  if (!sha256.test(reportSha256)) throw new Error("Conformance report SHA-256 is invalid");
  const model = report.agent.requestedModel;
  if (!model) throw new Error("Conformance report model is missing");
  const id = `${report.agent.id}.${model}`.toLowerCase().replaceAll(/[^a-z0-9._-]/g, "-");
  const pair: AgentModelPair = {
    id,
    agentId: report.agent.id,
    model,
    status: "candidate",
    testedStages: [...CONFORMANCE_STAGES],
    conformanceReportSha256: reportSha256,
    review: null,
  };
  return validateAgentModelGovernance({
    ...current,
    pairs: [...current.pairs.filter((item) => item.id !== id), pair],
  });
};

export const reviewAgentModelCandidate = ({
  registry,
  pairId,
  decision,
  reportSha256,
  reviewer,
  reviewedAt,
  reason,
}: {
  registry: AgentModelGovernance;
  pairId: string;
  decision: "approved" | "blocked";
  reportSha256: string;
  reviewer: string;
  reviewedAt: string;
  reason: string;
}): AgentModelGovernance => {
  const current = validateAgentModelGovernance(registry);
  const pair = current.pairs.find((item) => item.id === pairId);
  if (!pair) throw new Error(`Unknown Agent/model candidate: ${pairId}`);
  if (pair.status !== "candidate") throw new Error(`Agent/model pair is not awaiting review: ${pairId}`);
  if (pair.conformanceReportSha256 !== reportSha256)
    throw new Error(`Conformance report hash does not match candidate: ${pairId}`);
  const review = {
    reviewer: reviewer.trim(),
    reviewedAt,
    reason: reason.trim(),
  };
  if (!review.reviewer || !review.reason || Number.isNaN(Date.parse(reviewedAt)))
    throw new Error("Agent/model review requires a reviewer, valid date, and reason");
  const nextPair: AgentModelPair = {
    ...pair,
    status: decision,
    review,
  };
  return validateAgentModelGovernance({
    ...current,
    pairs: current.pairs.map((item) => (item.id === pairId ? nextPair : item)),
  });
};
