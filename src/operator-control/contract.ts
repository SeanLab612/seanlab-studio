import { OPERATOR_ACTION_IDS, type OperatorActionId, type OperatorRequest, type WorkflowTarget } from "./types.ts";

const requestIdPattern = /^[a-z0-9][a-z0-9-]{2,63}$/;
const projectIdPattern = /^[a-z0-9][a-z0-9-]{1,62}$/;
const allowedKeys = new Set([
  "schemaVersion",
  "requestId",
  "action",
  "projectId",
  "target",
  "fromStage",
  "revisionId",
  "includeReview",
  "confirmation",
  "qaWaiverReason",
]);

export const validateOperatorRequest = (input: unknown): OperatorRequest => {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Operator request must be an object");
  const value = input as Record<string, unknown>;
  const unknown = Object.keys(value).filter((key) => !allowedKeys.has(key));
  if (unknown.length) throw new Error(`Unsupported operator request fields: ${unknown.join(", ")}`);
  if (value.schemaVersion !== "1.0") throw new Error("Operator request schemaVersion must be 1.0");
  if (typeof value.requestId !== "string" || !requestIdPattern.test(value.requestId))
    throw new Error("requestId must use lowercase letters, numbers, and hyphens");
  if (typeof value.action !== "string" || !OPERATOR_ACTION_IDS.includes(value.action as OperatorActionId))
    throw new Error("Unsupported operator action");
  const action = value.action as OperatorActionId;
  if (action !== "doctor" && (typeof value.projectId !== "string" || !projectIdPattern.test(value.projectId)))
    throw new Error(`${action} requires a valid projectId`);
  if (value.projectId !== undefined && (typeof value.projectId !== "string" || !projectIdPattern.test(value.projectId)))
    throw new Error("projectId is invalid");
  if (value.target !== undefined && !["recut", "plan", "review"].includes(String(value.target)))
    throw new Error("target must be recut, plan, or review");
  if (
    value.fromStage !== undefined &&
    (typeof value.fromStage !== "string" || !/^[a-z][a-z-]{1,40}$/.test(value.fromStage))
  )
    throw new Error("fromStage is invalid");
  if (
    value.revisionId !== undefined &&
    (typeof value.revisionId !== "string" || !/^[a-z0-9][a-z0-9-]{2,63}$/.test(value.revisionId))
  )
    throw new Error("revisionId is invalid");
  if (action === "apply-revision" && value.revisionId === undefined)
    throw new Error("apply-revision requires revisionId");
  if (value.revisionId !== undefined && action !== "apply-revision")
    throw new Error("revisionId is valid only for apply-revision");
  if (value.includeReview !== undefined && typeof value.includeReview !== "boolean")
    throw new Error("includeReview must be boolean");
  if (action === "approve" && value.confirmation !== "human-review-approved")
    throw new Error("approve requires confirmation=human-review-approved");
  if (action === "approve-recut" && value.confirmation !== "human-recut-approved")
    throw new Error("approve-recut requires confirmation=human-recut-approved");
  if (value.qaWaiverReason !== undefined && (typeof value.qaWaiverReason !== "string" || !value.qaWaiverReason.trim()))
    throw new Error("qaWaiverReason must be a non-empty string");
  if (value.qaWaiverReason && action !== "approve") throw new Error("qaWaiverReason is valid only for approve");
  return value as OperatorRequest;
};

export const allowedOperatorActions = ({
  hasState,
  reviewReady,
  approved,
  recutReady = false,
  recutApproved = false,
}: {
  hasState: boolean;
  reviewReady: boolean;
  approved: boolean;
  recutReady?: boolean;
  recutApproved?: boolean;
}): OperatorActionId[] => {
  const actions: OperatorActionId[] = ["doctor", "preflight", "status", "plan", "export-bundle", "acceptance"];
  if (hasState) actions.push("resume");
  if (hasState) actions.push("apply-revision");
  actions.push("review");
  if (recutReady && !recutApproved) actions.push("approve-recut");
  if (reviewReady && !approved) actions.push("approve");
  return actions;
};

export const recommendResume = (
  stages: Array<{ name: string; status: string }>,
): { fromStage: string; target: WorkflowTarget } | undefined => {
  const failed = stages.find((stage) => stage.status === "failed");
  if (failed) return { fromStage: failed.name, target: "review" };
  const stale = stages.find((stage) => stage.status === "stale");
  if (stale) return { fromStage: stale.name, target: "review" };
  return undefined;
};
