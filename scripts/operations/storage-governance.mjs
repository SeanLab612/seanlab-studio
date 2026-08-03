import { createHash } from "node:crypto";
import { lstat, mkdir, readdir, rm } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import { projectDir, writeJsonAtomic } from "../creator/project-store.mjs";
import { workflowContextForCreator } from "../creator/studio-workflow.mjs";
import { loadLocalProductPolicy } from "./local-product-policy.mjs";

const inside = (root, target) => {
  const value = relative(root, target);
  return value !== "" && !value.startsWith(`..${sep}`) && value !== ".." && !value.startsWith(sep);
};

const publicPath = (root, path) => relative(root, path).split(sep).join("/");

export const directoryUsage = async (root) => {
  let bytes = 0;
  let files = 0;
  const walk = async (directory) => {
    const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const path = resolve(directory, entry.name);
      const info = await lstat(path).catch(() => undefined);
      if (!info || info.isSymbolicLink()) continue;
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile()) {
        files += 1;
        bytes += info.size;
      }
    }
  };
  await walk(resolve(root));
  return { bytes, files };
};

const definitions = (workspace) => [
  {
    id: "delivery-segments",
    path: resolve(workspace, "clips_final_4k"),
    label: "4K 分段中间文件",
    reason: "最终成片验收后可以从批准快照重新生成",
  },
  {
    id: "technical-logs",
    path: resolve(workspace, "logs"),
    label: "历史技术日志",
    reason: "仅用于故障排查，不参与已批准内容或成片",
  },
  {
    id: "recut-attempts",
    path: resolve(workspace, "recut-proposal"),
    label: "历史粗剪尝试",
    reason: "当前粗剪结果和审批证据存放在其他受保护位置",
  },
];

const planHash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export const buildProjectStoragePlan = async ({ root, workspace, quotaBytes }) => {
  const absoluteRoot = resolve(root);
  const absoluteWorkspace = resolve(workspace);
  if (!inside(absoluteRoot, absoluteWorkspace))
    throw new Error("Workflow workspace must stay inside the creator project");
  const project = await directoryUsage(absoluteRoot);
  const candidates = [];
  for (const definition of definitions(absoluteWorkspace)) {
    if (!inside(absoluteRoot, definition.path)) throw new Error("Cleanup candidate escaped the creator project");
    const usage = await directoryUsage(definition.path);
    if (usage.bytes > 0)
      candidates.push({
        id: definition.id,
        path: publicPath(absoluteRoot, definition.path),
        label: definition.label,
        reason: definition.reason,
        ...usage,
      });
  }
  const binding = {
    projectBytes: project.bytes,
    projectFiles: project.files,
    candidates: candidates.map(({ id, path, bytes, files }) => ({ id, path, bytes, files })),
  };
  return {
    schemaVersion: "1.0",
    project: {
      ...project,
      quotaBytes,
      status: project.bytes > quotaBytes ? "over-quota" : "within-quota",
    },
    cleanupPreview: candidates,
    reclaimableBytes: candidates.reduce((sum, item) => sum + item.bytes, 0),
    planSha256: planHash(binding),
    protected: ["creator-project.json", "assets", "authoring", "review", "approved delivery", "current workflow state"],
  };
};

export const previewCreatorProjectStorage = async (projectId) => {
  const [{ context }, policy] = await Promise.all([workflowContextForCreator(projectId), loadLocalProductPolicy()]);
  return buildProjectStoragePlan({
    root: projectDir(projectId),
    workspace: context.paths.workspace,
    quotaBytes: policy.projectQuotaBytes,
  });
};

export const applyCreatorProjectCleanup = async ({
  projectId,
  planSha256,
  candidateIds,
  confirmation,
  reviewer = "Sean",
}) => {
  if (confirmation !== "delete-regenerable-cache")
    throw new Error("Safe cleanup requires the exact delete-regenerable-cache confirmation");
  if (!Array.isArray(candidateIds) || candidateIds.length === 0)
    throw new Error("Select at least one cleanup candidate");
  const [{ context }, policy] = await Promise.all([workflowContextForCreator(projectId), loadLocalProductPolicy()]);
  const root = projectDir(projectId);
  const plan = await buildProjectStoragePlan({
    root,
    workspace: context.paths.workspace,
    quotaBytes: policy.projectQuotaBytes,
  });
  if (plan.planSha256 !== planSha256)
    throw new Error("Cleanup preview is stale; generate a new preview before deleting");
  const selected = new Set(candidateIds);
  const unknown = [...selected].filter((id) => !plan.cleanupPreview.some((item) => item.id === id));
  if (unknown.length) throw new Error(`Cleanup candidates are not in the bound preview: ${unknown.join(", ")}`);
  const deleted = [];
  for (const item of plan.cleanupPreview.filter((candidate) => selected.has(candidate.id))) {
    const target = resolve(root, item.path);
    if (!inside(root, target)) throw new Error("Cleanup target escaped the creator project");
    await rm(target, { recursive: true, force: true });
    deleted.push(item);
  }
  const record = {
    schemaVersion: "1.0",
    kind: "creator-project-cleanup",
    projectId,
    reviewer,
    appliedAt: new Date().toISOString(),
    planSha256,
    deleted,
    reclaimedBytes: deleted.reduce((sum, item) => sum + item.bytes, 0),
  };
  const recordPath = resolve(root, "review", "maintenance", `cleanup-${Date.now()}.json`);
  await mkdir(resolve(root, "review", "maintenance"), { recursive: true });
  await writeJsonAtomic(recordPath, record);
  return { recordPath, record, current: await previewCreatorProjectStorage(projectId) };
};
