import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { projectDir, writeJsonAtomic } from "./project-store.mjs";
import { nextHumanGateForTarget } from "../workflow/preview-summary.mjs";

const execFileAsync = promisify(execFile);

export const targetStageFromWorkflowArgs = (workflowArgs) => {
  const untilIndex = workflowArgs.indexOf("--until");
  const target = untilIndex >= 0 ? workflowArgs[untilIndex + 1] : undefined;
  return (
    {
      recut: "recut-review",
      plan: "validate",
      review: "agent-review",
      delivery: "delivery-validate",
    }[target] ??
    target ??
    "workflow-review"
  );
};

export const blockedStudioReadiness = ({ workflowArgs, failure }) => {
  const targetStage = targetStageFromWorkflowArgs(workflowArgs);
  const issue = {
    id: failure?.code ?? "READINESS_INSPECTION_FAILED",
    severity: "error",
    label: "运行前检查",
    message: failure?.message ?? "无法读取当前项目的运行条件",
    remediation: failure?.remediation ?? "修复项目配置后重新检查。",
  };
  const readinessSha256 = createHash("sha256").update(JSON.stringify({ targetStage, issue })).digest("hex");
  return {
    schemaVersion: "1.0",
    event: "workflow.preview",
    readinessSha256,
    readinessStatus: "blocked",
    targetStage,
    nextHumanGate: nextHumanGateForTarget(targetStage),
    plannedStages: [],
    reusedStages: [],
    blockedStages: [],
    stagePlan: [],
    issues: [issue],
    execution: {
      agentCalls: 0,
      codexCalls: 0,
      translationCalls: 0,
      videoRenderStages: 0,
      staticRenderStages: 0,
      localStages: 0,
    },
    avoidedExpensiveStages: [],
  };
};

export const readinessEventFromOutput = (output) => {
  const events = String(output ?? "")
    .split(/\r?\n/)
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
  const readiness = events.findLast((event) => event.event === "workflow.preview");
  if (!readiness) throw new Error("就绪检查没有返回可确认的工作流计划");
  return readiness;
};

export const inspectStudioReadiness = async ({ manifest, workflowArgs, execute = execFileAsync }) => {
  let stdout = "";
  try {
    const result = await execute(process.execPath, ["scripts/workflow.mjs", "--project", manifest, ...workflowArgs], {
      cwd: process.cwd(),
      env: process.env,
      timeout: 120_000,
      maxBuffer: 8 * 1024 * 1024,
    });
    stdout = result.stdout;
  } catch (error) {
    stdout = error.stdout ?? "";
    if (!stdout)
      return blockedStudioReadiness({
        workflowArgs,
        failure: { code: "READINESS_INSPECTION_FAILED", message: error.message },
      });
  }
  try {
    return readinessEventFromOutput(stdout);
  } catch (error) {
    return blockedStudioReadiness({
      workflowArgs,
      failure: { code: "READINESS_INSPECTION_FAILED", message: error.message },
    });
  }
};

export const assertStudioReadinessConfirmation = ({ readiness, expectedSha256, expectedTargetStage }) => {
  if (!expectedSha256 || expectedSha256 !== readiness.readinessSha256)
    throw new Error("就绪检查已经过期，请重新检查后再确认运行");
  if (readiness.targetStage !== expectedTargetStage) throw new Error("下一审核门已经变化，请重新检查后再确认运行");
  if (readiness.readinessStatus === "blocked") throw new Error("当前仍有阻塞项，修复后重新运行就绪检查");
  return readiness;
};

export const recordStudioReadinessConfirmation = async ({
  projectId,
  action,
  readiness,
  reviewer = "Sean",
  profile,
  projectRoot = projectDir(projectId),
}) => {
  const confirmedAt = new Date().toISOString();
  const record = {
    schemaVersion: "1.0",
    kind: "studio-readiness-confirmation",
    projectId,
    action,
    reviewer,
    confirmedAt,
    readinessSha256: readiness.readinessSha256,
    scopeSignature: readiness.scopeSignature,
    targetStage: readiness.targetStage,
    nextHumanGate: readiness.nextHumanGate,
    readinessStatus: readiness.readinessStatus,
    profile,
    plannedStages: readiness.plannedStages,
    reusedStages: readiness.reusedStages,
    execution: readiness.execution,
    issues: readiness.issues,
  };
  const fileName = `${confirmedAt.replaceAll(/[:.]/g, "-")}-${action}.json`;
  const path = resolve(projectRoot, "review", "readiness-confirmations", fileName);
  await writeJsonAtomic(path, record);
  return { ...record, path };
};
