import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  composeNarrationScript,
  sha256Text,
  validateNarrationScriptPackage,
} from "../../src/creator-workflow/contract.ts";
import { loadCreatorProject, projectDir, saveCreatorProject, writeJsonAtomic } from "./project-store.mjs";

const stableHash = (value) => sha256Text(JSON.stringify(value ?? null));
const attemptRoot = (projectId) => resolve(projectDir(projectId), "authoring/attempts");
const attemptDir = (projectId, attemptId) => resolve(attemptRoot(projectId), attemptId);
const assertAttemptId = (value) => {
  if (!/^[a-z0-9-]{8,80}$/.test(value)) throw new Error("Invalid narration attempt id");
  return value;
};

const writeReadableArtifacts = async (directory, narration) => {
  await writeFile(resolve(directory, "script.md"), `# ${narration.title}\n\n${narration.fullScript}\n`);
  await writeFile(
    resolve(directory, "shooting-guide.md"),
    `# 拍摄指导\n\n${narration.shootingGuide.map((item) => `- ${item}`).join("\n")}\n`,
  );
};

const compareNarration = (previous, current) => {
  if (!(previous && current)) return null;
  const previousSections = new Map(previous.sections.map((section) => [section.id, section]));
  const currentSections = new Map(current.sections.map((section) => [section.id, section]));
  const sectionIds = new Set([...previousSections.keys(), ...currentSections.keys()]);
  const changedSectionIds = [...sectionIds].filter(
    (id) => JSON.stringify(previousSections.get(id) ?? null) !== JSON.stringify(currentSections.get(id) ?? null),
  );
  return {
    titleChanged: previous.title !== current.title,
    changedSectionIds,
    fullScriptCharacterDelta: current.fullScript.length - previous.fullScript.length,
  };
};

export const recordNarrationAttempt = async ({
  project,
  projectId,
  narration,
  rejectedOutput,
  report = {},
  kind,
  status = "succeeded",
  instructions,
  error,
}) => {
  const createdAt = new Date().toISOString();
  const attemptId = `${createdAt.replace(/[-:.TZ]/g, "").slice(0, 14)}-${randomUUID().slice(0, 8)}`;
  const directory = attemptDir(projectId, attemptId);
  await mkdir(attemptRoot(projectId), { recursive: true });
  await mkdir(directory, { recursive: false });
  const parentNarration = project.authoring.currentAttemptId
    ? await readFile(
        resolve(attemptDir(projectId, project.authoring.currentAttemptId), "narration-package.json"),
        "utf8",
      )
        .then((value) => JSON.parse(value))
        .catch(() => null)
    : null;
  const metadata = {
    schemaVersion: "1.0",
    attemptId,
    parentAttemptId: project.authoring.currentAttemptId ?? null,
    kind,
    status,
    createdAt,
    agent: { id: project.agent.id, model: project.agent.model ?? null },
    contractVersion: project.agent.authoringContractVersion,
    sourceContextSha256: stableHash(
      await readFile(resolve(projectDir(projectId), "authoring/source-context.json"), "utf8").catch(() => ""),
    ),
    materialInventorySha256: stableHash(project.materials),
    providerReportSha256: stableHash(report),
    outputSha256: narration ? stableHash(narration) : null,
    rejectedOutputSha256: rejectedOutput ? stableHash(rejectedOutput) : null,
    fullScriptSha256: narration ? sha256Text(narration.fullScript) : null,
    changeSummary: compareNarration(parentNarration, narration),
    instructions: instructions?.trim() || null,
    error: error ? String(error.message ?? error) : null,
  };
  await writeJsonAtomic(resolve(directory, "provider-report.json"), report);
  if (narration) {
    await writeJsonAtomic(resolve(directory, "narration-package.json"), narration);
    await writeReadableArtifacts(directory, narration);
  }
  if (rejectedOutput) await writeJsonAtomic(resolve(directory, "rejected-output.json"), rejectedOutput);
  await writeJsonAtomic(resolve(directory, "metadata.json"), metadata);
  return metadata;
};

export const listNarrationAttempts = async (projectId) => {
  const entries = await readdir(attemptRoot(projectId), { withFileTypes: true }).catch(() => []);
  const attempts = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) =>
        readFile(resolve(attemptRoot(projectId), entry.name, "metadata.json"), "utf8")
          .then((value) => JSON.parse(value))
          .catch(() => null),
      ),
  );
  return attempts
    .filter(Boolean)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.attemptId.localeCompare(a.attemptId));
};

export const restoreNarrationAttempt = async (projectId, inputAttemptId) => {
  const attemptId = assertAttemptId(inputAttemptId);
  const project = await loadCreatorProject(projectId);
  if (project.authoring.state !== "drafted") throw new Error("只有尚未锁定的审核稿可以恢复历史版本");
  const source = JSON.parse(
    await readFile(resolve(attemptDir(projectId, attemptId), "narration-package.json"), "utf8"),
  );
  const narration = validateNarrationScriptPackage({ ...source, fullScript: composeNarrationScript(source) });
  const restored = await recordNarrationAttempt({
    project,
    projectId,
    narration,
    kind: "restore",
    report: { restoredFromAttemptId: attemptId },
  });
  const authoringDir = resolve(projectDir(projectId), "authoring");
  await writeJsonAtomic(resolve(authoringDir, "narration-package.json"), narration);
  await writeJsonAtomic(resolve(authoringDir, "provider-report.json"), { restoredFromAttemptId: attemptId });
  await writeFile(resolve(authoringDir, "draft-script.md"), `# ${narration.title}\n\n${narration.fullScript}\n`);
  await writeFile(
    resolve(authoringDir, "shooting-guide.md"),
    `# 拍摄指导\n\n${narration.shootingGuide.map((item) => `- ${item}`).join("\n")}\n`,
  );
  project.authoring.currentAttemptId = restored.attemptId;
  project.authoring.currentAttemptSha256 = restored.outputSha256;
  await saveCreatorProject(project);
  return { narration, attempt: restored };
};
