import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { dirname, extname, isAbsolute, relative, resolve, sep } from "node:path";
import { verifyReviewEvidence } from "../operations/review-evidence.mjs";
import { createStages } from "../workflow/stages.mjs";
import { fileExists, signatureFor } from "../workflow/state.mjs";
import { creatorRoot } from "./project-store.mjs";
import { workflowContextForCreator } from "./studio-workflow.mjs";

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const canonicalHash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const recordsPath = (projectId) => resolve(creatorRoot, projectId, "review", "static-review.json");
const stageNames = ["review-evidence", "visual-qa", "visual-pacing-review", "regression-fixtures", "agent-review"];
const phaseLabels = {
  entry: "进入画面",
  transition: "内容切换",
  stable: "稳定展示",
  "exit-risk": "退出前检查",
  "speaker-only": "纯口播",
  "screen-entry": "录屏进入",
  "screen-transition": "录屏切换",
  "screen-stable": "录屏稳定展示",
  "screen-exit-risk": "录屏退出前",
  "image-entry": "图片进入",
  "image-transition": "图片切换",
  "image-stable": "图片稳定展示",
  "image-exit-risk": "图片退出前",
  "animation-entry": "动画进入",
  "animation-build": "动画展开",
  "animation-stable": "动画稳定展示",
  "animation-exit-risk": "动画退出前",
  "speaker-return": "返回人物口播",
  "title-entry": "标题进入",
  "title-stable": "标题稳定展示",
  "title-exit": "标题退出",
};
const categoryLabels = {
  "semantic-component": "视觉组件",
  "authored-screen": "录屏",
  "authored-image": "图片",
  animation: "动画",
  "title-continuity": "总结标题",
  "speaker-only": "纯口播",
};
const severityLabels = { error: "必须处理", warning: "建议检查", info: "提示" };
const ruleLabels = {
  "font-size": "文字是否清晰",
  "crop-loss": "内容是否被裁切",
  "face-collision": "画面是否遮挡人物",
  "subtitle-clearance": "画面是否遮挡字幕",
  "source-readability": "录屏和图片是否看得清",
  "scene-alignment": "画面与口播是否对齐",
  "pip-safe-area": "画中画是否完整",
  regression: "是否偏离已批准风格",
};

const hashFile = (path) =>
  new Promise((done, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(path);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => done(hash.digest("hex")));
  });

const inside = (root, path) => {
  const value = relative(root, path);
  return value !== ".." && !value.startsWith(`..${sep}`) && !value.startsWith(sep);
};

const evidenceEnvelopeValid = (evidence, workspace) => {
  if (evidence?.schemaVersion !== "1.0" || evidence?.kind !== "review-evidence" || !Array.isArray(evidence.artifacts))
    return false;
  if (
    evidence.artifacts.some(
      (artifact) =>
        typeof artifact.path !== "string" ||
        !inside(workspace, resolve(workspace, artifact.path)) ||
        typeof artifact.sha256 !== "string",
    )
  )
    return false;
  const binding = {
    schemaVersion: evidence.schemaVersion,
    projectId: evidence.projectId,
    reviewMode: evidence.reviewMode,
    qaStatus: evidence.qaStatus,
    qaReportSha256: evidence.qaReportSha256,
    artifacts: evidence.artifacts,
  };
  return canonicalHash(binding) === evidence.approvalBindingSha256;
};

const optionalJson = async (path, fallback = undefined) => {
  try {
    return await readJson(path);
  } catch {
    return fallback;
  }
};

const loadRecords = async (projectId) =>
  optionalJson(recordsPath(projectId), { schemaVersion: "1.0", projectId, attempts: {} });

const saveRecords = async (projectId, value) => {
  const path = recordsPath(projectId);
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporary, path);
  return value;
};

const attemptFor = (records, binding) => {
  records.attempts ??= {};
  records.attempts[binding] ??= {
    approvalBindingSha256: binding,
    createdAt: new Date().toISOString(),
    notes: [],
  };
  return records.attempts[binding];
};

const artifactIdFor = (artifact, index) => {
  if (artifact.kind === "contact-sheet") return "contact-sheet";
  if (artifact.kind === "title-continuity-contact-sheet") return "title-contact-sheet";
  if (artifact.kind === "review-video") return "review-video";
  if (artifact.kind === "visual-pacing-review-video") return "visual-pacing-review-video";
  if (artifact.kind === "motion-risk-review-video") return "motion-risk-review-video";
  if (artifact.kind === "brand-bumper-preview") return "brand-bumper-preview";
  if (artifact.kind === "brand-transition-preview") return "brand-transition-preview";
  if (artifact.kind === "media-transition-entry-preview") return "media-transition-entry-preview";
  if (artifact.kind === "media-transition-exit-preview") return "media-transition-exit-preview";
  if (artifact.kind === "risk-frame") return `frame-${String(index + 1).padStart(4, "0")}`;
  return undefined;
};

const chapterForFrame = (frame, chapters, decisions, titleCues, scenes) => {
  const decision = decisions.find((item) => item.candidateId === frame.cueId);
  if (decision?.chapterId) return decision.chapterId;
  const scene = scenes.find((item) => item.id === frame.cueId);
  const title = titleCues.find((item) => item.id === frame.cueId);
  const cue = Number(scene?.startCue ?? title?.sourceStartCue ?? frame.cueIndex);
  return chapters.find((item) => cue >= item.startCue && cue <= item.endCue)?.id;
};

const publicFinding = (finding) => ({
  ...finding,
  severityLabel: severityLabels[finding.severity] ?? "检查项",
  ruleLabel: ruleLabels[finding.rule] ?? "画面检查",
});

const buildRegistry = ({ evidence, workspace, framesManifest }) => {
  const frameByPath = new Map(
    (framesManifest?.frames ?? []).map((frame) => [
      relative(workspace, resolve(frame.file)).split(sep).join("/"),
      frame,
    ]),
  );
  const registry = new Map();
  let frameIndex = 0;
  for (const artifact of evidence.artifacts ?? []) {
    const id = artifactIdFor(artifact, frameIndex);
    if (!id) continue;
    if (artifact.kind === "risk-frame") frameIndex += 1;
    const path = resolve(workspace, artifact.path);
    if (!inside(workspace, path)) continue;
    registry.set(id, {
      id,
      kind: artifact.kind,
      path,
      bytes: artifact.bytes,
      sha256: artifact.sha256,
      mediaType: extname(path).toLowerCase() === ".mp4" ? "video/mp4" : "image/png",
      frame: frameByPath.get(artifact.path),
    });
  }
  return registry;
};

const evidenceAvailability = async (paths) => {
  if (!(await fileExists(paths.reviewEvidence))) return { available: false, reason: "静态审核资料尚未生成" };
  try {
    const evidence = await readJson(paths.reviewEvidence);
    if (!evidenceEnvelopeValid(evidence, paths.workspace))
      return { available: false, reason: "静态审核资料结构无效，请重新生成" };
    return { available: true, evidence };
  } catch {
    return { available: false, reason: "静态审核资料无法读取，请重新生成" };
  }
};

export const loadStaticReview = async (projectId) => {
  const { context } = await workflowContextForCreator(projectId);
  const { paths, manifest } = context;
  const availability = await evidenceAvailability(paths);
  if (!availability.available) return { schemaVersion: "1.0", available: false, reason: availability.reason };
  const state = await optionalJson(paths.state, { stages: {} });
  const stageStatus = Object.fromEntries(stageNames.map((name) => [name, state.stages?.[name]?.status ?? "pending"]));
  const stageDefinitions = new Map(createStages(context).map((stage) => [stage.name, stage]));
  const stageSignaturesCurrent = await Promise.all(
    stageNames.map(async (name) => {
      const definition = stageDefinitions.get(name);
      const recorded = state.stages?.[name]?.outputSignature;
      if (!definition || !recorded) return false;
      try {
        return (await signatureFor(definition.outputs)) === recorded;
      } catch {
        return false;
      }
    }),
  );
  const stagesCurrent =
    stageNames.every((name) => stageStatus[name] === "succeeded") && stageSignaturesCurrent.every(Boolean);
  let evidence = availability.evidence;
  let evidenceValid = false;
  let staleReason;
  try {
    evidence = await verifyReviewEvidence({ evidencePath: paths.reviewEvidence, workspace: paths.workspace });
    evidenceValid = stagesCurrent;
    if (!stagesCurrent) staleReason = "上游画面或审核资料已经变化，请重新生成静态审核图后再批准。";
  } catch {
    staleReason = "审核图片或报告在生成后发生了变化，请重新生成静态审核资料。";
    if (!stagesCurrent) staleReason = "上游画面或审核资料已经变化，请重新生成静态审核图后再批准。";
  }
  const artifactByKind = (kind) => evidence.artifacts?.find((item) => item.kind === kind);
  const framesManifest = artifactByKind("frames-manifest")
    ? await optionalJson(resolve(paths.workspace, artifactByKind("frames-manifest").path), { frames: [] })
    : { frames: [] };
  const qaReport = artifactByKind("qa-report")
    ? await optionalJson(resolve(paths.workspace, artifactByKind("qa-report").path), {
        status: "failed",
        findings: [],
        summary: {},
      })
    : { status: "failed", findings: [], summary: {} };
  const directionPlan = artifactByKind("visual-direction-plan")
    ? await optionalJson(resolve(paths.workspace, artifactByKind("visual-direction-plan").path), {})
    : {};
  const directionReport = artifactByKind("visual-direction-report")
    ? await optionalJson(resolve(paths.workspace, artifactByKind("visual-direction-report").path), {})
    : {};
  const imageMetrics = artifactByKind("image-metrics")
    ? await optionalJson(resolve(paths.workspace, artifactByKind("image-metrics").path), { frames: [] })
    : { frames: [] };
  const scenes = artifactByKind("resolved-scene-timeline")
    ? await optionalJson(resolve(paths.workspace, artifactByKind("resolved-scene-timeline").path), {})
    : {};
  const terminology = artifactByKind("terminology-review")
    ? await optionalJson(resolve(paths.workspace, artifactByKind("terminology-review").path), {})
    : {};
  const semanticProvider = artifactByKind("semantic-provider-report")
    ? await optionalJson(resolve(paths.workspace, artifactByKind("semantic-provider-report").path), {})
    : {};
  const regression = await optionalJson(paths.regressionReport, {});
  const findings = (qaReport.findings ?? []).map(publicFinding);
  const measuredFrames = (imageMetrics.frames ?? []).filter((item) => !item.missing);
  const errorFindingIds = findings.filter((item) => item.severity === "error").map((item) => item.id);
  const registry = buildRegistry({ evidence, workspace: paths.workspace, framesManifest });
  const frameArtifacts = [...registry.values()].filter((item) => item.kind === "risk-frame");
  const chapters = directionPlan.chapters ?? [];
  const decisions = directionPlan.decisions ?? [];
  const frames = frameArtifacts.map((artifact) => {
    const frame = artifact.frame ?? {};
    return {
      id: artifact.id,
      url: `/api/projects/${encodeURIComponent(projectId)}/workflow/review-artifacts/${artifact.id}`,
      cueIndex: frame.cueIndex,
      cueId: frame.cueId,
      componentId: frame.componentId,
      layoutId: frame.layoutId,
      phase: frame.phase,
      phaseLabel: phaseLabels[frame.phase] ?? "审核画面",
      timeSeconds: frame.timeSeconds,
      frame: frame.frame,
      visualCategory: frame.visualCategory,
      categoryLabel: categoryLabels[frame.visualCategory] ?? "审核画面",
      chapterId: chapterForFrame(frame, chapters, decisions, directionPlan.titleCues ?? [], scenes.scenes ?? []),
      findingIds: findings
        .filter((item) => {
          if (!item.screenshot) return false;
          const findingPath = isAbsolute(item.screenshot)
            ? resolve(item.screenshot)
            : resolve(paths.workspace, item.screenshot);
          return findingPath === artifact.path;
        })
        .map((item) => item.id),
    };
  });
  const records = await loadRecords(projectId);
  const attempt = records.attempts?.[evidence.approvalBindingSha256];
  const approved = state.stages?.["human-approval"]?.status === "approved";
  const approvalBindingMatches =
    approved && state.stages?.["human-approval"]?.reviewEvidenceSha256 === evidence.approvalBindingSha256;
  const approvalMatches = approvalBindingMatches && evidenceValid;
  return {
    schemaVersion: "1.0",
    available: true,
    projectId: manifest.project.id,
    reviewMode: evidence.reviewMode,
    generatedAt: evidence.generatedAt,
    provenance: {
      status: evidenceValid ? "current" : "historical",
      evidenceGeneratedAt: evidence.generatedAt,
      agentId: semanticProvider.agentId ?? semanticProvider.provider ?? manifest.agent?.id ?? "unknown",
      provider: semanticProvider.provider ?? semanticProvider.agentId ?? manifest.providers?.semanticPlanning?.provider,
      model: semanticProvider.model ?? semanticProvider.generation?.model,
      semanticGeneratedAt: semanticProvider.generatedAt,
      plannedSegmentCount: semanticProvider.plannedSegmentCount,
      captionCount: semanticProvider.captionCount,
    },
    approvalBindingSha256: evidence.approvalBindingSha256,
    evidenceValid,
    staleReason,
    stageStatus,
    approval: {
      ready: evidenceValid && !approved && attempt?.decision !== "rejected",
      approved: approvalMatches,
      status: approvalMatches
        ? "approved"
        : approved
          ? "stale"
          : attempt?.decision === "rejected"
            ? "rejected"
            : evidenceValid
              ? "pending"
              : "stale",
      approvedAt: approvalMatches ? state.stages?.["human-approval"]?.approvedAt : undefined,
      blockingFindingIds: errorFindingIds,
      waiverRequired: errorFindingIds.length > 0,
    },
    summary: {
      ...evidence.summary,
      frameCount: frames.length,
      chapterCount: chapters.length,
      selectedCount:
        directionReport.summary?.selectedCount ?? decisions.filter((item) => item.action === "select").length,
      skippedCount: directionReport.summary?.skippedCount ?? decisions.filter((item) => item.action === "skip").length,
      visualCoverageRatio: directionReport.summary?.visualCoverageRatio ?? 0,
      visualsPerMinute: directionReport.summary?.visualsPerMinute ?? 0,
      authoredScenes: scenes.summary?.authored ?? scenes.scenes?.length ?? 0,
      resolvedScenes: scenes.summary?.resolved ?? 0,
      unresolvedScenes: scenes.summary?.requiredUnresolved ?? scenes.unresolved?.length ?? 0,
    },
    chapters,
    direction: {
      decisions,
      titleCues: directionPlan.titleCues ?? [],
      importanceUsage: directionReport.importanceUsage ?? {},
      componentUsage: directionReport.componentUsage ?? {},
      candidateOutcomes: directionReport.candidateOutcomes ?? null,
    },
    qa: {
      status: qaReport.status,
      summary: qaReport.summary ?? {},
      findings,
      terminology: {
        entryCount: terminology.entryCount ?? 0,
        projectOverrideCount: terminology.projectOverrideCount ?? 0,
        domains: terminology.domains ?? [],
      },
      regression: { status: regression.status ?? "unknown", findings: regression.findings ?? [] },
      sceneAlignment: scenes.summary ?? {},
      imageMetrics: {
        checked: imageMetrics.frames?.length ?? 0,
        missing: (imageMetrics.frames ?? []).filter((item) => item.missing).length,
        minimumSharpness: measuredFrames.length ? Math.min(...measuredFrames.map((item) => item.laplacianVariance)) : 0,
      },
    },
    frames,
    artifacts: {
      contactSheet: registry.has("contact-sheet")
        ? `/api/projects/${encodeURIComponent(projectId)}/workflow/review-artifacts/contact-sheet`
        : undefined,
      titleContactSheet: registry.has("title-contact-sheet")
        ? `/api/projects/${encodeURIComponent(projectId)}/workflow/review-artifacts/title-contact-sheet`
        : undefined,
      reviewVideo: registry.has("review-video")
        ? `/api/projects/${encodeURIComponent(projectId)}/workflow/review-artifacts/review-video`
        : undefined,
      visualPacingReview: registry.has("visual-pacing-review-video")
        ? `/api/projects/${encodeURIComponent(projectId)}/workflow/review-artifacts/visual-pacing-review-video`
        : undefined,
      motionRiskReview: registry.has("motion-risk-review-video")
        ? `/api/projects/${encodeURIComponent(projectId)}/workflow/review-artifacts/motion-risk-review-video`
        : undefined,
      mediaTransitionEntry: registry.has("media-transition-entry-preview")
        ? `/api/projects/${encodeURIComponent(projectId)}/workflow/review-artifacts/media-transition-entry-preview`
        : undefined,
      mediaTransitionExit: registry.has("media-transition-exit-preview")
        ? `/api/projects/${encodeURIComponent(projectId)}/workflow/review-artifacts/media-transition-exit-preview`
        : undefined,
    },
    notes: attempt?.notes ?? [],
    decision: attempt?.decision
      ? { decision: attempt.decision, reason: attempt.reason, recordedAt: attempt.recordedAt }
      : undefined,
  };
};

export const resolveStaticReviewArtifact = async (projectId, artifactId) => {
  if (typeof artifactId !== "string" || !/^[a-z0-9-]{3,40}$/.test(artifactId)) throw new Error("审核图片标识无效");
  const { context } = await workflowContextForCreator(projectId);
  const evidence = await readJson(context.paths.reviewEvidence);
  if (!evidenceEnvelopeValid(evidence, context.paths.workspace)) throw new Error("静态审核证据结构无效，请重新生成");
  const manifestArtifact = evidence.artifacts.find((item) => item.kind === "frames-manifest");
  const framesManifest = manifestArtifact
    ? await readJson(resolve(context.paths.workspace, manifestArtifact.path))
    : { frames: [] };
  const registry = buildRegistry({ evidence, workspace: context.paths.workspace, framesManifest });
  const artifact = registry.get(artifactId);
  if (!artifact) throw new Error("审核图片不存在或不属于当前证据包");
  const info = await stat(artifact.path);
  if (!info.isFile() || info.size !== artifact.bytes || (await hashFile(artifact.path)) !== artifact.sha256)
    throw new Error("审核图片在生成后发生了变化，请刷新审核资料");
  return { ...artifact, size: info.size };
};

const assertCurrentReview = async ({ projectId, approvalBindingSha256 }) => {
  if (typeof approvalBindingSha256 !== "string" || !/^[a-f0-9]{64}$/.test(approvalBindingSha256))
    throw new Error("缺少有效的静态审核版本标识");
  const review = await loadStaticReview(projectId);
  if (!review.available || review.approvalBindingSha256 !== approvalBindingSha256)
    throw new Error("静态审核资料已经变化，请刷新后重新审核");
  if (!review.evidenceValid) throw new Error(review.staleReason ?? "静态审核资料已经过期");
  return review;
};

export const addStaticReviewNote = async ({ projectId, approvalBindingSha256, artifactId, cueId, text }) => {
  const review = await assertCurrentReview({ projectId, approvalBindingSha256 });
  if (review.approval.approved) throw new Error("当前静态审核版本已经批准，不能再追加意见");
  const normalized = typeof text === "string" ? text.trim() : "";
  if (!normalized) throw new Error("请填写审核意见");
  if (normalized.length > 1000) throw new Error("单条审核意见不能超过 1000 个字");
  if (artifactId && !review.frames.some((item) => item.id === artifactId))
    throw new Error("审核画面已经变化，请刷新后重试");
  const records = await loadRecords(projectId);
  const attempt = attemptFor(records, approvalBindingSha256);
  const note = {
    id: `note-${randomUUID().slice(0, 8)}`,
    ...(artifactId ? { artifactId } : {}),
    ...(cueId ? { cueId } : {}),
    text: normalized,
    createdAt: new Date().toISOString(),
  };
  attempt.notes.push(note);
  await saveRecords(projectId, records);
  return note;
};

export const rejectStaticReview = async ({ projectId, approvalBindingSha256, reason }) => {
  const review = await assertCurrentReview({ projectId, approvalBindingSha256 });
  if (review.approval.approved) throw new Error("当前静态审核版本已经批准，不能再驳回");
  const normalized = typeof reason === "string" ? reason.trim() : "";
  if (!normalized) throw new Error("请填写驳回原因");
  if (normalized.length > 2000) throw new Error("驳回原因不能超过 2000 个字");
  const records = await loadRecords(projectId);
  const attempt = attemptFor(records, approvalBindingSha256);
  Object.assign(attempt, { decision: "rejected", reason: normalized, recordedAt: new Date().toISOString() });
  await saveRecords(projectId, records);
  return { decision: attempt.decision, reason: attempt.reason, recordedAt: attempt.recordedAt };
};

export const staticReviewApprovalArgs = ({ blockingFindingIds = [], selectedFindingIds = [], waiverReason = "" }) => {
  const blocking = [...new Set(blockingFindingIds)].sort();
  const selected = [...new Set(selectedFindingIds)].sort();
  if (blocking.length) {
    if (JSON.stringify(blocking) !== JSON.stringify(selected))
      throw new Error("必须逐项选择当前所有阻断问题，才能进行有条件批准");
    if (typeof waiverReason !== "string" || !waiverReason.trim()) throw new Error("请填写接受这些问题的具体原因");
  }
  return ["--approve", ...(blocking.length ? ["--waive-qa", `${blocking.join(", ")}：${waiverReason.trim()}`] : [])];
};

export const assertStaticReviewApproval = async ({
  projectId,
  approvalBindingSha256,
  confirmation,
  findingIds = [],
  waiverReason = "",
}) => {
  if (confirmation !== "human-review-approved") throw new Error("请先确认已经完成全部静态画面审核");
  const review = await assertCurrentReview({ projectId, approvalBindingSha256 });
  if (review.approval.approved) throw new Error("当前静态审核版本已经批准");
  if (review.decision?.decision === "rejected") throw new Error("当前版本已被驳回，请重新生成静态审核资料后再批准");
  const workflowArgs = staticReviewApprovalArgs({
    blockingFindingIds: review.approval.blockingFindingIds,
    selectedFindingIds: findingIds,
    waiverReason,
  });
  return {
    review,
    workflowArgs,
  };
};
