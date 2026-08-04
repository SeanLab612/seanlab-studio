import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { evaluateSourceGrounding, narrationClaimText } from "../../src/agents/conformance.ts";
import { composeNarrationScript, validateNarrationScriptPackage } from "../../src/creator-workflow/contract.ts";
import { editorialBriefPrompt, missingEditorialAnswers } from "../../src/creator-workflow/editorial-brief.ts";
import { narrationVisualFormsPrompt } from "../../src/creator-workflow/visual-authoring.ts";
import { createStructuredAgentJsonAdapter } from "../workflow/agent-json-adapter.mjs";
import { listNarrationAttempts, recordNarrationAttempt } from "./authoring-history.mjs";
import { assertConfirmedMaterialUnderstanding, loadMaterialUnderstanding } from "./material-understanding.mjs";
import { loadCreatorProject, projectDir, saveCreatorProject, writeJsonAtomic } from "./project-store.mjs";
import { resolveAuthoringSources } from "./source-context.mjs";
import { seedVisualStoryboard } from "./visual-storyboard.mjs";
import { writingGuidanceFor } from "./writing-profile.mjs";

const schemaPath = resolve("schemas/narration-script-package.schema.json");
const categoryGuidance = {
  "github-project":
    "以创作者填写的真实关系和主要角度为中心，从实际问题进入，用已验证的过程和结果说明价值，再讲限制、适用与不适用人群。",
  tutorial: "围绕用户目标，按可见的动作与结果组织，再讲常见失败和完成检查；录屏段必须写清画面动作。",
  "news-analysis": "按事件、核实事实、因果、影响、未知项和个人判断组织，不能把预测写成事实。",
  "tool-review": "从真实问题进入，用代表性工作流和结果证据说明价值，再讲限制和适用人群。",
  "model-review": "先提出测试问题，在同一口径下讲能力、成本和速度，保留失败案例；不得用一次跑分代表整体可用性。",
  "biopharma-extra": "术语严谨，避免医疗建议，区分科研、临床和商业判断。",
  other: "用一个清晰问题或判断统领全文，以证据模块推进，避免模板腔、资料罗列和空泛过渡。",
};

export const NARRATION_EDITORIAL_METHOD_VERSION = "1.0";

const editorialMethodPrompt = `编辑方法（版本 ${NARRATION_EDITORIAL_METHOD_VERSION}）：
- 写正文前先在内部确定一个核心问题或判断：观众为什么现在要听、这篇稿只解决什么、现有资料能证明到哪里。不要输出这份内部提纲。
- opening 和 overview 一起用具体问题、变化、结果或疑问建立听下去的理由；不要套用频道欢迎语，不要先列功能目录，不要制造来源不支持的悬念。
- 中段组织为二到六个自然的证据模块。每个模块只承担一个主要任务：提出有限结论或问题，给出事实、案例、测试、对比或素材证据，再解释这对观众意味着什么；资料包含失败、限制或未知项时必须保留。
- 证据先于判断，判断不得强于证据。不得把 Star、下载量、单次测试或单项跑分推导成受欢迎、全面领先、稳定可靠或适合所有人。来源没有直接评价时，删除“成熟、完整、可靠、先进、领先、专业”等定性词，改写为资料能够证明的具体行为或结果。
- 用具体场景解释能力，只有观众理解或操作所必需时才讲内部架构、依赖、命令和工程名词。不要把 sourceContext 的目录顺序当成口播顺序。
- 段落之间由问题自然推进：上一段的答案应当带出下一段需要解释的内容。不要为片头或动画额外写机械过渡语。
- 结论必须回答开头的问题，给出有边界的建议或影响，不得在结尾新增事实、突然拔高价值或使用关注点赞等平台话术。
- 完稿后做口语检查：一条句子尽量只讲一个关系；长短句交替；反问必须在后文回答；删掉公告腔、功能清单腔、宣传口号和无依据的第一人称经历。`;

export const assertUsableSourceContext = (sources, sourceContext) => {
  if (!sources.length) return;
  if (sourceContext.some((item) => item.status === "resolved" && item.content?.trim())) return;
  const failures = sourceContext
    .filter((item) => item.status === "failed")
    .map((item) => `${item.label}：${item.error ?? "读取失败"}`)
    .join("；");
  throw new Error(
    `参考资料均未读取成功，已停止写稿，避免 Agent 根据选题自行补写。请修正资料地址或删除无效资料后重试。${failures ? `（${failures}）` : ""}`,
  );
};

export const buildNarrationPrompt = (
  project,
  sourceContext,
  { currentNarration, rewriteInstructions, creatorWritingGuidance = [], materialUnderstanding } = {},
) => {
  const creatorEditorialDirection = project.brief.editorialBrief
    ? editorialBriefPrompt(project.brief.category, project.brief.editorialBrief)
    : [];
  const materialPolicy = `\n\n${editorialMethodPrompt}\n\n候选素材规则：\n- materials 中的截图和录屏只是候选，不要求全部使用。只有与某一段口播内容直接对应时，才把最明确的一份首选素材 id 写入该 section.materialIds。\n- 草稿阶段 screenshot 或 screen-recording 段可以暂时不绑定素材；写稿完成后，本地视觉规划器会继续按实体、证据角色和精确口播句安排截图组、短录屏及其他视觉节拍，项目固定 Agent 再为已经确定的动画阶段选择共享图片素材，最后由创作者整体确认。\n- 共享图片素材只是动画内部原料，不是独立主视觉；没有合适图片时由本地图标兜底。\n- section.materialIds 最多记录一个首选素材；同一素材可以在不同口播段落重复出现。不要为迁就素材重复口播或编造内容。`;
  const mode = `${materialPolicy}${
    currentNarration
      ? `\n\n这是需要重写的当前稿件：\n${JSON.stringify(currentNarration, null, 2)}\n\n创作者的修改意见：\n${rewriteInstructions}`
      : ""
  }`;
  const learnedWritingPolicy = creatorWritingGuidance.length
    ? `\n\n创作者已审核通过的长期写作偏好：\n${creatorWritingGuidance
        .map((item) => `- ${item.guidance}`)
        .join("\n")}\n这些偏好只决定表达方式和结构，不是本期事实来源；与本期写作方向或来源冲突时，以本期输入为准。`
    : "";
  return `你是创作者的中文口播稿助手。请严格输出 JSON，不要输出解释。\n\n固定要求：\n- opening 要直接进入本期问题，除非 creatorEditorialDirection 明确提供，不得自行添加频道名、创作者名、欢迎语或口号。\n- 不要输出 transitionAnchor；公开版不会插入固定片头。\n- 语言自然、口语化，允许短句和现场感，避免“首先其次最后”、夸张营销和 AI 套话。\n- 写稿阶段可以使用具体场景、类比、反问、悬念和节奏变化，但语气必须来自 creatorEditorialDirection，不得模仿未提供的特定创作者；这些表达只能帮助解释已有事实，不能暗含新的产品能力、数据、评价或来源外结论。\n- creatorEditorialDirection 是创作者亲自填写的写作方向和第一人称经历。它决定选题角度、受众、中心判断和表达边界，优先级高于资料目录顺序；不得擅自替换创作者选择的角度，也不得虚构 creatorEditorialDirection 中没有的第一人称体验。\n- “结尾是否需要观众做什么”为空时，不得自行添加关注、点赞、收藏、评论、下载或购买等行动号召。\n- fullScript 必须按 opening、overview、sections.narration、conclusion 的顺序完整组成。\n- 只使用 status=resolved 的 sourceContext 作为外部项目事实依据；不得使用失败资料，也不得用常识补齐资料中没有的项目能力。\n- materialUnderstanding 是创作者已经人工确认的图片、录屏和资料理解卡，可以作为写稿证据；理解卡中的 limitations 必须保留为边界，不能反向当作事实。\n- 如果主题是具体项目、产品或仓库，必须优先讲清资料中能验证的真实工作流、核心能力、差异化优点和限制，引用具体阶段、文件、命令或功能；不要退化成泛泛的行业科普。\n- 每一段涉及项目事实的描述，都必须能在 resolved sourceContext、creatorEditorialDirection 或人工确认的 materialUnderstanding 中找到直接依据。证据不足时缩小结论，不要猜。\n- 不得把 Star、下载量、用户数等指标推断成“受欢迎”“社区认可”“关注度高”，除非资料明确这样表述；不得根据项目名称或常识自行补充“开源”“免费”“工具”等分类。\n- 如果 sourceContext 明确包含“原始口播原话”或创作者指定的多个事实，必须逐项保留这些事实；可以改成自然口语，但不能只选择其中一项，也不能用额外推论替代。\n- 输出前逐句检查 title、overview、sections 和 conclusion：删除所有不能在选题、resolved sourceContext、creatorEditorialDirection 或人工确认素材理解中直接找到依据的项目事实。\n- 录屏和截图只在现有 materials 能支持时规划，不得虚构素材。\n- 每个录屏段的 recordingInstruction 要告诉创作者具体展示什么，不指定绝对时间码。\n- 口播稿不是成片视觉导演稿；semantic-visual 只表达内容意图，不指定 Remotion 组件。\n- ${categoryGuidance[project.brief.category] ?? categoryGuidance.other}\n\n可用于组织口播内容的语义视觉形式：\n${narrationVisualFormsPrompt()}\n\n视觉写作规则：\n- 只在内容本身适合时，把事实自然组织成对比、流程、因果、数字、分类、证据或短语强调等更容易理解的表达；不得为了覆盖形式增加无关内容、重复观点或编造事实。\n- 不规定每段必须有视觉机会，也不规定整篇必须覆盖多少种形式；丰富度服从内容质量和证据。\n- 每个正文 section 都必须输出 visualOpportunities 数组，可以为空，最多三项。form 只能使用上面的语义形式 id。为空时下游仍会自动安排人物画面。\n- evidenceText 必须逐字摘自同一 section.narration，且应覆盖足以识别关系的完整短句，不能只摘一个模糊词。\n- visualOpportunities 是不进入口播的结构化备注。opening、overview、sections.narration 和 conclusion 中不得出现“使用某某组件”“这里放一个图”“让下游选择”等制作指令，也不得出现这些语义形式 id。\n- opening、overview 和 conclusion 会由下游根据真实口播自动推断视觉关系；它们与正文一样必须进入逐段视觉确认，不能被省略。\n- 你不知道实际组件名称、布局、颜色、动效和出现时间，也不得猜测或指定它们；下游会根据真实口播、字幕和证据独立选择。${learnedWritingPolicy}\n\n项目：${JSON.stringify({ brief: { ...project.brief, editorialBrief: undefined }, creatorEditorialDirection, sourceContext, materialUnderstanding, materials: project.materials }, null, 2)}${mode}`;
};

const narrationSourceText = (project, sourceContext, materialUnderstanding) =>
  [
    project.brief.topic,
    ...(project.brief.editorialBrief
      ? editorialBriefPrompt(project.brief.category, project.brief.editorialBrief).flatMap((item) => [
          item.question,
          item.answer,
        ])
      : []),
    ...sourceContext
      .filter((source) => source.status === "resolved")
      .flatMap((source) => [source.label, source.content]),
    ...project.materials.flatMap((material) => [
      material.label,
      material.description,
      material.sourceLabel,
      material.anchorText,
    ]),
    materialUnderstanding?.projectSummary,
    ...(materialUnderstanding?.sources ?? []).flatMap((item) => [item.summary, ...item.keyFacts, ...item.limitations]),
    ...(materialUnderstanding?.materials ?? []).flatMap((item) => [
      item.summary,
      ...item.visibleText,
      ...item.visibleActions,
      ...item.usableEvidence,
      item.suggestedUse,
      ...item.limitations,
    ]),
  ]
    .filter((value) => typeof value === "string" && value.trim())
    .join("\n");

export const assertNarrationSourceGrounding = ({ narration, project, sourceContext, materialUnderstanding }) => {
  const grounding = evaluateSourceGrounding({
    outputText: narrationClaimText(narration),
    sourceText: narrationSourceText(project, sourceContext, materialUnderstanding),
  });
  if (grounding.unsupportedSourceTerms.length)
    throw new Error(`Agent 口播稿包含来源外事实：${grounding.unsupportedSourceTerms.join("、")}`);
  return grounding;
};

export const loadSourceContext = async (projectId) => {
  try {
    return JSON.parse(await readFile(resolve(projectDir(projectId), "authoring/source-context.json"), "utf8"));
  } catch {
    return [];
  }
};

const completeNarration = async ({
  project,
  sourceContext,
  fixture,
  currentNarration,
  rewriteInstructions,
  materialUnderstanding,
  onProgress,
}) => {
  let output;
  let report;
  if (project.agent.id === "fixture") {
    if (!fixture) throw new Error("Fixture Agent requires an explicit narration fixture");
    output = JSON.parse(await readFile(resolve(fixture), "utf8"));
    report = { provider: "fixture", fixture: resolve(fixture) };
  } else {
    onProgress({
      percent: 46,
      phase: "agent",
      message: `正在由 ${project.agent.id} ${currentNarration ? "重写" : "生成"}结构化口播稿`,
    });
    const adapter = createStructuredAgentJsonAdapter({
      config: { provider: project.agent.id, model: project.agent.model, timeoutSeconds: 600, maxRetries: 1 },
      schemaPath,
    });
    const creatorWritingGuidance = await writingGuidanceFor(project.brief.category);
    output = await adapter.completeJson({
      system: "You write natural, evidence-grounded Chinese creator narration and production guidance.",
      user: buildNarrationPrompt(project, sourceContext, {
        currentNarration,
        rewriteInstructions,
        creatorWritingGuidance,
        materialUnderstanding,
      }),
    });
    report = adapter.getLastRunMetadata();
  }
  onProgress({ percent: 84, phase: "validation", message: "Agent 已返回，正在校验稿件结构和录屏规划" });
  if (!output || typeof output !== "object" || Array.isArray(output))
    throw new Error("Agent 返回的口播稿不是结构化对象");
  if (!Array.isArray(output.sections)) throw new Error("Agent 返回的口播稿缺少 sections 段落数组");
  const narration = validateNarrationScriptPackage({ ...output, fullScript: composeNarrationScript(output) });
  assertNarrationSourceGrounding({ narration, project, sourceContext, materialUnderstanding });
  return {
    narration,
    report: { ...report, mode: currentNarration ? "rewrite" : "initial" },
  };
};

const persistNarration = async ({ project, projectId, narration, report, kind, instructions }) => {
  const authoringDir = resolve(projectDir(projectId), "authoring");
  await mkdir(authoringDir, { recursive: true });
  const attempt = await recordNarrationAttempt({
    project,
    projectId,
    narration,
    report,
    kind,
    instructions,
  });
  await writeJsonAtomic(resolve(authoringDir, "narration-package.json"), narration);
  await writeJsonAtomic(resolve(authoringDir, "provider-report.json"), report);
  await writeFile(resolve(authoringDir, "draft-script.md"), `# ${narration.title}\n\n${narration.fullScript}\n`);
  await writeFile(
    resolve(authoringDir, "shooting-guide.md"),
    `# 拍摄指导\n\n${narration.shootingGuide.map((item) => `- ${item}`).join("\n")}\n`,
  );
  project.authoring = {
    ...(project.authoring.inputScript ? { inputScript: project.authoring.inputScript } : {}),
    state: "drafted",
    draftScript: "authoring/draft-script.md",
    sourceContext: "authoring/source-context.json",
    shootingGuide: "authoring/shooting-guide.md",
    providerReport: "authoring/provider-report.json",
    currentAttemptId: attempt.attemptId,
    currentAttemptSha256: attempt.outputSha256,
  };
  project.project.status = "script-review";
  await saveCreatorProject(project);
};

export const resumeNarrationVisualPlanning = async (projectId, { onProgress = () => {} } = {}) => {
  const project = await loadCreatorProject(projectId);
  const narration = await loadNarration(projectId);
  if (project.authoring.state === "not-started") {
    const attempt = (await listNarrationAttempts(projectId)).find(
      (item) => item.status === "succeeded" && item.outputSha256,
    );
    if (!attempt) throw new Error("找不到可恢复的口播稿记录");
    project.authoring = {
      state: "drafted",
      draftScript: "authoring/draft-script.md",
      sourceContext: "authoring/source-context.json",
      shootingGuide: "authoring/shooting-guide.md",
      providerReport: "authoring/provider-report.json",
      currentAttemptId: attempt.attemptId,
      currentAttemptSha256: attempt.outputSha256,
    };
    project.project.status = "script-review";
    await saveCreatorProject(project);
  } else if (project.authoring.state !== "drafted") {
    throw new Error("只有尚未锁定的审核稿可以继续生成视觉方案");
  }
  onProgress({ percent: 15, phase: "narration-ready", message: "已读取现有口播稿，不会重新写稿" });
  const storyboard = await seedVisualStoryboard(projectId, narration);
  onProgress({ percent: 100, phase: "completed", message: "逐段视觉方案已生成" });
  return storyboard;
};

export const spokenTextFromInputScript = (value) =>
  value
    .replace(/^\uFEFF/, "")
    .replace(/^WEBVTT[^\n]*\n?/iu, "")
    .split(/\r?\n/)
    .filter((line) => !/^\s*\d+\s*$/u.test(line))
    .filter((line) => !/^\s*(?:\d{1,2}:)?\d{2}:\d{2}[,.]\d{3}\s*-->\s*(?:\d{1,2}:)?\d{2}:\d{2}[,.]\d{3}/u.test(line))
    .map((line) => line.replace(/<[^>]+>/gu, "").trim())
    .filter(Boolean)
    .join("\n")
    .trim();

const narrationChunks = (spokenText) => {
  const paragraphs = spokenText
    .split(/\n+/u)
    .map((item) => item.trim())
    .filter(Boolean);
  const sentences = paragraphs.flatMap((paragraph) =>
    [...paragraph.matchAll(/[^。！？!?]+[。！？!?]?/gu)].map((match) => match[0].trim()).filter(Boolean),
  );
  if (sentences.length < 5) throw new Error("口播稿内容太短，至少需要五个完整句子，才能生成可审核的逐段视觉方案");
  const groups = Array.from({ length: 5 }, () => []);
  sentences.forEach((sentence, index) => {
    groups[Math.min(4, Math.floor((index * 5) / sentences.length))].push(sentence);
  });
  return groups.map((group) => group.join(""));
};

export const createExistingNarrationPackage = ({ title, inputScript }) => {
  const spokenText = spokenTextFromInputScript(inputScript);
  if (!spokenText) throw new Error("口播稿中没有可用的口播文字");
  const [opening, overview, sectionOne, sectionTwo, conclusion] = narrationChunks(spokenText);
  return validateNarrationScriptPackage({
    schemaVersion: "1.0",
    title,
    opening,
    overview,
    sections: [sectionOne, sectionTwo].map((text, index) => ({
      id: `section-${index + 1}`,
      title: `内容段落 ${index + 1}`,
      narration: text,
      visualIntent: "semantic-visual",
      visualOpportunities: [],
      materialIds: [],
      recordingInstruction: null,
    })),
    conclusion,
    fullScript: [opening, overview, sectionOne, sectionTwo, conclusion].join("\n\n"),
    shootingGuide: ["使用已经录制的口播原片，不需要重新拍摄；后续仅设计视觉方案和特效。"],
  });
};

export const prepareExistingNarration = async (projectId) => {
  const project = await loadCreatorProject(projectId);
  if ((project.project.workflowMode ?? "script-first") !== "visual-post-production")
    throw new Error("当前项目不是“已有口播视频”模式");
  await assertConfirmedMaterialUnderstanding(projectId, project);
  if (!project.authoring.inputScript) throw new Error("请先选择口播稿或字幕稿");
  if (!project.video.sourceAssetId) throw new Error("请先选择已经录制的口播原片");
  const inputPath = resolve(projectDir(projectId), project.authoring.inputScript);
  const narration = createExistingNarrationPackage({
    title: project.project.title,
    inputScript: await readFile(inputPath, "utf8"),
  });
  await persistNarration({
    project,
    projectId,
    narration,
    report: { provider: "creator", mode: "existing-script", source: project.authoring.inputScript },
    kind: "existing-script",
  });
  return narration;
};

const resolveAndValidateSources = async (projectId, project, onProgress) => {
  onProgress({ percent: 18, phase: "sources", message: "正在解析网页、笔记和参考资料" });
  await mkdir(resolve(projectDir(projectId), "authoring"), { recursive: true });
  const previous = await loadSourceContext(projectId);
  const sourceContext = await resolveAuthoringSources(project.sources, { previous });
  await writeJsonAtomic(resolve(projectDir(projectId), "authoring/source-context.json"), sourceContext);
  assertUsableSourceContext(project.sources, sourceContext);
  const resolvedCount = sourceContext.filter((item) => item.status === "resolved").length;
  onProgress({
    percent: 38,
    phase: "sources-ready",
    message: project.sources.length
      ? `已冻结 ${resolvedCount}/${project.sources.length} 份可用资料，正在准备写稿任务`
      : "当前没有外部资料，将仅根据选题和素材准备写稿任务",
  });
  return sourceContext;
};

export const generateNarration = async (projectId, { fixture, onProgress = () => {} } = {}) => {
  const project = await loadCreatorProject(projectId);
  if (project.brief.editorialBrief) {
    const missing = missingEditorialAnswers(project.brief.category, project.brief.editorialBrief);
    if (missing.length) throw new Error(`请先完成写作方向：${missing.map((item) => item.label).join("、")}`);
  }
  const previousStatus = project.authoring.state === "drafted" ? "script-review" : "intake";
  project.project.status = "drafting";
  await saveCreatorProject(project);
  let narrationPersisted = false;
  onProgress({ percent: 8, phase: "project", message: "已读取项目和全局 Agent 设置" });
  try {
    const materialUnderstanding = await assertConfirmedMaterialUnderstanding(projectId, project);
    const sourceContext = await loadSourceContext(projectId);
    assertUsableSourceContext(project.sources, sourceContext);
    onProgress({
      percent: 38,
      phase: "inputs-ready",
      message: "已载入人工确认的素材理解卡和冻结资料",
    });
    const { narration, report } = await completeNarration({
      project,
      sourceContext,
      fixture,
      materialUnderstanding,
      onProgress,
    });
    await persistNarration({ project, projectId, narration, report, kind: "initial" });
    narrationPersisted = true;
    onProgress({ percent: 92, phase: "visual-planning", message: "口播稿已保存，正在生成逐段视觉方案" });
    await seedVisualStoryboard(projectId, narration);
    onProgress({ percent: 100, phase: "completed", message: "口播稿和拍摄指导已生成" });
    return narration;
  } catch (error) {
    if (!narrationPersisted) {
      await recordNarrationAttempt({
        project,
        projectId,
        kind: "initial",
        status: "failed",
        error,
        report: { provider: project.agent.id },
      }).catch(() => {});
      project.project.status = previousStatus;
      await saveCreatorProject(project);
    }
    throw error;
  }
};

export const rewriteNarration = async (projectId, { instructions, fixture, onProgress = () => {} } = {}) => {
  const normalizedInstructions = typeof instructions === "string" ? instructions.trim() : "";
  if (!normalizedInstructions) throw new Error("请填写希望 Agent 如何修改这份口播稿");
  if (normalizedInstructions.length > 2_000) throw new Error("重写意见不能超过 2000 个字符");
  const project = await loadCreatorProject(projectId);
  if (project.authoring.state !== "drafted") throw new Error("只有尚未锁定的审核稿可以交给 Agent 重写");
  const currentNarration = await loadNarration(projectId);
  project.project.status = "drafting";
  await saveCreatorProject(project);
  let narrationPersisted = false;
  onProgress({ percent: 8, phase: "project", message: "已读取当前稿件、项目资料和全局 Agent 设置" });
  try {
    const sourceContext = await resolveAndValidateSources(projectId, project, onProgress);
    const materialUnderstanding = await loadMaterialUnderstanding(projectId, project);
    const { narration, report } = await completeNarration({
      project,
      sourceContext,
      fixture,
      currentNarration,
      rewriteInstructions: normalizedInstructions,
      materialUnderstanding: materialUnderstanding.status === "confirmed" ? materialUnderstanding : undefined,
      onProgress,
    });
    await persistNarration({
      project,
      projectId,
      narration,
      report: { ...report, rewriteInstructions: normalizedInstructions },
      kind: "rewrite",
      instructions: normalizedInstructions,
    });
    narrationPersisted = true;
    onProgress({ percent: 92, phase: "visual-planning", message: "新口播稿已保存，正在更新逐段视觉方案" });
    await seedVisualStoryboard(projectId, narration);
    onProgress({ percent: 100, phase: "completed", message: "口播稿已按修改意见重写，等待审核" });
    return narration;
  } catch (error) {
    if (!narrationPersisted) {
      await recordNarrationAttempt({
        project,
        projectId,
        kind: "rewrite",
        status: "failed",
        instructions: normalizedInstructions,
        error,
        report: { provider: project.agent.id },
      }).catch(() => {});
      project.project.status = "script-review";
      await saveCreatorProject(project);
    }
    throw error;
  }
};

export const loadNarration = async (projectId) =>
  validateNarrationScriptPackage(
    JSON.parse(await readFile(resolve(projectDir(projectId), "authoring/narration-package.json"), "utf8")),
  );

export const saveNarrationDraft = async (projectId, narration) => {
  const value = validateNarrationScriptPackage(narration);
  const project = await loadCreatorProject(projectId);
  const attempt = await recordNarrationAttempt({
    project,
    projectId,
    narration: value,
    kind: "manual-save",
    report: { provider: "creator" },
  });
  await writeJsonAtomic(resolve(projectDir(projectId), "authoring/narration-package.json"), value);
  await writeFile(
    resolve(projectDir(projectId), "authoring/draft-script.md"),
    `# ${value.title}\n\n${value.fullScript}\n`,
  );
  project.authoring.currentAttemptId = attempt.attemptId;
  project.authoring.currentAttemptSha256 = attempt.outputSha256;
  await saveCreatorProject(project);
  return value;
};
