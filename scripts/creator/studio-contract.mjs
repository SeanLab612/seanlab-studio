import { normalizeDeliveryProfile } from "./delivery-profile.mjs";

const allowedWorkflowActions = {
  preview: ["--until", "recut", "--dry-run"],
  recut: ["--until", "recut"],
  review: ["--until", "review"],
  "approve-recut": ["--approve-recut"],
  "replan-recut": ["--replan-recut", "--until", "recut"],
  "replan-semantic": ["--replan-semantic", "--until", "review"],
  continue: ["--until", "review"],
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

export const workflowArgsForStudioReadiness = ({ reviewApproved, semanticReplanRequired, stages = [] }, profile) => {
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
