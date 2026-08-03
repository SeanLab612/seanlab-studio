import { resolve } from "node:path";
import {
  createProjectBackup,
  listProjectBackups,
  previewBackupRetention,
  pruneProjectBackups,
  restoreProjectBackup,
  verifyProjectBackup,
} from "./operations/project-backup.mjs";

const args = process.argv.slice(2);
const command = args[0] ?? "list";
const option = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const projectId = option("--id");
const backupRoot = option("--backup-root");
const assertStudioStopped = async () => {
  try {
    const response = await fetch("http://127.0.0.1:3080/api/health", { signal: AbortSignal.timeout(500) });
    if (response.ok) throw new Error("Stop SeanLab Studio before changing local project backups");
  } catch (error) {
    if (error.message.includes("Stop SeanLab Studio")) throw error;
  }
};

if (command === "create") {
  if (!projectId) throw new Error("Usage: npm run project:backup -- create --id <project-id>");
  await assertStudioStopped();
  console.log(JSON.stringify(await createProjectBackup({ projectId, backupRoot }), null, 2));
} else if (command === "list") {
  console.log(JSON.stringify(await listProjectBackups({ projectId, backupRoot }), null, 2));
} else if (command === "verify") {
  const path = option("--backup");
  if (!path) throw new Error("Usage: npm run project:backup -- verify --backup <path>");
  const report = await verifyProjectBackup(resolve(path));
  console.log(JSON.stringify(report, null, 2));
  if (report.status !== "passed") process.exitCode = 2;
} else if (command === "restore") {
  const path = option("--backup");
  const confirmation = option("--confirm");
  if (!path || !confirmation)
    throw new Error("Usage: npm run project:backup -- restore --backup <path> --confirm <project-id>");
  await assertStudioStopped();
  console.log(JSON.stringify(await restoreProjectBackup({ backupPath: path, confirmation, backupRoot }), null, 2));
} else if (command === "retention") {
  if (!projectId) throw new Error("Usage: npm run project:backup -- retention --id <project-id>");
  console.log(JSON.stringify(await previewBackupRetention({ projectId, backupRoot }), null, 2));
} else if (command === "prune") {
  const confirmation = option("--confirm");
  if (!projectId || !confirmation)
    throw new Error("Usage: npm run project:backup -- prune --id <project-id> --confirm <project-id>");
  await assertStudioStopped();
  console.log(JSON.stringify(await pruneProjectBackups({ projectId, confirmation, backupRoot }), null, 2));
} else throw new Error("Unknown project backup command. Use create, list, verify, restore, retention, or prune.");
