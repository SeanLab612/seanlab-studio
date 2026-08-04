import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdir, readFile, stat } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { promisify } from "node:util";
import { createStructuredAgentJsonAdapter } from "../workflow/agent-json-adapter.mjs";
import { hashFile, loadCreatorProject, projectDir, resolveCreatorAsset, writeJsonAtomic } from "./project-store.mjs";
import { resolveAuthoringSources } from "./source-context.mjs";

const execFileAsync = promisify(execFile);
const schemaPath = resolve("schemas/material-understanding.schema.json");
const imageExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
const videoExtensions = new Set([".mp4", ".mov", ".m4v", ".webm", ".mkv"]);
const textExtensions = new Set([".md", ".txt", ".json", ".csv", ".html", ".htm"]);
const visibleTextReasoningPattern =
  /无法确认|应以|需忽略|因此输出|(?:根据|基于).{0,8}(?:图像|图片|校对|sourceContext)|(?:应该|应当).{0,12}(?:使用|采用|校对|原文)|(?:于是|因此).{0,8}(?:输出|写入)|(?:不应|不要).{0,8}(?:包含|写入)|(?:OCR|图像识别).{0,12}(?:噪声|结果|错误|纠错)|(?:to be )?verified by (?:the )?creator|do not use|voice-?over script|information to be verified/iu;

export const materialUnderstandingFile = (projectId) =>
  resolve(projectDir(projectId), "authoring/material-understanding.json");

const sha256Json = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

const loadJson = async (path, fallback) => {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return fallback;
    throw error;
  }
};

const visibleTextCorrections = (project) =>
  project.sources
    .filter((source) => source.kind === "note" && /(?:画面|截图|可见)?文字校对/u.test(source.label))
    .flatMap((source) => {
      const affirmativeText = source.value.split(/不存在|不应|错误(?:内容|文字|结果)?/u, 1)[0];
      return [...affirmativeText.matchAll(/[“"]([^”"]{1,50})[”"]/gu)].map((match) => match[1].trim());
    })
    .filter(Boolean);

const applyVisibleTextCorrections = (output, project) => {
  const corrections = visibleTextCorrections(project);
  if (corrections.length === 0) return output;
  return {
    ...output,
    materials: output.materials.map((material) => ({
      ...material,
      visibleText: material.visibleText.map((text) => {
        const correction = corrections.find((candidate) => text.startsWith(candidate));
        return correction ?? text;
      }),
    })),
  };
};

const authoringEvidenceMaterials = (project) =>
  project.materials.filter((material) => material.kind !== "speaker-video");

const materialInventory = async (projectId, project, { includeContentHash = true } = {}) =>
  Promise.all(
    authoringEvidenceMaterials(project).map(async (material) => {
      let assetPath;
      let info;
      if (material.assetId) {
        try {
          assetPath = await resolveCreatorAsset(projectId, material.assetId);
          info = await stat(assetPath);
        } catch {}
      }
      return {
        id: material.id,
        kind: material.kind,
        label: material.label,
        description: material.description ?? "",
        sourceLabel: material.sourceLabel ?? "",
        assetId: material.assetId ?? "",
        missing: Boolean(material.assetId && !assetPath),
        bytes: info?.size ?? 0,
        modifiedAtMs: info?.mtimeMs ?? 0,
        ...(includeContentHash && assetPath ? { sha256: await hashFile(assetPath) } : {}),
      };
    }),
  );

const materialUnderstandingInventoryFingerprint = async (projectId, project) =>
  sha256Json({
    brief: {
      topic: project.brief.topic,
      creatorNotes: project.brief.creatorNotes ?? "",
      category: project.brief.category,
    },
    sources: project.sources,
    materials: await materialInventory(projectId, project, { includeContentHash: false }),
  });

export const materialUnderstandingInputFingerprint = async (projectId, project = undefined) => {
  const current = project ?? (await loadCreatorProject(projectId));
  return sha256Json({
    brief: {
      topic: current.brief.topic,
      creatorNotes: current.brief.creatorNotes ?? "",
      category: current.brief.category,
    },
    sources: current.sources,
    materials: await materialInventory(projectId, current),
  });
};

const probeVideo = async (path) => {
  const { stdout } = await execFileAsync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration:stream=index,codec_type,width,height", "-of", "json", path],
    { timeout: 30_000, maxBuffer: 2_000_000 },
  );
  const value = JSON.parse(stdout);
  const video = value.streams?.find((stream) => stream.codec_type === "video");
  return {
    durationSeconds: Number(value.format?.duration ?? 0),
    width: Number(video?.width ?? 0),
    height: Number(video?.height ?? 0),
    hasAudio: Boolean(value.streams?.some((stream) => stream.codec_type === "audio")),
  };
};

const renderVideoContactSheet = async (source, destination, metadata) => {
  const rate = Math.max(0.05, 6 / Math.max(metadata.durationSeconds, 1));
  await execFileAsync(
    "ffmpeg",
    [
      "-y",
      "-v",
      "error",
      "-i",
      source,
      "-vf",
      `fps=${rate},scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2:color=black,tile=3x2:padding=8:margin=8`,
      "-frames:v",
      "1",
      destination,
    ],
    { timeout: 120_000, maxBuffer: 4_000_000 },
  );
};

const prepareMaterial = async (projectId, material, mediaDir) => {
  const base = {
    materialId: material.id,
    kind: material.kind,
    label: material.label,
    creatorDescription: material.description ?? "",
    sourceLabel: material.sourceLabel ?? "",
  };
  if (!material.assetId) return { promptEntry: { ...base, preparationLimitation: "没有本地文件" } };
  const source = await resolveCreatorAsset(projectId, material.assetId);
  const extension = extname(source).toLowerCase();
  if (imageExtensions.has(extension)) return { imagePath: source, promptEntry: { ...base, visualInput: source } };
  if (videoExtensions.has(extension)) {
    try {
      const metadata = await probeVideo(source);
      const imagePath = resolve(mediaDir, `${material.id}-contact-sheet.jpg`);
      await renderVideoContactSheet(source, imagePath, metadata);
      return {
        imagePath,
        promptEntry: {
          ...base,
          visualInput: imagePath,
          sampledFrom: source,
          metadata,
          sampling: "按全片时长均匀抽取六个代表画面；不能据此断言未抽到的瞬间",
        },
      };
    } catch (error) {
      return {
        promptEntry: {
          ...base,
          preparationLimitation: `录屏抽帧失败：${error.message}`,
        },
      };
    }
  }
  if (extension === ".pdf") {
    try {
      const prefix = resolve(mediaDir, `${material.id}-page`);
      await execFileAsync("pdftoppm", ["-f", "1", "-singlefile", "-jpeg", "-r", "120", source, prefix], {
        timeout: 60_000,
        maxBuffer: 2_000_000,
      });
      const imagePath = `${prefix}.jpg`;
      return {
        imagePath,
        promptEntry: {
          ...base,
          visualInput: imagePath,
          sampledFrom: source,
          sampling: "只读取 PDF 第一页，其余页面必须列为限制",
        },
      };
    } catch (error) {
      return { promptEntry: { ...base, preparationLimitation: `PDF 预览失败：${error.message}` } };
    }
  }
  if (textExtensions.has(extension)) {
    const content = (await readFile(source, "utf8")).slice(0, 24_000);
    return { promptEntry: { ...base, textContent: content } };
  }
  return {
    promptEntry: {
      ...base,
      preparationLimitation: `暂不支持直接读取 ${extension || "未知格式"} 文件内容`,
    },
  };
};

const assertUnderstandingOutput = (output, project) => {
  const sourceIds = new Set(project.sources.map((item) => item.id));
  const materialIds = new Set(authoringEvidenceMaterials(project).map((item) => item.id));
  if (
    output.sources.length !== sourceIds.size ||
    output.sources.some((item) => !sourceIds.has(item.sourceId)) ||
    new Set(output.sources.map((item) => item.sourceId)).size !== sourceIds.size
  )
    throw new Error("Agent 返回的资料理解卡与当前资料清单不一致");
  if (
    output.materials.length !== materialIds.size ||
    output.materials.some((item) => !materialIds.has(item.materialId)) ||
    new Set(output.materials.map((item) => item.materialId)).size !== materialIds.size
  )
    throw new Error("Agent 返回的素材理解卡与当前素材清单不一致");
  for (const material of output.materials) {
    const contaminatedText = material.visibleText.find((text) => visibleTextReasoningPattern.test(text));
    if (contaminatedText)
      throw new Error(
        `素材 ${material.materialId} 的 visibleText 混入了 OCR 判断或解释：${JSON.stringify(contaminatedText)}`,
      );
  }
  return output;
};

export const materialUnderstandingPrompt = ({
  project,
  sourceContext,
  prepared,
}) => `你是 SeanLab Studio 的素材理解助手。
你的任务不是写口播稿，而是忠实总结创作者已经提交的资料、图片和录屏，让创作者先审核你是否看懂。

规则：
- 只能描述输入中实际可见或可读的内容，不得根据文件名、项目名或常识补写。
- 图片要提取关键可见文字、界面状态、对象和可用证据。
- visibleText 每一项只能是画面中逐字可见的短文本，原样摘录，不得加入 OCR 判断、纠错过程、解释、改写或“无法确认”“应以”“需忽略”“因此输出”等说明。读不清的文字不要写入 visibleText，改在 limitations 说明。
- sourceContext 中的文字校对只用于决定采用哪个画面原文，不得把校对说明本身复制或改写进 visibleText。
- 录屏输入是六帧联系图，要按画面顺序概括可见操作和变化；没有看到的动作必须写入 limitations。
- sourceContext 中只有 status=resolved 的内容可作为资料事实；失败项只能说明读取失败。
- 每一个 sourceId 和 materialId 都必须且只能输出一次，顺序与输入一致。
- suggestedUse 只描述它适合支持哪类口播内容，不指定具体组件、动画、布局或时间点。
- 无法确认时明确写入 limitations，不要猜。

项目描述：
${JSON.stringify(
  {
    topic: project.brief.topic,
    creatorNotes: project.brief.creatorNotes,
    editorialDirection: project.brief.editorialBrief,
  },
  null,
  2,
)}

已读取资料：
${JSON.stringify(sourceContext, null, 2)}

已准备素材：
${JSON.stringify(
  prepared.map((item) => item.promptEntry),
  null,
  2,
)}
`;

export const analyzeMaterialUnderstanding = async (
  projectId,
  { fixture, adapterFactory = createStructuredAgentJsonAdapter, onProgress = () => {} } = {},
) => {
  const project = await loadCreatorProject(projectId);
  if (project.authoring.state !== "not-started") throw new Error("口播稿开始生成后不能重做写稿前素材理解");
  onProgress({ percent: 8, phase: "inventory", message: "正在核对资料、图片和录屏清单" });
  const authoringDir = resolve(projectDir(projectId), "authoring");
  const mediaDir = resolve(authoringDir, "material-understanding-media");
  await mkdir(mediaDir, { recursive: true });
  const previousSources = await loadJson(resolve(authoringDir, "source-context.json"), []);
  const sourceContext = await resolveAuthoringSources(project.sources, { previous: previousSources });
  await writeJsonAtomic(resolve(authoringDir, "source-context.json"), sourceContext);
  onProgress({ percent: 28, phase: "media", message: "正在读取图片，并从录屏抽取代表画面" });
  const prepared = [];
  for (const material of authoringEvidenceMaterials(project))
    prepared.push(await prepareMaterial(projectId, material, mediaDir));
  const imagePaths = prepared.flatMap((item) => (item.imagePath ? [item.imagePath] : []));
  onProgress({
    percent: 52,
    phase: "agent",
    message: `正在由 ${project.agent.id} 汇总 ${project.sources.length} 份资料和 ${authoringEvidenceMaterials(project).length} 份写稿证据素材`,
  });
  let output;
  let provider;
  if (fixture) {
    output = JSON.parse(await readFile(resolve(fixture), "utf8"));
    output = applyVisibleTextCorrections(output, project);
    provider = { provider: "fixture", fixture: resolve(fixture) };
  } else {
    const adapter = adapterFactory({
      config: { provider: project.agent.id, model: project.agent.model, timeoutSeconds: 600, maxRetries: 1 },
      schemaPath,
    });
    const basePrompt = materialUnderstandingPrompt({ project, sourceContext, prepared });
    let semanticError;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      output = applyVisibleTextCorrections(
        await adapter.completeJson({
          system: "You inspect creator-provided sources and visual media, then return strict Chinese JSON cards.",
          user:
            attempt === 1
              ? basePrompt
              : `${basePrompt}

上一次输出未通过确定性校验：
${semanticError.message}
请重新生成完整结果。尤其要把 visibleText 当作纯 OCR 字符串数组；任何判断、说明和纠错过程都只能写入 limitations。`,
          imagePaths,
        }),
        project,
      );
      try {
        assertUnderstandingOutput(output, project);
        semanticError = undefined;
        break;
      } catch (error) {
        semanticError = error;
      }
    }
    if (semanticError) throw semanticError;
    provider = adapter.getLastRunMetadata();
  }
  onProgress({ percent: 86, phase: "validation", message: "正在核对理解卡与原始素材是否一一对应" });
  assertUnderstandingOutput(output, project);
  const inputSha256 = await materialUnderstandingInputFingerprint(projectId, project);
  const inventorySha256 = await materialUnderstandingInventoryFingerprint(projectId, project);
  const report = {
    ...output,
    status: "suggested",
    inputSha256,
    inventorySha256,
    sourceContextSha256: sha256Json(sourceContext),
    analyzedAt: new Date().toISOString(),
    provider,
    mediaSampling: prepared.map((item) => item.promptEntry),
  };
  await writeJsonAtomic(materialUnderstandingFile(projectId), report);
  onProgress({ percent: 100, phase: "completed", message: "素材理解卡已生成，等待人工确认" });
  return report;
};

export const loadMaterialUnderstanding = async (projectId, project = undefined, { verifyContentHash = false } = {}) => {
  const report = await loadJson(materialUnderstandingFile(projectId), undefined);
  if (!report) return { status: "missing" };
  const currentProject = project ?? (await loadCreatorProject(projectId));
  const currentInventorySha256 = await materialUnderstandingInventoryFingerprint(projectId, currentProject);
  if (report.inventorySha256 !== currentInventorySha256) return { ...report, status: "stale", currentInventorySha256 };
  if (verifyContentHash) {
    const currentInputSha256 = await materialUnderstandingInputFingerprint(projectId, currentProject);
    if (report.inputSha256 !== currentInputSha256) return { ...report, status: "stale", currentInputSha256 };
  }
  return report;
};

export const confirmMaterialUnderstanding = async (projectId, inputSha256) => {
  const report = await loadMaterialUnderstanding(projectId, undefined, { verifyContentHash: true });
  if (report.status === "missing") throw new Error("请先让 Studio 分析资料和素材");
  if (report.status === "stale") throw new Error("资料或素材已变化，请重新生成理解卡");
  if (inputSha256 !== report.inputSha256) throw new Error("理解卡确认目标已变化，请刷新后重试");
  const confirmed = {
    ...report,
    status: "confirmed",
    confirmedAt: new Date().toISOString(),
  };
  await writeJsonAtomic(materialUnderstandingFile(projectId), confirmed);
  return confirmed;
};

export const assertConfirmedMaterialUnderstanding = async (projectId, project = undefined) => {
  const report = await loadMaterialUnderstanding(projectId, project, { verifyContentHash: true });
  if (report.status === "missing") throw new Error("请先分析并确认资料和素材理解卡");
  if (report.status === "stale") throw new Error("资料或素材已变化，请重新分析并确认理解卡");
  if (report.status !== "confirmed") throw new Error("请先人工确认 Studio 的资料和素材理解卡");
  return report;
};
