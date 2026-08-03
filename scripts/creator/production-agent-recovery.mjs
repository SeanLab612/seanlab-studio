export const MAX_AUTOMATIC_PRODUCTION_RECOVERY_ATTEMPTS = 2;

const automaticallyResumableActions = new Set(["recut", "continue"]);
const automaticallyResumableRecommendations = new Set(["resume", "recheck"]);

export const decideAutomaticProductionRecovery = ({
  recovery,
  diagnosis,
  attempts,
  readiness,
  repair,
  maxAttempts = MAX_AUTOMATIC_PRODUCTION_RECOVERY_ATTEMPTS,
}) => {
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
  if ((recovery.status !== "recoverable" || !recovery.resume?.enabled) && !repairedSource)
    return {
      action: "wait-human",
      reason: "recovery-not-allowlisted",
      message: "当前故障不在自动恢复白名单内",
    };
  if (
    (!diagnosis.safeToResume || !automaticallyResumableRecommendations.has(diagnosis.recommendedAction)) &&
    !repairedProviderEnvironment &&
    !repairedSource
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
  if (!automaticallyResumableActions.has(recovery.resume.action))
    return {
      action: "wait-human",
      reason: "workflow-action-requires-human",
      message: "下一步涉及人工审核或交付，不能自动执行",
    };
  if (!recovery.resume.stage)
    return {
      action: "wait-human",
      reason: "missing-resume-stage",
      message: "没有找到可验证的断点",
    };
  return {
    action: "resume",
    reason: repairedSource
      ? "automatic-source-repair"
      : repairedProviderEnvironment
        ? "automatic-provider-env-refresh"
        : diagnosis.recommendedAction === "recheck"
          ? "automatic-recheck-resume"
          : "automatic-resume",
    message: `从 ${recovery.resume.stage} 安全恢复`,
    workflowAction: recovery.resume.action,
    stage: recovery.resume.stage,
    attempt: attempts + 1,
  };
};
