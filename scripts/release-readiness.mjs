import { execFile } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const execFileAsync = promisify(execFile);

const requiredScripts = [
  "studio:start",
  "studio:stop",
  "studio:status",
  "doctor",
  "setup:python",
  "project:backup",
  "test:unit",
  "test:workflow-core",
];

const requiredDocs = [
  "README.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "CODE_OF_CONDUCT.md",
  "THIRD_PARTY_NOTICES.md",
  "docs/open-source-edition.md",
];

const protectedIgnoreRules = ["projects/", "studio-data/", "out", ".venv/"];
const qualityGates = [
  "format:check",
  "lint",
  "typecheck",
  "test:unit",
  "test:workflow-core",
  "test:visual-brief",
  "test:registry",
  "test:icons",
];

const normalizeIgnoreRule = (line) => line.trim().replace(/^\//, "");

export const runReleaseReadiness = async ({ root = repositoryRoot, runQualityGates = false } = {}) => {
  const checks = [];
  const pass = (id, detail) => checks.push({ id, status: "passed", detail });
  const warn = (id, detail) => checks.push({ id, status: "warning", detail });
  const fail = (id, detail) => checks.push({ id, status: "failed", detail });

  const packageMetadata = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
  if (/^\d+\.\d+\.\d+$/.test(packageMetadata.version)) pass("version.semver", packageMetadata.version);
  else fail("version.semver", `Invalid package version: ${packageMetadata.version}`);

  const missingScripts = requiredScripts.filter((name) => !packageMetadata.scripts?.[name]);
  if (missingScripts.length === 0) pass("operator.scripts", `${requiredScripts.length} required commands available`);
  else fail("operator.scripts", `Missing commands: ${missingScripts.join(", ")}`);

  const studioServer = await readFile(resolve(root, "scripts/studio-server.mjs"), "utf8");
  if (
    studioServer.includes('url.pathname === "/api/app"') &&
    studioServer.includes('readFile(resolve("package.json"), "utf8")') &&
    studioServer.includes("version: packageMetadata.version")
  )
    pass("version.api-source", "Studio /api/app reads package.json");
  else fail("version.api-source", "Studio metadata API is not visibly bound to package.json");

  const missingDocs = [];
  for (const path of requiredDocs) {
    try {
      await readFile(resolve(root, path), "utf8");
    } catch {
      missingDocs.push(path);
    }
  }
  if (missingDocs.length === 0) pass("documentation.required", `${requiredDocs.length} documents available`);
  else fail("documentation.required", `Missing documents: ${missingDocs.join(", ")}`);

  const ignoreRules = (await readFile(resolve(root, ".gitignore"), "utf8"))
    .split(/\r?\n/u)
    .map(normalizeIgnoreRule)
    .filter(Boolean);
  const missingIgnoreRules = protectedIgnoreRules.filter((rule) => !ignoreRules.includes(rule));
  if (missingIgnoreRules.length === 0)
    pass("local-data.ignored", `${protectedIgnoreRules.length} protected local paths are ignored`);
  else fail("local-data.ignored", `Missing ignore rules: ${missingIgnoreRules.join(", ")}`);

  try {
    await access(resolve(root, ".git"));
    const { stdout } = await execFileAsync("git", ["ls-files", "--", "projects", "studio-data", "out", ".venv"], {
      cwd: root,
    });
    if (stdout.trim()) fail("local-data.untracked", `Protected local files are tracked: ${stdout.trim()}`);
    else pass("local-data.untracked", "Git index contains no protected local project or cache files");
  } catch (error) {
    if (error?.code === "ENOENT") warn("local-data.untracked", "Git index check skipped outside a repository copy");
    else fail("local-data.untracked", `Unable to inspect Git index: ${error.message}`);
  }

  if (runQualityGates) {
    for (const script of qualityGates) {
      try {
        await execFileAsync("npm", ["run", script], { cwd: root, maxBuffer: 8 * 1024 * 1024 });
        pass(`quality.${script}`, "passed");
      } catch (error) {
        const detail = String(error.stderr || error.stdout || error.message)
          .trim()
          .slice(-2000);
        fail(`quality.${script}`, detail);
      }
    }
    try {
      await execFileAsync("npm", ["audit", "--omit=dev", "--audit-level=high"], {
        cwd: root,
        maxBuffer: 4 * 1024 * 1024,
      });
      pass("security.production-dependencies", "npm audit found no high-severity production vulnerability");
    } catch (error) {
      fail(
        "security.production-dependencies",
        String(error.stdout || error.stderr || error.message)
          .trim()
          .slice(-2000),
      );
    }
  }

  const governance = JSON.parse(await readFile(resolve(root, "config/agent-model-governance.json"), "utf8"));
  const approvedPair = governance.pairs?.find(
    (pair) => pair.agentId === "codex-cli" && pair.model === "gpt-5.6-sol" && pair.status === "approved",
  );
  if (approvedPair?.conformanceReportSha256)
    pass("agent.approved-pair", `${approvedPair.agentId}/${approvedPair.model}`);
  else fail("agent.approved-pair", "Approved codex-cli/gpt-5.6-sol evidence is missing");

  try {
    await readFile(resolve(root, "LICENSE"), "utf8");
    pass("open-source.license", "LICENSE is present");
  } catch {
    warn("open-source.license", "No LICENSE is present; public source is not yet an explicit open-source grant");
  }

  const failed = checks.filter((check) => check.status === "failed").length;
  const warnings = checks.filter((check) => check.status === "warning").length;
  return {
    kind: "release-readiness",
    status: failed ? "failed" : warnings ? "warning" : "passed",
    version: packageMetadata.version,
    productPosition: "local-production-mvp",
    versionPromotion: "explicitly-approved",
    summary: { passed: checks.length - failed - warnings, warnings, failed },
    checks,
    safety: {
      agentInvoked: false,
      translationInvoked: false,
      renderingInvoked: false,
      creatorProjectsRead: false,
    },
  };
};

const entrypointUrl = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (import.meta.url === entrypointUrl) {
  const report = await runReleaseReadiness({ runQualityGates: true });
  console.log(JSON.stringify(report, null, 2));
  if (report.status === "failed") process.exitCode = 1;
}
