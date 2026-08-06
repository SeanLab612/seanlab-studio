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
  production: ["--until", "approval", "--production-agent-auto-approve"],
  delivery: ["--until", "delivery"],
};

export const workflowArgsForStudioAction = (action) => {
  const args = allowedWorkflowActions[action];
  if (!args) throw new Error("Studio 仅允许执行已登记的视频工作流动作");
  return [...args];
};

export const workflowArgsForStudioPlan = ({ semanticReplanRequired = false } = {}) =>
  semanticReplanRequired
    ? ["--from", "semantic-plan", "--replan-semantic", "--until", "plan", "--production-agent-auto-approve"]
    : workflowArgsForStudioAction("plan");

export const workflowExecutionForStudioRecovery = ({ recovery, snapshot }) => {
  const semanticPlanRepair =
    recovery?.authority?.registeredRepairKind === "validated-semantic-plan-repair" &&
    recovery?.failure?.retryable !== false &&
    ["semantic-plan", "component-props", "visual-direction", "validate"].includes(recovery?.failure?.stage);

  if (semanticPlanRepair && !snapshot?.productionPlan?.confirmed)
    return {
      action: "plan",
      workflowArgs: ["--from", "semantic-plan", "--replan-semantic", ...workflowArgsForStudioAction("plan")],
      expectedTargetStage: "validate",
    };

  const action = recovery.resume.action;
  let workflowArgs = workflowArgsForStudioAction(action);
  if (action === "continue" && recovery.resume.stage) workflowArgs = ["--from", recovery.resume.stage, ...workflowArgs];
  return {
    action,
    workflowArgs,
    expectedTargetStage:
      action === "recut" ? "recut-review" : snapshot?.productionPlan?.confirmed ? "agent-review" : "validate",
  };
};

const readinessRecoveryStatuses = new Set(["failed", "interrupted", "stale"]);

const completedStatuses = new Set(["succeeded", "approved"]);

export const confirmedProductionResumeStage = (stages = []) => {
  const validateIndex = stages.findIndex((stage) => stage.name === "validate");
  if (validateIndex < 0 || !completedStatuses.has(stages[validateIndex]?.status)) return undefined;
  return stages.slice(validateIndex + 1).find((stage) => !completedStatuses.has(stage.status))?.name;
};

export const workflowArgsForConfirmedProduction = ({ stages = [] }) => {
  const resumeStage = confirmedProductionResumeStage(stages);
  return [...(resumeStage ? ["--from", resumeStage] : []), "--until", "approval", "--production-agent-auto-approve"];
};

export const workflowArgsForStudioReadiness = (
  { reviewApproved, semanticReplanRequired, productionPlan, currentFailure, stages = [] },
  profile,
) => {
  const failedUpstreamStage = stages.find(
    (stage) =>
      stage.status === "failed" && !["human-approval", "delivery-render", "delivery-validate"].includes(stage.name),
  )?.name;
  const upstreamRecoveryStage =
    currentFailure?.stage && !["human-approval", "delivery-render", "delivery-validate"].includes(currentFailure.stage)
      ? currentFailure.stage
      : failedUpstreamStage;
  if (upstreamRecoveryStage) {
    const recoveryStage = semanticReplanRequired ? "semantic-plan" : upstreamRecoveryStage;
    return [
      "--from",
      recoveryStage,
      ...(semanticReplanRequired ? ["--replan-semantic"] : []),
      "--until",
      productionPlan?.confirmed ? "approval" : "plan",
      "--production-agent-auto-approve",
      "--dry-run",
    ];
  }
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
    return [...workflowArgsForConfirmedProduction({ stages }), "--dry-run"];
  }
  const visualPlanReady = stages.find((stage) => stage.name === "validate")?.status === "succeeded";
  if (!visualPlanReady) {
    const recoveryStage = semanticReplanRequired
      ? "semantic-plan"
      : stages.find((stage) => readinessRecoveryStatuses.has(stage.status))?.name;
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
  return [
    ...scope,
    ...(semanticReplanRequired ? ["--replan-semantic"] : []),
    "--until",
    "approval",
    "--production-agent-auto-approve",
    "--dry-run",
  ];
};

const resumableStatuses = new Set(["failed", "interrupted", "running", "stale", "pending"]);
const currentStatuses = new Set(["succeeded", "approved"]);

export const resumeStageForStudio = (stages = []) =>
  stages.find((stage) => resumableStatuses.has(stage.status) && stage.name !== "human-approval")?.name;

export const studioStageDependenciesCurrent = (stage, state) =>
  (stage.dependsOn ?? []).every((dependency) => currentStatuses.has(state.stages?.[dependency]?.status));
