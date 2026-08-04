import { copyFile, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { verifyApprovalSnapshot } from "../workflow/approval-snapshot.mjs";
import { readManifest } from "../workflow/manifest.mjs";
import { createStages, signatureConfigForStage } from "../workflow/stages.mjs";
import { fileExists, recordEvent, saveState, signatureFor } from "../workflow/state.mjs";
import { creatorRoot, loadCreatorProject, saveCreatorProject } from "./project-store.mjs";
import { loadProductionBaseline } from "./production-agent-baseline.mjs";
import { studioStageDependenciesCurrent } from "./studio-contract.mjs";

const reviewFiles = (paths) => [
  paths.recutProviderPlan,
  paths.proposedEdl,
  paths.recutCandidates,
  paths.recutReview,
  paths.recutPreview,
];
const approvalFiles = (paths) => [paths.proposedEdl, paths.recutCandidates, paths.recutReview, paths.recutPreview];
const decisionPath = (projectId) => resolve(creatorRoot, projectId, "review", "recut-decision.json");
const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const recoverableStatuses = new Set(["stale", "interrupted", "running"]);
const inputSignatureFor = (manifest, stage) =>
  signatureFor([
    manifest.schemaVersion,
    stage.name,
    stage.inputs,
    ...stage.inputs,
    signatureConfigForStage(manifest, stage.name),
  ]);

const stageArtifactsCurrent = async ({ manifest, stage, entry }) => {
  if (!entry?.inputSignature || !entry?.outputSignature) return false;
  const outputsExist = await Promise.all((stage.outputs ?? []).map(fileExists)).then((items) => items.every(Boolean));
  if (!outputsExist) return false;
  return (
    entry.inputSignature === (await inputSignatureFor(manifest, stage)) &&
    entry.outputSignature === (await signatureFor(stage.outputs ?? []))
  );
};

export const workflowContextForCreator = async (projectId) => {
  const creator = await loadCreatorProject(projectId);
  if (!creator.video?.manifest || !creator.video?.projectId) throw new Error("请先生成视频工作流交接包");
  const context = await readManifest(creator.video.manifest);
  if (context.manifest.project.id !== creator.video.projectId) throw new Error("视频交接包与已登记项目不匹配");
  return { creator, context };
};

const loadDecision = async (projectId) => {
  try {
    return await readJson(decisionPath(projectId));
  } catch {
    return undefined;
  }
};

export const loadStudioWorkflow = async (projectId) => {
  const { creator, context } = await workflowContextForCreator(projectId);
  const { manifest, paths } = context;
  const state = (await fileExists(paths.state)) ? await readJson(paths.state) : undefined;
  const stages = createStages(context).map(({ name }) => {
    const entry = state?.stages?.[name];
    return {
      name,
      status: entry?.status ?? "pending",
      elapsedMs: entry?.elapsedMs,
      lastProgressAt: entry?.lastProgressAt,
      failure: entry?.failure
        ? {
            stage: name,
            code: entry.failure.code,
            category: entry.failure.category,
            message: entry.failure.message,
            remediation: entry.failure.remediation,
            retryable: entry.failure.retryable,
            occurredAt: entry.failure.occurredAt,
          }
        : undefined,
    };
  });
  const recutReady = state?.stages?.["recut-review"]?.status === "succeeded";
  const recutApproved = state?.stages?.["recut-approval"]?.status === "approved";
  const editPromoted = state?.stages?.["edit-promote"]?.status === "succeeded";
  const productionBaseline = await loadProductionBaseline(projectId);
  const enhancedReviewReady =
    state?.stages?.["review-evidence"]?.status === "succeeded" &&
    state?.stages?.["visual-qa"]?.status === "succeeded" &&
    state?.stages?.["regression-fixtures"]?.status === "succeeded" &&
    state?.stages?.["agent-review"]?.status === "succeeded";
  const reviewReady = enhancedReviewReady || Boolean(productionBaseline);
  const reviewApproved =
    state?.stages?.["human-approval"]?.status === "approved" ||
    ["approved", "delivered"].includes(productionBaseline?.status);
  const workflowStarted = Object.values(state?.stages ?? {}).some(
    (entry) => entry?.status && entry.status !== "pending",
  );
  const semanticHasHistory = await fileExists(paths.semanticNarrativePlan);
  const semanticStatus = state?.stages?.["semantic-plan"]?.status ?? "pending";
  const semanticReplanRequired =
    semanticHasHistory && recutApproved && editPromoted && !["succeeded", "approved"].includes(semanticStatus);
  const creatorStatus =
    creator.project.status === "delivered" && reviewApproved
      ? "delivered"
      : reviewApproved
        ? "approved"
        : reviewReady
          ? "review"
          : workflowStarted
            ? "video-running"
            : "video-ready";
  if (
    creator.project.status !== creatorStatus &&
    ["video-ready", "video-running", "review", "approved"].includes(creator.project.status)
  ) {
    creator.project.status = creatorStatus;
    await saveCreatorProject(creator);
  }
  let recut;
  if (recutReady && (await Promise.all(reviewFiles(paths).map(fileExists))).every(Boolean)) {
    const candidates = await readJson(paths.recutCandidates);
    const proposedEdl = await readJson(paths.proposedEdl);
    const screenSha256 = await signatureFor(reviewFiles(paths));
    const approvalSha256 = await signatureFor(approvalFiles(paths));
    const storedDecision = await loadDecision(projectId);
    recut = {
      summary: candidates.summary,
      candidates: candidates.candidates ?? [],
      removals: candidates.removals ?? [],
      protectedRanges: candidates.protectedRanges ?? [],
      unresolvedProtectedAnchors: candidates.unresolvedProtectedAnchors ?? [],
      proposedRanges: proposedEdl.ranges?.length ?? 0,
      screenSha256,
      approvalSha256,
      approvedSha256: state?.stages?.["recut-approval"]?.reviewSha256,
      decision: storedDecision?.screenSha256 === screenSha256 ? storedDecision : undefined,
      previewUrl: `/api/projects/${encodeURIComponent(projectId)}/workflow/recut-preview`,
    };
  }
  return {
    schemaVersion: "1.0",
    project: { id: manifest.project.id, title: manifest.project.title },
    updatedAt: state?.updatedAt,
    stages,
    currentFailure: productionBaseline ? undefined : stages.find((item) => item.status === "failed")?.failure,
    recutReady,
    recutApproved,
    recutApprovalStatus: state?.stages?.["recut-approval"]?.status ?? "pending",
    editPromoted,
    reviewReady,
    reviewApproved,
    productionBaseline,
    semanticReplanRequired,
    creatorStatus,
    recut,
  };
};

export const reconcileStudioWorkflow = async (projectId) => {
  const { context } = await workflowContextForCreator(projectId);
  const { manifest, paths } = context;
  if (!(await fileExists(paths.state))) return { changed: [], snapshot: await loadStudioWorkflow(projectId) };
  const state = await readJson(paths.state);
  state.events ??= [];
  const stages = createStages(context);
  const changed = [];
  const currentStatuses = new Set(["succeeded", "approved"]);
  for (const stage of stages) {
    const entry = state.stages?.[stage.name];
    if (!entry) continue;
    const dependenciesCurrent = studioStageDependenciesCurrent(stage, state);
    let artifactsCurrent = dependenciesCurrent && (await stageArtifactsCurrent({ manifest, stage, entry }));
    if (stage.name === "human-approval" && dependenciesCurrent && entry.snapshot) {
      try {
        const verified = await verifyApprovalSnapshot({ paths, snapshot: entry.snapshot });
        artifactsCurrent =
          verified.manifest.reviewEvidenceSha256 === entry.reviewEvidenceSha256 &&
          verified.manifest.projectId === manifest.project.id;
      } catch {
        artifactsCurrent = false;
      }
    }
    if (artifactsCurrent && recoverableStatuses.has(entry.status)) {
      entry.status = stage.approval ? "approved" : "succeeded";
      delete entry.error;
      delete entry.failure;
      entry.reconciledAt = new Date().toISOString();
      changed.push({ stage: stage.name, status: entry.status });
    } else if (
      (!dependenciesCurrent || !artifactsCurrent) &&
      currentStatuses.has(entry.status) &&
      (!stage.approval || !dependenciesCurrent)
    ) {
      entry.status = "stale";
      changed.push({ stage: stage.name, status: "stale" });
    }
  }
  if (changed.length) {
    for (const item of changed)
      recordEvent(state, { event: "stage.reconciled", stage: item.stage, status: item.status });
    state.updatedAt = new Date().toISOString();
    await saveState(paths.state, state);
  }
  return { changed, snapshot: await loadStudioWorkflow(projectId) };
};

export const markStudioWorkflowInterrupted = async (projectId) => {
  const { context } = await workflowContextForCreator(projectId);
  if (!(await fileExists(context.paths.state))) return false;
  const state = await readJson(context.paths.state);
  let changed = false;
  for (const [name, entry] of Object.entries(state.stages ?? {})) {
    if (entry.status !== "running") continue;
    entry.status = "interrupted";
    entry.finishedAt = new Date().toISOString();
    entry.error = "Studio task was cancelled by the creator";
    entry.failure = {
      schemaVersion: "1.0",
      code: "TASK_CANCELLED",
      category: "operation",
      stage: name,
      message: "任务已由你取消，可以从这一阶段继续。",
      retryable: true,
      remediation: "Resume the same workflow stage without deleting completed upstream artifacts.",
      occurredAt: entry.finishedAt,
    };
    changed = true;
  }
  if (!changed) return false;
  state.updatedAt = new Date().toISOString();
  const temporary = `${context.paths.state}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`);
  await rename(temporary, context.paths.state);
  return true;
};

export const assertReviewedRecut = async ({ projectId, screenSha256 }) => {
  if (typeof screenSha256 !== "string" || !/^[a-f0-9]{64}$/.test(screenSha256))
    throw new Error("缺少有效的粗剪审核哈希");
  const snapshot = await loadStudioWorkflow(projectId);
  if (!snapshot.recutReady || !snapshot.recut) throw new Error("粗剪预览还没有准备好");
  if (snapshot.recut.screenSha256 !== screenSha256) throw new Error("粗剪提案在审核后已变化，请刷新并重新审核");
  return snapshot;
};

export const recordRecutDecision = async ({ projectId, screenSha256, decision, note = "" }) => {
  await assertReviewedRecut({ projectId, screenSha256 });
  if (!new Set(["rejected", "reopened"]).has(decision)) throw new Error("不支持的审核决定");
  if (typeof note !== "string" || note.length > 1000) throw new Error("审核说明不能超过 1000 个字");
  const value = {
    schemaVersion: "1.0",
    projectId,
    screenSha256,
    decision,
    note: note.trim(),
    recordedAt: new Date().toISOString(),
  };
  const path = decisionPath(projectId);
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporary, path);
  return value;
};

export const archiveCurrentRecutProposal = async (projectId) => {
  const { context } = await workflowContextForCreator(projectId);
  const existing = [...reviewFiles(context.paths), context.paths.state, context.paths.artifacts].filter((path) => path);
  if (!(await Promise.all(existing.map(fileExists))).some(Boolean)) return undefined;
  const attempt = `attempt-${new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-")}`;
  const directory = resolve(context.paths.recutProposalDir, attempt);
  await mkdir(directory, { recursive: true });
  for (const path of existing) if (await fileExists(path)) await copyFile(path, resolve(directory, basename(path)));
  return attempt;
};

export const restoreArchivedRecutProposal = async (projectId, attempt) => {
  if (typeof attempt !== "string" || !/^attempt-[0-9TZ.-]+$/.test(attempt)) throw new Error("粗剪历史尝试标识无效");
  const { context } = await workflowContextForCreator(projectId);
  const directory = resolve(context.paths.recutProposalDir, attempt);
  const targets = [...reviewFiles(context.paths), context.paths.state, context.paths.artifacts];
  for (const target of targets) {
    const archived = resolve(directory, basename(target));
    if (await fileExists(archived)) await copyFile(archived, target);
  }
};

export const recutPreviewPath = async (projectId) => {
  const { context } = await workflowContextForCreator(projectId);
  if (!(await fileExists(context.paths.recutPreview))) throw new Error("粗剪预览不存在");
  const info = await stat(context.paths.recutPreview);
  if (!info.isFile() || info.size === 0) throw new Error("粗剪预览无效");
  return { path: context.paths.recutPreview, size: info.size };
};
