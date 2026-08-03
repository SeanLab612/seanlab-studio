import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { isAbsolute, relative, resolve } from "node:path";
import { creatorRoot } from "./project-store.mjs";

const acceptanceFlag = "production-agent-recovery";
const supportedScenarios = new Set([
  "recover-once",
  "repair-code",
  "exhaust-attempts",
  "waiting-human",
  "recover-once-live",
]);
const workflowRuns = new Map();

const isInside = (root, candidate) => {
  const child = relative(resolve(root), resolve(candidate));
  return Boolean(child) && !child.startsWith("..") && !isAbsolute(child);
};

const stableHash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export const productionAgentAcceptanceScenario = () => {
  if (process.env.NODE_ENV !== "test" || process.env.REMOTION_MD_ACCEPTANCE_FAULTS !== acceptanceFlag) return undefined;
  const scenario = process.env.REMOTION_MD_ACCEPTANCE_SCENARIO;
  if (!supportedScenarios.has(scenario)) throw new Error("Unsupported production Agent acceptance scenario");
  const studioDataRoot = process.env.REMOTION_MD_STUDIO_DATA_ROOT;
  if (!studioDataRoot || !isInside(tmpdir(), creatorRoot) || !isInside(tmpdir(), studioDataRoot))
    throw new Error("Production Agent acceptance faults require isolated temporary roots");
  return {
    id: scenario,
    liveAgent: scenario === "recover-once-live",
  };
};

export const nextProductionAgentAcceptanceWorkflowOutcome = ({ projectId, scenario }) => {
  const key = `${scenario.id}:${projectId}`;
  const attempt = (workflowRuns.get(key) ?? 0) + 1;
  workflowRuns.set(key, attempt);
  const succeeds = ["recover-once", "repair-code", "recover-once-live"].includes(scenario.id) && attempt > 1;
  if (succeeds) return { exitCode: 0, attempt };
  const sourceRepair = scenario.id === "repair-code";
  return {
    exitCode: 71,
    attempt,
    failure: {
      code: sourceRepair ? "VISUAL_PROPS_INVALID" : "ACCEPTANCE_TRANSIENT_STAGE_FAILURE",
      category: sourceRepair ? "visual-contract" : "operation",
      stage: sourceRepair ? "component-props" : "visual-qa",
      message: sourceRepair ? "受控验收故障：组件属性契约需要源码修复" : `受控验收故障：visual-qa 第 ${attempt} 次失败`,
      remediation: sourceRepair
        ? "在隔离工作树修复契约并通过完整验证后继续。"
        : "从已验证的 visual-qa 检查点重新检查并继续。",
      retryable: !sourceRepair,
      occurredAt: new Date().toISOString(),
    },
  };
};

export const productionAgentAcceptanceRecoveryFixture = ({ projectId, failedRecord, scenario }) => {
  const failure = failedRecord.currentFailure;
  const sourceRepair = scenario.id === "repair-code";
  const recoverySnapshot = {
    projectId,
    status: sourceRepair ? "blocked" : "recoverable",
    stage: failure.stage,
    failure,
    preserved: {
      completedStages: ["review-evidence"],
      approvedStages: ["recut-approval"],
      artifacts: [
        {
          kind: "review-evidence",
          path: "<acceptance>/review-evidence.json",
          bytes: 128,
          sha256: stableHash({ projectId, kind: "review-evidence" }),
        },
      ],
    },
    resume: {
      enabled: !sourceRepair,
      action: "continue",
      stage: failure.stage,
      requiresReadiness: true,
      requiresConfirmation: true,
    },
  };
  const recovery = {
    schemaVersion: "1.0",
    ...recoverySnapshot,
    headline: "受控故障可以从当前有效断点继续",
    summary: failure.message,
    recoverySha256: stableHash(recoverySnapshot),
  };
  const waitsForHuman = scenario.id === "waiting-human";
  const diagnosis = {
    summary: waitsForHuman
      ? "需要人工决定视觉修复方式"
      : sourceRepair
        ? "检测到可由制作 Agent 修复的组件契约缺陷"
        : "检测到可重试的受控阶段故障",
    rootCause: waitsForHuman
      ? "验收场景要求进行视觉选择，自动恢复白名单不覆盖该决策。"
      : sourceRepair
        ? "验收注入器模拟了一个只涉及 Studio 源码的组件属性契约错误。"
        : "验收注入器在 visual-qa 阶段制造了一次可恢复的瞬时错误。",
    evidence: [`失败任务 ${failedRecord.id}`, `故障阶段 ${failure.stage}`, "上游审核证据和粗剪审批保持不变"],
    recommendedAction: waitsForHuman ? "request-user" : sourceRepair ? "repair-code" : "recheck",
    safeToResume: !waitsForHuman && !sourceRepair,
    userMessage: waitsForHuman
      ? "请人工选择修复方案后再继续。"
      : sourceRepair
        ? "可以在隔离工作树完成源码修复和验证后继续。"
        : "可以从 visual-qa 重新检查并继续。",
    technicalNotes: ["这是隔离临时项目中的确定性验收故障。"],
  };
  const readiness = {
    projectId,
    event: "workflow.preview",
    schemaVersion: "1.0",
    readinessSha256: stableHash({ projectId, failedJobId: failedRecord.id, stage: failure.stage }),
    readinessStatus: "ready",
    nextHumanGate: "human-approval",
    targetStage: "regression-fixtures",
    plannedStages: sourceRepair
      ? ["component-props", "visual-direction", "visual-qa", "review-evidence", "regression-fixtures"]
      : ["visual-qa", "review-evidence", "regression-fixtures"],
    reusedStages: ["recut-approval"],
    blockedStages: [],
    issues: [],
  };
  return {
    recovery,
    diagnosis,
    readiness,
    ...(sourceRepair
      ? {
          repair: {
            kind: "validated-source-repair",
            success: true,
            changedPaths: ["src/visual-brief/generator.ts", "tests/semantic-planning.test.ts"],
            patchSha256: stableHash({ projectId, repair: "component-props" }),
            validation: ["format:check", "lint", "typecheck", "test:unit", "test:workflow-core"],
          },
        }
      : {}),
    provider: {
      provider: "acceptance-fixture",
      executor: "deterministic",
      model: "fixture",
      status: "succeeded",
      attemptCount: 1,
      elapsedMs: 0,
    },
  };
};
