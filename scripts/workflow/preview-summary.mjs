import { createHash } from "node:crypto";

const expensiveExecutionClasses = new Set(["agent", "codex", "translation-provider", "video-render", "static-render"]);

const canonicalize = (value) => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonicalize(item)]),
  );
};

const readinessHash = (value) =>
  createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex");

export const nextHumanGateForTarget = (targetStage) => {
  if (targetStage === "recut-review") return "recut-approval";
  if (targetStage === "validate") return "visual-confirmation";
  if (targetStage === "regression-fixtures") return "human-approval";
  if (targetStage === "delivery-validate") return "delivery-acceptance";
  return "workflow-review";
};

export const summarizeWorkflowPreview = ({ preview, targetStage, preflight, scopeSignature }) => {
  const planned = preview.filter((item) => item.action === "run");
  const reused = preview.filter((item) => item.action === "reuse");
  const blocked = preview.filter((item) => item.action === "blocked");
  const checks = preflight?.checks ?? [];
  const failedChecks = checks.filter((item) => item.status === "failed");
  const warningChecks = checks.filter((item) => item.status === "warning");
  const count = (executionClass, items = planned) =>
    items.filter((item) => item.executionClass === executionClass).length;
  const readinessStatus =
    blocked.length || failedChecks.length
      ? "blocked"
      : warningChecks.length
        ? "warning"
        : planned.length
          ? "ready"
          : "up-to-date";
  const issues = [
    ...failedChecks.map((item) => ({
      id: item.id,
      severity: "error",
      label: item.label,
      message: item.summary,
      remediation: item.remediation,
    })),
    ...warningChecks.map((item) => ({
      id: item.id,
      severity: "warning",
      label: item.label,
      message: item.summary,
      remediation: item.remediation,
    })),
    ...blocked.map((item) => ({
      id: `stage:${item.stage}`,
      severity: "error",
      label: item.stage,
      message: `阶段 ${item.stage} 当前不能安全运行`,
      remediation: item.remediation,
    })),
  ];
  const binding = {
    targetStage,
    scopeSignature,
    stagePlan: preview.map(({ stage, action, executionClass, reasons, inputSignature }) => ({
      stage,
      action,
      executionClass,
      reasons: reasons ?? [],
      inputSignature,
    })),
    checks: checks.map(({ id, status, summary, details }) => ({ id, status, summary, details })),
  };
  return {
    schemaVersion: "1.0",
    readinessSha256: readinessHash(binding),
    readinessStatus,
    nextHumanGate: nextHumanGateForTarget(targetStage),
    targetStage,
    scopeSignature,
    plannedStages: planned.map((item) => item.stage),
    reusedStages: reused.map((item) => item.stage),
    blockedStages: blocked.map((item) => item.stage),
    stagePlan: preview,
    preflight: preflight
      ? {
          status: preflight.status,
          summary: preflight.summary,
          checks,
        }
      : undefined,
    issues,
    execution: {
      agentCalls: count("agent") + count("codex"),
      codexCalls: count("codex"),
      translationCalls: count("translation-provider"),
      videoRenderStages: count("video-render"),
      staticRenderStages: count("static-render"),
      localStages: count("local"),
    },
    avoidedExpensiveStages: reused
      .filter((item) => expensiveExecutionClasses.has(item.executionClass))
      .map((item) => item.stage),
  };
};
