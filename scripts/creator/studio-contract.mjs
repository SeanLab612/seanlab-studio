import { normalizeDeliveryProfile } from "./delivery-profile.mjs";

const allowedWorkflowActions = {
  preview: ["--until", "recut", "--dry-run"],
  recut: ["--until", "recut"],
  review: ["--until", "review"],
  "approve-recut": ["--approve-recut"],
  "replan-recut": ["--replan-recut", "--until", "recut"],
  "replan-semantic": ["--replan-semantic", "--until", "review"],
  continue: ["--until", "review"],
  plan: ["--until", "plan", "--production-agent-auto-approve"],
  production: [
    "--until",
    "delivery",
    "--production-agent-auto-approve",
    "--delivery-resolution",
    "source",
    "--delivery-frame-rate",
    "source",
  ],
  delivery: ["--until", "delivery"],
};

export const workflowArgsForStudioAction = (action) => {
  const args = allowedWorkflowActions[action];
  if (!args) throw new Error("Studio 仅允许执行已登记的视频工作流动作");
  return [...args];
};

const readinessRecoveryStatuses = new Set(["failed", "interrupted", "stale"]);

const completedStatuses = new Set(["succeeded", "approved"]);

export const confirmedProductionResumeStage = (stages = []) => {
  const validateIndex = stages.findIndex((stage) => stage.name === "validate");
  if (validateIndex < 0 || !completedStatuses.has(stages[validateIndex]?.status)) return undefined;
  return stages.slice(validateIndex + 1).find((stage) => !completedStatuses.has(stage.status))?.name;
};

export const workflowArgsForConfirmedProduction = ({ stages = [] }, profile) => {
  const resumeStage = confirmedProductionResumeStage(stages);
  const normalized = normalizeDeliveryProfile(profile);
  return [
    ...(resumeStage ? ["--from", resumeStage] : []),
    "--until",
    "delivery",
    "--production-agent-auto-approve",
    "--delivery-resolution",
    normalized.resolution,
    "--delivery-frame-rate",
    String(normalized.frameRate),
  ];
};

export const workflowArgsForStudioReadiness = (
  { reviewApproved, semanticReplanRequired, productionPlan, stages = [] },
  profile,
) => {
  if (reviewApproved) {
    const deliveryRecoveryStage = stages.find(
      (stage) =>
        ["delivery-render", "delivery-validate"].includes(stage.name) && readinessRecoveryStatuses.has(stage.status),
    )?.name;
    const deliveryScope = deliveryRecoveryStage ? ["--from", deliveryRecoveryStage] : [];
    const normalized = normalizeDeliveryProfile(profile);
    return [
      ...deliveryScope,
      "--until",
      "delivery",
      "--dry-run",
      "--delivery-resolution",
      normalized.resolution,
      "--delivery-frame-rate",
      String(normalized.frameRate),
    ];
  }
  if (productionPlan?.confirmed) {
    const productionArgs = workflowArgsForConfirmedProduction({ stages }, profile);
    const deliveryIndex = productionArgs.indexOf("--delivery-resolution");
    return [...productionArgs.slice(0, deliveryIndex), "--dry-run", ...productionArgs.slice(deliveryIndex)];
  }
  const visualPlanReady = stages.find((stage) => stage.name === "validate")?.status === "succeeded";
  if (!visualPlanReady) {
    const recoveryStage = stages.find((stage) => readinessRecoveryStatuses.has(stage.status))?.name;
    return [
      ...(recoveryStage ? ["--from", recoveryStage] : []),
      ...(semanticReplanRequired ? ["--replan-semantic"] : []),
      "--until",
      "plan",
      "--production-agent-auto-approve",
      "--dry-run",
    ];
  }
  const recoveryStage = stages.find((stage) => readinessRecoveryStatuses.has(stage.status))?.name;
  const scope = recoveryStage ? ["--from", recoveryStage] : [];
  const normalized = normalizeDeliveryProfile(profile);
  return [
    ...scope,
    ...(semanticReplanRequired ? ["--replan-semantic"] : []),
    "--until",
    "delivery",
    "--production-agent-auto-approve",
    "--dry-run",
    "--delivery-resolution",
    normalized.resolution,
    "--delivery-frame-rate",
    String(normalized.frameRate),
  ];
};

const resumableStatuses = new Set(["failed", "interrupted", "running", "stale", "pending"]);
const currentStatuses = new Set(["succeeded", "approved"]);

export const resumeStageForStudio = (stages = []) =>
  stages.find((stage) => resumableStatuses.has(stage.status) && stage.name !== "human-approval")?.name;

export const studioStageDependenciesCurrent = (stage, state) =>
  (stage.dependsOn ?? []).every((dependency) => currentStatuses.has(state.stages?.[dependency]?.status));
