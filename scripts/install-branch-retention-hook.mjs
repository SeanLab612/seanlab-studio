import { execFile } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

await execFileAsync("git", ["config", "core.hooksPath", ".githooks"], { cwd: repositoryRoot });
console.log("Installed repository hooks from .githooks");
console.log("After a local merge into main, only the three newest safely merged remote branches are retained.");
