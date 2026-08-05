import { spawn } from "node:child_process";
import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve } from "node:path";
import {
  approvedAgentModelPairs,
  assertApprovedAgentModel,
  validateAgentModelGovernance,
} from "../src/agents/governance.ts";
import { detectAgent, detectAgents } from "../src/agents/registry.ts";
import { animationTemplateRegistry } from "../src/animation-system/template-registry.ts";
import { approvedComponentRegistry } from "../src/components/library/registry.ts";
import { editorialQuestionnaire, PUBLIC_CREATOR_CATEGORIES } from "../src/creator-workflow/editorial-brief.ts";
import { iconRegistry } from "../src/icons/registry.ts";
import { layoutTemplateRegistry } from "../src/layout-templates/registry.ts";
import { animationPrototypeRegistry } from "../src/visual-production/animation-registry.ts";
import { listNarrationAttempts, restoreNarrationAttempt } from "./creator/authoring-history.mjs";
import { inferCreatorEditorialBrief } from "./creator/editorial-intake.mjs";
import { createVideoHandoff, lockNarration, updateNarration } from "./creator/lock-handoff.mjs";
import {
  analyzeMaterialUnderstanding,
  confirmMaterialUnderstanding,
  loadMaterialUnderstanding,
} from "./creator/material-understanding.mjs";
import {
  generateNarration,
  loadNarration,
  loadSourceContext,
  prepareExistingNarration,
  resumeNarrationVisualPlanning,
  rewriteNarration,
} from "./creator/narration.mjs";
import { buildNarrationExport } from "./creator/narration-export.mjs";
import {
  addCreatorSource,
  createCreatorProject,
  deleteCreatorMaterial,
  deleteCreatorProject,
  importCreatorAsset,
  importCreatorInputScript,
  inferCreatorAssetKind,
  inspectCreatorProjects,
  listCreatorProjects,
  loadCreatorProject,
  renameCreatorProject,
  resolveCreatorAsset,
  saveCreatorProject,
  updateCreatorEditorialBrief,
} from "./creator/project-store.mjs";
import {
  addPromotedImageAssetTagsBatch,
  listGeneratedAssetCandidates,
  listPromotedImageAssets,
  promoteGeneratedAsset,
  promoteGeneratedAssetsBatch,
  resolveGeneratedAssetPreview,
  resolveImageAssetPreview,
  updatePromotedImageAssetMetadata,
} from "./creator/generated-assets.mjs";
import { buildProjectImageAssetMatches, previewPromotedImageAssetMatch } from "./creator/image-asset-matches.mjs";
import { imageGenerationCapability } from "./creator/generated-image-contract.mjs";
import {
  confirmAnimationAssetReplan,
  loadAnimationAssetReplanning,
  replanAnimationAssets,
} from "./creator/animation-asset-replanning.mjs";
import {
  automaticProductionRecoveryAttempts,
  enterProductionAgent,
  exitProductionAgentForDelivery,
  loadProductionAgentState,
  recordProductionAgentDiagnosis,
  transitionProductionAgent,
} from "./creator/production-agent.mjs";
import {
  decideAutomaticProductionRecovery,
  deterministicProductionDiagnosis,
  deterministicProductionRepair,
  MAX_AUTOMATIC_PRODUCTION_RECOVERY_ATTEMPTS,
} from "./creator/production-agent-recovery.mjs";
import { repairProductionBinding } from "./creator/production-agent-binding-repair.mjs";
import { repairProductionVisualContract } from "./creator/production-agent-visual-contract-repair.mjs";
import {
  approveProductionBaseline,
  createProductionBaseline,
  deliverProductionBaseline,
  loadProductionBaseline,
} from "./creator/production-agent-baseline.mjs";
import {
  isAutonomousTechnicalRepairEligible,
  runProductionAgentTechnicalRepair,
} from "./creator/production-agent-technical-repair.mjs";
import {
  nextProductionAgentAcceptanceWorkflowOutcome,
  productionAgentAcceptanceRecoveryFixture,
  productionAgentAcceptanceScenario,
} from "./creator/production-agent-acceptance.mjs";
import {
  resumeStageForStudio,
  workflowArgsForStudioAction,
  workflowArgsForStudioReadiness,
} from "./creator/studio-contract.mjs";
import {
  loadStudioCover,
  registerStudioCoverPortrait,
  renderStudioCover,
  streamStudioCover,
  streamStudioCoverCatalogAsset,
} from "./creator/studio-covers.mjs";
import {
  acceptStudioDelivery,
  assertStudioDeliveryStart,
  loadStudioDelivery,
  resolveDeliveryArtifact,
  returnStudioDelivery,
} from "./creator/studio-delivery.mjs";
import { applyStudioRevision, loadStudioOperations, previewStudioRevision } from "./creator/studio-operations.mjs";
import {
  assertStudioReadinessConfirmation,
  blockedStudioReadiness,
  inspectStudioReadiness,
  recordStudioReadinessConfirmation,
} from "./creator/studio-readiness.mjs";
import {
  assertStudioRecoveryConfirmation,
  recordStudioRecoveryConfirmation,
  studioRecoveryDiagnosisPrompt,
} from "./creator/studio-recovery.mjs";
import {
  addStaticReviewNote,
  assertStaticReviewApproval,
  loadStaticReview,
  rejectStaticReview,
  resolveStaticReviewArtifact,
} from "./creator/studio-static-review.mjs";
import {
  archiveCurrentRecutProposal,
  assertReviewedRecut,
  loadStudioWorkflow,
  markStudioWorkflowInterrupted,
  reconcileStudioWorkflow,
  recordRecutDecision,
  recutPreviewPath,
  restoreArchivedRecutProposal,
} from "./creator/studio-workflow.mjs";
import { loadVisualStoryboard, saveVisualStoryboard } from "./creator/visual-storyboard.mjs";
import {
  acceptWritingLessons,
  loadCreatorWritingProfile,
  loadWritingLearning,
  suggestWritingLessons,
} from "./creator/writing-profile.mjs";
import { runEnvironmentDoctor } from "./operations/doctor.mjs";
import { chooseLocalFiles } from "./operations/local-file-picker.mjs";
import { redactSecrets } from "./operations/errors.mjs";
import { parseSingleByteRange } from "./operations/http-byte-range.mjs";
import { studioPageContentSecurityPolicy, studioSecureHeaders } from "./operations/http-security.mjs";
import { JobGate } from "./operations/job-gate.mjs";
import { KeyedMutex } from "./operations/keyed-mutex.mjs";
import { loadLocalProductPolicy } from "./operations/local-product-policy.mjs";
import { applyCreatorProjectCleanup } from "./operations/storage-governance.mjs";
import { assertProjectHasNoActiveJob, ownedProjectJob } from "./operations/studio-job-guard.mjs";
import { createStructuredAgentJsonAdapter } from "./workflow/agent-json-adapter.mjs";
import { readManifest, writeManifest } from "./workflow/manifest.mjs";
import { processTreeSpawnOptions, terminateProcessTreeWithEscalation } from "./workflow/process-tree.mjs";
import { loadProviderEnvironmentFromZsh } from "./workflow/shell-environment.mjs";

let providerEnvironmentReport = loadProviderEnvironmentFromZsh();
const localProductPolicy = await loadLocalProductPolicy();
const jobGate = new JobGate({
  maxConcurrent: localProductPolicy.maxConcurrentJobs,
  maxQueued: localProductPolicy.maxQueuedJobs,
});
const agentModelGovernancePath = resolve("config/agent-model-governance.json");
const port = Number(process.env.PORT ?? 3080);
const studioToken = randomBytes(32).toString("hex");
const allowedHosts = new Set([`localhost:${port}`, `127.0.0.1:${port}`]);
const allowedOrigins = new Set([...allowedHosts].map((host) => `http://${host}`));
const mutationMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const validToken = (value) => {
  if (typeof value !== "string" || value.length !== studioToken.length) return false;
  return timingSafeEqual(Buffer.from(value), Buffer.from(studioToken));
};

const assertTrustedRequest = (request) => {
  const host = String(request.headers.host ?? "").toLowerCase();
  if (!allowedHosts.has(host)) throw new Error("Untrusted Studio Host header");
  if (!mutationMethods.has(request.method)) return;
  if (!allowedOrigins.has(request.headers.origin)) throw new Error("Untrusted Studio request origin");
  if (!validToken(request.headers["x-studio-token"])) throw new Error("Invalid Studio session token");
};
const loadAgentModelGovernance = async () =>
  validateAgentModelGovernance(JSON.parse(await readFile(agentModelGovernancePath, "utf8")));
const detectGovernedAgents = async () => {
  const [agents, governance] = await Promise.all([detectAgents(), loadAgentModelGovernance()]);
  return agents.map((agent) => ({
    ...agent,
    governance: {
      approvedModels: approvedAgentModelPairs(governance, agent.id).map((pair) => pair.model),
      candidates: governance.pairs
        .filter((pair) => pair.agentId === agent.id && pair.status === "candidate")
        .map((pair) => pair.model),
      blockedModels: governance.pairs
        .filter((pair) => pair.agentId === agent.id && pair.status === "blocked")
        .map((pair) => pair.model),
    },
  }));
};

const staticRoot = resolve("studio");
const localAssetRoot = resolve("public");
const studioDataRoot = resolve(process.env.REMOTION_MD_STUDIO_DATA_ROOT ?? "studio-data");
const jobs = new Map();
const subscribers = new Set();
const projectMutationMutex = new KeyedMutex();
const jobsPath = resolve(studioDataRoot, "jobs.json");
const storedRunningJobIds = [];
const publicJob = ({ cancel, logs = [], events, ...record }) => ({
  ...record,
  technicalTail: (logs.length ? logs : (record.technicalTail ?? []))
    .slice(-12)
    .map((line) => redactSecrets(String(line)).replaceAll(process.cwd(), "<workspace>").slice(0, 1200)),
});
const providerSettings = async () => {
  const detectedAgents = Object.fromEntries((await detectAgents()).map((agent) => [agent.id, agent]));
  return {
    environment: {
      shell: "zsh interactive login",
      status: providerEnvironmentReport.status,
      reason: providerEnvironmentReport.status === "failed" ? providerEnvironmentReport.reason : undefined,
    },
    providers: [
      {
        id: "codex-cli",
        displayName: "Codex CLI",
        interface: "固定项目 Agent",
        configured: Boolean(detectedAgents["codex-cli"]?.available),
        primaryUse: "英文字幕翻译、制作阶段编排与故障处理",
        optionalUse: imageGenerationCapability({ agentId: "codex-cli" }).configured
          ? "已连接受控生图服务，可按动画模板生成项目素材。"
          : "具备原生生图能力，但 CLI 无生图接口；当前 Studio 尚未连接独立生图服务。",
        capabilities: { translation: true, imageGeneration: true, imageProviderOrchestration: true },
      },
      {
        id: "claude-code",
        displayName: "Claude Code",
        interface: "固定项目 Agent",
        configured: Boolean(detectedAgents["claude-code"]?.available),
        primaryUse: "英文字幕翻译、制作阶段编排与故障处理",
        optionalUse: imageGenerationCapability({ agentId: "claude-code" }).configured
          ? "模型本身不生图，但可以调度 Studio 的独立生图服务。"
          : "模型本身不生图；配置独立生图服务后可由 Claude Code 负责理解和调度。",
        capabilities: { translation: true, imageGeneration: false, imageProviderOrchestration: true },
      },
      {
        id: "mimo",
        displayName: "Xiaomi MiMo",
        interface: "OpenAI-compatible API",
        configured: Boolean(process.env.MIMO_API_KEY),
        credential: {
          environmentVariable: "MIMO_API_KEY",
          source: providerEnvironmentReport.detected.includes("MIMO_API_KEY")
            ? "本地 zsh 环境"
            : process.env.MIMO_API_KEY
              ? "Studio 进程环境"
              : "未配置",
        },
        endpoint: "https://token-plan-cn.xiaomimimo.com/v1",
        model: "mimo-v2.5",
        primaryUse: "仅用于兼容旧项目的英文字幕翻译",
        optionalUse: "新项目不再默认使用；旧项目仍按原清单运行以保证可复现。",
        legacy: true,
      },
    ],
  };
};
let persistJobsQueue = Promise.resolve();
const persistJobs = () => {
  const operation = persistJobsQueue
    .catch(() => {})
    .then(async () => {
      await mkdir(studioDataRoot, { recursive: true });
      const temporary = `${jobsPath}.${process.pid}.${randomUUID()}.tmp`;
      await writeFile(temporary, `${JSON.stringify([...jobs.values()].map(publicJob), null, 2)}\n`);
      await rename(temporary, jobsPath);
    });
  persistJobsQueue = operation;
  return operation;
};
try {
  const stored = JSON.parse(await readFile(jobsPath, "utf8"));
  for (const record of stored) {
    if (["queued", "running"].includes(record.status)) storedRunningJobIds.push(record.id);
    jobs.set(record.id, record);
  }
} catch {}
const broadcast = (event, value) => {
  const message = `event: ${event}\ndata: ${JSON.stringify(value)}\n\n`;
  for (const response of subscribers) response.write(message);
};
const json = (response, status, value) => {
  response.writeHead(status, {
    ...studioSecureHeaders,
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(`${JSON.stringify(value)}\n`);
};
const body = async (request) => {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > 1_048_576) throw new Error("请求内容不能超过 1 MB");
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
};
const friendlyJobError = (error) => {
  const message = error?.message ?? String(error);
  if (message.includes("动画图片素材规划失败")) return "口播稿已保存，动画图片素材规划未完成，请从视觉方案继续。";
  if (message.includes("invalid_json_schema")) return "Agent 结构化输出合同无效，刷新页面不会解决。";
  if (message.includes("Codex CLI semantic planning")) return "Codex CLI 写稿失败，请查看任务详情后重试。";
  if (message.includes("Claude Code structured run")) return "Claude Code 写稿失败，请查看任务详情后重试。";
  return message;
};
const job = (kind, projectId, operation, lifecycle = {}) => {
  assertProjectHasNoActiveJob(jobs.values(), projectId);
  const capacity = jobGate.snapshot;
  if (capacity.running.length >= capacity.maxConcurrent && capacity.queued.length >= capacity.maxQueued)
    throw new Error("Studio 任务队列已满，请等待当前任务完成后再试");
  const id = `${kind}-${randomUUID()}`;
  const record = {
    id,
    kind,
    projectId,
    status: "queued",
    queuedAt: new Date().toISOString(),
    progress: { percent: 0, phase: "queued", message: "任务已进入队列" },
    logs: [],
  };
  jobs.set(id, record);
  persistJobs().catch(() => {});
  broadcast("job", publicJob(record));
  const reportProgress = (progress) => {
    record.progress = { ...record.progress, ...progress };
    persistJobs().catch(() => {});
    broadcast("job", publicJob(record));
  };
  let acquired = false;
  jobGate
    .acquire(id)
    .then(() => {
      acquired = true;
      if (record.status === "cancelled") return undefined;
      record.status = "running";
      record.startedAt = new Date().toISOString();
      reportProgress({ phase: "starting", message: "任务已开始执行" });
      return operation(reportProgress, record);
    })
    .then((result) => {
      if (record.status === "running")
        Object.assign(record, { status: "completed", result, completedAt: new Date().toISOString() });
    })
    .catch((error) => {
      if (["queued", "running"].includes(record.status))
        Object.assign(record, {
          status: "failed",
          error: friendlyJobError(error),
          errorDetail: error?.message ?? String(error),
          completedAt: new Date().toISOString(),
        });
    })
    .finally(() => {
      if (acquired) jobGate.release(id);
      persistJobs().catch(() => {});
      broadcast("job", publicJob(record));
      const callback =
        record.status === "completed"
          ? lifecycle.onCompleted
          : record.status === "failed"
            ? lifecycle.onFailure
            : undefined;
      if (callback)
        Promise.resolve()
          .then(() => callback(record))
          .catch((error) => {
            record.logs.push(`Lifecycle callback failed: ${redactSecrets(error?.message ?? String(error))}`);
            persistJobs().catch(() => {});
            broadcast("job", publicJob(record));
          });
    });
  return record;
};
const productionStageProgressMessages = {
  "semantic-plan": "正在理解口播内容并规划增强视觉",
  "component-props": "正在准备视觉组件",
  "visual-direction": "正在安排画面节奏",
  validate: "正在检查视觉方案",
  "review-base": "正在准备审核画面",
  "qa-capture": "正在生成静态审核图",
  "visual-qa": "制作 Agent 正在检查显示完整性",
  "visual-pacing-review": "正在检查动画节奏",
  "review-evidence": "正在整理审核证据",
  "regression-fixtures": "正在检查已批准风格",
  "agent-review": "制作 Agent 正在自主复核",
  "human-approval": "制作 Agent 正在锁定审核证据",
  "delivery-render": "正在渲染最终成片",
  "delivery-validate": "最终成片已生成，正在进行技术验收",
};
const productionStageProgressMessage = (stage) => productionStageProgressMessages[stage] ?? `正在执行 ${stage}`;
const workflowJob = (projectId, manifest, action, args, { rollbackAttempt, environment = {} } = {}) =>
  job(
    "video-workflow",
    projectId,
    async (reportProgress, record) => {
      const acceptanceScenario =
        manifest === "__production-agent-acceptance__" ? productionAgentAcceptanceScenario() : undefined;
      if (acceptanceScenario) {
        record.action = action;
        const outcome = nextProductionAgentAcceptanceWorkflowOutcome({
          projectId,
          scenario: acceptanceScenario,
        });
        reportProgress({
          phase: "visual-qa",
          percent: outcome.exitCode === 0 ? 100 : 55,
          message:
            outcome.exitCode === 0 ? "受控验收恢复任务完成" : `已注入第 ${outcome.attempt} 次受控 visual-qa 故障`,
        });
        if (outcome.exitCode === 0) {
          const productionAgent = await loadProductionAgentState(projectId).catch(() => undefined);
          if (productionAgent?.state === "recovering")
            await transitionProductionAgent({
              projectId,
              state: "active",
              reason: "automatic-recovery-succeeded",
              metadata: { action, jobId: record.id },
            });
          return { exitCode: 0, acceptance: true };
        }
        record.currentFailure = outcome.failure;
        const productionAgent = await loadProductionAgentState(projectId).catch(() => undefined);
        const automaticDiagnosisEligible = ["active", "diagnosing", "recovering"].includes(productionAgent?.state);
        await transitionProductionAgent({
          projectId,
          state: automaticDiagnosisEligible ? "diagnosing" : "failed",
          reason: "workflow-stage-failed",
          metadata: { action, exitCode: outcome.exitCode, jobId: record.id },
        });
        throw new Error(outcome.failure.message);
      }
      return new Promise((done, reject) => {
        const child = spawn(
          process.execPath,
          ["scripts/workflow.mjs", "--project", manifest, ...args],
          processTreeSpawnOptions({
            cwd: process.cwd(),
            env: { ...process.env, ...environment },
            stdio: ["ignore", "pipe", "pipe"],
          }),
        );
        record.action = action;
        const appendLogs = (chunk) => {
          const lines = chunk.toString().split(/\r?\n/).filter(Boolean);
          record?.logs.push(...lines);
          if (record?.logs.length > 200) record.logs.splice(0, record.logs.length - 200);
          for (const line of lines) {
            const deliveryAction = action === "delivery" || action === "production";
            const deliverySegment = deliveryAction ? /^segment (\d+)\/(\d+)$/.exec(line.trim()) : null;
            if (deliverySegment) {
              const index = Number(deliverySegment[1]);
              const total = Number(deliverySegment[2]);
              reportProgress({
                phase: "delivery-render",
                percent: total > 0 ? Math.round(8 + (Math.min(index, total) / total) * 76) : 8,
                message: `正在渲染第 ${Math.min(index + 1, total)}/${total} 段`,
              });
            }
            const deliveryFrame = deliveryAction ? /^Rendered (\d+)\/(\d+)/.exec(line.trim()) : null;
            if (deliveryFrame) {
              const rendered = Number(deliveryFrame[1]);
              const total = Number(deliveryFrame[2]);
              reportProgress({
                phase: "delivery-render",
                percent: total > 0 ? Math.round(8 + (Math.min(rendered, total) / total) * 76) : 8,
                message: `正在合成最终画面 ${Math.min(rendered, total)}/${total} 帧`,
              });
            }
            const deliveryEncode = deliveryAction ? /^Encoded (\d+)\/(\d+)/.exec(line.trim()) : null;
            if (deliveryEncode) {
              const encoded = Number(deliveryEncode[1]);
              const total = Number(deliveryEncode[2]);
              reportProgress({
                phase: "delivery-encode",
                percent: total > 0 ? Math.round(84 + (Math.min(encoded, total) / total) * 4) : 84,
                message: `画面生成完成，正在编码最终视频 ${Math.min(encoded, total)}/${total}`,
              });
            }
            try {
              const event = JSON.parse(line);
              record.events ??= [];
              record.events.push(event);
              if (record.events.length > 100) record.events.splice(0, record.events.length - 100);
              if (event.stage && event.event === "stage.started")
                reportProgress({
                  phase: event.stage,
                  percent: deliveryAction ? (event.stage === "delivery-validate" ? 88 : 8) : undefined,
                  message: deliveryAction ? productionStageProgressMessage(event.stage) : `正在执行 ${event.stage}`,
                });
              if (event.stage && ["stage.succeeded", "stage.candidate.succeeded"].includes(event.event))
                reportProgress({
                  phase: event.stage,
                  percent: deliveryAction ? (event.stage === "delivery-validate" ? 100 : 84) : undefined,
                  message: deliveryAction
                    ? event.stage === "delivery-validate"
                      ? "技术验收通过，等待你的最终确认"
                      : `${productionStageProgressMessages[event.stage]?.replace("正在", "已完成") ?? event.stage}`
                    : `${event.stage} 已完成`,
                });
              if (event.event === "workflow.preview") {
                record.readiness = event;
                reportProgress({
                  phase: "readiness",
                  percent: 100,
                  message:
                    event.readinessStatus === "blocked"
                      ? "检查完成：存在阻塞项"
                      : event.readinessStatus === "up-to-date"
                        ? "检查完成：已到达下一审核门"
                        : "检查完成：可以安全继续",
                });
              }
              if (event.failure) record.currentFailure = event.failure;
            } catch {}
          }
        };
        child.stdout.on("data", appendLogs);
        child.stderr.on("data", appendLogs);
        child.on("error", reject);
        child.on("close", async (code) => {
          if (action === "readiness" && !record.readiness) {
            record.readiness = blockedStudioReadiness({
              workflowArgs: args,
              failure: record.currentFailure ?? {
                code: "READINESS_INSPECTION_FAILED",
                message: `运行前检查退出，代码 ${code}`,
                remediation: "修复项目配置后重新检查。",
              },
            });
            reportProgress({
              phase: "readiness",
              percent: 100,
              message: "检查完成：存在阻塞项",
            });
            return done({ exitCode: code, readiness: record.readiness });
          }
          if (code === 0 && action === "approve-recut") await enterProductionAgent(projectId).catch(() => {});
          if (code === 0 && ["delivery", "production"].includes(action))
            await exitProductionAgentForDelivery(projectId, { jobId: record.id, validated: true }).catch(() => {});
          if (code === 0 && !["readiness", "delivery", "production", "approve-recut"].includes(action)) {
            const productionAgent = await loadProductionAgentState(projectId).catch(() => undefined);
            if (productionAgent?.state === "recovering")
              await transitionProductionAgent({
                projectId,
                state: "active",
                reason: "automatic-recovery-succeeded",
                metadata: { action, jobId: record.id },
              }).catch(() => {});
          }
          if (code !== 0 && action !== "readiness") {
            const productionAgent = await loadProductionAgentState(projectId).catch(() => undefined);
            const automaticDiagnosisEligible = ["active", "diagnosing", "recovering"].includes(productionAgent?.state);
            await transitionProductionAgent({
              projectId,
              state: automaticDiagnosisEligible ? "diagnosing" : "failed",
              reason: "workflow-stage-failed",
              metadata: { action, exitCode: code, jobId: record.id },
            }).catch(() => {});
          }
          if (code === 0 || (action === "readiness" && code === 2))
            return done({ exitCode: code, readiness: record.readiness });
          if (rollbackAttempt) {
            try {
              await restoreArchivedRecutProposal(projectId, rollbackAttempt);
              record.rollback = { attempt: rollbackAttempt, restored: true };
            } catch (error) {
              record.rollback = { attempt: rollbackAttempt, restored: false, error: error.message };
            }
          }
          reject(new Error(record.currentFailure?.message ?? `Workflow exited ${code}`));
        });
        record.cancel = async () => {
          await terminateProcessTreeWithEscalation(child);
          await markStudioWorkflowInterrupted(projectId).catch(() => {});
        };
      });
    },
    {
      onFailure: (record) =>
        scheduleAutomaticProductionRecovery({
          projectId,
          manifest,
          failedRecord: record,
          environment,
        }),
    },
  );

const scheduleAutomaticProductionRecovery = async ({ projectId, manifest, failedRecord, environment = {} }) => {
  if (failedRecord.action === "readiness") return;
  const productionAgent = await loadProductionAgentState(projectId);
  if (productionAgent.state !== "diagnosing") return;
  const attempts = automaticProductionRecoveryAttempts(productionAgent);
  if (attempts >= MAX_AUTOMATIC_PRODUCTION_RECOVERY_ATTEMPTS) {
    job(
      "production-baseline",
      projectId,
      async (reportProgress) => {
        reportProgress({ phase: "baseline", percent: 15, message: "增强制作未能继续，正在生成基础审核版本" });
        const baseline = await createProductionBaseline({
          projectId,
          failure: failedRecord.currentFailure,
        });
        if (!baseline.success) throw new Error(baseline.reason);
        await transitionProductionAgent({
          projectId,
          state: "waiting-human",
          reason: "automatic-baseline-ready",
          metadata: { failedJobId: failedRecord.id, attempts },
        });
        reportProgress({ phase: "review-ready", percent: 100, message: "基础审核版本已经准备好" });
        return baseline;
      },
      {
        onFailure: () =>
          transitionProductionAgent({
            projectId,
            state: "waiting-human",
            reason: "automatic-attempt-limit-reached",
            metadata: { failedJobId: failedRecord.id, attempts },
          }),
      },
    );
    await persistJobs();
    return;
  }
  const diagnosisJob = job(
    "production-agent-recovery",
    projectId,
    async (reportProgress, currentJob) => {
      const controller = new AbortController();
      currentJob.cancel = () => controller.abort();
      reportProgress({ phase: "diagnosis", percent: 10, message: "制作 Agent 正在诊断失败证据" });
      const project = await loadCreatorProject(projectId);
      const acceptanceScenario =
        manifest === "__production-agent-acceptance__" ? productionAgentAcceptanceScenario() : undefined;
      const acceptanceFixture = acceptanceScenario
        ? productionAgentAcceptanceRecoveryFixture({
            projectId,
            failedRecord,
            scenario: acceptanceScenario,
          })
        : undefined;
      let recovery;
      let diagnosis;
      let provider;
      let adapter;
      if (acceptanceFixture) {
        recovery = acceptanceFixture.recovery;
        if (acceptanceScenario.liveAgent) {
          const selectedAgent = await detectAgent(project.agent.id);
          if (!selectedAgent.available) throw new Error(selectedAgent.remediation ?? "当前项目固定 Agent 不可用");
          if (!project.agent.model) throw new Error("当前项目没有固定已审核模型，不能自动诊断");
          assertApprovedAgentModel(await loadAgentModelGovernance(), project.agent.id, project.agent.model);
          adapter = createStructuredAgentJsonAdapter({
            config: {
              provider: project.agent.id,
              model: project.agent.model,
              maxRetries: 0,
              timeoutSeconds: 180,
            },
            schemaPath: resolve("schemas/studio-recovery-diagnosis.schema.json"),
            cwd: process.cwd(),
          });
          const prompt = studioRecoveryDiagnosisPrompt(recovery);
          diagnosis = await adapter.completeJson({ ...prompt, signal: controller.signal });
          provider = adapter.getLastRunMetadata();
        } else {
          diagnosis = acceptanceFixture.diagnosis;
          provider = acceptanceFixture.provider;
        }
      } else {
        const visibleJobs = [...jobs.values()].filter((candidate) => candidate.id !== currentJob.id).map(publicJob);
        const operations = await loadStudioOperations({ projectId, jobs: visibleJobs });
        recovery = operations.operations.recovery;
        const deterministicRepair = deterministicProductionRepair(recovery.failure);
        if (deterministicRepair) {
          diagnosis = deterministicProductionDiagnosis(recovery.failure, deterministicRepair);
          provider = { provider: "deterministic-local", model: null, attempts: 0 };
        } else {
          const selectedAgent = await detectAgent(project.agent.id);
          if (!selectedAgent.available) throw new Error(selectedAgent.remediation ?? "当前项目固定 Agent 不可用");
          if (!project.agent.model) throw new Error("当前项目没有固定已审核模型，不能自动诊断");
          assertApprovedAgentModel(await loadAgentModelGovernance(), project.agent.id, project.agent.model);
          adapter = createStructuredAgentJsonAdapter({
            config: {
              provider: project.agent.id,
              model: project.agent.model,
              maxRetries: 0,
              timeoutSeconds: 180,
            },
            schemaPath: resolve("schemas/studio-recovery-diagnosis.schema.json"),
            cwd: process.cwd(),
          });
          const prompt = studioRecoveryDiagnosisPrompt(recovery);
          diagnosis = await adapter.completeJson({ ...prompt, signal: controller.signal });
          provider = adapter.getLastRunMetadata();
        }
      }
      let repair = acceptanceFixture?.repair ?? deterministicProductionRepair(recovery.failure);
      if (repair?.kind === "validated-semantic-plan-repair")
        reportProgress({ phase: "repair", percent: 38, message: "制作 Agent 正在按字幕证据重新拆分语义规划" });
      if (
        !repair &&
        recovery.failure?.code === "PROVIDER_AUTH_MISSING" &&
        diagnosis.recommendedAction === "repair-config"
      ) {
        reportProgress({ phase: "repair", percent: 42, message: "正在重新读取本地服务凭据" });
        const before = Boolean(process.env.MIMO_API_KEY);
        providerEnvironmentReport = loadProviderEnvironmentFromZsh({ overwrite: true });
        const after = Boolean(process.env.MIMO_API_KEY);
        repair = {
          kind: "provider-environment-refresh",
          success: after,
          changed: before !== after,
        };
      }
      if (!repair && diagnosis.recommendedAction === "repair-code") {
        if (!isAutonomousTechnicalRepairEligible(recovery.failure)) {
          repair = {
            kind: "validated-source-repair",
            success: false,
            reason: "failure-requires-human-judgment",
          };
        } else {
          reportProgress({ phase: "repair", percent: 30, message: "制作 Agent 正在隔离工作树中修复技术问题" });
          repair = await runProductionAgentTechnicalRepair({
            projectId,
            recovery,
            agentId: project.agent.id,
            model: project.agent.model,
            signal: controller.signal,
          });
        }
      }
      if (
        !repair &&
        recovery.failure?.code === "BINDING_ANCHOR_NOT_FOUND" &&
        diagnosis.recommendedAction === "repair-binding"
      ) {
        reportProgress({ phase: "repair", percent: 38, message: "制作 Agent 正在重新绑定失效的口播位置" });
        const bindingAdapter = createStructuredAgentJsonAdapter({
          config: {
            provider: project.agent.id,
            model: project.agent.model,
            maxRetries: 0,
            timeoutSeconds: 180,
          },
          schemaPath: resolve("schemas/studio-binding-repair.schema.json"),
          cwd: process.cwd(),
        });
        repair = await repairProductionBinding({
          projectId,
          recovery,
          adapter: bindingAdapter,
        });
      }
      if (!repair && (recovery.failure?.stage === "agent-review" || diagnosis.recommendedAction === "repair-visual")) {
        reportProgress({ phase: "repair", percent: 42, message: "制作 Agent 正在将无效视觉节拍安全回退为人物画面" });
        repair = await repairProductionVisualContract({ projectId, recovery });
      }
      reportProgress({ phase: "readiness", percent: 55, message: "正在验证断点和可复用产物" });
      let readiness = acceptanceFixture?.readiness;
      const repairResumeStage = recovery.resume?.stage ?? repair?.stage;
      const repairResumeAction = recovery.resume?.action ?? repair?.workflowAction;
      if (
        !readiness &&
        (recovery.status === "recoverable" || repair?.success) &&
        repairResumeStage &&
        ["recut", "continue", "delivery"].includes(repairResumeAction)
      ) {
        const snapshot = await loadStudioWorkflow(projectId);
        readiness = await inspectStudioReadiness({
          manifest,
          workflowArgs: workflowArgsForStudioReadiness(snapshot),
        });
      }
      let decision = decideAutomaticProductionRecovery({
        recovery,
        diagnosis,
        attempts,
        readiness,
        repair,
      });
      let baseline;
      if (decision.action !== "resume" && attempts + 1 >= MAX_AUTOMATIC_PRODUCTION_RECOVERY_ATTEMPTS) {
        reportProgress({ phase: "baseline", percent: 72, message: "正在准备不依赖增强视觉的基础审核版本" });
        baseline = await createProductionBaseline({ projectId, failure: recovery.failure }).catch((error) => ({
          kind: "production-baseline",
          success: false,
          reason: error?.message ?? String(error),
        }));
        if (baseline.success)
          decision = {
            action: "baseline",
            reason: "automatic-baseline-ready",
            message: "增强制作已安全降级，基础审核版本已经准备好",
          };
      }
      const evidence = await recordProductionAgentDiagnosis({
        projectId,
        recovery,
        diagnosis,
        decision: { ...decision, readiness, repair },
        provider,
        failedJobId: failedRecord.id,
      });
      if (decision.action === "resume")
        await transitionProductionAgent({
          projectId,
          state: "recovering",
          reason: decision.reason,
          metadata: {
            failedJobId: failedRecord.id,
            diagnosisPath: evidence.path,
            stage: decision.stage,
            attempt: decision.attempt,
            readinessSha256: readiness?.readinessSha256,
          },
        });
      else if (decision.action === "baseline")
        await transitionProductionAgent({
          projectId,
          state: "waiting-human",
          reason: decision.reason,
          metadata: {
            failedJobId: failedRecord.id,
            diagnosisPath: evidence.path,
            baselineSha256: baseline.record.review.sha256,
          },
        });
      else
        await transitionProductionAgent({
          projectId,
          state: "waiting-human",
          reason: decision.reason,
          metadata: {
            failedJobId: failedRecord.id,
            diagnosisPath: evidence.path,
            message: decision.message,
          },
        });
      reportProgress({
        phase:
          decision.action === "resume" ? "recovery" : decision.action === "baseline" ? "review-ready" : "waiting-human",
        percent: 100,
        message:
          decision.action === "resume" || decision.action === "baseline"
            ? decision.message
            : `已保留产物：${decision.message}`,
      });
      return { decision, evidence, readiness, baseline };
    },
    {
      onCompleted: async (record) => {
        const decision = record.result?.decision;
        if (decision?.action !== "resume") return;
        const workflowArgs = ["--from", decision.stage, ...workflowArgsForStudioAction(decision.workflowAction)];
        const resumed = workflowJob(projectId, manifest, decision.workflowAction, workflowArgs, { environment });
        resumed.automaticRecovery = {
          sourceJobId: failedRecord.id,
          diagnosisJobId: record.id,
          attempt: decision.attempt,
          stage: decision.stage,
        };
        await persistJobs();
      },
      onFailure: () =>
        transitionProductionAgent({
          projectId,
          state: "waiting-human",
          reason: "automatic-diagnosis-failed",
          metadata: { failedJobId: failedRecord.id },
        }),
    },
  );
  diagnosisJob.sourceJobId = failedRecord.id;
  await persistJobs();
};

const animationRepairJob = (projectId, manifest) =>
  job(
    "video-workflow",
    projectId,
    (reportProgress, record) =>
      new Promise((done, reject) => {
        const child = spawn(
          process.execPath,
          ["scripts/render-animation-repair.mjs", "--project", manifest],
          processTreeSpawnOptions({
            cwd: process.cwd(),
            env: process.env,
            stdio: ["ignore", "pipe", "pipe"],
          }),
        );
        record.action = "animation-repair";
        const appendLogs = (chunk) => {
          const lines = chunk.toString().split(/\r?\n/).filter(Boolean);
          record.logs.push(...lines);
          if (record.logs.length > 200) record.logs.splice(0, record.logs.length - 200);
          for (const line of lines) {
            const rendered = /^Rendered (\d+)\/(\d+)/.exec(line.trim());
            if (rendered) {
              const current = Number(rendered[1]);
              const total = Number(rendered[2]);
              reportProgress({
                phase: "animation-repair-render",
                percent: total > 0 ? Math.round(2 + (Math.min(current, total) / total) * 90) : 2,
                message: `正在补回动画 ${Math.min(current, total)}/${total} 帧`,
              });
            }
            const encoded = /^Encoded (\d+)\/(\d+)/.exec(line.trim());
            if (encoded) {
              const current = Number(encoded[1]);
              const total = Number(encoded[2]);
              reportProgress({
                phase: "animation-repair-encode",
                percent: total > 0 ? Math.round(92 + (Math.min(current, total) / total) * 4) : 92,
                message: `正在编码动画补回成片 ${Math.min(current, total)}/${total}`,
              });
            }
            try {
              const event = JSON.parse(line);
              record.events ??= [];
              record.events.push(event);
              if (record.events.length > 100) record.events.splice(0, record.events.length - 100);
              if (event.event === "animation-repair.started")
                reportProgress({ phase: "animation-repair-render", percent: 2, message: "动画补回任务已开始渲染" });
              if (event.event === "animation-repair.validating")
                reportProgress({ phase: "animation-repair-validate", percent: 96, message: "正在进行完整解码校验" });
              if (event.event === "animation-repair.completed")
                reportProgress({ phase: "animation-repair-complete", percent: 100, message: "动画补回成片已完成" });
            } catch {}
          }
          persistJobs().catch(() => {});
          broadcast("job", publicJob(record));
        };
        child.stdout.on("data", appendLogs);
        child.stderr.on("data", appendLogs);
        child.on("error", reject);
        child.on("close", (code) => {
          if (code === 0) done({ exitCode: code });
          else reject(new Error(`Animation repair exited ${code}`));
        });
        record.cancel = () => terminateProcessTreeWithEscalation(child);
      }),
  );

const assertProjectIdle = (projectId) => {
  assertProjectHasNoActiveJob(jobs.values(), projectId);
};

const typographyModes = new Set(["auto", "system-only", "wenkai-emphasis"]);
const updateProjectTypography = async (projectId, mode) => {
  if (!typographyModes.has(mode)) throw new Error("不支持的字体模式");
  assertProjectIdle(projectId);
  const project = await loadCreatorProject(projectId);
  if (["approved", "delivered"].includes(project.project.status))
    throw new Error("已批准或已交付的项目不能直接更换字体，请先创建返修版本");
  const typography = { version: "typography-2.0", mode };
  if (project.video?.manifest) {
    const { manifest, manifestPath } = await readManifest(project.video.manifest);
    manifest.policies ??= {};
    manifest.policies.typography = typography;
    await writeManifest(manifest, manifestPath);
  }
  project.typography = typography;
  await saveCreatorProject(project);
  if (project.video?.manifest) await reconcileStudioWorkflow(projectId);
  return loadCreatorProject(projectId);
};

const revealInFinder = ({ path, directory }) =>
  new Promise((done, reject) => {
    if (process.platform !== "darwin") return reject(new Error("当前系统不支持 Finder 打开操作"));
    const child = spawn("open", directory ? [path] : ["-R", path], {
      cwd: process.cwd(),
      stdio: "ignore",
    });
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? done() : reject(new Error(`Finder 打开失败：${code}`))));
  });

const streamFile = ({ request, response, asset, mediaType, cacheControl, allowRanges = false, nosniff = false }) => {
  const commonHeaders = {
    ...studioSecureHeaders,
    "content-type": mediaType,
    ...(allowRanges ? { "accept-ranges": "bytes" } : {}),
    "cache-control": cacheControl,
    ...(nosniff ? { "x-content-type-options": "nosniff" } : {}),
  };
  const range = allowRanges ? request.headers.range : undefined;
  if (!range) {
    response.writeHead(200, { ...commonHeaders, "content-length": asset.size });
    createReadStream(asset.path).pipe(response);
    return;
  }
  const parsed = parseSingleByteRange(range, asset.size);
  if (!parsed) {
    response.writeHead(416, { ...studioSecureHeaders, "content-range": `bytes */${asset.size}` });
    response.end();
    return;
  }
  response.writeHead(206, {
    ...commonHeaders,
    "content-length": parsed.end - parsed.start + 1,
    "content-range": `bytes ${parsed.start}-${parsed.end}/${asset.size}`,
  });
  createReadStream(asset.path, parsed).pipe(response);
};

const streamVideo = async (request, response, projectId) => {
  const asset = await recutPreviewPath(projectId);
  streamFile({
    request,
    response,
    asset,
    mediaType: "video/mp4",
    cacheControl: "no-store",
    allowRanges: true,
  });
};

const streamProductionBaseline = async (request, response, projectId, kind = "review") => {
  const baseline = await loadProductionBaseline(projectId);
  if (!baseline) throw new Error("基础审核版本当前不可用");
  const asset = baseline[kind];
  if (!asset?.path) throw new Error("基础版本成片当前不可用");
  const info = await stat(asset.path);
  streamFile({
    request,
    response,
    asset: { path: asset.path, size: info.size },
    mediaType: "video/mp4",
    cacheControl: "private, no-store",
    allowRanges: true,
    nosniff: true,
  });
};

const streamReviewArtifact = async (request, response, projectId, artifactId) => {
  const asset = await resolveStaticReviewArtifact(projectId, artifactId);
  streamFile({
    request,
    response,
    asset,
    mediaType: asset.mediaType,
    cacheControl: "private, no-store",
    allowRanges: asset.mediaType === "video/mp4",
    nosniff: true,
  });
};

const streamDeliveryVideo = async (request, response, projectId) => {
  const asset = await resolveDeliveryArtifact(projectId, "video");
  streamFile({
    request,
    response,
    asset,
    mediaType: asset.mediaType,
    cacheControl: "private, no-store",
    allowRanges: true,
    nosniff: true,
  });
};

const routes = async (request, response, url) => {
  if (request.method === "GET" && url.pathname === "/api/app") {
    const packageMetadata = JSON.parse(await readFile(resolve("package.json"), "utf8"));
    return json(response, 200, {
      name: "SeanLab Studio",
      version: packageMetadata.version,
      componentIds: Object.keys(approvedComponentRegistry),
      layoutTemplateIds: layoutTemplateRegistry.map((template) => template.id),
      animationTemplates: animationTemplateRegistry,
      animationStructures: Object.values(animationPrototypeRegistry).map((item) => ({
        id: item.id,
        label: item.label,
        relationship: item.relationship,
        minimumStages: item.minimumStages,
        maximumStages: item.maximumStages,
        compatibleStyleIds: item.compatibleStyleIds,
        defaultStyleId: item.defaultStyleId,
      })),
      icons: Object.values(iconRegistry).map((item) => ({
        id: item.id,
        label: item.label,
        category: item.category,
        ...(item.category === "brand" ? { textBadge: item.shortLabel } : { symbolId: item.id.slice("system.".length) }),
      })),
      csrfToken: studioToken,
    });
  }
  if (request.method === "GET" && url.pathname === "/api/health")
    return json(response, 200, {
      status: "ok",
      pid: process.pid,
      startedAt: serverStartedAt,
      jobs: jobGate.snapshot,
      policy: {
        maxConcurrentJobs: localProductPolicy.maxConcurrentJobs,
        maxQueuedJobs: localProductPolicy.maxQueuedJobs,
      },
    });
  if (request.method === "GET" && url.pathname === "/api/events") {
    response.writeHead(200, {
      ...studioSecureHeaders,
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });
    response.write(`event: ready\ndata: ${JSON.stringify({ connectedAt: new Date().toISOString() })}\n\n`);
    subscribers.add(response);
    request.on("close", () => subscribers.delete(response));
    return;
  }
  if (request.method === "GET" && url.pathname === "/api/agents")
    return json(response, 200, await detectGovernedAgents());
  if (request.method === "GET" && url.pathname === "/api/editorial-questions")
    return json(response, 200, {
      categories: PUBLIC_CREATOR_CATEGORIES,
      questionnaires: Object.fromEntries(
        PUBLIC_CREATOR_CATEGORIES.map((category) => [category.id, editorialQuestionnaire(category.id)]),
      ),
    });
  if (request.method === "GET" && url.pathname === "/api/providers")
    return json(response, 200, await providerSettings());
  if (request.method === "GET" && url.pathname === "/api/doctor") {
    const agentId = url.searchParams.get("agent");
    if (agentId && !["codex-cli", "claude-code"].includes(agentId)) throw new Error("Unsupported Doctor Agent");
    return json(
      response,
      200,
      await runEnvironmentDoctor({
        workspacePath: process.cwd(),
        requireMimo: true,
        requireCodex: agentId === "codex-cli",
        requireClaude: agentId === "claude-code",
      }),
    );
  }
  if (request.method === "POST" && url.pathname === "/api/providers/reload") {
    providerEnvironmentReport = loadProviderEnvironmentFromZsh({ overwrite: true });
    return json(response, 200, await providerSettings());
  }
  if (request.method === "GET" && url.pathname === "/api/projects")
    return json(response, 200, await listCreatorProjects());
  if (request.method === "GET" && url.pathname === "/api/project-inventory")
    return json(response, 200, await inspectCreatorProjects());
  if (request.method === "GET" && url.pathname === "/api/jobs")
    return json(response, 200, [...jobs.values()].map(publicJob));
  if (request.method === "GET" && url.pathname === "/api/generated-assets")
    return json(response, 200, await listGeneratedAssetCandidates());
  if (request.method === "GET" && url.pathname === "/api/image-assets")
    return json(response, 200, await listPromotedImageAssets());
  if (request.method === "POST" && url.pathname === "/api/image-assets/metadata/batch-tags") {
    const input = await body(request);
    if (input.confirmation !== "human-add-image-asset-tags-batch")
      throw new Error("Image asset batch tagging requires explicit human confirmation");
    return json(
      response,
      200,
      await addPromotedImageAssetTagsBatch({
        assetIds: input.assetIds,
        tags: input.tags,
      }),
    );
  }
  const imageAssetMetadataMatch = url.pathname.match(/^\/api\/image-assets\/([^/]+)\/metadata$/);
  if (request.method === "PUT" && imageAssetMetadataMatch) {
    const input = await body(request);
    if (input.confirmation !== "human-update-image-asset-metadata")
      throw new Error("Image asset metadata update requires explicit human confirmation");
    return json(
      response,
      200,
      await updatePromotedImageAssetMetadata({
        assetId: decodeURIComponent(imageAssetMetadataMatch[1]),
        metadata: input.metadata,
      }),
    );
  }
  const imageAssetMatchPreviewMatch = url.pathname.match(/^\/api\/image-assets\/([^/]+)\/match-preview$/);
  if (request.method === "POST" && imageAssetMatchPreviewMatch) {
    const input = await body(request);
    return json(
      response,
      200,
      await previewPromotedImageAssetMatch({
        assetId: decodeURIComponent(imageAssetMatchPreviewMatch[1]),
        text: input.text,
      }),
    );
  }
  const imageAssetPreviewMatch = url.pathname.match(/^\/api\/image-assets\/([^/]+)\/preview$/);
  if (request.method === "GET" && imageAssetPreviewMatch) {
    const asset = await resolveImageAssetPreview({ assetId: decodeURIComponent(imageAssetPreviewMatch[1]) });
    return streamFile({
      request,
      response,
      asset,
      mediaType:
        {
          ".webp": "image/webp",
          ".jpg": "image/jpeg",
          ".jpeg": "image/jpeg",
          ".png": "image/png",
        }[extname(asset.path).toLowerCase()] ?? "application/octet-stream",
      cacheControl: "no-store",
      nosniff: true,
    });
  }
  if (request.method === "POST" && url.pathname === "/api/generated-assets/promote-batch") {
    const input = await body(request);
    if (input.confirmation !== "human-promote-generated-assets-batch")
      throw new Error("Generated asset batch promotion requires explicit human confirmation");
    return json(
      response,
      200,
      await promoteGeneratedAssetsBatch({
        selections: input.selections,
      }),
    );
  }
  const projectMatch = url.pathname.match(/^\/api\/projects\/([^/]+)(?:\/(.*))?$/);
  if (request.method === "POST" && url.pathname === "/api/projects") {
    const input = await body(request);
    const selectedAgent = await detectAgent(input.agentId);
    if (!selectedAgent.available) throw new Error(selectedAgent.remediation ?? "所选 Agent 当前不可用");
    if (input.model) assertApprovedAgentModel(await loadAgentModelGovernance(), input.agentId, input.model);
    return json(
      response,
      201,
      await createCreatorProject({
        id: input.id,
        title: input.title,
        topic: input.topic,
        creatorNotes: input.creatorNotes,
        category: input.category,
        workflowMode: input.workflowMode,
        agentId: input.agentId,
        model: input.model,
      }),
    );
  }
  if (!projectMatch) return false;
  const [, projectId, action = ""] = projectMatch;
  if (request.method === "GET" && !action) {
    const project = await loadCreatorProject(projectId);
    let narration;
    try {
      narration = await loadNarration(projectId);
    } catch {}
    const visualStoryboard = await loadVisualStoryboard(projectId, narration);
    return json(response, 200, {
      project,
      narration,
      visualStoryboard,
      imageAssetMatches: await buildProjectImageAssetMatches({ project, narration, storyboard: visualStoryboard }),
      animationAssetReplanning: await loadAnimationAssetReplanning(projectId),
      sourceContext: await loadSourceContext(projectId),
      materialUnderstanding: await loadMaterialUnderstanding(projectId, project),
      narrationHistory: await listNarrationAttempts(projectId),
      writingLearning: await loadWritingLearning(projectId),
      writingProfile: await loadCreatorWritingProfile(),
    });
  }
  const assetMatch = action.match(/^assets\/([a-z0-9-]+)$/);
  if (request.method === "GET" && assetMatch) {
    const assetPath = await resolveCreatorAsset(projectId, assetMatch[1]);
    const info = await stat(assetPath);
    const contentTypes = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".webp": "image/webp",
      ".gif": "image/gif",
    };
    response.writeHead(200, {
      ...studioSecureHeaders,
      "content-type": contentTypes[extname(assetPath).toLowerCase()] ?? "application/octet-stream",
      "content-length": info.size,
      "cache-control": "private, max-age=60",
    });
    return createReadStream(assetPath).pipe(response);
  }
  if (request.method === "PATCH" && !action) {
    const input = await body(request);
    return json(response, 200, await renameCreatorProject(projectId, input.title));
  }
  if (request.method === "PATCH" && action === "typography") {
    const input = await body(request);
    return json(response, 200, await updateProjectTypography(projectId, input.mode));
  }
  if (request.method === "DELETE" && !action) {
    assertProjectIdle(projectId);
    const input = await body(request);
    return json(response, 200, await deleteCreatorProject({ id: projectId, confirmation: input.confirmation }));
  }
  if (request.method === "POST" && action === "assets") {
    const input = await body(request);
    return json(response, 201, await importCreatorAsset({ projectId, ...input }));
  }
  const materialMatch = action.match(/^materials\/([a-z0-9-]+)$/);
  if (request.method === "DELETE" && materialMatch) {
    assertProjectIdle(projectId);
    return json(response, 200, await deleteCreatorMaterial({ projectId, materialId: materialMatch[1] }));
  }
  if (request.method === "POST" && action === "assets/pick") {
    assertProjectIdle(projectId);
    const input = await body(request);
    const paths = await chooseLocalFiles({
      multiple: input.multiple !== false,
      prompt: input.kind === "speaker-video" ? "选择已经录制的口播原片" : "选择图片、录屏或参考文件",
    });
    if (!paths.length) return json(response, 200, { cancelled: true, materials: [] });
    const results = [];
    for (const sourcePath of paths) {
      results.push(
        await importCreatorAsset({
          projectId,
          sourcePath,
          kind: input.kind === "speaker-video" ? "speaker-video" : inferCreatorAssetKind(sourcePath),
          fit: input.fit,
        }),
      );
    }
    return json(response, 201, { cancelled: false, materials: results.map((item) => item.material), results });
  }
  if (request.method === "POST" && action === "input-script/pick") {
    assertProjectIdle(projectId);
    const paths = await chooseLocalFiles({ multiple: false, prompt: "选择口播稿或字幕稿" });
    if (!paths.length) return json(response, 200, { cancelled: true });
    return json(response, 201, {
      cancelled: false,
      ...(await importCreatorInputScript({ projectId, sourcePath: paths[0] })),
    });
  }
  if (request.method === "POST" && action === "sources") {
    const input = await body(request);
    return json(response, 201, await addCreatorSource({ projectId, ...input }));
  }
  if (request.method === "PUT" && action === "editorial-brief") {
    const input = await body(request);
    return json(response, 200, await updateCreatorEditorialBrief({ projectId, editorialBrief: input.editorialBrief }));
  }
  if (request.method === "POST" && action === "editorial-brief/infer") {
    assertProjectIdle(projectId);
    const record = job("editorial-inference", projectId, (onProgress) =>
      inferCreatorEditorialBrief(projectId, { onProgress }),
    );
    return json(response, 202, record);
  }
  if (request.method === "POST" && action === "material-understanding/analyze") {
    assertProjectIdle(projectId);
    const record = job("material-understanding", projectId, (onProgress) =>
      analyzeMaterialUnderstanding(projectId, { onProgress }),
    );
    return json(response, 202, record);
  }
  if (request.method === "POST" && action === "material-understanding/confirm") {
    const input = await body(request);
    return json(response, 200, await confirmMaterialUnderstanding(projectId, input.inputSha256));
  }
  if (request.method === "POST" && action === "draft") {
    assertProjectIdle(projectId);
    const input = await body(request);
    const record = job("narration", projectId, (onProgress) => generateNarration(projectId, { ...input, onProgress }));
    return json(response, 202, record);
  }
  if (request.method === "POST" && action === "visual-storyboard/seed") {
    assertProjectIdle(projectId);
    const record = job("visual-storyboard-seed", projectId, (onProgress) =>
      resumeNarrationVisualPlanning(projectId, { onProgress }),
    );
    return json(response, 202, record);
  }
  if (request.method === "POST" && action === "existing-narration/prepare") {
    assertProjectIdle(projectId);
    return json(response, 200, await prepareExistingNarration(projectId));
  }
  if (request.method === "POST" && action === "rewrite") {
    assertProjectIdle(projectId);
    const input = await body(request);
    const record = job("narration-rewrite", projectId, (onProgress) =>
      rewriteNarration(projectId, { ...input, onProgress }),
    );
    return json(response, 202, record);
  }
  if (request.method === "PUT" && action === "narration")
    return json(response, 200, await updateNarration(projectId, await body(request)));
  if (request.method === "PUT" && action === "visual-storyboard") {
    const narration = await loadNarration(projectId);
    return json(response, 200, await saveVisualStoryboard(projectId, await body(request), narration));
  }
  if (request.method === "POST" && action === "animation-assets/replan") {
    assertProjectIdle(projectId);
    const record = job("animation-asset-replan", projectId, (onProgress) =>
      replanAnimationAssets(projectId, { onProgress }),
    );
    return json(response, 202, record);
  }
  if (request.method === "POST" && action === "animation-assets/replan/confirm") {
    assertProjectIdle(projectId);
    const input = await body(request);
    return json(
      response,
      200,
      await confirmAnimationAssetReplan({
        projectId,
        attemptId: input.attemptId,
        candidateStoryboardSha256: input.candidateStoryboardSha256,
        confirmation: input.confirmation,
      }),
    );
  }
  if (request.method === "POST" && action === "narration/restore") {
    const input = await body(request);
    return json(response, 200, await restoreNarrationAttempt(projectId, input.attemptId));
  }
  if (request.method === "GET" && action === "narration/export") {
    const exported = await buildNarrationExport(projectId, url.searchParams.get("format") ?? "md");
    const filename = encodeURIComponent(`${projectId}-narration.${exported.extension}`);
    response.writeHead(200, {
      ...studioSecureHeaders,
      "content-type": exported.contentType,
      "content-disposition": exported.print ? "inline" : `attachment; filename*=UTF-8''${filename}`,
      "cache-control": "no-store",
    });
    response.end(exported.body);
    return;
  }
  if (request.method === "POST" && action === "lock")
    return json(response, 200, await lockNarration(projectId, await body(request)));
  if (request.method === "POST" && action === "writing-learning/suggest") {
    assertProjectIdle(projectId);
    const record = job("writing-learning", projectId, (onProgress) => suggestWritingLessons(projectId, { onProgress }));
    return json(response, 202, record);
  }
  if (request.method === "POST" && action === "writing-learning/accept") {
    const input = await body(request);
    return json(response, 200, await acceptWritingLessons(projectId, input.lessonIds));
  }
  if (request.method === "POST" && action === "handoff")
    return json(response, 200, await createVideoHandoff(projectId, await body(request)));
  if (request.method === "GET" && action === "workflow/status")
    return json(response, 200, await loadStudioWorkflow(projectId));
  if (request.method === "GET" && action === "production-agent")
    return json(response, 200, await loadProductionAgentState(projectId));
  if (request.method === "POST" && action === "acceptance/production-agent-fault") {
    const acceptanceScenario = productionAgentAcceptanceScenario();
    if (!acceptanceScenario) return false;
    if (!projectId.startsWith("acceptance-"))
      throw new Error("Production Agent acceptance requires a dedicated acceptance project");
    await loadCreatorProject(projectId);
    assertProjectIdle(projectId);
    await enterProductionAgent(projectId, "controlled-fault-acceptance");
    const record = workflowJob(projectId, "__production-agent-acceptance__", "continue", [
      "--from",
      "visual-qa",
      "--until",
      "review",
    ]);
    record.acceptanceScenario = acceptanceScenario.id;
    return json(response, 202, record);
  }
  if (request.method === "GET" && action.match(/^generated-assets\/([^/]+)\/preview$/)) {
    const assetId = action.split("/")[1];
    const asset = await resolveGeneratedAssetPreview({ projectId, assetId });
    return streamFile({
      request,
      response,
      asset,
      mediaType:
        {
          ".webp": "image/webp",
          ".jpg": "image/jpeg",
          ".jpeg": "image/jpeg",
          ".png": "image/png",
        }[extname(asset.path).toLowerCase()] ?? "application/octet-stream",
      cacheControl: "no-store",
      nosniff: true,
    });
  }
  if (request.method === "POST" && action.match(/^generated-assets\/([^/]+)\/promote$/)) {
    const assetId = action.split("/")[1];
    const input = await body(request);
    if (input.confirmation !== "human-promote-generated-asset")
      throw new Error("Generated asset promotion requires explicit human confirmation");
    return json(response, 200, await promoteGeneratedAsset({ projectId, assetId }));
  }
  if (request.method === "POST" && action === "workflow/refresh") {
    assertProjectIdle(projectId);
    return json(response, 200, await reconcileStudioWorkflow(projectId));
  }
  if (request.method === "GET" && action === "workflow/recut-preview") return streamVideo(request, response, projectId);
  if (request.method === "GET" && action === "workflow/production-baseline/video")
    return streamProductionBaseline(request, response, projectId);
  if (request.method === "GET" && action === "workflow/production-baseline/delivery-video")
    return streamProductionBaseline(request, response, projectId, "delivery");
  if (request.method === "POST" && action === "workflow/production-baseline/approve") {
    assertProjectIdle(projectId);
    return json(response, 200, await approveProductionBaseline({ projectId, ...(await body(request)) }));
  }
  if (request.method === "POST" && action === "workflow/production-baseline/deliver") {
    assertProjectIdle(projectId);
    return json(response, 200, await deliverProductionBaseline({ projectId, ...(await body(request)) }));
  }
  if (request.method === "GET" && action === "workflow/static-review")
    return json(response, 200, await loadStaticReview(projectId));
  if (request.method === "GET" && action === "workflow/delivery")
    return json(response, 200, await loadStudioDelivery(projectId));
  if (request.method === "GET" && action === "cover") return json(response, 200, await loadStudioCover(projectId));
  if (request.method === "POST" && action === "cover/portrait") {
    assertProjectIdle(projectId);
    const input = await body(request);
    return json(
      response,
      200,
      await registerStudioCoverPortrait({ projectId, sourcePath: input.sourcePath, crop: input.crop }),
    );
  }
  if (request.method === "POST" && action === "cover/render") {
    assertProjectIdle(projectId);
    const input = await body(request);
    return json(response, 200, await renderStudioCover({ projectId, selection: input.selection }));
  }
  const coverArtifactMatch = action.match(/^cover\/artifact\/(landscape|portrait)$/);
  if (request.method === "GET" && coverArtifactMatch)
    return streamStudioCover(response, projectId, coverArtifactMatch[1]);
  const coverDownloadMatch = action.match(/^cover\/download\/(landscape|portrait)$/);
  if (request.method === "GET" && coverDownloadMatch)
    return streamStudioCover(response, projectId, coverDownloadMatch[1], { download: true });
  const coverCatalogAssetMatch = action.match(/^cover\/catalog-asset\/(person)\/([a-z0-9-]+)$/);
  if (request.method === "GET" && coverCatalogAssetMatch)
    return streamStudioCoverCatalogAsset(response, projectId, coverCatalogAssetMatch[1]);
  if (request.method === "GET" && action === "workflow/delivery/video")
    return streamDeliveryVideo(request, response, projectId);
  if (request.method === "GET" && action === "workflow/operations")
    return json(response, 200, await loadStudioOperations({ projectId, jobs: [...jobs.values()].map(publicJob) }));
  if (request.method === "GET" && action === "workflow/recovery") {
    const operations = await loadStudioOperations({ projectId, jobs: [...jobs.values()].map(publicJob) });
    return json(response, 200, operations.operations.recovery);
  }
  if (request.method === "POST" && action === "workflow/recovery/ask") {
    assertProjectIdle(projectId);
    const project = await loadCreatorProject(projectId);
    if (!project.video.manifest) throw new Error("请先生成视频工作流交接包");
    const operations = await loadStudioOperations({ projectId, jobs: [...jobs.values()].map(publicJob) });
    const recovery = operations.operations.recovery;
    if (!recovery.actions.askAgent.enabled) throw new Error("当前没有需要 Agent 诊断的故障");
    const selectedAgent = await detectAgent(project.agent.id);
    if (!selectedAgent.available) throw new Error(selectedAgent.remediation ?? "当前项目固定 Agent 不可用");
    if (!project.agent.model) throw new Error("当前项目没有固定已审核模型，不能启动 Agent 诊断");
    assertApprovedAgentModel(await loadAgentModelGovernance(), project.agent.id, project.agent.model);
    const record = job("recovery-diagnosis", projectId, async (reportProgress, currentJob) => {
      const controller = new AbortController();
      currentJob.cancel = () => controller.abort();
      reportProgress({ phase: "diagnosis", percent: 15, message: "固定 Agent 正在只读分析故障证据" });
      const adapter = createStructuredAgentJsonAdapter({
        config: {
          provider: project.agent.id,
          model: project.agent.model,
          maxRetries: 0,
          timeoutSeconds: 180,
        },
        schemaPath: resolve("schemas/studio-recovery-diagnosis.schema.json"),
        cwd: process.cwd(),
      });
      const prompt = studioRecoveryDiagnosisPrompt(recovery);
      const diagnosis = await adapter.completeJson({ ...prompt, signal: controller.signal });
      reportProgress({ phase: "diagnosis", percent: 100, message: "只读诊断完成，等待你决定下一步" });
      return {
        schemaVersion: "1.0",
        recoverySha256: recovery.recoverySha256,
        diagnosis,
        provider: adapter.getLastRunMetadata(),
      };
    });
    record.action = "ask-agent";
    record.recoverySha256 = recovery.recoverySha256;
    await persistJobs();
    return json(response, 202, publicJob(record));
  }
  if (request.method === "POST" && action === "workflow/recovery/resume") {
    assertProjectIdle(projectId);
    const input = await body(request);
    if (input.confirmation !== "human-recovery-resume") throw new Error("从故障断点继续需要明确确认");
    const project = await loadCreatorProject(projectId);
    if (!project.video.manifest) throw new Error("请先生成视频工作流交接包");
    const operations = await loadStudioOperations({ projectId, jobs: [...jobs.values()].map(publicJob) });
    const recovery = assertStudioRecoveryConfirmation({
      recovery: operations.operations.recovery,
      expectedSha256: input.recoverySha256,
    });
    const snapshot = await loadStudioWorkflow(projectId);
    const readinessArgs = workflowArgsForStudioReadiness(snapshot);
    const readiness = await inspectStudioReadiness({
      manifest: project.video.manifest,
      workflowArgs: readinessArgs,
    });
    const expectedTargetStage = recovery.resume.action === "recut" ? "recut-review" : "agent-review";
    assertStudioReadinessConfirmation({
      readiness,
      expectedSha256: input.readinessSha256,
      expectedTargetStage,
    });
    let workflowArgs = workflowArgsForStudioAction(recovery.resume.action);
    if (recovery.resume.action === "continue" && recovery.resume.stage)
      workflowArgs = ["--from", recovery.resume.stage, ...workflowArgs];
    const recoveryConfirmation = await recordStudioRecoveryConfirmation({
      projectId,
      recovery,
      readiness,
    });
    const readinessConfirmation = await recordStudioReadinessConfirmation({
      projectId,
      action: `recovery-${recovery.resume.action}`,
      readiness,
    });
    const record = workflowJob(projectId, project.video.manifest, recovery.resume.action, workflowArgs);
    record.recoveryConfirmation = recoveryConfirmation;
    record.readinessConfirmation = readinessConfirmation;
    await persistJobs();
    return json(response, 202, publicJob(record));
  }
  if (request.method === "POST" && action === "workflow/cleanup") {
    assertProjectIdle(projectId);
    return json(response, 200, await applyCreatorProjectCleanup({ projectId, ...(await body(request)) }));
  }
  if (request.method === "POST" && action === "workflow/revisions/preview") {
    assertProjectIdle(projectId);
    return json(response, 200, await previewStudioRevision({ projectId, ...(await body(request)) }));
  }
  if (request.method === "POST" && action === "workflow/revisions/apply") {
    assertProjectIdle(projectId);
    const revision = await applyStudioRevision({ projectId, ...(await body(request)) });
    if (revision.decision === "rejected") return json(response, 200, { revision });
    const project = await loadCreatorProject(projectId);
    const resumeAction = revision.staleStages.includes("semantic-plan") ? "replan-semantic" : "continue";
    const task = workflowJob(
      projectId,
      project.video.manifest,
      resumeAction,
      workflowArgsForStudioAction(resumeAction),
    );
    return json(response, 202, { revision, task: publicJob(task) });
  }
  const reviewArtifactMatch = action.match(/^workflow\/review-artifacts\/([a-z0-9-]+)$/);
  if (request.method === "GET" && reviewArtifactMatch)
    return streamReviewArtifact(request, response, projectId, reviewArtifactMatch[1]);
  if (request.method === "POST" && action === "workflow/static-review/notes") {
    const input = await body(request);
    return json(response, 201, await addStaticReviewNote({ projectId, ...input }));
  }
  if (request.method === "POST" && action === "workflow/static-review/reject") {
    const input = await body(request);
    return json(response, 200, await rejectStaticReview({ projectId, ...input }));
  }
  if (request.method === "POST" && action === "workflow/static-review/approve") {
    assertProjectIdle(projectId);
    const project = await loadCreatorProject(projectId);
    if (!project.video.manifest) throw new Error("请先生成视频工作流交接包");
    const input = await body(request);
    const approval = await assertStaticReviewApproval({ projectId, ...input });
    return json(
      response,
      202,
      workflowJob(projectId, project.video.manifest, "approve-static-review", approval.workflowArgs),
    );
  }
  if (request.method === "POST" && action === "workflow/delivery/start") {
    assertProjectIdle(projectId);
    const project = await loadCreatorProject(projectId);
    if (!project.video.manifest) throw new Error("请先生成视频工作流交接包");
    const input = await body(request);
    const start = await assertStudioDeliveryStart({ projectId, ...input });
    const snapshot = await loadStudioWorkflow(projectId);
    const readiness = await inspectStudioReadiness({
      manifest: project.video.manifest,
      workflowArgs: workflowArgsForStudioReadiness(snapshot, input.profile),
    });
    assertStudioReadinessConfirmation({
      readiness,
      expectedSha256: input.readinessSha256,
      expectedTargetStage: "delivery-validate",
    });
    const readinessConfirmation = await recordStudioReadinessConfirmation({
      projectId,
      action: "delivery",
      readiness,
      profile: input.profile,
    });
    const record = workflowJob(projectId, project.video.manifest, "delivery", start.workflowArgs);
    record.approvalSnapshotId = start.snapshotId;
    record.readinessConfirmation = readinessConfirmation;
    await persistJobs();
    return json(response, 202, publicJob(record));
  }
  if (request.method === "POST" && action === "workflow/delivery/accept") {
    assertProjectIdle(projectId);
    return json(response, 200, await acceptStudioDelivery({ projectId, ...(await body(request)) }));
  }
  if (request.method === "POST" && action === "workflow/delivery/return") {
    assertProjectIdle(projectId);
    return json(response, 200, await returnStudioDelivery({ projectId, ...(await body(request)) }));
  }
  if (request.method === "POST" && action === "workflow/delivery/reveal") {
    const input = await body(request);
    const artifact = await resolveDeliveryArtifact(projectId, input.target);
    await revealInFinder(artifact);
    return json(response, 200, { opened: true, target: input.target });
  }
  if (request.method === "POST" && action === "workflow/recut-decision") {
    const input = await body(request);
    return json(response, 200, await recordRecutDecision({ projectId, ...input }));
  }
  if (request.method === "POST" && action === "workflow") {
    const project = await loadCreatorProject(projectId);
    if (!project.video.manifest) throw new Error("Create the video handoff first");
    const input = await body(request);
    assertProjectIdle(projectId);
    if (input.action === "animation-repair") {
      if (input.confirmation !== "human-animation-repair") throw new Error("补回候选动画需要明确确认");
      return json(response, 202, animationRepairJob(projectId, project.video.manifest));
    }
    let rollbackAttempt;
    let environment;
    let workflowArgs;
    if (input.action === "readiness") {
      const snapshot = await loadStudioWorkflow(projectId);
      workflowArgs = workflowArgsForStudioReadiness(snapshot, input.profile);
    } else workflowArgs = workflowArgsForStudioAction(input.action);
    if (input.action === "production") {
      const snapshot = await loadStudioWorkflow(projectId);
      if (snapshot.semanticReplanRequired) workflowArgs = ["--replan-semantic", ...workflowArgs];
    }
    if (input.action === "approve-recut") {
      const snapshot = await assertReviewedRecut({ projectId, screenSha256: input.screenSha256 });
      if (snapshot.recut?.decision?.decision === "rejected")
        throw new Error("当前粗剪提案已被驳回，请先重新规划或重新打开审核");
    }
    if (input.action === "replan-recut") {
      if (input.confirmation !== "human-recut-replan") throw new Error("重新规划粗剪需要明确确认");
      const snapshot = await assertReviewedRecut({ projectId, screenSha256: input.screenSha256 });
      const decision = snapshot.recut?.decision;
      if (decision?.decision !== "rejected" || !decision.note?.trim())
        throw new Error("请先填写修改意见并驳回当前粗剪提案");
      environment = { REMOTION_MD_RECUT_REVIEW_FEEDBACK: decision.note.trim() };
      rollbackAttempt = await archiveCurrentRecutProposal(projectId);
    }
    if (input.action === "replan-semantic") {
      if (input.confirmation !== "human-semantic-replan") throw new Error("重新理解内容需要明确确认");
      const snapshot = await loadStudioWorkflow(projectId);
      if (!snapshot.semanticReplanRequired) throw new Error("当前语义计划仍然有效，无需重新理解内容");
    }
    if (input.action === "continue") {
      const snapshot = await loadStudioWorkflow(projectId);
      if (snapshot.reviewReady) throw new Error("静态审核资料已经生成，无需重复执行；请进入静态审核。");
      if (!snapshot.recutApproved) throw new Error("粗剪方案已经变化或尚未批准，请先重新生成并审核 720p 粗剪预览。");
      const resumeStage = resumeStageForStudio(snapshot.stages);
      if (resumeStage) workflowArgs = ["--from", resumeStage, ...workflowArgs];
    }
    let readinessConfirmation;
    if (["recut", "review", "continue", "production"].includes(input.action)) {
      const snapshot = await loadStudioWorkflow(projectId);
      const readinessArgs = workflowArgsForStudioReadiness(snapshot);
      const readiness = await inspectStudioReadiness({
        manifest: project.video.manifest,
        workflowArgs: readinessArgs,
      });
      const expectedTargetStage =
        input.action === "recut"
          ? "recut-review"
          : input.action === "production"
            ? "delivery-validate"
            : "agent-review";
      assertStudioReadinessConfirmation({
        readiness,
        expectedSha256: input.readinessSha256,
        expectedTargetStage,
      });
      readinessConfirmation = await recordStudioReadinessConfirmation({
        projectId,
        action: input.action,
        readiness,
      });
    }
    if (["review", "continue", "production"].includes(input.action))
      await enterProductionAgent(projectId, "creator-authorized-production").catch(() => {});
    const record = workflowJob(projectId, project.video.manifest, input.action, workflowArgs, {
      rollbackAttempt,
      environment,
    });
    if (input.action === "readiness") {
      record.readinessProfile = input.profile;
      await persistJobs();
    }
    if (readinessConfirmation) {
      record.readinessConfirmation = readinessConfirmation;
      await persistJobs();
    }
    return json(response, 202, publicJob(record));
  }
  if (request.method === "POST" && action.startsWith("jobs/") && action.endsWith("/cancel")) {
    const id = action.split("/")[1];
    const record = ownedProjectJob(jobs, projectId, id);
    if (record?.status === "queued") {
      record.status = "cancelled";
      jobGate.cancel(id);
      record.completedAt = new Date().toISOString();
    } else if (record?.status === "running") {
      record.status = "cancelled";
      await record.cancel?.();
      record.completedAt = new Date().toISOString();
    }
    await persistJobs();
    if (record) broadcast("job", publicJob(record));
    return json(response, record ? 200 : 404, record ?? { error: "Job not found" });
  }
  return false;
};

const serverStartedAt = new Date().toISOString();
const server = createServer(async (request, response) => {
  try {
    assertTrustedRequest(request);
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (url.pathname.startsWith("/api/")) {
      const mutationProject = mutationMethods.has(request.method)
        ? url.pathname.match(/^\/api\/projects\/([^/]+)(?:\/|$)/)?.[1]
        : undefined;
      const handled = mutationProject
        ? await projectMutationMutex.run(mutationProject, () => routes(request, response, url))
        : await routes(request, response, url);
      if (handled === false) json(response, 404, { error: "Not found" });
      return;
    }
    const servesLocalAsset = url.pathname.startsWith("/local-assets/");
    const relativePath = servesLocalAsset
      ? url.pathname.slice("/local-assets/".length)
      : url.pathname === "/"
        ? "index.html"
        : url.pathname.slice(1);
    if (relativePath.includes("..")) throw new Error("Invalid path");
    const filePath = resolve(servesLocalAsset ? localAssetRoot : staticRoot, relativePath);
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error("Not found");
    const contentTypes = {
      ".html": "text/html",
      ".css": "text/css",
      ".js": "text/javascript",
      ".png": "image/png",
      ".svg": "image/svg+xml",
      ".mp4": "video/mp4",
    };
    response.writeHead(200, {
      ...studioSecureHeaders,
      "content-security-policy": studioPageContentSecurityPolicy,
      "content-type": contentTypes[extname(filePath)] ?? "application/octet-stream",
    });
    createReadStream(filePath).pipe(response);
  } catch (error) {
    if (!response.headersSent)
      json(
        response,
        error.message === "Not found"
          ? 404
          : error.message.startsWith("Untrusted") || error.message.startsWith("Invalid Studio")
            ? 403
            : 500,
        {
          error: error.message,
        },
      );
  }
});

server.once("error", (error) => {
  console.error(`Studio failed to listen on 127.0.0.1:${port}: ${error.message}`);
  process.exitCode = 1;
});

server.listen(port, "127.0.0.1", async () => {
  // Recovery is intentionally deferred until this process owns the port. A second
  // Studio instance that loses EADDRINUSE must never interrupt the active owner's jobs.
  for (const id of storedRunningJobIds) {
    const record = jobs.get(id);
    if (!["queued", "running"].includes(record?.status)) continue;
    record.status = "interrupted";
    record.error =
      "Studio restarted before this task completed. No Agent or render was restarted automatically; resume from the linked workflow state.";
    record.completedAt = new Date().toISOString();
    await markStudioWorkflowInterrupted(record.projectId).catch(() => {});
  }
  await persistJobs().catch((error) => console.error(`Failed to persist recovered Studio jobs: ${error.message}`));
  console.log(`Remotion MD Studio: http://localhost:${port}`);
});

let shuttingDown = false;
const shutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  const hardExit = setTimeout(() => process.exit(1), 10_000);
  hardExit.unref();
  const active = [...jobs.values()].filter((record) => ["queued", "running"].includes(record.status));
  for (const record of active) {
    if (record.status === "queued") jobGate.cancel(record.id);
    else await record.cancel?.().catch(() => {});
    record.status = "interrupted";
    record.error = `Studio stopped by ${signal}. Resume from the linked workflow state.`;
    record.completedAt = new Date().toISOString();
    await markStudioWorkflowInterrupted(record.projectId).catch(() => {});
  }
  await persistJobs().catch(() => {});
  server.close(() => process.exit(0));
  server.closeAllConnections?.();
};
process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));
