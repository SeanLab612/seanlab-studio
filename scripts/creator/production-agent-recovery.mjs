export const MAX_AUTOMATIC_PRODUCTION_RECOVERY_ATTEMPTS = 6;

const automaticallyResumableActions = new Set(["recut", "continue", "delivery"]);
const automaticallyResumableRecommendations = new Set(["resume", "recheck"]);

const deterministicRepairStrategies = new Map([
  [
    "SEMANTIC_PLAN_INVALID",
    {
      kind: "validated-semantic-plan-repair",
      stage: "semantic-plan",
      workflowAction: "continue",
      strategy: "structured-validation-repair",
    },
  ],
]);

/**
 * Technical failures with a deterministic, evidence-preserving repair path do
 * not depend on a diagnostician choosing the right label. Adding a future
 * strategy here still requires a validated handler and a resumable checkpoint.
 */
export const deterministicProductionRepair = (failure) => {
  const strategy = deterministicRepairStrategies.get(failure?.code);
  if (!strategy || failure?.retryable === false || (failure?.stage && failure.stage !== strategy.stage))
    return undefined;
  return { ...strategy, success: true };
};

export const deterministicProductionDiagnosis = (failure, repair) => ({
  summary: "已识别为可验证的技术规划错误",
  rootCause: failure?.message ?? `${failure?.code ?? "UNKNOWN"} 需要执行已注册的确定性修复`,
  evidence: [
    `error-code:${failure?.code ?? "UNKNOWN"}`,
    `failed-stage:${failure?.stage ?? repair?.stage ?? "unknown"}`,
    `repair-strategy:${repair?.strategy ?? "unknown"}`,
  ],
  recommendedAction: "recheck",
  safeToResume: true,
  userMessage: "制作 Agent 已匹配到可验证修复器，将自动从原断点继续",
  technicalNotes: ["未修改口播、素材、审核结论或已通过的上游产物"],
});

export const decideAutomaticProductionRecovery = ({
  recovery,
  diagnosis,
  attempts,
  readiness,
  repair,
  maxAttempts = MAX_AUTOMATIC_PRODUCTION_RECOVERY_ATTEMPTS,
}) => {
  const resume = {
    action: recovery.resume?.action ?? repair?.workflowAction,
    stage: recovery.resume?.stage ?? repair?.stage,
  };
  if (attempts >= maxAttempts)
    return {
      action: "wait-human",
      reason: "automatic-attempt-limit-reached",
      message: `自动恢复已达到 ${maxAttempts} 次上限`,
    };
  const repairedProviderEnvironment =
    diagnosis.recommendedAction === "repair-config" &&
    repair?.kind === "provider-environment-refresh" &&
    repair.success;
  const repairedSource =
    diagnosis.recommendedAction === "repair-code" && repair?.kind === "validated-source-repair" && repair.success;
  const repairedBinding =
    diagnosis.recommendedAction === "repair-binding" && repair?.kind === "validated-binding-repair" && repair.success;
  const repairedVisual =
    diagnosis.recommendedAction === "repair-visual" &&
    repair?.kind === "validated-visual-contract-repair" &&
    repair.success;
  const repairedSemantic = repair?.kind === "validated-semantic-plan-repair" && repair.success;
  if (
    (recovery.status !== "recoverable" || !recovery.resume?.enabled) &&
    !repairedSource &&
    !repairedBinding &&
    !repairedVisual &&
    !repairedSemantic
  )
    return {
      action: "wait-human",
      reason: "recovery-not-allowlisted",
      message: "当前故障不在自动恢复白名单内",
    };
  if (
    (!diagnosis.safeToResume || !automaticallyResumableRecommendations.has(diagnosis.recommendedAction)) &&
    !repairedProviderEnvironment &&
    !repairedSource &&
    !repairedBinding &&
    !repairedVisual &&
    !repairedSemantic
  )
    return {
      action: "wait-human",
      reason: `agent-recommended-${diagnosis.recommendedAction}`,
      message: diagnosis.userMessage,
    };
  if (!readiness || readiness.readinessStatus === "blocked")
    return {
      action: "wait-human",
      reason: "readiness-blocked",
      message: "断点检查仍有阻塞项，已停止自动恢复",
    };
  if (!automaticallyResumableActions.has(resume.action))
    return {
      action: "wait-human",
      reason: "workflow-action-requires-human",
      message: "下一步涉及人工审核或交付，不能自动执行",
    };
  if (!resume.stage)
    return {
      action: "wait-human",
      reason: "missing-resume-stage",
      message: "没有找到可验证的断点",
    };
  return {
    action: "resume",
    reason: repairedSemantic
      ? "automatic-semantic-plan-repair"
      : repairedVisual
        ? "automatic-visual-contract-repair"
        : repairedBinding
          ? "automatic-binding-repair"
          : repairedSource
            ? "automatic-source-repair"
            : repairedProviderEnvironment
              ? "automatic-provider-env-refresh"
              : diagnosis.recommendedAction === "recheck"
                ? "automatic-recheck-resume"
                : "automatic-resume",
    message: `从 ${resume.stage} 安全恢复`,
    workflowAction: resume.action,
    stage: resume.stage,
    attempt: attempts + 1,
  };
};
