import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { projectDir, writeJsonAtomic } from "./project-store.mjs";
import { resumeStageForStudio } from "./studio-contract.mjs";

const terminalJobStatuses = new Set(["failed", "interrupted", "cancelled"]);
const activeJobStatuses = new Set(["queued", "running"]);
const incompleteStageStatuses = new Set(["failed", "interrupted", "stale"]);
const productRepairCodes = new Set([
  "REGISTRY_CONTRACT_INVALID",
  "VISUAL_PROPS_INVALID",
  "QA_CONTRACT_MISSING",
  "DELIVERY_VISUAL_PARITY_FAILED",
  "STATE_ARTIFACT_CONFLICT",
]);

const stableHash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

const failureCopy = (failure = {}) => ({
  code: failure.code ?? "WORKFLOW_STOPPED",
  category: failure.category ?? "operation",
  stage: failure.stage,
  message: failure.message ?? "当前步骤未完成。",
  remediation: failure.remediation ?? "先检查原因，再从当前有效断点继续。",
  retryable: failure.retryable !== false,
  occurredAt: failure.occurredAt,
});

const syntheticStageFailure = (stage) => {
  if (!stage) return undefined;
  if (stage.status === "interrupted")
    return {
      code: "TASK_INTERRUPTED",
      category: "operation",
      stage: stage.name,
      message: "任务在这一阶段中断，已完成的上游产物仍然保留。",
      remediation: "重新检查有效断点后，从这一阶段继续。",
      retryable: true,
    };
  if (stage.status === "stale")
    return {
      code: "STAGE_STALE",
      category: "state",
      stage: stage.name,
      message: "这一阶段的输入已经变化，旧结果不会继续使用。",
      remediation: "重新检查受影响范围后，只重跑失效阶段。",
      retryable: true,
    };
  return undefined;
};

const latestForProject = (jobs, projectId, predicate = () => true) =>
  jobs.filter((item) => item.projectId === projectId && predicate(item)).at(-1);

const publicLatestJob = (job) =>
  job
    ? {
        id: job.id,
        kind: job.kind,
        action: job.action,
        status: job.status,
        queuedAt: job.queuedAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        progress: job.progress,
        error: job.error,
        technicalTail: (job.technicalTail ?? []).slice(-12),
      }
    : undefined;

const recoveryCopyForAgent = (recovery) => ({
  projectId: recovery.projectId,
  status: recovery.status,
  headline: recovery.headline,
  summary: recovery.summary,
  stage: recovery.stage,
  failure: recovery.failure,
  preserved: recovery.preserved,
  resume: recovery.resume,
  latestJob: recovery.latestJob,
  readiness: recovery.readiness,
});

export const buildStudioRecovery = ({ projectId, workflow, jobs = [], artifacts = [], agent }) => {
  const projectJobs = jobs.filter((item) => item.projectId === projectId);
  const activeJob = latestForProject(projectJobs, projectId, (item) => activeJobStatuses.has(item.status));
  const latestProductionJob = latestForProject(
    projectJobs,
    projectId,
    (item) => item.kind === "video-workflow" && item.action !== "readiness",
  );
  const terminalJob = terminalJobStatuses.has(latestProductionJob?.status) ? latestProductionJob : undefined;
  const incompleteStage = workflow.stages.find((stage) => incompleteStageStatuses.has(stage.status));
  const historicalStageStateOnly = workflow.reviewApproved && !terminalJob;
  const currentStageFailure = historicalStageStateOnly ? undefined : workflow.currentFailure;
  const failure = currentStageFailure
    ? failureCopy(currentStageFailure)
    : terminalJob?.currentFailure
      ? failureCopy(terminalJob.currentFailure)
      : ((historicalStageStateOnly ? undefined : syntheticStageFailure(incompleteStage)) ??
        (terminalJob
          ? failureCopy({
              code: terminalJob.status === "cancelled" ? "TASK_CANCELLED" : "JOB_FAILED",
              category: "operation",
              stage: terminalJob.progress?.phase,
              message: terminalJob.error ?? "最近一次任务未完成。",
              remediation: "先运行安全检查，确认有效断点和复用范围。",
              retryable: true,
              occurredAt: terminalJob.completedAt,
            })
          : undefined));
  const completedStages = workflow.stages.filter((stage) => stage.status === "succeeded").map((stage) => stage.name);
  const approvedStages = workflow.stages.filter((stage) => stage.status === "approved").map((stage) => stage.name);
  const availableArtifacts = artifacts.filter((artifact) => artifact.available);
  const resumeStage =
    workflow.stages.find((stage) => incompleteStageStatuses.has(stage.status))?.name ??
    resumeStageForStudio(workflow.stages);
  const resumeAction =
    workflow.reviewReady || workflow.reviewApproved ? undefined : workflow.recutApproved ? "continue" : "recut";
  const repairRequired = Boolean(failure && (failure.retryable === false || productRepairCodes.has(failure.code)));
  const status = activeJob
    ? "busy"
    : failure
      ? repairRequired || !resumeStage || !resumeAction
        ? "blocked"
        : "recoverable"
      : "healthy";
  const headline = {
    healthy: "当前工作流没有待恢复故障",
    busy: "任务仍在运行，不会重复启动",
    recoverable: "可以从当前有效断点继续",
    blocked: "需要先修复原因，再恢复工作流",
  }[status];
  const summary =
    status === "busy"
      ? (activeJob.progress?.message ?? "Studio 正在执行当前任务。")
      : (failure?.message ?? "已完成步骤和审核结果保持不变。");
  const readinessJob = latestForProject(
    projectJobs,
    projectId,
    (item) =>
      item.kind === "video-workflow" && item.action === "readiness" && item.status === "completed" && item.readiness,
  );
  const readiness = readinessJob?.readiness
    ? {
        jobId: readinessJob.id,
        readinessSha256: readinessJob.readiness.readinessSha256,
        readinessStatus: readinessJob.readiness.readinessStatus,
        targetStage: readinessJob.readiness.targetStage,
        nextHumanGate: readinessJob.readiness.nextHumanGate,
        plannedStages: readinessJob.readiness.plannedStages ?? [],
        reusedStages: readinessJob.readiness.reusedStages ?? [],
        blockedStages: readinessJob.readiness.blockedStages ?? [],
        execution: readinessJob.readiness.execution,
        avoidedExpensiveStages: readinessJob.readiness.avoidedExpensiveStages ?? [],
        issues: readinessJob.readiness.issues ?? [],
      }
    : undefined;
  const snapshot = {
    projectId,
    status,
    stage: failure?.stage ?? incompleteStage?.name,
    failure,
    activeJob: publicLatestJob(activeJob),
    latestTerminalJob: publicLatestJob(terminalJob),
    preserved: {
      completedStages,
      approvedStages,
      artifacts: availableArtifacts.map(({ kind, bytes, sha256 }) => ({ kind, bytes, sha256 })),
    },
    resume: {
      action: resumeAction,
      stage: resumeStage,
    },
  };
  const recoverySha256 = stableHash(snapshot);
  const recovery = {
    schemaVersion: "1.0",
    projectId,
    status,
    headline,
    summary,
    stage: snapshot.stage,
    failure,
    latestJob: publicLatestJob(activeJob ?? terminalJob),
    preserved: {
      completedStages,
      approvedStages,
      artifactCount: availableArtifacts.length,
      artifacts: availableArtifacts.map(({ kind, path, bytes, sha256 }) => ({ kind, path, bytes, sha256 })),
    },
    resume: {
      action: resumeAction,
      stage: resumeStage,
      enabled: status === "recoverable",
      requiresReadiness: true,
      requiresConfirmation: true,
    },
    readiness,
    agent: {
      id: agent?.id,
      model: agent?.model,
      fallback: agent?.fallback,
    },
    actions: {
      recheck: { enabled: status !== "busy", mutatesProject: false },
      askAgent: { enabled: status !== "busy" && Boolean(failure), mutatesProject: false },
      resume: { enabled: status === "recoverable", mutatesProject: true, requiresConfirmation: true },
    },
    recoverySha256,
  };
  return {
    ...recovery,
    agentContext: recoveryCopyForAgent(recovery),
  };
};

export const assertStudioRecoveryConfirmation = ({ recovery, expectedSha256 }) => {
  if (!expectedSha256 || recovery.recoverySha256 !== expectedSha256)
    throw new Error("故障恢复快照已经变化，请重新打开恢复中心检查");
  if (recovery.status !== "recoverable" || !recovery.resume.enabled)
    throw new Error("当前状态不能直接恢复，请先按恢复中心提示处理");
  return recovery;
};

export const recordStudioRecoveryConfirmation = async ({
  projectId,
  recovery,
  readiness,
  reviewer = "Sean",
  projectRoot = projectDir(projectId),
}) => {
  const confirmedAt = new Date().toISOString();
  const record = {
    schemaVersion: "1.0",
    kind: "studio-recovery-confirmation",
    projectId,
    reviewer,
    confirmedAt,
    recoverySha256: recovery.recoverySha256,
    failure: recovery.failure,
    resume: recovery.resume,
    readinessSha256: readiness.readinessSha256,
    targetStage: readiness.targetStage,
    plannedStages: readiness.plannedStages,
    reusedStages: readiness.reusedStages,
    execution: readiness.execution,
  };
  const fileName = `${confirmedAt.replaceAll(/[:.]/g, "-")}-${recovery.resume.action}.json`;
  const path = resolve(projectRoot, "review", "recovery-confirmations", fileName);
  await writeJsonAtomic(path, record);
  return { ...record, path };
};

export const studioRecoveryDiagnosisPrompt = (recovery) => ({
  system: [
    "You are the read-only recovery diagnostician inside SeanLab Studio.",
    "Use only the supplied recovery snapshot and technical tail.",
    "Do not claim to have modified files, restarted jobs, called providers, or rendered video.",
    "Recommend the smallest safe next action.",
    "An exact checkpoint retry may be automated only when evidence proves it is retryable and approved artifacts remain unchanged.",
    "A narrowly scoped technical source defect may be repaired automatically in an isolated worktree only when the repair changes allowlisted source paths and passes the full validation suite.",
    "A BINDING_ANCHOR_NOT_FOUND failure may use repair-binding when the fixed Agent can select a semantically equivalent exact candidate from current captions, or safely fall back to the speaker while preserving review gates.",
    "A visual copy contract that rejects a product term literally grounded in the supplied narration may be a repair-code source defect; distinguish it from invented internal production language.",
    "A confirmed component beat that cannot satisfy its deterministic evidence contract may use repair-visual to remove only that invalid beat and fall back to the speaker; the later visual review remains human-controlled.",
    "Configuration choices, missing creator media, narration or transcript meaning, broader visual and aesthetic decisions, review decisions, and delivery always require a human.",
    "Return concise Simplified Chinese that matches the JSON Schema.",
  ].join("\n"),
  user: [
    "请诊断以下本地视频工作流故障。",
    "重点回答：根因是什么、已保留什么、是否适合从断点继续、用户下一步应做什么。",
    "如果是 BINDING_ANCHOR_NOT_FOUND 且可在当前字幕中受约束地重绑定或回退人物画面，选择 repair-binding；如果是某个已确认 component beat 不符合自身证据契约，可选择 repair-visual 仅回退该节拍；如果证据明确指向 Studio 源码或契约缺陷，可选择 repair-code；其他证据不足的情况必须选择 request-user，不能猜测。",
    JSON.stringify(recovery.agentContext, null, 2),
  ].join("\n\n"),
});
