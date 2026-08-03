import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createAnimationAssetPlan, animationAssetTargets } from "./animation-asset-planner.mjs";
import { loadNarration } from "./narration.mjs";
import { loadCreatorProject, projectDir, writeJsonAtomic } from "./project-store.mjs";
import { loadVisualStoryboard, saveVisualStoryboard, validateVisualStoryboard } from "./visual-storyboard.mjs";

const replanningRoot = (projectId) => resolve(projectDir(projectId), "authoring/animation-asset-attempts");
const replanningDraftFile = (projectId) =>
  resolve(projectDir(projectId), "authoring/animation-asset-replan-draft.json");
const attemptDirectory = (projectId, attemptId) => resolve(replanningRoot(projectId), attemptId);
const hashJson = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const validAttemptId = (value) => {
  if (!/^[a-z0-9-]{8,80}$/.test(value ?? "")) throw new Error("Invalid animation asset attempt id");
  return value;
};
const attemptIdFor = (createdAt) => `${createdAt.replace(/[-:.TZ]/g, "").slice(0, 14)}-${randomUUID().slice(0, 8)}`;

const bindingSnapshot = (storyboard) =>
  new Map(
    animationAssetTargets(storyboard).map((target) => [
      target.targetId,
      {
        targetId: target.targetId,
        sectionId: target.sectionId,
        ...(target.beatId ? { beatId: target.beatId } : {}),
        stageId: target.stage.id,
        stageLabel: target.stage.label,
        spokenQuote: target.stage.spokenQuote,
        imageAssetId: target.stage.imageAssetId ?? null,
        imageAssetLabel: target.stage.imageAssetLabel ?? null,
        iconId: target.stage.iconId ?? null,
      },
    ]),
  );

const compareBindings = (beforeStoryboard, afterStoryboard) => {
  const before = bindingSnapshot(beforeStoryboard);
  const after = bindingSnapshot(afterStoryboard);
  return [...after.values()].map((next) => {
    const previous = before.get(next.targetId) ?? {
      targetId: next.targetId,
      imageAssetId: null,
      imageAssetLabel: null,
      iconId: null,
    };
    return {
      targetId: next.targetId,
      sectionId: next.sectionId,
      ...(next.beatId ? { beatId: next.beatId } : {}),
      stageId: next.stageId,
      stageLabel: next.stageLabel,
      spokenQuote: next.spokenQuote,
      changed:
        previous.imageAssetId !== next.imageAssetId ||
        previous.imageAssetLabel !== next.imageAssetLabel ||
        previous.iconId !== next.iconId,
      previous: {
        imageAssetId: previous.imageAssetId,
        imageAssetLabel: previous.imageAssetLabel,
        iconId: previous.iconId,
      },
      proposed: {
        imageAssetId: next.imageAssetId,
        imageAssetLabel: next.imageAssetLabel,
        iconId: next.iconId,
      },
    };
  });
};

const optionalJson = async (path, fallback = null) => {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
};

export const listAnimationAssetReplanningAttempts = async (projectId) => {
  const entries = await readdir(replanningRoot(projectId), { withFileTypes: true }).catch(() => []);
  const attempts = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const directory = attemptDirectory(projectId, entry.name);
        const [metadata, promotion] = await Promise.all([
          optionalJson(resolve(directory, "metadata.json")),
          optionalJson(resolve(directory, "promotion.json")),
        ]);
        return metadata ? { ...metadata, promotedAt: promotion?.confirmedAt ?? null } : null;
      }),
  );
  return attempts.filter(Boolean).sort((left, right) => right.createdAt.localeCompare(left.createdAt));
};

export const loadAnimationAssetReplanning = async (projectId) => ({
  draft: await optionalJson(replanningDraftFile(projectId)),
  attempts: await listAnimationAssetReplanningAttempts(projectId),
});

export const replanAnimationAssets = async (projectId, { adapterFactory, onProgress = () => {} } = {}) => {
  const project = await loadCreatorProject(projectId);
  if (project.authoring.state !== "drafted") throw new Error("只有尚未锁定的分镜稿可以重新规划动画素材");
  const narration = await loadNarration(projectId);
  const currentStoryboard = await loadVisualStoryboard(projectId, narration);
  const targetCount = animationAssetTargets(currentStoryboard).length;
  if (!targetCount) throw new Error("当前分镜没有可重新规划素材的动画阶段");
  onProgress({ percent: 12, phase: "preparing", message: `正在整理 ${targetCount} 个动画阶段` });
  const candidateInput = structuredClone(currentStoryboard);
  const result = await createAnimationAssetPlan({
    project,
    storyboard: candidateInput,
    ...(adapterFactory ? { adapterFactory } : {}),
  });
  const candidateStoryboard = validateVisualStoryboard(result.storyboard, narration);
  const changes = compareBindings(currentStoryboard, candidateStoryboard);
  const createdAt = new Date().toISOString();
  const attemptId = attemptIdFor(createdAt);
  const directory = attemptDirectory(projectId, attemptId);
  const baseStoryboardSha256 = hashJson(currentStoryboard);
  const candidateStoryboardSha256 = hashJson(candidateStoryboard);
  const metadata = {
    schemaVersion: "1.0",
    attemptId,
    status: "suggested",
    createdAt,
    agent: { id: project.agent.id, model: project.agent.model ?? null, fallback: project.agent.fallback },
    targetCount,
    changedCount: changes.filter((change) => change.changed).length,
    baseStoryboardSha256,
    candidateStoryboardSha256,
  };
  onProgress({ percent: 78, phase: "recording", message: "正在保存候选方案和差异证据" });
  await mkdir(replanningRoot(projectId), { recursive: true });
  await mkdir(directory, { recursive: false });
  await Promise.all([
    writeJsonAtomic(resolve(directory, "base-storyboard.json"), currentStoryboard),
    writeJsonAtomic(resolve(directory, "candidate-storyboard.json"), candidateStoryboard),
    writeJsonAtomic(resolve(directory, "provider-report.json"), result.report),
    writeJsonAtomic(resolve(directory, "diff.json"), { schemaVersion: "1.0", changes }),
    writeJsonAtomic(resolve(directory, "metadata.json"), metadata),
  ]);
  const draft = { ...metadata, changes };
  await writeJsonAtomic(replanningDraftFile(projectId), draft);
  onProgress({ percent: 100, phase: "review", message: "候选方案已生成，等待人工确认" });
  return draft;
};

export const confirmAnimationAssetReplan = async ({
  projectId,
  attemptId: rawAttemptId,
  candidateStoryboardSha256,
  confirmation,
}) => {
  if (confirmation !== "human-confirm-animation-asset-replan") throw new Error("动画素材方案必须经过人工确认");
  const attemptId = validAttemptId(rawAttemptId);
  const project = await loadCreatorProject(projectId);
  if (project.authoring.state !== "drafted") throw new Error("只有尚未锁定的分镜稿可以确认动画素材方案");
  const narration = await loadNarration(projectId);
  const draft = await optionalJson(replanningDraftFile(projectId));
  if (!draft || draft.attemptId !== attemptId || draft.status !== "suggested")
    throw new Error("当前没有这次等待确认的动画素材方案");
  if (draft.candidateStoryboardSha256 !== candidateStoryboardSha256)
    throw new Error("动画素材候选方案已变化，请重新检查");
  const directory = attemptDirectory(projectId, attemptId);
  const candidateStoryboard = validateVisualStoryboard(
    await optionalJson(resolve(directory, "candidate-storyboard.json")),
    narration,
  );
  if (hashJson(candidateStoryboard) !== draft.candidateStoryboardSha256) throw new Error("动画素材候选方案校验失败");
  const currentStoryboard = await loadVisualStoryboard(projectId, narration);
  const currentSha256 = hashJson(currentStoryboard);
  const alreadyApplied = currentSha256 === draft.candidateStoryboardSha256;
  if (!alreadyApplied && currentSha256 !== draft.baseStoryboardSha256)
    throw new Error("当前分镜在候选方案生成后已经修改，请重新规划动画素材");
  const confirmedAt = new Date().toISOString();
  try {
    await writeFile(
      resolve(directory, "promotion.json"),
      `${JSON.stringify(
        {
          schemaVersion: "1.0",
          attemptId,
          confirmation,
          candidateStoryboardSha256,
          confirmedAt,
        },
        null,
        2,
      )}\n`,
      { flag: "wx" },
    );
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
  }
  const storyboard = alreadyApplied
    ? currentStoryboard
    : await saveVisualStoryboard(projectId, candidateStoryboard, narration);
  const confirmedDraft = { ...draft, status: "confirmed", confirmedAt };
  await writeJsonAtomic(replanningDraftFile(projectId), confirmedDraft);
  return { storyboard, draft: confirmedDraft };
};
