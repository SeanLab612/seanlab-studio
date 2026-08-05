import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { evaluateSourceGrounding, narrationClaimText } from "../../src/agents/conformance.ts";
import { composeNarrationScript, validateNarrationScriptPackage } from "../../src/creator-workflow/contract.ts";
import { narrationProductionCapabilityPrompt } from "../../src/creator-workflow/visual-authoring.ts";
import { editorialBriefPrompt, missingEditorialAnswers } from "../../src/creator-workflow/editorial-brief.ts";
import { createStructuredAgentJsonAdapter } from "../workflow/agent-json-adapter.mjs";
import { recordNarrationAttempt } from "./authoring-history.mjs";
import { assertConfirmedMaterialUnderstanding, loadMaterialUnderstanding } from "./material-understanding.mjs";
import { loadCreatorProject, projectDir, saveCreatorProject, writeJsonAtomic } from "./project-store.mjs";
import { resolveAuthoringSources } from "./source-context.mjs";
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
  const materialPolicy = `\n\n${editorialMethodPrompt}\n\n素材语义契约：\n- materials 中 required=true 的截图和录屏已经由创作者确认，必须在成片中真实呈现；required=false 的素材不得进入 section.materialIds。\n- 写稿时要自然考虑每份必用素材能够证明或展示的内容。每个 required 素材 id 必须且只能写入一个语义最匹配的 section.materialIds；一个 section 可以承接多份相关素材。\n- section.materialIds 只是不可见的语义交接，不是视觉方案。不要决定时间码、布局、组件、动画、裁剪方式或素材出现顺序。\n- visualOpportunities 一律输出空数组，visualIntent 一律使用 semantic-visual，recordingInstruction 一律为 null。正式视觉方案由口播稿锁定后的生产 Agent 根据全文、素材理解和实际音频独立生成。\n- 不要为迁就素材重复观点或编造事实；应当用素材能够支持的真实内容自然组织口播。`;
  const mode = `${materialPolicy}${
    currentNarration
      ? `\n\n这是需要重写的当前稿件：\n${JSON.stringify(currentNarration, null, 2)}\n\n创作者的修改意见：\n${rewriteInstructions}`
      : ""
  }`;
  const learnedWritingPolicy = `\n\n下游表达能力提示（只帮助你把事实讲完整，不生成视觉方案）：\n${narrationProductionCapabilityPrompt()}${
    creatorWritingGuidance.length
      ? `\n\n创作者已审核通过的长期写作偏好：\n${creatorWritingGuidance
          .map((item) => `- ${item.guidance}`)
          .join("\n")}\n这些偏好只决定表达方式和结构，不是本期事实来源；与本期写作方向或来源冲突时，以本期输入为准。`
      : ""
  }`;
  return `你是创作者的中文口播稿助手。请严格输出 JSON，不要输出解释。\n\n固定要求：\n- opening 要直接进入本期问题，除非 creatorEditorialDirection 明确提供，不得自行添加频道名、创作者名、欢迎语或口号。\n- 不要输出 transitionAnchor；公开版不会插入固定片头。\n- 语言自然、口语化，允许短句和现场感，避免“首先其次最后”、夸张营销和 AI 套话。\n- 写稿阶段可以使用具体场景、类比、反问、悬念和节奏变化，但语气必须来自 creatorEditorialDirection，不得模仿未提供的特定创作者；这些表达只能帮助解释已有事实，不能暗含新的产品能力、数据、评价或来源外结论。\n- creatorEditorialDirection 是创作者亲自填写的写作方向和第一人称经历。它决定选题角度、受众、中心判断和表达边界，优先级高于资料目录顺序；不得擅自替换创作者选择的角度，也不得虚构 creatorEditorialDirection 中没有的第一人称体验。\n- “结尾是否需要观众做什么”为空时，不得自行添加关注、点赞、收藏、评论、下载或购买等行动号召。\n- fullScript 必须按 opening、overview、sections.narration、conclusion 的顺序完整组成。\n- 只使用 status=resolved 的 sourceContext 作为外部项目事实依据；不得使用失败资料，也不得用常识补齐资料中没有的项目能力。\n- materialUnderstanding 是创作者已经确认的资料与素材理解，可以作为写稿证据；limitations 不能反向当作事实。\n- 如果主题是具体项目、产品或仓库，必须优先讲清资料中能验证的真实工作流、核心能力、差异化优点和限制。\n- 每一段涉及项目事实的描述，都必须能在输入证据中找到直接依据；证据不足时缩小结论，不要猜。\n- 不得把 Star、下载量、用户数等指标推断成受欢迎、社区认可或全面领先，除非资料明确支持。\n- 输出前逐句检查并删除所有无依据的项目事实。\n- 写稿阶段不生成视觉方案，不选择组件、动画、布局、颜色、动效或时间点。\n- visualOpportunities 必须为空，materialIds 只保存必用素材与口播段落的语义关系，不进入用户界面。\n- opening、overview、sections.narration 和 conclusion 中不得出现“使用某某组件”“这里放一个图”“让下游选择”等制作指令。\n- ${categoryGuidance[project.brief.category] ?? categoryGuidance.other}${learnedWritingPolicy}\n\n项目：${JSON.stringify({ brief: { ...project.brief, editorialBrief: undefined }, creatorEditorialDirection, sourceContext, materialUnderstanding, materials: project.materials }, null, 2)}${mode}`;
};

export const assertNarrationMaterialCoverage = (narration, project) => {
  const visualMaterials = project.materials.filter((item) => ["screenshot", "screen-recording"].includes(item.kind));
  const knownIds = new Set(visualMaterials.map((item) => item.id));
  const requiredIds = new Set(visualMaterials.filter((item) => item.required).map((item) => item.id));
  const counts = new Map();
  for (const section of narration.sections) {
    for (const materialId of section.materialIds) {
      if (!knownIds.has(materialId)) throw new Error(`口播稿引用了未知或非视觉素材：${materialId}`);
      counts.set(materialId, (counts.get(materialId) ?? 0) + 1);
    }
  }
  const missing = [...requiredIds].filter((id) => !counts.has(id));
  if (missing.length) throw new Error(`口播稿没有为必用素材建立语义位置：${missing.join(", ")}`);
  const repeated = [...counts].filter(([id, count]) => requiredIds.has(id) && count !== 1).map(([id]) => id);
  if (repeated.length) throw new Error(`必用素材必须且只能绑定一个语义段落：${repeated.join(", ")}`);
  const excluded = [...counts.keys()].filter((id) => !requiredIds.has(id));
  if (excluded.length) throw new Error(`已排除素材不能进入口播交接：${excluded.join(", ")}`);
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

export const assertNarrationDeterministicGrounding = ({ narration, project, sourceContext, materialUnderstanding }) => {
  const grounding = evaluateSourceGrounding({
    outputText: narrationClaimText(narration),
    sourceText: narrationSourceText(project, sourceContext, materialUnderstanding),
  });
  const registeredMaterialIds = new Set(project.materials.map((material) => material.id));
  const unknownMaterialIds = [
    ...new Set(
      narration.sections.flatMap((section) => section.materialIds).filter((id) => !registeredMaterialIds.has(id)),
    ),
  ];
  if (unknownMaterialIds.length)
    throw Object.assign(new Error(`Agent 口播稿引用了不存在的素材：${unknownMaterialIds.join("、")}`), {
      unknownMaterialIds,
    });
  if (grounding.unsupportedNumberClaims.length)
    throw Object.assign(
      new Error(`Agent 口播稿包含来源中无法核对的明确数字：${grounding.unsupportedNumberClaims.join("、")}`),
      { unsupportedNumberClaims: grounding.unsupportedNumberClaims },
    );
  return grounding;
};

// Backward-compatible export for callers that still use the old name. Qualifier words are audit signals only;
// deterministic narration blocking is limited to exact numeric claims and registered material references.
export const assertNarrationSourceGrounding = assertNarrationDeterministicGrounding;

export const buildNarrationValidationRepairPrompt = ({ originalPrompt, rejectedOutput, validationError }) =>
  `${originalPrompt}\n\n上一版草稿未通过本地校验，请在不改变创作者方向的前提下自动修复。\n` +
  `校验结果：${String(validationError?.message ?? validationError)}\n` +
  `修复规则：\n- 只修改导致校验失败的句子或字段，其他有效内容尽量保留。\n- 对无法直接证明的事实，删除或缩小结论，不得换成另一个新事实。\n- 继续严格输出符合原 JSON Schema 的完整对象，不要输出解释。\n\n` +
  `被拒绝的草稿：\n${JSON.stringify(rejectedOutput, null, 2)}`;

export const buildNarrationEvidenceReviewPrompt = ({ originalPrompt, draft }) =>
  `${originalPrompt}\n\n这是写稿 Agent 的独立第二遍事实审核。请对照上面的冻结资料、创作者方向和已确认素材理解，逐句复核下面草稿中的项目事实。\n` +
  `审核规则：\n- 这是事实审核，不是风格重写；保留已有结构、角度和有证据的表达。\n- 对每个外部事实进行语义对照，允许中英文翻译、同义改写和不改变含义的口语化表达。\n- 无法在资料中直接支持的能力、评价、因果、范围或推荐，由你自行删除或缩小，不要交给用户解决。\n- 不得改动创作者明确提供的第一人称经历和写作方向；不得新增资料外事实。\n- 如果草稿已经有依据，原样返回。严格输出符合原 JSON Schema 的完整对象，不输出审核说明。\n\n` +
  `待审核草稿：\n${JSON.stringify(draft, null, 2)}`;

export const loadSourceContext = async (projectId) => {
  try {
    return JSON.parse(await readFile(resolve(projectDir(projectId), "authoring/source-context.json"), "utf8"));
  } catch {
    return [];
  }
};

export const completeNarration = async ({
  project,
  sourceContext,
  fixture,
  currentNarration,
  rewriteInstructions,
  materialUnderstanding,
  onProgress = () => {},
  adapterFactory = createStructuredAgentJsonAdapter,
  validationRepairRounds = 2,
  creatorWritingGuidance: suppliedCreatorWritingGuidance,
}) => {
  let output;
  let report;
  let auditInput;
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
    const adapter = adapterFactory({
      config: { provider: project.agent.id, model: project.agent.model, timeoutSeconds: 600, maxRetries: 1 },
      schemaPath,
    });
    const creatorWritingGuidance = suppliedCreatorWritingGuidance ?? (await writingGuidanceFor(project.brief.category));
    const originalPrompt = buildNarrationPrompt(project, sourceContext, {
      currentNarration,
      rewriteInstructions,
      creatorWritingGuidance,
      materialUnderstanding,
    });
    const repairHistory = [];
    const completeValidatedCandidate = async ({ prompt: requestedPrompt, stage, validationPercent }) => {
      let prompt = requestedPrompt;
      for (let repairRound = 0; repairRound <= validationRepairRounds; repairRound += 1) {
        try {
          output = await adapter.completeJson({
            system: "You write natural, evidence-grounded Chinese creator narration and production guidance.",
            user: prompt,
          });
        } catch (error) {
          throw Object.assign(error, {
            repairHistory,
            auditInput,
            providerReport: adapter.getLastRunMetadata(),
          });
        }
        report = adapter.getLastRunMetadata();
        onProgress({
          percent: validationPercent,
          phase: "validation",
          message: stage.startsWith("evidence-review")
            ? "Agent 已完成事实审稿，正在校验确定性规则"
            : "Agent 已返回，正在校验稿件结构和素材引用",
        });
        try {
          if (!output || typeof output !== "object" || Array.isArray(output))
            throw new Error("Agent 返回的口播稿不是结构化对象");
          if (!Array.isArray(output.sections)) throw new Error("Agent 返回的口播稿缺少 sections 段落数组");
          const narration = validateNarrationScriptPackage({ ...output, fullScript: composeNarrationScript(output) });
          assertNarrationDeterministicGrounding({ narration, project, sourceContext, materialUnderstanding });
          assertNarrationMaterialCoverage(narration, project);
          return narration;
        } catch (error) {
          repairHistory.push({
            stage,
            round: repairRound + 1,
            output,
            error: String(error?.message ?? error),
            report,
          });
          if (repairRound >= validationRepairRounds) {
            throw Object.assign(
              new Error(`Agent 口播稿经 ${validationRepairRounds} 次自动修复后仍未通过确定性校验`, { cause: error }),
              { repairHistory, auditInput, providerReport: report },
            );
          }
          onProgress({
            percent: Math.min(90, validationPercent + 2),
            phase: "automatic-repair",
            message: `发现可自动修复的结构、数字或素材引用问题，正在进行第 ${repairRound + 1} 次定点修改`,
          });
          prompt = buildNarrationValidationRepairPrompt({
            originalPrompt: requestedPrompt,
            rejectedOutput: output,
            validationError: error,
          });
        }
      }
    };

    const initialNarration = await completeValidatedCandidate({
      prompt: originalPrompt,
      stage: "draft-validation",
      validationPercent: 70,
    });
    auditInput = { narration: initialNarration, report };
    onProgress({
      percent: 76,
      phase: "evidence-review",
      message: `正在由 ${project.agent.id} 独立复核每句项目事实，有问题将自动收窄`,
    });
    const narration = await completeValidatedCandidate({
      prompt: buildNarrationEvidenceReviewPrompt({ originalPrompt, draft: initialNarration }),
      stage: "evidence-review-validation",
      validationPercent: 88,
    });
    return {
      narration,
      report: {
        ...report,
        mode: currentNarration ? "rewrite" : "initial",
        evidenceReviewCount: 1,
        evidenceReviewChangedDraft: JSON.stringify(narration) !== JSON.stringify(initialNarration),
        validationRepairCount: repairHistory.length,
      },
      auditInput,
      repairHistory,
    };
  }
  onProgress({ percent: 84, phase: "validation", message: "Agent 已返回，正在校验稿件结构和录屏规划" });
  if (!output || typeof output !== "object" || Array.isArray(output))
    throw new Error("Agent 返回的口播稿不是结构化对象");
  if (!Array.isArray(output.sections)) throw new Error("Agent 返回的口播稿缺少 sections 段落数组");
  const narration = validateNarrationScriptPackage({ ...output, fullScript: composeNarrationScript(output) });
  assertNarrationDeterministicGrounding({ narration, project, sourceContext, materialUnderstanding });
  assertNarrationMaterialCoverage(narration, project);
  return {
    narration,
    report: { ...report, mode: currentNarration ? "rewrite" : "initial" },
    repairHistory: [],
    auditInput: null,
  };
};

const recordNarrationEvidenceAuditInput = async ({ project, projectId, auditInput, instructions }) => {
  if (!auditInput) return null;
  return recordNarrationAttempt({
    project,
    projectId,
    narration: auditInput.narration,
    report: { ...auditInput.report, evidenceReviewInput: true },
    kind: "evidence-review-input",
    status: "superseded",
    instructions,
  });
};

const recordAutomaticNarrationRepairs = async ({ project, projectId, repairHistory = [], instructions }) => {
  for (const repair of repairHistory) {
    await recordNarrationAttempt({
      project,
      projectId,
      rejectedOutput: repair.output,
      report: { ...repair.report, validationRepairRound: repair.round, validationRepairStage: repair.stage },
      kind: "automatic-repair",
      status: "failed",
      instructions,
      error: new Error(repair.error),
    });
  }
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
  const requiredMaterials = project.materials.filter(
    (item) => item.required && ["screenshot", "screen-recording"].includes(item.kind),
  );
  requiredMaterials.forEach((material, index) => {
    narration.sections[index % narration.sections.length].materialIds.push(material.id);
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
  let recordedRepairCount = 0;
  let auditInputRecorded = false;
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
    const { narration, report, repairHistory, auditInput } = await completeNarration({
      project,
      sourceContext,
      fixture,
      materialUnderstanding,
      onProgress,
    });
    const evidenceReviewInputAttempt = await recordNarrationEvidenceAuditInput({ project, projectId, auditInput });
    auditInputRecorded = Boolean(auditInput);
    await recordAutomaticNarrationRepairs({ project, projectId, repairHistory });
    recordedRepairCount = repairHistory.length;
    await persistNarration({
      project,
      projectId,
      narration,
      report: { ...report, evidenceReviewInputAttemptId: evidenceReviewInputAttempt?.attemptId ?? null },
      kind: "initial",
    });
    narrationPersisted = true;
    onProgress({ percent: 100, phase: "completed", message: "口播稿已生成，等待文字审核" });
    return narration;
  } catch (error) {
    if (!narrationPersisted) {
      if (!auditInputRecorded)
        await recordNarrationEvidenceAuditInput({ project, projectId, auditInput: error?.auditInput }).catch(() => {});
      const unrecordedRepairs = (error?.repairHistory ?? []).slice(recordedRepairCount);
      await recordAutomaticNarrationRepairs({ project, projectId, repairHistory: unrecordedRepairs }).catch(() => {});
      await recordNarrationAttempt({
        project,
        projectId,
        kind: "initial",
        status: "failed",
        error,
        report: error?.providerReport ?? { provider: project.agent.id },
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
  let recordedRepairCount = 0;
  let auditInputRecorded = false;
  onProgress({ percent: 8, phase: "project", message: "已读取当前稿件、项目资料和全局 Agent 设置" });
  try {
    const sourceContext = await resolveAndValidateSources(projectId, project, onProgress);
    const materialUnderstanding = await loadMaterialUnderstanding(projectId, project);
    const { narration, report, repairHistory, auditInput } = await completeNarration({
      project,
      sourceContext,
      fixture,
      currentNarration,
      rewriteInstructions: normalizedInstructions,
      materialUnderstanding: materialUnderstanding.status === "confirmed" ? materialUnderstanding : undefined,
      onProgress,
    });
    const evidenceReviewInputAttempt = await recordNarrationEvidenceAuditInput({
      project,
      projectId,
      auditInput,
      instructions: normalizedInstructions,
    });
    auditInputRecorded = Boolean(auditInput);
    await recordAutomaticNarrationRepairs({
      project,
      projectId,
      repairHistory,
      instructions: normalizedInstructions,
    });
    recordedRepairCount = repairHistory.length;
    await persistNarration({
      project,
      projectId,
      narration,
      report: {
        ...report,
        rewriteInstructions: normalizedInstructions,
        evidenceReviewInputAttemptId: evidenceReviewInputAttempt?.attemptId ?? null,
      },
      kind: "rewrite",
      instructions: normalizedInstructions,
    });
    narrationPersisted = true;
    onProgress({ percent: 100, phase: "completed", message: "口播稿已按修改意见重写，等待文字审核" });
    return narration;
  } catch (error) {
    if (!narrationPersisted) {
      if (!auditInputRecorded)
        await recordNarrationEvidenceAuditInput({
          project,
          projectId,
          auditInput: error?.auditInput,
          instructions: normalizedInstructions,
        }).catch(() => {});
      const unrecordedRepairs = (error?.repairHistory ?? []).slice(recordedRepairCount);
      await recordAutomaticNarrationRepairs({
        project,
        projectId,
        repairHistory: unrecordedRepairs,
        instructions: normalizedInstructions,
      }).catch(() => {});
      await recordNarrationAttempt({
        project,
        projectId,
        kind: "rewrite",
        status: "failed",
        instructions: normalizedInstructions,
        error,
        report: error?.providerReport ?? { provider: project.agent.id },
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
