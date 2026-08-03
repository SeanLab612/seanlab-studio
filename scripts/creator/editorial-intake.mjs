import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import {
  editorialQuestionnaire,
  missingEditorialAnswers,
  normalizeEditorialBrief,
} from "../../src/creator-workflow/editorial-brief.ts";
import { createStructuredAgentJsonAdapter } from "../workflow/agent-json-adapter.mjs";
import { loadCreatorProject, projectDir, saveCreatorProject, writeJsonAtomic } from "./project-store.mjs";

const schemaPath = resolve("schemas/editorial-brief-inference.schema.json");

const questionsFor = (category) => {
  const questionnaire = editorialQuestionnaire(category);
  return [...questionnaire.universal, ...questionnaire.categorySpecific];
};

const compact = (value) => String(value ?? "").replace(/\s+/g, "");

export const mergeInferredEditorialAnswers = ({ category, creatorBrief, currentBrief, inference }) => {
  const questions = questionsFor(category);
  const allowed = new Map(questions.map((question) => [question.id, question]));
  const answers = { ...(currentBrief?.answers ?? {}) };
  const accepted = [];
  const ignored = [];
  for (const candidate of inference?.answers ?? []) {
    const question = allowed.get(candidate?.id);
    const answer = typeof candidate?.answer === "string" ? candidate.answer.trim() : "";
    const evidenceQuote = typeof candidate?.evidenceQuote === "string" ? candidate.evidenceQuote.trim() : "";
    if (!question || !answer || !evidenceQuote || !compact(creatorBrief).includes(compact(evidenceQuote))) {
      ignored.push(candidate?.id ?? "unknown");
      continue;
    }
    if (question.options && !question.options.some((option) => option.value === answer)) {
      ignored.push(candidate.id);
      continue;
    }
    if (!answers[candidate.id]) answers[candidate.id] = answer;
    accepted.push({ id: candidate.id, answer, evidenceQuote });
  }
  const editorialBrief = normalizeEditorialBrief(category, {
    version: "1.0",
    status: "draft",
    answers,
  });
  return {
    editorialBrief,
    accepted,
    ignored,
    missing: missingEditorialAnswers(category, editorialBrief),
  };
};

const inferencePrompt = (project, creatorBrief) => {
  const questions = questionsFor(project.brief.category);
  return `你负责把创作者的一段自然语言需求整理成 SeanLab Studio 的写稿方向。严格输出 JSON，不要解释。

规则：
- 只能提取创作者明确说过的内容，不得补写常识、项目事实、使用经历、限制或推荐结论。
- 每个答案都必须附带 creatorBrief 中逐字存在的 evidenceQuote；没有直接原话支持就不要输出该项。
- relationship、project-focus 等选择题的 answer 必须使用题目 options 中的 value。
- “结尾是否需要观众做什么”只有创作者明确提出时才能填写。
- 可以把同一段原话整理成更简洁的答案，但不能改变含义。
- 无法确定的问题留给创作者补充，不要为了填满问卷而猜测。

内容分类：${project.brief.category}
问题定义：${JSON.stringify(questions)}
creatorBrief：
${creatorBrief}`;
};

export const inferCreatorEditorialBrief = async (projectId, { onProgress = () => {} } = {}) => {
  const project = await loadCreatorProject(projectId);
  if (project.authoring.state !== "not-started") throw new Error("口播稿开始生成后不能重新理解创建需求");
  const creatorBrief = project.brief.creatorNotes?.trim() || project.brief.topic.trim();
  if (creatorBrief.length < 20) throw new Error("请先补充更完整的创作需求，再让 Studio 自动理解");
  onProgress({ percent: 15, phase: "brief", message: "正在读取你的完整创作需求" });
  const adapter = createStructuredAgentJsonAdapter({
    config: { provider: project.agent.id, model: project.agent.model, timeoutSeconds: 300, maxRetries: 1 },
    schemaPath,
  });
  onProgress({ percent: 38, phase: "agent", message: `正在由 ${project.agent.id} 提炼写稿方向` });
  const inference = await adapter.completeJson({
    system: "You extract only explicitly supported creator intent into a structured editorial brief.",
    user: inferencePrompt(project, creatorBrief),
  });
  onProgress({ percent: 78, phase: "validation", message: "正在核对每项结论是否有创作者原话支持" });
  const merged = mergeInferredEditorialAnswers({
    category: project.brief.category,
    creatorBrief,
    currentBrief: project.brief.editorialBrief,
    inference,
  });
  project.brief.editorialBrief = { ...merged.editorialBrief, updatedAt: new Date().toISOString() };
  await saveCreatorProject(project);
  const directory = resolve(projectDir(projectId), "authoring");
  await mkdir(directory, { recursive: true });
  await writeJsonAtomic(resolve(directory, "brief-inference.json"), {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    summary: inference.summary,
    accepted: merged.accepted,
    ignored: merged.ignored,
    missing: merged.missing,
    provider: adapter.getLastRunMetadata(),
  });
  onProgress({
    percent: 100,
    phase: "completed",
    message: merged.missing.length
      ? `已自动整理，剩余 ${merged.missing.length} 个关键信息需要确认`
      : "已从完整描述中整理出全部写稿方向",
  });
  return {
    editorialBrief: project.brief.editorialBrief,
    summary: inference.summary,
    acceptedCount: merged.accepted.length,
    missing: merged.missing,
  };
};
