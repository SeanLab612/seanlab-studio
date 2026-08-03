import { createHash, randomUUID } from "node:crypto";
import { copyFile, mkdir, readFile, stat } from "node:fs/promises";
import { basename, extname, isAbsolute, relative, resolve } from "node:path";
import { creatorRoot, projectDir, writeJsonAtomic } from "./project-store.mjs";

const projectRegistryFile = (projectId) => resolve(projectDir(projectId), "generated-assets", "registry.json");
const imageLibraryRoot = () => resolve(creatorRoot, ".asset-library", "images");
const imageLibraryRegistryFile = () => resolve(imageLibraryRoot(), "registry.json");
const legacySharedRoot = () => resolve(creatorRoot, ".asset-library", "generated");
const legacySharedRegistryFile = () => resolve(legacySharedRoot(), "registry.json");
const supportedImageExtensions = new Set([".jpeg", ".jpg", ".png", ".webp"]);

const resolveInside = (root, candidate, label) => {
  if (typeof candidate !== "string" || !candidate || isAbsolute(candidate))
    throw new Error(`${label} must be a project-relative path`);
  const absolute = resolve(root, candidate);
  const child = relative(root, absolute);
  if (!child || child.startsWith("..") || isAbsolute(child))
    throw new Error(`${label} escapes the generated asset directory`);
  return absolute;
};

const readRegistry = async (path) => {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    return { schemaVersion: "1.0", assets: [] };
  }
};

const editableImageAssetTextFields = {
  displayName: 80,
  subject: 120,
  description: 500,
  style: 80,
};
const editableImageAssetListFields = {
  aliases: { items: 30, length: 80 },
  keywords: { items: 40, length: 80 },
  tags: { items: 40, length: 80 },
  applicableScenes: { items: 30, length: 120 },
  excludedTerms: { items: 30, length: 80 },
};

const normalizeMetadataText = (value, field, maxLength) => {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new Error(`Image asset ${field} must be text`);
  const normalized = value.normalize("NFKC").replace(/\s+/g, " ").trim();
  if (normalized.length > maxLength) throw new Error(`Image asset ${field} is too long`);
  return normalized;
};

const normalizeMetadataList = (value, field, { items, length }) => {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error(`Image asset ${field} must be a list`);
  if (value.length > items) throw new Error(`Image asset ${field} has too many values`);
  const normalized = value.map((item) => normalizeMetadataText(item, field, length)).filter(Boolean);
  return [...new Set(normalized)];
};

export const normalizeImageAssetMetadata = (input) => {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Image asset metadata must be an object");
  return {
    ...Object.fromEntries(
      Object.entries(editableImageAssetTextFields).map(([field, maxLength]) => [
        field,
        normalizeMetadataText(input[field], field, maxLength),
      ]),
    ),
    ...Object.fromEntries(
      Object.entries(editableImageAssetListFields).map(([field, limits]) => [
        field,
        normalizeMetadataList(input[field], field, limits),
      ]),
    ),
  };
};

const sha256 = async (path) =>
  createHash("sha256")
    .update(await readFile(path))
    .digest("hex");

export const recordGeneratedAsset = async ({
  projectId,
  sourcePath,
  productionPath,
  subject,
  beatId,
  templateId,
  prompt,
  negativePrompt,
  agentId,
  model,
  references = [],
}) => {
  const id = `generated-${randomUUID()}`;
  const directory = resolve(projectDir(projectId), "generated-assets", id);
  await mkdir(directory, { recursive: true });
  const originalName = `original${extname(sourcePath).toLowerCase() || ".png"}`;
  const productionName = `production${extname(productionPath ?? sourcePath).toLowerCase() || ".png"}`;
  const original = resolve(directory, originalName);
  const production = resolve(directory, productionName);
  await copyFile(sourcePath, original);
  await copyFile(productionPath ?? sourcePath, production);
  const info = await stat(production);
  const now = new Date().toISOString();
  const asset = {
    id,
    projectId,
    status: "project-only",
    subject,
    beatId,
    templateId,
    prompt,
    negativePrompt,
    agentId,
    ...(model ? { model } : {}),
    references,
    files: {
      original: `${id}/${originalName}`,
      production: `${id}/${productionName}`,
    },
    sha256: await sha256(production),
    bytes: info.size,
    createdAt: now,
  };
  const registry = await readRegistry(projectRegistryFile(projectId));
  registry.assets.push(asset);
  await writeJsonAtomic(projectRegistryFile(projectId), registry);
  return asset;
};

export const listProjectGeneratedAssets = async (projectId) =>
  (await readRegistry(projectRegistryFile(projectId))).assets;

export const listGeneratedAssetCandidates = async () => {
  const { readdir } = await import("node:fs/promises");
  const entries = await readdir(creatorRoot, { withFileTypes: true }).catch(() => []);
  const results = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    const assets = await listProjectGeneratedAssets(entry.name).catch(() => []);
    results.push(...assets.filter((asset) => asset.status === "project-only"));
  }
  return results.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
};

const libraryRegistries = async () => [
  {
    file: legacySharedRegistryFile(),
    root: legacySharedRoot(),
    registry: await readRegistry(legacySharedRegistryFile()),
    priority: 0,
  },
  {
    file: imageLibraryRegistryFile(),
    root: imageLibraryRoot(),
    registry: await readRegistry(imageLibraryRegistryFile()),
    priority: 1,
  },
];

const libraryEntries = async () => {
  const entries = new Map();
  for (const source of await libraryRegistries())
    for (const asset of source.registry.assets)
      entries.set(asset.id, {
        asset: { ...asset, origin: asset.origin ?? "generated" },
        root: source.root,
        registryFile: source.file,
        priority: source.priority,
      });
  return entries;
};

const annotateExactDuplicates = (assets) => {
  const bySha256 = new Map();
  for (const asset of assets) {
    if (typeof asset.sha256 !== "string" || !asset.sha256) continue;
    const group = bySha256.get(asset.sha256) ?? [];
    group.push(asset.id);
    bySha256.set(asset.sha256, group);
  }
  return assets.map((asset) => {
    const duplicateAssetIds = (bySha256.get(asset.sha256) ?? []).filter((id) => id !== asset.id);
    return duplicateAssetIds.length ? { ...asset, duplicateAssetIds } : asset;
  });
};

export const listPromotedImageAssets = async () =>
  annotateExactDuplicates(
    [...(await libraryEntries()).values()]
      .map(({ asset }) => asset)
      .sort((a, b) => (b.promotedAt ?? b.createdAt ?? "").localeCompare(a.promotedAt ?? a.createdAt ?? "")),
  );

export const getPromotedImageAsset = async (assetId) => {
  if (typeof assetId !== "string" || !assetId) throw new Error("Invalid image asset id");
  const entry = (await libraryEntries()).get(assetId);
  if (!entry) throw new Error("Image asset not found");
  return entry.asset;
};

const normalizeAssetIds = (assetIds) => {
  if (!Array.isArray(assetIds) || assetIds.length === 0) throw new Error("Select at least one image asset");
  if (assetIds.length > 100) throw new Error("Image asset update is limited to 100 assets");
  const normalized = assetIds.map((assetId) => {
    if (typeof assetId !== "string" || !assetId) throw new Error("Invalid image asset id");
    return assetId;
  });
  if (new Set(normalized).size !== normalized.length) throw new Error("Image asset selections must be unique");
  return normalized;
};

const editableAssetLocation = async (assetId) => {
  if (typeof assetId !== "string" || !assetId) throw new Error("Invalid image asset id");
  const registries = await libraryRegistries();
  for (const source of [...registries].sort((left, right) => right.priority - left.priority)) {
    const asset = source.registry.assets.find((candidate) => candidate.id === assetId);
    if (asset) return { source, asset };
  }
  throw new Error("Image asset not found");
};

export const updatePromotedImageAssetMetadata = async ({ assetId, metadata }) => {
  const normalized = normalizeImageAssetMetadata(metadata);
  const { source, asset } = await editableAssetLocation(assetId);
  Object.assign(asset, normalized, { metadataUpdatedAt: new Date().toISOString() });
  await writeJsonAtomic(source.file, source.registry);
  return await getPromotedImageAsset(assetId);
};

export const addPromotedImageAssetTagsBatch = async ({ assetIds, tags }) => {
  const normalizedIds = normalizeAssetIds(assetIds);
  const normalizedTags = normalizeMetadataList(tags, "tags", editableImageAssetListFields.tags);
  if (!normalizedTags.length) throw new Error("Add at least one image asset tag");
  const registries = await libraryRegistries();
  const touched = new Set();
  const updated = [];
  for (const assetId of normalizedIds) {
    let located;
    for (const source of [...registries].sort((left, right) => right.priority - left.priority)) {
      const asset = source.registry.assets.find((candidate) => candidate.id === assetId);
      if (asset) {
        located = { source, asset };
        break;
      }
    }
    if (!located) throw new Error("Image asset not found");
    located.asset.tags = [
      ...new Set([...(Array.isArray(located.asset.tags) ? located.asset.tags : []), ...normalizedTags]),
    ];
    located.asset.metadataUpdatedAt = new Date().toISOString();
    touched.add(located.source.file);
    updated.push(located.asset);
  }
  for (const source of registries) if (touched.has(source.file)) await writeJsonAtomic(source.file, source.registry);
  return updated;
};

const normalizeSelections = (selections) => {
  if (!Array.isArray(selections) || selections.length === 0)
    throw new Error("Select at least one generated asset to promote");
  if (selections.length > 100) throw new Error("Generated asset promotion is limited to 100 assets");
  const unique = new Map();
  for (const selection of selections) {
    const projectId = selection?.projectId;
    const assetId = selection?.assetId;
    projectDir(projectId);
    if (typeof assetId !== "string" || !assetId) throw new Error("Invalid generated asset id");
    const key = `${projectId}\0${assetId}`;
    if (unique.has(key)) throw new Error("Generated asset selections must be unique");
    unique.set(key, { projectId, assetId });
  }
  return [...unique.values()];
};

export const promoteGeneratedAssetsBatch = async ({ selections }) => {
  const normalized = normalizeSelections(selections);
  const registries = new Map();
  const validated = [];
  for (const selection of normalized) {
    let registry = registries.get(selection.projectId);
    if (!registry) {
      registry = await readRegistry(projectRegistryFile(selection.projectId));
      registries.set(selection.projectId, registry);
    }
    const asset = registry.assets.find((candidate) => candidate.id === selection.assetId);
    if (!asset) throw new Error("Generated asset not found");
    if (asset.status === "promoted") {
      validated.push({ ...selection, asset, alreadyPromoted: true });
      continue;
    }
    if (asset.status !== "project-only") throw new Error("Generated asset is not eligible for promotion");
    const extension = extname(asset.files?.production ?? "").toLowerCase();
    if (!supportedImageExtensions.has(extension)) throw new Error("Unsupported generated asset image format");
    const source = resolveInside(
      resolve(projectDir(selection.projectId), "generated-assets"),
      asset.files.production,
      "Generated asset production file",
    );
    await stat(source);
    if ((await sha256(source)) !== asset.sha256) throw new Error("Generated asset checksum does not match");
    validated.push({ ...selection, asset, extension, source, alreadyPromoted: false });
  }

  const shared = await readRegistry(imageLibraryRegistryFile());
  const promotedAt = new Date().toISOString();
  for (const item of validated) {
    if (item.alreadyPromoted) continue;
    const targetDirectory = resolve(imageLibraryRoot(), item.asset.id);
    await mkdir(targetDirectory, { recursive: true });
    const target = resolve(targetDirectory, `asset${item.extension}`);
    await copyFile(item.source, target);
    item.asset.status = "promoted";
    item.asset.promotedAt = promotedAt;
    if (!shared.assets.some((candidate) => candidate.id === item.asset.id))
      shared.assets.push({
        ...item.asset,
        origin: "generated",
        sourceProjectId: item.projectId,
        file: `${item.asset.id}/${basename(target)}`,
      });
  }
  for (const [projectId, registry] of registries)
    if (validated.some((item) => item.projectId === projectId && !item.alreadyPromoted))
      await writeJsonAtomic(projectRegistryFile(projectId), registry);
  if (validated.some((item) => !item.alreadyPromoted)) await writeJsonAtomic(imageLibraryRegistryFile(), shared);
  return validated.map(({ asset }) => asset);
};

export const promoteGeneratedAsset = async ({ projectId, assetId }) =>
  (await promoteGeneratedAssetsBatch({ selections: [{ projectId, assetId }] }))[0];

export const resolveGeneratedAssetPreview = async ({ projectId, assetId }) => {
  const assets = await listProjectGeneratedAssets(projectId);
  const asset = assets.find((candidate) => candidate.id === assetId);
  if (!asset) throw new Error("Generated asset not found");
  const path = resolveInside(
    resolve(projectDir(projectId), "generated-assets"),
    asset.files.production,
    "Generated asset preview file",
  );
  const info = await stat(path);
  return { path, size: info.size };
};

export const resolveImageAssetPreview = async ({ assetId }) => {
  if (typeof assetId !== "string" || !assetId) throw new Error("Invalid image asset id");
  const entry = (await libraryEntries()).get(assetId);
  if (!entry) throw new Error("Image asset not found");
  const path = resolveInside(entry.root, entry.asset.file, "Image asset preview file");
  const info = await stat(path);
  return { path, size: info.size };
};
