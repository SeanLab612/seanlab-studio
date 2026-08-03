export const OPERATOR_ACTION_IDS = [
  "doctor",
  "preflight",
  "status",
  "plan",
  "review",
  "resume",
  "apply-revision",
  "approve-recut",
  "approve",
  "export-bundle",
  "acceptance",
] as const;

export type OperatorActionId = (typeof OPERATOR_ACTION_IDS)[number];
export type WorkflowTarget = "recut" | "plan" | "review";

export type OperatorRequest = {
  schemaVersion: "1.0";
  requestId: string;
  action: OperatorActionId;
  projectId?: string;
  target?: WorkflowTarget;
  fromStage?: string;
  revisionId?: string;
  includeReview?: boolean;
  confirmation?: "human-recut-approved" | "human-review-approved";
  qaWaiverReason?: string;
};

export type OperatorEvent = {
  schemaVersion: "1.0";
  requestId: string;
  projectId?: string;
  event: "control.started" | "control.output" | "control.finished" | "control.failed";
  at: string;
  payload?: unknown;
  failure?: {
    code: string;
    category: string;
    message: string;
    remediation: string;
    retryable: boolean;
  };
};

export type OperatorStatus = {
  schemaVersion: "1.1";
  project: { id: string; title: string };
  updatedAt?: string;
  allowedActions: OperatorActionId[];
  stages: Array<{
    name: string;
    status: "pending" | "running" | "succeeded" | "failed" | "stale" | "approved";
    elapsedMs?: number;
    failure?: unknown;
  }>;
  preflight?: unknown;
  currentFailure?: unknown;
  resume?: { fromStage: string; target: WorkflowTarget };
  revisions?: { count: number; latest?: unknown };
};
