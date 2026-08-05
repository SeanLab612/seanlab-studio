import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { access, mkdir, readFile, stat, statfs, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { detectAgent } from "../../src/agents/registry.ts";
import { classifyOperationalError, OperationalError } from "./errors.mjs";
import { loadLocalProductPolicy } from "./local-product-policy.mjs";

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const command = async (file, args, options = {}) => {
  try {
    const result = await execFileAsync(file, args, {
      cwd: repositoryRoot,
      encoding: "utf8",
      timeout: options.timeout ?? 15_000,
      maxBuffer: 10 * 1024 * 1024,
    });
    return { ok: true, stdout: result.stdout.trim(), stderr: result.stderr.trim() };
  } catch (error) {
    return {
      ok: false,
      stdout: String(error.stdout ?? "").trim(),
      stderr: String(error.stderr ?? error.message ?? error).trim(),
      exitCode: error.code,
    };
  }
};

const check = (id, label, status, summary, details = {}, remediation) => ({
  id,
  label,
  status,
  summary,
  details,
  remediation,
});

const nodeCheck = async () => {
  const major = Number(process.versions.node.split(".")[0]);
  return check(
    "node",
    "Node.js",
    major >= 22 ? "passed" : "failed",
    process.version,
    { minimumMajor: 22, executable: process.execPath },
    major >= 22 ? undefined : "Install Node.js 22 or newer.",
  );
};

const platformCheck = async () => {
  const recommended = process.platform === "darwin" && process.arch === "arm64";
  return check(
    "platform",
    "Local production host",
    recommended ? "passed" : "warning",
    `${process.platform}/${process.arch}`,
    { platform: process.platform, architecture: process.arch, recommended: "darwin/arm64" },
    recommended
      ? undefined
      : "Core commands may work, but the persistent Studio service and clean-machine release target are Apple-silicon macOS.",
  );
};

const dependencyCheck = async () => {
  const packageJson = JSON.parse(await readFile(resolve(repositoryRoot, "package.json"), "utf8"));
  const expected = Object.fromEntries(
    Object.entries(packageJson.dependencies).filter(([name]) => name === "remotion" || name.startsWith("@remotion/")),
  );
  const installed = {};
  const mismatches = [];
  for (const [name, version] of Object.entries(expected)) {
    try {
      const record = JSON.parse(await readFile(resolve(repositoryRoot, "node_modules", name, "package.json"), "utf8"));
      installed[name] = record.version;
      if (record.version !== version) mismatches.push(`${name}: expected ${version}, received ${record.version}`);
    } catch {
      mismatches.push(`${name}: missing`);
    }
  }
  return check(
    "remotion",
    "Remotion dependencies",
    mismatches.length ? "failed" : "passed",
    mismatches.length ? mismatches.join("; ") : `Remotion ${installed.remotion}`,
    { expected, installed },
    mismatches.length ? "Run npm install from the repository root." : undefined,
  );
};

const ffmpegCheck = async () => {
  const [ffmpeg, ffprobe, decoders, encoders] = await Promise.all([
    command("ffmpeg", ["-version"]),
    command("ffprobe", ["-version"]),
    command("ffmpeg", ["-hide_banner", "-decoders"]),
    command("ffmpeg", ["-hide_banner", "-encoders"]),
  ]);
  const capabilities = {
    ffmpeg: ffmpeg.stdout.split("\n")[0],
    ffprobe: ffprobe.stdout.split("\n")[0],
    h264Decode: /\bh264\b/i.test(decoders.stdout),
    hevcDecode: /\bhevc\b/i.test(decoders.stdout),
    h264Encode: /(?:libx264|h264_videotoolbox|\bh264\b)/i.test(encoders.stdout),
    aacEncode: /\baac\b/i.test(encoders.stdout),
  };
  const passed =
    ffmpeg.ok && ffprobe.ok && capabilities.h264Decode && capabilities.h264Encode && capabilities.aacEncode;
  return check(
    "ffmpeg",
    "FFmpeg and codecs",
    passed ? "passed" : "failed",
    passed
      ? "ffprobe, H.264 decode/encode, HEVC decode, and AAC encode are available"
      : "Required FFmpeg capability is missing",
    capabilities,
    passed ? undefined : "Install a full FFmpeg build with ffprobe, H.264, HEVC, and AAC support.",
  );
};

const pythonCheck = async () => {
  const localPython = resolve(repositoryRoot, ".venv/bin/python3");
  const executable = await access(localPython, constants.X_OK)
    .then(() => localPython)
    .catch(() => "python3");
  const version = await command(executable, ["--version"]);
  const modules = await command(
    executable,
    ["-c", "import cv2, PIL, numpy, requests; print('cv2,PIL,numpy,requests')"],
    { timeout: 60_000 },
  );
  const passed = version.ok && modules.ok;
  return check(
    "python",
    "Python video analysis",
    passed ? "passed" : "failed",
    passed ? `${version.stdout || version.stderr}; cv2 and Pillow available` : modules.stderr || version.stderr,
    {
      executable,
      version: version.stdout || version.stderr,
      modules: { cv2: modules.ok, pillow: modules.ok, numpy: modules.ok, requests: modules.ok },
    },
    passed ? undefined : "Run npm run setup:python to create the repository-local Python environment.",
  );
};

const fontCheck = async () => {
  const required = [
    { family: "PingFang SC", macFiles: ["/System/Library/Fonts/PingFang.ttc"] },
    { family: "SF Pro Display", macFiles: ["/System/Library/Fonts/SFNS.ttf"] },
  ];
  const results = [];
  for (const requirement of required) {
    const matched = await command("fc-match", ["-f", "%{family}", requirement.family]);
    const fontConfigAvailable = matched.ok && matched.stdout.toLowerCase().includes(requirement.family.toLowerCase());
    const macFileAvailable =
      process.platform === "darwin" &&
      (
        await Promise.all(
          requirement.macFiles.map((path) =>
            access(path, constants.R_OK)
              .then(() => true)
              .catch(() => false),
          ),
        )
      ).some(Boolean);
    const systemAvailable = fontConfigAvailable || macFileAvailable;
    results.push({
      family: requirement.family,
      available: systemAvailable,
      source: macFileAvailable ? "macOS system font" : fontConfigAvailable ? "fontconfig" : "missing",
    });
  }
  const missing = results.filter((item) => !item.available).map((item) => item.family);
  return check(
    "fonts",
    "Render fonts",
    missing.length ? "warning" : "passed",
    missing.length
      ? `Missing preferred fonts: ${missing.join(", ")}; fallback fonts remain available`
      : required.map((item) => item.family).join(", "),
    { required: results },
    missing.length ? "Install the system font families or use a supported macOS rendering host." : undefined,
  );
};

const workspaceCheck = async (workspacePath) => {
  const existing = await nearestExistingPath(workspacePath);
  try {
    await access(existing, constants.R_OK | constants.W_OK);
    return check("workspace", "Workspace permissions", "passed", "Workspace is readable and writable", {
      path: existing,
    });
  } catch {
    return check(
      "workspace",
      "Workspace permissions",
      "failed",
      "Workspace is not readable and writable",
      { path: existing },
      "Choose a user-owned workspace and fix its read/write permissions.",
    );
  }
};

const mimoCheck = async ({ requireMimo }) => {
  const configured = Boolean(process.env.MIMO_API_KEY);
  return check(
    "mimo",
    "Xiaomi MiMo configuration",
    configured ? "passed" : requireMimo ? "failed" : "warning",
    configured ? "MIMO_API_KEY is present (value not inspected or emitted)" : "MIMO_API_KEY is not present",
    { configured, baseUrl: "https://token-plan-cn.xiaomimimo.com/v1" },
    configured ? undefined : "Export MIMO_API_KEY before translation or semantic planning.",
  );
};

const codexCheck = async ({ requireCodex, detectAgentImpl }) => {
  const detected = await detectAgentImpl("codex-cli");
  const available = detected.available;
  const authenticated = detected.authenticated;
  const passed = available && authenticated;
  return check(
    "codex-cli",
    "Codex CLI semantic provider",
    passed ? "passed" : requireCodex ? "failed" : "warning",
    passed
      ? `${detected.version}; authenticated`
      : available
        ? "Codex CLI is not authenticated"
        : "Codex CLI is missing",
    { available, authenticated, version: detected.version, executablePath: detected.executablePath },
    passed ? undefined : "Install Codex CLI and run codex login before semantic planning.",
  );
};

const claudeCheck = async ({ requireClaude, detectAgentImpl }) => {
  const detected = await detectAgentImpl("claude-code");
  const available = detected.available;
  const authenticated = detected.authenticated;
  const passed = available && authenticated;
  return check(
    "claude-code",
    "Claude Code semantic provider",
    passed ? "passed" : requireClaude ? "failed" : "warning",
    passed
      ? `${detected.version}; authenticated`
      : available
        ? "Claude Code is not authenticated"
        : "Claude Code is missing",
    { available, authenticated, version: detected.version, executablePath: detected.executablePath },
    passed ? undefined : "Install Claude Code and authenticate before semantic planning.",
  );
};

const diskCheck = async (targetPath, minimumFreeBytes) => {
  const existing = await nearestExistingPath(targetPath);
  const info = await statfs(existing);
  const freeBytes = Number(info.bavail) * Number(info.bsize);
  return check(
    "disk",
    "Workspace disk capacity",
    freeBytes >= minimumFreeBytes ? "passed" : "failed",
    `${(freeBytes / 1024 ** 3).toFixed(1)} GiB free`,
    { path: existing, freeBytes, minimumFreeBytes },
    freeBytes >= minimumFreeBytes ? undefined : "Free at least 10 GiB or choose another workspace.",
  );
};

const nearestExistingPath = async (path) => {
  let current = resolve(path);
  while (true) {
    try {
      await access(current, constants.F_OK);
      return current;
    } catch {
      const parent = dirname(current);
      if (parent === current) throw new OperationalError("IO_OUTPUT_UNWRITABLE", `No existing parent for ${path}`);
      current = parent;
    }
  }
};

const sourceDecodeCheck = async (sourcePath) => {
  if (!sourcePath)
    return check(
      "source-decode",
      "Source video decode",
      "skipped",
      "No project source was supplied; codec capability was checked instead",
    );
  try {
    const info = await stat(sourcePath);
    if (!info.isFile() || info.size === 0) throw new Error("Source is not a non-empty file");
  } catch (error) {
    return check(
      "source-decode",
      "Source video decode",
      "failed",
      error.message,
      { sourcePath },
      "Relink a valid source video.",
    );
  }
  const probe = await command("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=codec_name,width,height:format=duration",
    "-of",
    "json",
    sourcePath,
  ]);
  const decode = await command(
    "ffmpeg",
    ["-v", "error", "-ss", "0", "-i", sourcePath, "-frames:v", "1", "-f", "null", "-"],
    { timeout: 30_000 },
  );
  let metadata;
  try {
    metadata = JSON.parse(probe.stdout);
  } catch {
    metadata = undefined;
  }
  const passed = probe.ok && decode.ok && metadata?.streams?.length;
  return check(
    "source-decode",
    "Source video decode",
    passed ? "passed" : "failed",
    passed ? "ffprobe metadata and one decoded frame succeeded" : decode.stderr || probe.stderr,
    { sourcePath, stream: metadata?.streams?.[0], durationSeconds: Number(metadata?.format?.duration) || undefined },
    passed ? undefined : "Verify the source is complete and its codec is supported by FFmpeg.",
  );
};

export const summarizeDoctorChecks = (checks) => {
  const summary = {
    passed: checks.filter((item) => item.status === "passed").length,
    warnings: checks.filter((item) => item.status === "warning").length,
    failed: checks.filter((item) => item.status === "failed").length,
    skipped: checks.filter((item) => item.status === "skipped").length,
  };
  return {
    status: summary.failed ? "failed" : summary.warnings ? "warning" : "passed",
    summary,
  };
};

export const runEnvironmentDoctor = async ({
  sourcePath,
  workspacePath = repositoryRoot,
  requireMimo = true,
  requireCodex = false,
  requireClaude = false,
  detectAgentImpl = detectAgent,
} = {}) => {
  const policy = await loadLocalProductPolicy();
  const checks = [];
  for (const operation of [
    nodeCheck,
    platformCheck,
    dependencyCheck,
    ffmpegCheck,
    pythonCheck,
    fontCheck,
    () => mimoCheck({ requireMimo }),
    () => codexCheck({ requireCodex, detectAgentImpl }),
    () => claudeCheck({ requireClaude, detectAgentImpl }),
    () => workspaceCheck(workspacePath),
    () => diskCheck(workspacePath, policy.minimumFreeBytes),
    () => sourceDecodeCheck(sourcePath),
  ]) {
    try {
      checks.push(await operation());
    } catch (error) {
      const failure = classifyOperationalError(error);
      checks.push(
        check(failure.code.toLowerCase(), failure.category, "failed", failure.message, {}, failure.remediation),
      );
    }
  }
  const { status, summary } = summarizeDoctorChecks(checks);
  return {
    schemaVersion: "1.0",
    kind: "environment-doctor",
    generatedAt: new Date().toISOString(),
    repositoryRoot,
    policy,
    status,
    summary,
    checks,
  };
};

export const writeDoctorReport = async (path, report) => {
  await mkdir(dirname(resolve(path)), { recursive: true });
  await writeFile(resolve(path), `${JSON.stringify(report, null, 2)}\n`);
};
