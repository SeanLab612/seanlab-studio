import { readdir, readFile, stat } from "node:fs/promises";
import { basename, relative, resolve, sep } from "node:path";
import { verifyApprovalSnapshot } from "../workflow/approval-snapshot.mjs";
import { fileExists, hashFile } from "../workflow/state.mjs";
import { estimateDelivery, normalizeDeliveryProfile } from "./delivery-profile.mjs";
import { loadCreatorProject, projectDir, saveCreatorProject, writeJsonAtomic } from "./project-store.mjs";
import { loadStaticReview } from "./studio-static-review.mjs";
import { workflowContextForCreator } from "./studio-workflow.mjs";

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const verifiedOutputCache = new Map();
const optionalJson = async (path) => {
  try {
    return await readJson(path);
  } catch {
    return undefined;
  }
};
const deliveryOutputPath = (paths) => resolve(paths.workspace, "delivery-source-resolution.mp4");
const decisionPath = (projectId) => resolve(projectDir(projectId), "review", "delivery-decision.json");
const summaryPath = (projectId) => resolve(projectDir(projectId), "review", "delivery-summary.json");
const directoryBytes = async (path) => {
  const entries = await readdir(path, { withFileTypes: true }).catch(() => []);
  const sizes = await Promise.all(
    entries.filter((entry) => entry.isFile()).map((entry) => stat(resolve(path, entry.name)).then((info) => info.size)),
  );
  return sizes.reduce((total, size) => total + size, 0);
};
const inside = (root, target) => {
  const value = relative(resolve(root), resolve(target));
  return value === "" || (value !== ".." && !value.startsWith(`..${sep}`) && !value.startsWith(sep));
};
const projectRelative = (projectId, path) => {
  const root = projectDir(projectId);
  if (!inside(root, path)) throw new Error("交付产物不在当前项目目录中");
  return relative(root, path).split(sep).join("/");
};
const parseRate = (value) => {
  const [numerator, denominator = "1"] = String(value ?? "0/1")
    .split("/")
    .map(Number);
  return denominator ? numerator / denominator : 0;
};
const verifyOutputAgainstReport = async ({ outputPath, outputInfo, validation }) => {
  if (!outputInfo || !validation?.output?.sha256) throw new Error("最终成片尚未通过技术验收");
  const key = `${outputPath}:${outputInfo.size}:${outputInfo.mtimeMs}:${validation.output.sha256}`;
  if (verifiedOutputCache.get(outputPath) === key) return validation.output.sha256;
  const actualSha256 = await hashFile(outputPath);
  if (actualSha256 !== validation.output.sha256) throw new Error("最终成片在技术验收后发生了变化，请重新验收");
  verifiedOutputCache.set(outputPath, key);
  return actualSha256;
};
const formatActivity = (event) => {
  const labels = {
    "delivery-render": "渲染最终成片",
    "delivery-validate": "验收成片文件",
  };
  const actions = {
    "stage.started": "开始",
    "stage.succeeded": "完成",
    "stage.skipped": "复用已有结果",
    "stage.failed": "暂停",
  };
  return {
    at: event.at,
    stage: event.stage,
    label: labels[event.stage] ?? event.stage,
    message: actions[event.event] ?? "状态更新",
  };
};

export const inspectDeliveryConsistency = ({ state, outputInfo, validation, validationCurrent }) => {
  const renderStatus = state.stages?.["delivery-render"]?.status ?? "pending";
  const validateStatus = state.stages?.["delivery-validate"]?.status ?? "pending";
  const active = renderStatus === "running" || validateStatus === "running";
  const findings = [];
  if (!active && outputInfo && renderStatus !== "succeeded")
    findings.push({
      code: "DELIVERY_FILE_WITHOUT_RENDER_STATE",
      message: "检测到成片文件，但正式工作流没有记录本次成片渲染成功。",
    });
  if (!active && renderStatus === "succeeded" && !outputInfo)
    findings.push({
      code: "DELIVERY_RENDER_STATE_WITHOUT_FILE",
      message: "正式工作流记录成片渲染成功，但成片文件已经不存在。",
    });
  if (!active && validation && validateStatus !== "succeeded")
    findings.push({
      code: "DELIVERY_VALIDATION_WITHOUT_STATE",
      message: "检测到技术验收文件，但正式工作流没有记录本次验收成功。",
    });
  if (!active && renderStatus === "succeeded" && validateStatus === "succeeded" && !validationCurrent)
    findings.push({
      code: "DELIVERY_VALIDATION_MISMATCH",
      message: "成片、技术验收文件与正式工作流状态不一致。",
    });
  return { status: findings.length ? "conflict" : "consistent", findings };
};

const currentDeliveryEvidence = async (projectId) => {
  const { context } = await workflowContextForCreator(projectId);
  const { paths } = context;
  const state = (await optionalJson(paths.state)) ?? { stages: {}, events: [] };
  const outputPath = deliveryOutputPath(paths);
  const outputInfo = await stat(outputPath).catch(() => undefined);
  const workingOutputBytes = outputInfo?.size ?? (await directoryBytes(resolve(paths.workspace, "clips_final_4k")));
  const validation = await optionalJson(paths.deliveryValidation);
  const visualDirectionReport = await optionalJson(paths.visualDirectionReport);
  const validationInfo = await stat(paths.deliveryValidation).catch(() => undefined);
  const validationSha256 = validationInfo ? await hashFile(paths.deliveryValidation) : undefined;
  const reportMatchesOutput = Boolean(
    outputInfo &&
      validation?.status === "passed" &&
      validation.output?.bytes === outputInfo.size &&
      typeof validation.output?.sha256 === "string",
  );
  const validationCurrent = Boolean(
    state.stages?.["delivery-render"]?.status === "succeeded" &&
      state.stages?.["delivery-validate"]?.status === "succeeded" &&
      reportMatchesOutput,
  );
  return {
    context,
    paths,
    state,
    outputPath,
    outputInfo,
    workingOutputBytes,
    validation,
    visualDirectionReport,
    validationSha256,
    validationCurrent,
  };
};

export const loadStudioDelivery = async (projectId) => {
  const project = await loadCreatorProject(projectId);
  const evidence = await currentDeliveryEvidence(projectId);
  const { state, outputPath, outputInfo, workingOutputBytes, validation, validationSha256, validationCurrent } =
    evidence;
  const approval = state.stages?.["human-approval"] ?? { status: "pending" };
  const renderStage = state.stages?.["delivery-render"] ?? { status: "pending" };
  const validateStage = state.stages?.["delivery-validate"] ?? { status: "pending" };
  const decision = await optionalJson(decisionPath(projectId));
  const decisionCurrent = Boolean(
    decision &&
      validationCurrent &&
      decision.validationSha256 === validationSha256 &&
      decision.outputSha256 === validation?.output?.sha256 &&
      decision.approvalSnapshotId === approval.snapshot?.id,
  );
  const summary =
    decisionCurrent && decision?.decision === "accepted" ? await optionalJson(summaryPath(projectId)) : undefined;
  const currentStage =
    validateStage.status === "running" ? validateStage : renderStage.status === "running" ? renderStage : undefined;
  const recoverableFailure = new Set(["failed", "interrupted", "stale"]);
  const failedStage = recoverableFailure.has(validateStage.status)
    ? validateStage
    : recoverableFailure.has(renderStage.status)
      ? renderStage
      : undefined;
  const consistency = inspectDeliveryConsistency({ state, outputInfo, validation, validationCurrent });
  const status =
    consistency.status === "conflict"
      ? "conflict"
      : decisionCurrent && decision.decision === "accepted"
        ? "delivered"
        : decisionCurrent && decision.decision === "returned"
          ? "returned"
          : validationCurrent
            ? "awaiting-acceptance"
            : validateStage.status === "running"
              ? "validating"
              : renderStage.status === "running"
                ? "rendering"
                : failedStage
                  ? "failed"
                  : approval.status === "approved"
                    ? "ready"
                    : "waiting-approval";
  const video = validation?.media?.video;
  const audio = validation?.media?.audio;
  const activity = (state.events ?? [])
    .filter((event) => ["delivery-render", "delivery-validate"].includes(event.stage))
    .slice(-8)
    .map(formatActivity);
  const media = await optionalJson(resolve(evidence.paths.workspace, "media-manifest.json"));
  const edl = await optionalJson(resolve(evidence.paths.workspace, "edl.json"));
  const selectedProfile = normalizeDeliveryProfile(evidence.context.manifest.render?.delivery);
  const estimates = media
    ? ["720p", "1080p", "2k", "4k", "source"].flatMap((resolution) =>
        [30, 60, "source"].map((frameRate) => ({
          key: `${resolution}-${frameRate}`,
          profile: { resolution, frameRate },
          estimate: estimateDelivery({
            profile: { resolution, frameRate },
            source: media,
            durationSeconds: Number(edl?.totalDurationS ?? media.durationSeconds ?? 0),
          }),
        })),
      )
    : [];
  return {
    schemaVersion: "1.0",
    projectId,
    status,
    export: { selectedProfile, estimates },
    approval: {
      approved: approval.status === "approved",
      approvedAt: approval.approvedAt,
      reviewEvidenceSha256: approval.reviewEvidenceSha256,
      snapshotId: approval.snapshot?.id,
    },
    progress: {
      currentStage:
        currentStage === renderStage
          ? "delivery-render"
          : currentStage === validateStage
            ? "delivery-validate"
            : undefined,
      startedAt: currentStage?.startedAt,
      lastProgressAt: currentStage?.lastProgressAt,
      elapsedMs: currentStage?.startedAt ? Date.now() - Date.parse(currentStage.startedAt) : undefined,
      outputBytes: workingOutputBytes,
      outputFileName: basename(outputPath),
      activity,
    },
    stages: {
      render: { status: renderStage.status, elapsedMs: renderStage.elapsedMs, failure: renderStage.failure },
      validate: { status: validateStage.status, elapsedMs: validateStage.elapsedMs, failure: validateStage.failure },
    },
    consistency,
    failure: failedStage?.failure,
    canStart:
      approval.status === "approved" &&
      evidence.visualDirectionReport?.animationRenderer?.status !== "candidate-blocked" &&
      !currentStage &&
      !validationCurrent &&
      consistency.status === "consistent" &&
      !(decisionCurrent && decision?.decision === "returned"),
    canCancel: Boolean(currentStage),
    readyForAcceptance: validationCurrent && !(decisionCurrent && decision?.decision === "accepted"),
    validation: validation
      ? {
          status: validation.status,
          generatedAt: validation.generatedAt,
          expected: validation.expected,
          decode: validation.decode,
          findings: validation.findings ?? [],
          output: validation.output,
          media: {
            width: video?.width,
            height: video?.height,
            fps: Number(parseRate(video?.r_frame_rate).toFixed(3)),
            videoCodec: video?.codec_name,
            audioCodec: audio?.codec_name,
            hasAudio: Boolean(audio),
            durationSeconds: validation.media?.durationSeconds,
          },
          validationSha256,
        }
      : undefined,
    video: validationCurrent
      ? {
          url: `/api/projects/${encodeURIComponent(projectId)}/workflow/delivery/video`,
          fileName: basename(outputPath),
          bytes: outputInfo?.size,
        }
      : undefined,
    decision: decisionCurrent ? decision : undefined,
    summary,
    summaryAvailable: Boolean(summary),
    projectStatus: project.project.status,
  };
};

export const assertStudioDeliveryStart = async ({ projectId, confirmation, profile }) => {
  if (confirmation !== "human-delivery-start") throw new Error("开始最终渲染需要明确确认");
  const review = await loadStaticReview(projectId);
  if (!review.available || !review.evidenceValid || !review.approval.approved)
    throw new Error("当前静态审核证据尚未批准或已经过期，请先返回静态审核");
  const evidence = await currentDeliveryEvidence(projectId);
  const approval = evidence.state.stages?.["human-approval"];
  await verifyApprovalSnapshot({ paths: evidence.paths, snapshot: approval?.snapshot });
  if (evidence.visualDirectionReport?.animationRenderer?.status === "candidate-blocked")
    throw new Error("当前动画运动积木仍处于候选审核状态，不能进入最终交付");
  const delivery = await loadStudioDelivery(projectId);
  if (delivery.status === "delivered") throw new Error("当前项目已经完成交付");
  if (delivery.status === "awaiting-acceptance") throw new Error("最终成片已经通过技术验收，请直接进行最终确认");
  if (delivery.status === "returned") throw new Error("当前成片已退回修改，请先完成结构化返修再重新渲染");
  const normalizedProfile = normalizeDeliveryProfile(profile);
  return {
    workflowArgs: [
      "--until",
      "delivery",
      "--delivery-resolution",
      normalizedProfile.resolution,
      "--delivery-frame-rate",
      String(normalizedProfile.frameRate),
    ],
    snapshotId: approval.snapshot.id,
  };
};

const assertCurrentValidatedDelivery = async (projectId) => {
  const evidence = await currentDeliveryEvidence(projectId);
  if (!evidence.validationCurrent) throw new Error("最终成片尚未通过技术验收");
  const actualSha256 = await verifyOutputAgainstReport(evidence);
  const approval = evidence.state.stages?.["human-approval"];
  await verifyApprovalSnapshot({ paths: evidence.paths, snapshot: approval?.snapshot });
  return { ...evidence, actualSha256, approval };
};

export const acceptStudioDelivery = async ({ projectId, confirmation, note = "" }) => {
  if (confirmation !== "human-delivery-accepted") throw new Error("完成交付需要明确确认");
  const evidence = await assertCurrentValidatedDelivery(projectId);
  const previous = await optionalJson(decisionPath(projectId));
  if (
    previous?.decision === "returned" &&
    previous.validationSha256 === evidence.validationSha256 &&
    previous.outputSha256 === evidence.actualSha256
  )
    throw new Error("当前成片已经退回修改，不能在未返修的情况下重新批准");
  const decidedAt = new Date().toISOString();
  const decision = {
    schemaVersion: "1.0",
    kind: "studio-delivery-decision",
    projectId,
    decision: "accepted",
    decidedAt,
    note: String(note).trim().slice(0, 2000),
    approvalSnapshotId: evidence.approval.snapshot.id,
    approvalSnapshotSha256: evidence.approval.snapshot.sha256,
    reviewEvidenceSha256: evidence.approval.reviewEvidenceSha256,
    validationSha256: evidence.validationSha256,
    outputSha256: evidence.actualSha256,
  };
  await writeJsonAtomic(decisionPath(projectId), decision);
  const provider = await optionalJson(evidence.paths.semanticProviderReport);
  const captions = [];
  for (const path of [evidence.paths.captionsSrt, resolve(evidence.paths.workspace, "captions-semantic.json")]) {
    if (path && inside(projectDir(projectId), path) && (await fileExists(path))) captions.push(path);
  }
  const reviewFiles = [];
  for (const path of [evidence.paths.reviewEvidence, evidence.paths.reviewEvidenceSummary]) {
    if (path && inside(projectDir(projectId), path) && (await fileExists(path))) reviewFiles.push(path);
  }
  const summary = {
    schemaVersion: "1.0",
    kind: "studio-delivery-summary",
    projectId,
    completedAt: decidedAt,
    finalVideo: {
      path: projectRelative(projectId, evidence.outputPath),
      bytes: evidence.outputInfo.size,
      sha256: evidence.actualSha256,
    },
    captions: await Promise.all(
      captions.map(async (path) => ({
        path: projectRelative(projectId, path),
        bytes: (await stat(path)).size,
        sha256: await hashFile(path),
      })),
    ),
    approval: {
      snapshotId: evidence.approval.snapshot.id,
      snapshotSha256: evidence.approval.snapshot.sha256,
      reviewEvidenceSha256: evidence.approval.reviewEvidenceSha256,
    },
    validation: {
      path: projectRelative(projectId, evidence.paths.deliveryValidation),
      sha256: evidence.validationSha256,
      status: evidence.validation.status,
      decode: evidence.validation.decode.status,
    },
    reviewPackage: {
      approvalBindingSha256: evidence.approval.reviewEvidenceSha256,
      files: await Promise.all(
        reviewFiles.map(async (path) => ({
          path: projectRelative(projectId, path),
          bytes: (await stat(path)).size,
          sha256: await hashFile(path),
        })),
      ),
    },
    reproducibility: {
      agentId: provider?.agentId ?? provider?.provider,
      model: provider?.generation?.model ?? provider?.model,
      runtimeVersion: provider?.runtimeVersion,
      semanticOutputHash: provider?.outputHash,
    },
    decision,
  };
  await writeJsonAtomic(summaryPath(projectId), summary);
  const project = await loadCreatorProject(projectId);
  project.project.status = "delivered";
  await saveCreatorProject(project);
  return { decision, summary };
};

export const returnStudioDelivery = async ({ projectId, reason }) => {
  const normalizedReason = typeof reason === "string" ? reason.trim() : "";
  if (!normalizedReason) throw new Error("请填写退回修改的具体原因");
  const evidence = await assertCurrentValidatedDelivery(projectId);
  const previous = await optionalJson(decisionPath(projectId));
  if (
    previous?.decision === "accepted" &&
    previous.validationSha256 === evidence.validationSha256 &&
    previous.outputSha256 === evidence.actualSha256
  )
    throw new Error("当前项目已经完成交付，不能直接退回同一份成片");
  const decision = {
    schemaVersion: "1.0",
    kind: "studio-delivery-decision",
    projectId,
    decision: "returned",
    decidedAt: new Date().toISOString(),
    reason: normalizedReason.slice(0, 2000),
    approvalSnapshotId: evidence.approval.snapshot.id,
    approvalSnapshotSha256: evidence.approval.snapshot.sha256,
    reviewEvidenceSha256: evidence.approval.reviewEvidenceSha256,
    validationSha256: evidence.validationSha256,
    outputSha256: evidence.actualSha256,
  };
  await writeJsonAtomic(decisionPath(projectId), decision);
  const project = await loadCreatorProject(projectId);
  project.project.status = "approved";
  await saveCreatorProject(project);
  return decision;
};

export const resolveDeliveryArtifact = async (projectId, target) => {
  const evidence = await currentDeliveryEvidence(projectId);
  if (target === "workspace") return { path: evidence.paths.workspace, directory: true };
  if (target !== "video") throw new Error("不支持的交付产物");
  if (!evidence.validationCurrent) throw new Error("最终成片尚未通过技术验收");
  if (!inside(projectDir(projectId), evidence.outputPath)) throw new Error("交付产物不在当前项目目录中");
  await verifyOutputAgainstReport(evidence);
  return { path: evidence.outputPath, directory: false, size: evidence.outputInfo.size, mediaType: "video/mp4" };
};
