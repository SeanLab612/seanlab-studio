import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const environment = resolve(".venv");
const python = resolve(environment, "bin/python3");

try {
  await access(python);
} catch {
  await execFileAsync("python3", ["-m", "venv", environment], { cwd: resolve("."), stdio: "inherit" });
}
await execFileAsync(python, ["-m", "pip", "install", "--upgrade", "pip"], {
  cwd: resolve("."),
  maxBuffer: 10 * 1024 * 1024,
});
const result = await execFileAsync(python, ["-m", "pip", "install", "-r", "requirements.txt"], {
  cwd: resolve("."),
  maxBuffer: 20 * 1024 * 1024,
});
if (result.stdout.trim()) console.log(result.stdout.trim());
console.log(`Python environment ready: ${python}`);
