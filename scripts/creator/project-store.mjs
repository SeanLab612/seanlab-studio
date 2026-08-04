import { createHash, randomUUID } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, extname, resolve } from "node:path";
import { homedir } from "node:os";
import { createReadStream } from "node:fs";
import { validateCreatorProject } from "../../src/creator-workflow/contract.ts";
import { createEmptyEditorialBrief, normalizeEditorialBrief } from "../../src/creator-workflow/editorial-brief.ts";

export const creatorRoot = resolve(process.env.REMOTION_MD_CREATOR_ROOT ?? "projects");
const idPattern = /^[a-z0-9][a-z0-9-]{1,62}$/;
const assertId = (id) => {
  if (!idPattern.test(id ?? "")) throw new Error("Invalid creator project id");
  return id;
};
export const projectDir = (id) => resolve(creatorRoot, assertId(id));
export const projectFile = (id) => resolve(projectDir(id), "creator-project.json");

export const writeJsonAtomic = async (path, value) => {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporary, path);
};

export const createCreatorProject = async ({
  id,
  title,
  topic,
  creatorNotes,
  category,
  workflowMode = "script-first",
  agentId,
  model,
  sources = [],
  materials = [],
}) => {
  const now = new Date().toISOString();
  const value = validateCreatorProject({
    schemaVersion: "1.0",
    project: { id: assertId(id), title, createdAt: now, updatedAt: now, status: "intake", workflowMode },
    agent: {
      id: agentId,
      ...(model ? { model } : {}),
      fallback: "none",
      authoringContractVersion: "1.0",
      semanticContractVersion: "1.1",
    },
    typography: { version: "typography-2.0", mode: "auto" },
    brief: {
      topic,
      category,
      ...(typeof creatorNotes === "string" && creatorNotes.trim() ? { creatorNotes: creatorNotes.trim() } : {}),
      editorialBrief: createEmptyEditorialBrief(),
    },
    sources,
    materials,
    authoring: { state: "not-started" },
    video: {},
  });
  await mkdir(creatorRoot, { recursive: true });
  try {
    await mkdir(projectDir(id));
  } catch (error) {
    if (error?.code === "EEXIST") throw new Error(`创作项目已存在：${id}`);
    throw error;
  }
  try {
    await writeJsonAtomic(projectFile(id), value);
    return value;
  } catch (error) {
    await rm(projectDir(id), { recursive: true, force: true });
    throw error;
  }
};

export const loadCreatorProject = async (id) =>
  validateCreatorProject(JSON.parse(await readFile(projectFile(assertId(id)), "utf8")));

export const saveCreatorProject = async (value) => {
  value.project.updatedAt = new Date().toISOString();
  validateCreatorProject(value);
  await writeJsonAtomic(projectFile(value.project.id), value);
  return value;
};

export const renameCreatorProject = async (id, title) => {
  const normalizedTitle = typeof title === "string" ? title.trim() : "";
  if (!normalizedTitle) throw new Error("项目名称不能为空");
  if (normalizedTitle.length > 80) throw new Error("项目名称不能超过 80 个字符");
  const project = await loadCreatorProject(id);
  project.project.title = normalizedTitle;
  return saveCreatorProject(project);
};

export const deleteCreatorProject = async ({ id, confirmation }) => {
  const project = await loadCreatorProject(id);
  if (typeof confirmation !== "string" || confirmation.trim() !== project.project.title)
    throw new Error(`请输入完整项目名称“${project.project.title}”以确认删除`);
  const root = projectDir(id);
  await rm(root, { recursive: true, force: true });
  return { id, title: project.project.title, deleted: true };
};

const sourceKindFor = (value) => (/^https?:\/\//.test(value) ? "url" : value.startsWith("/") ? "file" : "note");

export const normalizeCreatorSource = ({ label, value }) => {
  const normalizedLabel = typeof label === "string" ? label.trim() : "";
  const normalizedValue = typeof value === "string" ? value.trim() : "";
  if (!normalizedLabel) throw new Error("请填写参考资料名称");
  if (!normalizedValue) throw new Error("请填写参考资料内容、网址或文件路径");
  return { kind: sourceKindFor(normalizedValue), label: normalizedLabel, value: normalizedValue };
};

export const addCreatorSource = async ({ projectId, label, value }) => {
  const project = await loadCreatorProject(projectId);
  const normalized = normalizeCreatorSource({ label, value });
  const duplicate = project.sources.find(
    (item) => item.kind === normalized.kind && item.value.trim() === normalized.value,
  );
  if (duplicate) throw new Error(`参考资料已存在：${duplicate.label}`);
  project.sources.push({ id: `source-${project.sources.length + 1}`, ...normalized });
  return saveCreatorProject(project);
};

export const updateCreatorEditorialBrief = async ({ projectId, editorialBrief }) => {
  const project = await loadCreatorProject(projectId);
  if (project.authoring.state !== "not-started")
    throw new Error("口播稿开始生成后不能直接修改写作方向，请在审稿页使用重写功能");
  project.brief.editorialBrief = {
    ...normalizeEditorialBrief(project.brief.category, editorialBrief),
    updatedAt: new Date().toISOString(),
  };
  return saveCreatorProject(project);
};

export const listCreatorProjects = async () => {
  const inventory = await inspectCreatorProjects();
  return inventory.projects;
};

export const inspectCreatorProjects = async () => {
  await mkdir(creatorRoot, { recursive: true });
  const entries = await readdir(creatorRoot, { withFileTypes: true });
  const projects = [];
  const invalidProjects = [];
  for (const entry of entries.filter((item) => item.isDirectory())) {
    const candidate = resolve(creatorRoot, entry.name, "creator-project.json");
    const candidateInfo = await stat(candidate).catch(() => undefined);
    if (!candidateInfo?.isFile()) continue;
    try {
      projects.push(await loadCreatorProject(entry.name));
    } catch (error) {
      invalidProjects.push({
        id: entry.name,
        path: resolve(creatorRoot, entry.name),
        error: String(error?.message ?? error).slice(0, 1000),
      });
    }
  }
  return {
    projects: projects.sort((a, b) => b.project.createdAt.localeCompare(a.project.createdAt)),
    invalidProjects: invalidProjects.sort((a, b) => a.id.localeCompare(b.id)),
  };
};

export const normalizeLocalPath = (sourcePath) => {
  if (typeof sourcePath !== "string") throw new Error("素材路径必须是文本");
  let value = sourcePath.trim();
  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
  ) {
    value = value.slice(1, -1).trim();
  }
  if (!value || value.includes("\0")) throw new Error("请输入有效的素材绝对路径");
  if (value === "~" || value.startsWith("~/")) value = `${homedir()}${value.slice(1)}`;
  return resolve(value);
};

export const hashFile = (path) =>
  new Promise((done, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(path);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => done(hash.digest("hex")));
  });

export const defaultMaterialRequired = (kind) => !["screenshot", "screen-recording"].includes(kind);

const imageAssetExtensions = new Set([".avif", ".gif", ".heic", ".jpeg", ".jpg", ".png", ".webp"]);
const videoAssetExtensions = new Set([".m4v", ".mkv", ".mov", ".mp4", ".webm"]);
const scriptExtensions = new Set([".md", ".srt", ".txt", ".vtt"]);

export const inferCreatorAssetKind = (sourcePath) => {
  const extension = extname(String(sourcePath ?? "")).toLowerCase();
  if (imageAssetExtensions.has(extension)) return "screenshot";
  if (videoAssetExtensions.has(extension)) return "screen-recording";
  return "reference";
};

export const importCreatorInputScript = async ({ projectId, sourcePath }) => {
  const project = await loadCreatorProject(projectId);
  if ((project.project.workflowMode ?? "script-first") !== "visual-post-production")
    throw new Error("只有“已有口播视频”项目可以导入口播稿");
  const source = normalizeLocalPath(sourcePath);
  const extension = extname(source).toLowerCase();
  if (!scriptExtensions.has(extension)) throw new Error("口播稿仅支持 TXT、Markdown、SRT 或 VTT 文件");
  const info = await stat(source).catch((error) => {
    if (error?.code === "ENOENT") throw new Error(`找不到口播稿：${source}`);
    throw error;
  });
  if (!info.isFile() || info.size === 0) throw new Error("口播稿必须是非空文件");
  if (info.size > 2_000_000) throw new Error("口播稿文件不能超过 2 MB");
  const relativePath = `authoring/input-script${extension}`;
  const destination = resolve(projectDir(projectId), relativePath);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(source, destination);
  project.authoring.inputScript = relativePath;
  const existing = project.sources.find((item) => item.id === "source-input-script");
  const sourceEntry = { id: "source-input-script", kind: "file", label: "已有口播稿（原文）", value: destination };
  if (existing) Object.assign(existing, sourceEntry);
  else project.sources.unshift(sourceEntry);
  await saveCreatorProject(project);
  return { path: relativePath, fileName: basename(source), bytes: info.size };
};

export const validateCreatorAssetKind = (source, kind) => {
  const extension = extname(source).toLowerCase();
  if (kind === "screenshot" && !imageAssetExtensions.has(extension))
    throw new Error("图片或截图必须选择有效的图片文件");
  if (kind === "screen-recording" && !videoAssetExtensions.has(extension))
    throw new Error("录屏必须选择有效的视频文件");
  if (kind === "speaker-video" && !videoAssetExtensions.has(extension))
    throw new Error("人物口播原片必须选择有效的视频文件");
};

const duplicateMaterialFor = async ({ project, projectId, source, bytes }) => {
  const sourceSha256 = await hashFile(source);
  for (const material of project.materials) {
    if (!material.assetId) continue;
    try {
      const existing = await resolveCreatorAsset(projectId, material.assetId);
      const info = await stat(existing);
      if (info.size === bytes && (await hashFile(existing)) === sourceSha256) return material;
    } catch {}
  }
  return undefined;
};

export const importCreatorAsset = async ({
  projectId,
  sourcePath,
  kind,
  label,
  description,
  evidenceRole,
  sourceLabel,
  fit,
  focalPoint,
}) => {
  const supportedKinds = new Set(["screenshot", "screen-recording", "reference", "speaker-video"]);
  if (!supportedKinds.has(kind)) throw new Error(`不支持的素材类型：${kind}`);
  const project = await loadCreatorProject(projectId);
  const source = normalizeLocalPath(sourcePath);
  let info;
  try {
    info = await stat(source);
  } catch (error) {
    if (error?.code === "ENOENT") throw new Error(`找不到素材文件：${source}`);
    throw error;
  }
  if (!info.isFile() || info.size === 0) throw new Error("Asset must be a non-empty file");
  validateCreatorAssetKind(source, kind);
  const duplicate = await duplicateMaterialFor({ project, projectId, source, bytes: info.size });
  if (duplicate) throw new Error(`素材已登记：${duplicate.label}`);
  const assetId = `asset-${randomUUID().slice(0, 8)}`;
  const fileName = `${assetId}${extname(source).toLowerCase()}`;
  const destination = resolve(projectDir(projectId), "assets", fileName);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(source, destination);
  const materialSequence = project.materials.reduce((highest, item) => {
    const match = /^material-(\d+)$/.exec(item.id);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0);
  const materialId = `material-${materialSequence + 1}`;
  const normalizedEvidenceRole = new Set(["interface", "result", "source", "comparison", "document", "other"]).has(
    evidenceRole,
  )
    ? evidenceRole
    : "interface";
  const material = {
    id: materialId,
    kind,
    label: label?.trim() || basename(source),
    assetId,
    required: defaultMaterialRequired(kind),
    ...(kind === "screenshot"
      ? {
          description: description?.trim() || label?.trim() || basename(source),
          evidenceRole: normalizedEvidenceRole,
          sourceLabel: sourceLabel?.trim() || undefined,
          fit: fit === "cover" ? "cover" : "contain",
          focalPoint:
            focalPoint && Number.isFinite(focalPoint.x) && Number.isFinite(focalPoint.y)
              ? { x: Math.max(0, Math.min(1, focalPoint.x)), y: Math.max(0, Math.min(1, focalPoint.y)) }
              : { x: 0.5, y: 0.5 },
        }
      : {}),
  };
  project.materials.push(material);
  if (kind === "speaker-video" && (project.project.workflowMode ?? "script-first") === "visual-post-production")
    project.video.sourceAssetId = assetId;
  try {
    await saveCreatorProject(project);
    return {
      assetId,
      materialId,
      material,
      materialCount: project.materials.length,
      path: destination,
      bytes: info.size,
    };
  } catch (error) {
    await rm(destination, { force: true });
    throw error;
  }
};

export const deleteCreatorMaterial = async ({ projectId, materialId }) => {
  if (!idPattern.test(materialId ?? "")) throw new Error("素材编号无效");
  const project = await loadCreatorProject(projectId);
  if (project.authoring.state !== "not-started")
    throw new Error("口播稿开始生成后不能直接删除素材，请先在视觉方案中解除引用");
  const index = project.materials.findIndex((item) => item.id === materialId);
  if (index < 0) throw new Error(`找不到素材：${materialId}`);
  const [material] = project.materials.splice(index, 1);
  let originalPath;
  let recoveryPath;
  if (material.assetId) {
    originalPath = await resolveCreatorAsset(projectId, material.assetId).catch(() => undefined);
    if (originalPath) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      recoveryPath = resolve(projectDir(projectId), "assets/.trash", `${timestamp}-${basename(originalPath)}`);
      await mkdir(dirname(recoveryPath), { recursive: true });
      await rename(originalPath, recoveryPath);
    }
  }
  if (project.video.sourceAssetId === material.assetId) delete project.video.sourceAssetId;
  try {
    await saveCreatorProject(project);
  } catch (error) {
    if (originalPath && recoveryPath) await rename(recoveryPath, originalPath).catch(() => {});
    throw error;
  }
  return {
    deleted: true,
    material,
    materialCount: project.materials.length,
    recoverable: Boolean(recoveryPath),
  };
};

export const resolveCreatorAsset = async (projectId, assetId) => {
  const entries = await readdir(resolve(projectDir(projectId), "assets"));
  const file = entries.find((item) => item.startsWith(`${assetId}.`));
  if (!file) throw new Error(`Creator asset not found: ${assetId}`);
  return resolve(projectDir(projectId), "assets", file);
};
