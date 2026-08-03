import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createStructuredAgentJsonAdapter } from "../workflow/agent-json-adapter.mjs";
import { listNarrationAttempts } from "./authoring-history.mjs";
import { loadCreatorProject, projectDir, creatorRoot, writeJsonAtomic } from "./project-store.mjs";

const schemaPath = resolve("schemas/writing-learning-candidate.schema.json");
const profilePath = () => resolve(creatorRoot, ".creator-profile", "writing-lessons.json");
const candidatePath = (projectId) => resolve(projectDir(projectId), "authoring/writing-learning.json");

export const WRITING_LESSON_CATALOG = {
  "problem-first-hook": "开场立刻用具体问题、变化或结果建立观看理由，不先罗列功能。",
  "short-spoken-sentences": "优先使用适合一口气说完的短句，并用长短句变化保持口播节奏。",
  "first-person-when-supported": "创作者已明确提供真实经历时，用第一人称表达；没有依据时绝不代写经历。",
  "workflow-before-implementation": "介绍项目或工具时，优先讲真实使用流程和可见结果，再决定是否需要解释内部实现。",
  "minimal-engineering-jargon": "非必要不使用工程术语；必须出现时，用观众能理解的实际作用解释。",
  "concrete-example-over-label": "用具体动作、场景和结果解释能力，减少抽象功能标签。",
  "avoid-feature-catalog": "不要把资料目录或功能列表直接写成口播结构，用一个核心判断组织取舍。",
  "material-order-alignment": "存在连续演示素材时，正文按观众能理解的操作顺序推进，并让每段口播对应明确画面。",
  "limitation-before-conclusion": "资料包含限制或未知项时，在结论前主动说明，不把边界藏在结尾之后。",
  "next-episode-hook": "创作者明确要求系列内容时，在结尾留下具体的下一期内容钩子。",
  "creator-specified-cta-only": "只有创作者明确提出时才加入点赞、收藏、关注或其他行动引导。",
};

const emptyProfile = () => ({ schemaVersion: "1.0", updatedAt: null, lessons: [] });

export const loadCreatorWritingProfile = async () => {
  try {
    const value = JSON.parse(await readFile(profilePath(), "utf8"));
    if (value?.schemaVersion !== "1.0" || !Array.isArray(value.lessons)) return emptyProfile();
    return {
      schemaVersion: "1.0",
      updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : null,
      lessons: value.lessons.filter((item) => WRITING_LESSON_CATALOG[item.id]),
    };
  } catch {
    return emptyProfile();
  }
};

export const writingGuidanceFor = async (_category) => {
  const profile = await loadCreatorWritingProfile();
  return profile.lessons
    .filter((lesson) => lesson.enabled !== false)
    .map((lesson) => ({ id: lesson.id, guidance: WRITING_LESSON_CATALOG[lesson.id] }));
};

export const loadWritingLearning = async (projectId) => {
  try {
    return JSON.parse(await readFile(candidatePath(projectId), "utf8"));
  } catch {
    return null;
  }
};

const loadAttemptNarration = async (projectId, attemptId) =>
  JSON.parse(
    await readFile(resolve(projectDir(projectId), "authoring/attempts", attemptId, "narration-package.json"), "utf8"),
  );

export const suggestWritingLessons = async (projectId, { onProgress = () => {} } = {}) => {
  const project = await loadCreatorProject(projectId);
  if (project.authoring.state !== "locked") throw new Error("只有已审核并锁定的口播稿可以提炼创作经验");
  const attempts = (await listNarrationAttempts(projectId))
    .filter((attempt) => attempt.status === "succeeded" && attempt.outputSha256)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  if (!attempts.length) throw new Error("没有可用于总结的写稿版本");
  const first = await loadAttemptNarration(projectId, attempts[0].attemptId);
  const final = await loadAttemptNarration(projectId, project.authoring.lockedAttemptId);
  const instructions = attempts.map((attempt) => attempt.instructions).filter(Boolean);
  onProgress({ percent: 22, phase: "history", message: `正在比较 ${attempts.length} 个写稿版本` });
  const adapter = createStructuredAgentJsonAdapter({
    config: { provider: project.agent.id, model: project.agent.model, timeoutSeconds: 300, maxRetries: 1 },
    schemaPath,
  });
  onProgress({ percent: 45, phase: "agent", message: `正在由 ${project.agent.id} 总结可复用的写稿经验` });
  const output = await adapter.completeJson({
    system: "You identify reusable creator writing preferences without carrying episode facts into future projects.",
    user: `比较初稿、最终审核稿和修改意见，只从允许的 lesson id 中选择真正有证据的长期写作偏好。严格输出 JSON。

规则：
- 只总结表达方式、结构和取舍，不总结项目名称、人物、公司、数据、功能或本期观点。
- 没有明显修改证据时可以返回空 lessonIds。
- summary 只说明这次主要改变了哪些写作方法，不复述本期事实。
- 最多选择 6 项。

允许的经验：
${JSON.stringify(WRITING_LESSON_CATALOG)}

内容分类：${project.brief.category}
修改意见：${JSON.stringify(instructions)}
初稿：${first.fullScript.slice(0, 30000)}
最终审核稿：${final.fullScript.slice(0, 30000)}`,
  });
  const lessonIds = [...new Set(output.lessonIds)].filter((id) => WRITING_LESSON_CATALOG[id]).slice(0, 6);
  const candidate = {
    schemaVersion: "1.0",
    projectId,
    category: project.brief.category,
    generatedAt: new Date().toISOString(),
    summary: output.summary,
    status: "suggested",
    lessonIds,
    lessons: lessonIds.map((id) => ({ id, guidance: WRITING_LESSON_CATALOG[id] })),
    evidence: {
      firstAttemptId: attempts[0].attemptId,
      lockedAttemptId: project.authoring.lockedAttemptId,
      comparedAttempts: attempts.length,
    },
  };
  await writeJsonAtomic(candidatePath(projectId), candidate);
  onProgress({
    percent: 100,
    phase: "completed",
    message: lessonIds.length
      ? `已提炼 ${lessonIds.length} 条候选经验，等待你确认`
      : "本期没有发现需要新增的长期写稿经验",
  });
  return candidate;
};

export const acceptWritingLessons = async (projectId, lessonIds) => {
  const candidate = await loadWritingLearning(projectId);
  if (candidate?.status !== "suggested") throw new Error("当前没有等待确认的写稿经验");
  const acceptedIds = [...new Set(Array.isArray(lessonIds) ? lessonIds : [])].filter((id) =>
    candidate.lessonIds.includes(id),
  );
  const profile = await loadCreatorWritingProfile();
  const now = new Date().toISOString();
  for (const id of acceptedIds) {
    const existing = profile.lessons.find((lesson) => lesson.id === id);
    if (existing) {
      existing.acceptedCount = Number(existing.acceptedCount ?? 0) + 1;
      existing.lastAcceptedAt = now;
      existing.categories = [...new Set([...(existing.categories ?? []), candidate.category])];
      existing.sourceProjectIds = [...new Set([...(existing.sourceProjectIds ?? []), projectId])].slice(-20);
      existing.enabled = true;
    } else {
      profile.lessons.push({
        id,
        guidance: WRITING_LESSON_CATALOG[id],
        acceptedCount: 1,
        firstAcceptedAt: now,
        lastAcceptedAt: now,
        categories: [candidate.category],
        sourceProjectIds: [projectId],
        enabled: true,
      });
    }
  }
  profile.updatedAt = now;
  await mkdir(resolve(creatorRoot, ".creator-profile"), { recursive: true });
  await writeJsonAtomic(profilePath(), profile);
  const updated = { ...candidate, status: "accepted", acceptedAt: now, acceptedLessonIds: acceptedIds };
  await writeJsonAtomic(candidatePath(projectId), updated);
  return { candidate: updated, profile };
};
