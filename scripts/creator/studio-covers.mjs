import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, extname, isAbsolute, resolve } from "node:path";
import { promisify } from "node:util";
import { brandIconGraphics } from "../../src/icons/brand-graphics.ts";
import { iconRegistry } from "../../src/icons/registry.ts";
import { studioSecureHeaders } from "../operations/http-security.mjs";
import { loadCreatorProject, projectDir, writeJsonAtomic } from "./project-store.mjs";

const run = promisify(execFile);
const systemIconSpritePath = resolve("public/icons/system/sprite.svg");
const coverRegistryPath = resolve("public/assets/covers/registry.json");
const coverFormatProfile = "creator-cover-3x4-portrait-4x3-landscape-v1";
const allowedPhotoExtensions = new Set([".png", ".webp"]);
const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const exists = async (path) => Boolean(await stat(path).catch(() => undefined));
const coverRoot = (projectId) => resolve(projectDir(projectId), "cover");
const publicCoverRoot = (projectId) => resolve("public/projects", projectId, "cover");
const statePath = (projectId) => resolve(coverRoot(projectId), "cover-state.json");
const outputPath = (projectId, format) => resolve(coverRoot(projectId), `cover-${format}.png`);
const propsPath = (projectId, format) => resolve(coverRoot(projectId), `cover-${format}-props.json`);
const hashFile = async (path) =>
  createHash("sha256")
    .update(await readFile(path))
    .digest("hex");

const clamp = (value, minimum, maximum, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, number)) : fallback;
};
const normalizeCrop = (value = {}) => ({
  x: clamp(value.x, 0, 100, 64),
  y: clamp(value.y, 0, 100, 42),
  zoom: clamp(value.zoom, 1, 2.5, 1),
});
const clampLine = (value) => [...String(value ?? "").trim()].slice(0, 12).join("");
const defaultTitleLines = (title) => {
  const normalized = String(title ?? "Creator Video")
    .replace(/[\s:：|]+/g, "")
    .trim();
  const chars = [...normalized];
  if (chars.length <= 12) return [clampLine(normalized), "本地视频工作流"];
  return [chars.slice(0, 10).join(""), chars.slice(10, 22).join("") || "本地视频工作流"];
};
const assertLine = (value, label) => {
  const line = clampLine(value);
  if (!line) throw new Error(`${label}不能为空`);
  return line;
};

const coverIconCatalog = async () => {
  const systemSprite = await readFile(systemIconSpritePath, "utf8");
  return Object.values(iconRegistry).flatMap((item) => {
    if (item.category === "brand") {
      const graphic = brandIconGraphics[item.id];
      return graphic
        ? [
            {
              id: item.id,
              category: item.category,
              label: item.label,
              assetKind: "brand-vector",
              svgPath: graphic.path,
              hex: graphic.hex,
              tileBackground: item.tileBackground,
              upstream: graphic.upstream,
            },
          ]
        : [];
    }
    return systemSprite.includes(`id="${item.id.replace("system.", "")}"`)
      ? [{ id: item.id, category: item.category, label: item.label, assetKind: "vector" }]
      : [];
  });
};
const catalog = async (portraitConfigured) => {
  const coverRegistry = await readJson(coverRegistryPath);
  if (coverRegistry.schemaVersion !== "1.0" || !Array.isArray(coverRegistry.backgrounds))
    throw new Error("封面背景目录无效");
  return {
    templates: coverRegistry.templates,
    people: portraitConfigured ? [{ id: "user-portrait", label: "我的照片" }] : [],
    backgrounds: coverRegistry.backgrounds,
    icons: await coverIconCatalog(),
  };
};
const readSavedState = async (projectId) => readJson(statePath(projectId)).catch(() => undefined);

const currentSelection = async (projectId, registry, saved) => {
  const project = await loadCreatorProject(projectId);
  const titleLines = defaultTitleLines(project.project.title);
  const eligibleIconIds = new Set(registry.icons.map((item) => item.id));
  const iconIds = (saved?.selection?.iconIds ?? []).filter((iconId) => eligibleIconIds.has(iconId)).slice(0, 4);
  const prior = saved?.selection ?? {};
  return {
    ...prior,
    templateId: registry.templates.some((item) => item.id === prior.templateId)
      ? prior.templateId
      : registry.templates[0].id,
    personId: saved?.portrait ? "user-portrait" : undefined,
    backgroundId: registry.backgrounds.some((item) => item.id === prior.backgroundId)
      ? prior.backgroundId
      : registry.backgrounds[0].id,
    titleLines,
    kicker: "LOCAL CREATOR VIDEO",
    badge: "CREATOR VIDEO",
    brandName: "",
    portraitCrop: normalizeCrop(saved?.portrait?.crop),
    iconIds,
  };
};

export const registerStudioCoverPortrait = async ({ projectId, sourcePath, crop }) => {
  const previous = await readSavedState(projectId);
  const requestedSource = typeof sourcePath === "string" ? sourcePath.trim() : "";
  let portrait = previous?.portrait;
  if (requestedSource) {
    if (!isAbsolute(requestedSource)) throw new Error("请填写人物照片的绝对路径");
    const source = resolve(requestedSource);
    const extension = extname(source).toLowerCase();
    if (!allowedPhotoExtensions.has(extension)) throw new Error("人物抠图仅支持透明背景 PNG 或 WebP");
    const info = await stat(source).catch(() => undefined);
    if (!info?.isFile()) throw new Error("人物照片不存在或不是文件");
    const destinationDirectory = publicCoverRoot(projectId);
    await mkdir(destinationDirectory, { recursive: true });
    const destination = resolve(destinationDirectory, `portrait${extension}`);
    await copyFile(source, destination);
    portrait = {
      assetPath: `projects/${projectId}/cover/portrait${extension}`,
      sourceName: basename(source),
      importedAt: new Date().toISOString(),
    };
  }
  if (!portrait?.assetPath) throw new Error("请填写人物照片的绝对路径");
  portrait = { ...portrait, crop: normalizeCrop(crop ?? portrait.crop) };
  await mkdir(coverRoot(projectId), { recursive: true });
  await writeJsonAtomic(statePath(projectId), {
    ...(previous ?? { schemaVersion: "1.0" }),
    formatProfile: coverFormatProfile,
    status: "not-generated",
    generatedAt: undefined,
    portrait,
    selection: { ...(previous?.selection ?? {}), personId: "user-portrait", portraitCrop: portrait.crop },
  });
  return loadStudioCover(projectId);
};

export const loadStudioCover = async (projectId) => {
  const saved = await readSavedState(projectId);
  const portraitConfigured = Boolean(
    saved?.portrait?.assetPath && (await exists(resolve("public", saved.portrait.assetPath))),
  );
  const registry = await catalog(portraitConfigured);
  const selection = await currentSelection(projectId, registry, saved);
  const landscape = outputPath(projectId, "landscape");
  const portrait = outputPath(projectId, "portrait");
  return {
    schemaVersion: "1.0",
    catalog: registry,
    selection,
    portraitConfigured,
    portrait: saved?.portrait,
    status: saved?.status ?? "not-generated",
    generatedAt: saved?.generatedAt,
    outputs: {
      landscape:
        saved?.status === "generated" && (await exists(landscape))
          ? { url: `/api/projects/${projectId}/cover/artifact/landscape`, sha256: await hashFile(landscape) }
          : undefined,
      portrait:
        saved?.status === "generated" && (await exists(portrait))
          ? { url: `/api/projects/${projectId}/cover/artifact/portrait`, sha256: await hashFile(portrait) }
          : undefined,
    },
  };
};

export const renderStudioCover = async ({ projectId, selection: input }) => {
  const saved = await readSavedState(projectId);
  if (!saved?.portrait?.assetPath || !(await exists(resolve("public", saved.portrait.assetPath))))
    throw new Error("请先导入自己的封面人物照片并确认裁剪位置");
  const registry = await catalog(true);
  const template = registry.templates.find((item) => item.id === input.templateId);
  const background = registry.backgrounds.find((item) => item.id === input.backgroundId);
  if (!template) throw new Error("封面模板不在已注册列表中");
  if (!background) throw new Error("封面背景不在已注册列表中");
  const requestedIconIds = Array.isArray(input.iconIds)
    ? input.iconIds.map((iconId) => String(iconId).trim()).filter(Boolean)
    : [];
  if (requestedIconIds.length > 4 || new Set(requestedIconIds).size !== requestedIconIds.length)
    throw new Error("封面最多选择 4 个不重复图标");
  const eligibleIconIds = new Set(registry.icons.map((item) => item.id));
  if (requestedIconIds.some((iconId) => !eligibleIconIds.has(iconId)))
    throw new Error("封面图标必须来自已核对的本地图标目录");
  const titleLines = [assertLine(input.titleLines?.[0], "封面第一行"), assertLine(input.titleLines?.[1], "封面第二行")];
  if (input.titleLines?.[2]?.trim()) titleLines.push(assertLine(input.titleLines[2], "封面第三行"));
  const portraitCrop = normalizeCrop(input.portraitCrop ?? saved.portrait.crop);
  const selection = {
    templateId: template.id,
    personId: "user-portrait",
    backgroundId: background.id,
    iconIds: requestedIconIds,
    titleLines,
    portraitCrop,
    brandName: String(input.brandName ?? "")
      .trim()
      .slice(0, 20),
    kicker:
      String(input.kicker ?? "LOCAL CREATOR VIDEO")
        .trim()
        .slice(0, 24) || "LOCAL CREATOR VIDEO",
    badge:
      String(input.badge ?? "CREATOR VIDEO")
        .trim()
        .slice(0, 16) || "CREATOR VIDEO",
    supportingFacts: ["写稿与素材", "视觉分镜", "本地交付"],
  };
  await mkdir(coverRoot(projectId), { recursive: true });
  for (const format of ["landscape", "portrait"]) {
    const backgroundAsset = String(background[format] ?? "");
    if (!/^assets\/covers\/backgrounds\/[a-z0-9-]+\.png$/.test(backgroundAsset))
      throw new Error("封面背景路径未通过安全校验");
    const backgroundHash = await hashFile(resolve("public", backgroundAsset));
    if (backgroundHash !== background[`${format}Sha256`]) throw new Error("封面背景文件与入库记录不一致");
    const props = {
      schemaVersion: "1.0",
      templateId: template.id,
      titleLines,
      kicker: selection.kicker,
      badge: selection.badge,
      brandName: selection.brandName,
      iconIds: selection.iconIds,
      supportingFacts: selection.supportingFacts,
      portraitSrc: saved.portrait.assetPath,
      generatedBackgroundSrc: backgroundAsset,
      portraitTreatment: "transparent-cutout",
      portraitCrop,
      theme: background.theme,
      accents: background.accents,
    };
    await writeFile(propsPath(projectId, format), `${JSON.stringify(props, null, 2)}\n`);
    await run(
      "npx",
      [
        "remotion",
        "still",
        "src/index.ts",
        format === "landscape" ? "CoverAssetPackLandscape" : "CoverAssetPackPortrait",
        outputPath(projectId, format),
        "--frame",
        "0",
        "--props",
        propsPath(projectId, format),
      ],
      { cwd: process.cwd(), maxBuffer: 24 * 1024 * 1024 },
    );
  }
  await writeJsonAtomic(statePath(projectId), {
    schemaVersion: "1.0",
    formatProfile: coverFormatProfile,
    status: "generated",
    generatedAt: new Date().toISOString(),
    portrait: { ...saved.portrait, crop: portraitCrop },
    selection,
    renderer: "remotion-local",
  });
  return loadStudioCover(projectId);
};

export const streamStudioCover = async (response, projectId, format, { download = false } = {}) => {
  if (!["landscape", "portrait"].includes(format)) throw new Error("不支持的封面比例");
  const path = outputPath(projectId, format);
  const info = await stat(path).catch(() => undefined);
  if (!info) throw new Error("封面尚未生成");
  response.writeHead(200, {
    ...studioSecureHeaders,
    "content-type": "image/png",
    "content-length": info.size,
    ...(download
      ? {
          "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`${projectId}-cover-${format}.png`)}`,
        }
      : {}),
    "cache-control": "no-store",
  });
  return createReadStream(path).pipe(response);
};

export const streamStudioCoverCatalogAsset = async (response, projectId, kind) => {
  if (kind !== "person") throw new Error("公开版背景由本地样式生成，不读取预置背景图片");
  const saved = await readSavedState(projectId);
  const relativePath = saved?.portrait?.assetPath;
  if (!relativePath || relativePath.includes("..")) throw new Error("请先导入人物照片");
  const path = resolve("public", relativePath);
  const info = await stat(path).catch(() => undefined);
  if (!info) throw new Error("人物照片文件不存在");
  response.writeHead(200, {
    ...studioSecureHeaders,
    "content-type": { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" }[
      extname(path).toLowerCase()
    ],
    "content-length": info.size,
    "cache-control": "private, max-age=300",
  });
  return createReadStream(path).pipe(response);
};
