import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { fileExists, hashFile } from "./state.mjs";

const inside = (root, path) => {
  const value = relative(resolve(root), resolve(path));
  return value !== ".." && !value.startsWith(`..${sep}`) && !value.startsWith(sep);
};

const workspaceRelative = (workspace, path) => {
  const absolute = resolve(path);
  if (!inside(workspace, absolute)) throw new Error(`Approval artifact must stay inside the workspace: ${absolute}`);
  return relative(resolve(workspace), absolute).split(sep).join("/");
};

const coreApprovalArtifacts = (paths) => [
  paths.semanticNarrativePlan,
  paths.semanticProviderReport,
  paths.componentCandidates,
  paths.visualDirectionPlan,
  paths.visualDirectionReport,
  paths.visualDirectionReview,
  paths.visualDirectionTimeline,
  paths.planning,
  paths.reviewProps,
  paths.finalProps,
  paths.resolvedSceneTimeline,
  paths.sceneAlignmentReport,
  paths.supplementalMediaManifest,
  paths.imageEvidenceManifest,
  resolve(paths.workspace, "media-manifest.json"),
  resolve(paths.workspace, "edl.json"),
  paths.reviewEvidence,
  paths.reviewEvidenceSummary,
  resolve(paths.workspace, "visual-qa/qa-report.json"),
  resolve(paths.workspace, "regression/report.json"),
];

const describeExternalBinding = async (kind, path) => {
  if (!path || !(await fileExists(path))) throw new Error(`Approval binding is missing ${kind}: ${path}`);
  const info = await stat(path);
  if (!info.isFile()) throw new Error(`Approval binding must be a file: ${path}`);
  return { kind, path: resolve(path), bytes: info.size, sha256: await hashFile(path) };
};

export const createApprovalSnapshot = async ({ paths, reviewEvidence }) => {
  const id = `${new Date().toISOString().replaceAll(/[:.]/g, "-")}-${reviewEvidence.approvalBindingSha256.slice(0, 10)}`;
  const directory = resolve(paths.workspace, "approvals", id);
  const artifactRoot = resolve(directory, "artifacts");
  const evidencePaths = (reviewEvidence.artifacts ?? []).map((artifact) => resolve(paths.workspace, artifact.path));
  let frozenImageEvidence = [];
  if (paths.imageEvidenceManifest && (await fileExists(paths.imageEvidenceManifest))) {
    const imageManifest = JSON.parse(await readFile(paths.imageEvidenceManifest, "utf8"));
    frozenImageEvidence = (imageManifest.assets ?? []).map((asset) => resolve(paths.workspace, asset.frozenPath));
  }
  const sources = [
    ...new Set(
      [...coreApprovalArtifacts(paths), ...evidencePaths, ...frozenImageEvidence]
        .filter(Boolean)
        .map((path) => resolve(path)),
    ),
  ];
  const artifacts = [];
  for (const source of sources) {
    if (!(await fileExists(source))) continue;
    const sourcePath = workspaceRelative(paths.workspace, source);
    const snapshotPath = resolve(artifactRoot, sourcePath);
    await mkdir(dirname(snapshotPath), { recursive: true });
    await copyFile(source, snapshotPath);
    const info = await stat(snapshotPath);
    artifacts.push({
      sourcePath,
      snapshotPath: `artifacts/${sourcePath}`,
      bytes: info.size,
      sha256: await hashFile(snapshotPath),
    });
  }
  artifacts.sort((left, right) => left.sourcePath.localeCompare(right.sourcePath));
  const externalBindings = await Promise.all([
    describeExternalBinding("source-video", paths.source),
    describeExternalBinding("project-manifest", paths.manifest),
  ]);
  const manifest = {
    schemaVersion: "1.1",
    kind: "approval-snapshot",
    projectId: reviewEvidence.projectId,
    createdAt: new Date().toISOString(),
    reviewEvidenceSha256: reviewEvidence.approvalBindingSha256,
    externalBindings,
    artifacts,
  };
  const manifestPath = resolve(directory, "approval-snapshot.json");
  await mkdir(directory, { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return {
    id,
    path: workspaceRelative(paths.workspace, manifestPath),
    sha256: await hashFile(manifestPath),
    artifactCount: artifacts.length,
  };
};

export const verifyApprovalSnapshot = async ({ paths, snapshot }) => {
  if (!snapshot?.path || !snapshot?.sha256) throw new Error("Approved delivery requires a frozen approval snapshot");
  const manifestPath = resolve(paths.workspace, snapshot.path);
  if (!inside(paths.workspace, manifestPath)) throw new Error("Approval snapshot path escapes the workspace");
  if ((await hashFile(manifestPath)) !== snapshot.sha256) throw new Error("Approval snapshot manifest has changed");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (manifest.schemaVersion !== "1.1" || manifest.kind !== "approval-snapshot")
    throw new Error("Approval snapshot uses an unsupported contract");
  for (const binding of manifest.externalBindings ?? []) {
    if (!binding.path || !binding.sha256) throw new Error(`Approval snapshot has an invalid ${binding.kind} binding`);
    if (!(await fileExists(binding.path)) || (await hashFile(binding.path)) !== binding.sha256)
      throw new Error(`Approved ${binding.kind} has changed; a new review is required`);
  }
  if ((manifest.externalBindings ?? []).length !== 2)
    throw new Error("Approval snapshot does not bind the source video and project manifest");
  const directory = dirname(manifestPath);
  const verified = [];
  for (const artifact of manifest.artifacts ?? []) {
    const frozen = resolve(directory, artifact.snapshotPath);
    const destination = resolve(paths.workspace, artifact.sourcePath);
    if (!inside(directory, frozen) || !inside(paths.workspace, destination))
      throw new Error(`Approval snapshot artifact escapes its root: ${artifact.sourcePath}`);
    if ((await hashFile(frozen)) !== artifact.sha256)
      throw new Error(`Approval snapshot artifact has changed: ${artifact.sourcePath}`);
    verified.push({ artifact, frozen, destination });
  }
  return { manifest, manifestPath, directory, verified };
};

export const verifyAndRestoreApprovalSnapshot = async ({ paths, snapshot }) => {
  const { manifest, verified } = await verifyApprovalSnapshot({ paths, snapshot });
  const restored = [];
  for (const { artifact, frozen, destination } of verified) {
    const currentMatches = (await fileExists(destination)) && (await hashFile(destination)) === artifact.sha256;
    if (currentMatches) continue;
    await mkdir(dirname(destination), { recursive: true });
    await copyFile(frozen, destination);
    restored.push(artifact.sourcePath);
  }
  if (paths.imageEvidenceManifest && (await fileExists(paths.imageEvidenceManifest))) {
    const imageManifest = JSON.parse(await readFile(paths.imageEvidenceManifest, "utf8"));
    for (const asset of imageManifest.assets ?? []) {
      const source = resolve(paths.workspace, asset.frozenPath);
      const destination = resolve("public", asset.publicSrc);
      if ((await fileExists(destination)) && (await hashFile(destination)) === asset.sha256) continue;
      if ((await hashFile(source)) !== asset.sha256)
        throw new Error(`Frozen image evidence checksum mismatch: ${asset.id}`);
      await mkdir(dirname(destination), { recursive: true });
      await copyFile(source, destination);
      restored.push(`public/${asset.publicSrc}`);
    }
  }
  return { manifest, restored };
};
