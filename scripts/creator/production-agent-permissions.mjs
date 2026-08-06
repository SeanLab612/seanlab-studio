const humanOwnedCategories = new Set(["approval", "creator-input", "input", "review-revision"]);
const humanOwnedCodes = new Set([
  "APPROVAL_REQUIRED",
  "INPUT_SOURCE_MISSING",
  "INPUT_TRANSCRIPT_INVALID",
  "INPUT_VIDEO_DECODE_FAILED",
  "INPUT_SCENE_DURATION_UNSAFE",
  "REVISION_REQUEST_INVALID",
  "REVISION_BASELINE_CONFLICT",
  "REVISION_ALREADY_APPLIED",
]);

const isolatedSourceRepairCategories = new Set(["internal", "studio-defect", "visual-contract"]);
const isolatedSourceRepairCodes = new Set([
  "DELIVERY_VISUAL_PARITY_FAILED",
  "INTERNAL_WORKFLOW_ERROR",
  "QA_CONTRACT_MISSING",
  "REGISTRY_CONTRACT_INVALID",
  "STATE_ARTIFACT_CONFLICT",
  "VISUAL_PROPS_INVALID",
]);

const registeredProjectRepairCodes = new Map([
  ["BINDING_ANCHOR_NOT_FOUND", "validated-binding-repair"],
  ["SEMANTIC_PLAN_INVALID", "validated-semantic-plan-repair"],
]);

export const PRODUCTION_AGENT_HUMAN_OWNED_ACTIONS = Object.freeze([
  "change-narration-meaning",
  "delete-or-replace-creator-media",
  "change-required-media-obligation",
  "approve-direction-or-final-video",
  "change-credentials-or-provider-billing",
  "publish-or-push-source",
]);

export const productionAgentAuthorityForFailure = (failure = {}) => {
  const shared = {
    schemaVersion: "1.0",
    failureCode: failure.code ?? "UNKNOWN",
    stage: failure.stage,
    humanOwnedActions: PRODUCTION_AGENT_HUMAN_OWNED_ACTIONS,
  };
  if (
    humanOwnedCodes.has(failure.code) ||
    humanOwnedCategories.has(failure.category) ||
    failure.stage === "human-approval"
  )
    return {
      ...shared,
      level: "human-decision",
      mayMutateProject: false,
      mayMutateSource: false,
      requiresUser: true,
      reason: "creator-content-media-or-approval-decision",
    };
  const registeredRepairKind = registeredProjectRepairCodes.get(failure.code);
  if (registeredRepairKind)
    return {
      ...shared,
      level: "validated-project-repair",
      mayMutateProject: true,
      mayMutateSource: false,
      requiresUser: false,
      registeredRepairKind,
      reason: "registered-project-repair-with-full-validator",
    };
  if (isolatedSourceRepairCodes.has(failure.code) || isolatedSourceRepairCategories.has(failure.category))
    return {
      ...shared,
      level: "isolated-source-repair",
      mayMutateProject: false,
      mayMutateSource: true,
      requiresUser: false,
      reason: "technical-defect-repairable-in-validated-source-snapshot",
    };
  if (failure.retryable !== false)
    return {
      ...shared,
      level: "checkpoint-retry",
      mayMutateProject: false,
      mayMutateSource: false,
      requiresUser: false,
      reason: "retryable-from-verified-checkpoint",
    };
  return {
    ...shared,
    level: "diagnose-only",
    mayMutateProject: false,
    mayMutateSource: false,
    requiresUser: true,
    reason: "no-registered-validator-for-safe-mutation",
  };
};

export const canApplyValidatedProjectRepair = ({ failure, repair }) => {
  const authority = productionAgentAuthorityForFailure(failure);
  return (
    authority.level === "validated-project-repair" &&
    repair?.success === true &&
    repair.kind === authority.registeredRepairKind
  );
};

export const canAttemptIsolatedSourceRepair = (failure) =>
  productionAgentAuthorityForFailure(failure).level === "isolated-source-repair";
