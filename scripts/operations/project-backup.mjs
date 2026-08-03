import { createHash, randomUUID } from "node:crypto";
import { constants, createReadStream } from "node:fs";
import { copyFile, mkdir, readFile, readdir, rename, rm, stat } from "node:fs/promises";
import { basename, dirname, relative, resolve, sep } from "node:path";
import { creatorRoot, loadCreatorProject, projectDir, writeJsonAtomic } from "../creator/project-store.mjs";
import { loadLocalProductPolicy } from "./local-product-policy.mjs";

const backupRootDefault = () => resolve(process.env.REMOTION_MD_BACKUP_ROOT ?? "studio-data/backups");
const safeId = (value) => {
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(value ?? "")) throw new Error("Invalid creator project id");
  return value;
};
const inside = (root, target) => {
  const value = relative(root, target);
  return value === "" || (!value.startsWith(`..${sep}`) && value !== ".." && !value.startsWith(sep));
};
const hashFile = (path) =>
  new Promise((done, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(path);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => done(hash.digest("hex")));
  });

const inventory = async (root, current = root) => {
  const records = [];
  for (const entry of await readdir(current, { withFileTypes: true })) {
    const path = resolve(current, entry.name);
    if (!inside(root, path)) throw new Error("Backup inventory escaped its root");
    if (entry.isSymbolicLink()) throw new Error(`Project backup refuses symbolic links: ${path}`);
    if (entry.isDirectory()) records.push(...(await inventory(root, path)));
    else if (entry.isFile()) {
      const info = await stat(path);
      records.push({
        path: relative(root, path).split(sep).join("/"),
        bytes: info.size,
        sha256: await hashFile(path),
      });
    }
  }
  return records.sort((left, right) => left.path.localeCompare(right.path));
};

const copyTree = async (source, destination) => {
  await mkdir(destination, { recursive: true });
  for (const entry of await readdir(source, { withFileTypes: true })) {
    const from = resolve(source, entry.name);
    const to = resolve(destination, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Project backup refuses symbolic links: ${from}`);
    if (entry.isDirectory()) await copyTree(from, to);
    else if (entry.isFile()) {
      await mkdir(dirname(to), { recursive: true });
      try {
        await copyFile(from, to, constants.COPYFILE_FICLONE);
      } catch {
        await copyFile(from, to);
      }
    }
  }
};

const backupManifest = async (path) => JSON.parse(await readFile(resolve(path, "backup-manifest.json"), "utf8"));

export const verifyProjectBackup = async (backupPath) => {
  const root = resolve(backupPath);
  const manifest = await backupManifest(root);
  const payload = resolve(root, "project");
  const findings = [];
  const current = await inventory(payload).catch((error) => {
    findings.push({ rule: "inventory.read", message: error.message });
    return [];
  });
  const byPath = new Map(current.map((item) => [item.path, item]));
  for (const expected of manifest.inventory ?? []) {
    const actual = byPath.get(expected.path);
    if (!actual) findings.push({ rule: "inventory.missing", path: expected.path });
    else if (actual.bytes !== expected.bytes || actual.sha256 !== expected.sha256)
      findings.push({ rule: "inventory.hash", path: expected.path });
    byPath.delete(expected.path);
  }
  for (const path of byPath.keys()) findings.push({ rule: "inventory.unlisted", path });
  return {
    schemaVersion: "1.0",
    kind: "creator-project-backup-verification",
    backupId: manifest.backupId,
    projectId: manifest.projectId,
    status: findings.length ? "failed" : "passed",
    findings,
  };
};

export const createProjectBackup = async ({ projectId, backupRoot = backupRootDefault() }) => {
  const id = safeId(projectId);
  const project = await loadCreatorProject(id);
  const source = projectDir(id);
  const backupId = `${id}-${new Date().toISOString().replaceAll(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
  const root = resolve(backupRoot);
  const temporary = resolve(root, `.${backupId}.tmp`);
  const destination = resolve(root, backupId);
  if (!inside(root, destination)) throw new Error("Backup destination escaped the backup root");
  await mkdir(root, { recursive: true });
  await mkdir(temporary);
  try {
    const sourceInventory = await inventory(source);
    await copyTree(source, resolve(temporary, "project"));
    const manifest = {
      schemaVersion: "1.0",
      kind: "creator-project-backup",
      backupId,
      projectId: id,
      projectTitle: project.project.title,
      createdAt: new Date().toISOString(),
      sourceRoot: source,
      inventory: sourceInventory,
      totals: {
        files: sourceInventory.length,
        bytes: sourceInventory.reduce((sum, item) => sum + item.bytes, 0),
      },
    };
    await writeJsonAtomic(resolve(temporary, "backup-manifest.json"), manifest);
    const verification = await verifyProjectBackup(temporary);
    if (verification.status !== "passed")
      throw new Error(`Backup verification failed: ${JSON.stringify(verification.findings)}`);
    await rename(temporary, destination);
    return { path: destination, manifest, verification };
  } catch (error) {
    await rm(temporary, { recursive: true, force: true });
    throw error;
  }
};

export const listProjectBackups = async ({ projectId, backupRoot = backupRootDefault() } = {}) => {
  const root = resolve(backupRoot);
  const results = [];
  for (const entry of await readdir(root, { withFileTypes: true }).catch(() => [])) {
    if (!entry.isDirectory() || entry.name.startsWith(".") || entry.name === "rollbacks") continue;
    try {
      const manifest = await backupManifest(resolve(root, entry.name));
      if (!projectId || manifest.projectId === projectId)
        results.push({ path: resolve(root, entry.name), ...manifest });
    } catch {}
  }
  return results.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
};

export const previewBackupRetention = async ({ projectId, backupRoot = backupRootDefault() }) => {
  const [policy, backups] = await Promise.all([
    loadLocalProductPolicy(),
    listProjectBackups({ projectId: safeId(projectId), backupRoot }),
  ]);
  return {
    schemaVersion: "1.0",
    projectId,
    retention: policy.backupRetention,
    keep: backups.slice(0, policy.backupRetention),
    removable: backups.slice(policy.backupRetention),
  };
};

export const pruneProjectBackups = async ({ projectId, confirmation, backupRoot = backupRootDefault() }) => {
  const id = safeId(projectId);
  if (confirmation !== id) throw new Error(`Backup pruning requires the exact project id confirmation: ${id}`);
  const root = resolve(backupRoot);
  const preview = await previewBackupRetention({ projectId: id, backupRoot: root });
  for (const item of preview.removable) {
    if (!inside(root, item.path)) throw new Error("Backup retention target escaped the backup root");
    await rm(item.path, { recursive: true, force: true });
  }
  return {
    schemaVersion: "1.0",
    projectId: id,
    prunedAt: new Date().toISOString(),
    removed: preview.removable.map((item) => ({ backupId: item.backupId, path: item.path })),
    retained: preview.keep.map((item) => ({ backupId: item.backupId, path: item.path })),
  };
};

export const restoreProjectBackup = async ({ backupPath, confirmation, backupRoot = backupRootDefault() }) => {
  const source = resolve(backupPath);
  const verification = await verifyProjectBackup(source);
  if (verification.status !== "passed") throw new Error("Cannot restore a backup that failed verification");
  const manifest = await backupManifest(source);
  const id = safeId(manifest.projectId);
  if (confirmation !== id) throw new Error(`Restore requires the exact project id confirmation: ${id}`);
  const target = projectDir(id);
  const staging = resolve(creatorRoot, `.${id}.restore-${randomUUID().slice(0, 8)}`);
  const rollback = resolve(creatorRoot, `.${id}.rollback-${randomUUID().slice(0, 8)}`);
  await mkdir(creatorRoot, { recursive: true });
  await copyTree(resolve(source, "project"), staging);
  const stagedInventory = await inventory(staging);
  if (JSON.stringify(stagedInventory) !== JSON.stringify(manifest.inventory)) {
    await rm(staging, { recursive: true, force: true });
    throw new Error("Restored staging copy does not match the backup manifest");
  }
  let existingMoved = false;
  try {
    await stat(target);
    await rename(target, rollback);
    existingMoved = true;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  try {
    await rename(staging, target);
    await loadCreatorProject(id);
    let rollbackPath;
    if (existingMoved) {
      rollbackPath = resolve(backupRoot, "rollbacks", `${id}-${Date.now()}-${basename(rollback)}`);
      await mkdir(dirname(rollbackPath), { recursive: true });
      await copyTree(rollback, rollbackPath);
      await rm(rollback, { recursive: true, force: true });
    }
    return {
      schemaVersion: "1.0",
      projectId: id,
      backupId: manifest.backupId,
      restoredAt: new Date().toISOString(),
      rollbackPath,
    };
  } catch (error) {
    await rm(target, { recursive: true, force: true });
    if (existingMoved) await rename(rollback, target);
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
};
