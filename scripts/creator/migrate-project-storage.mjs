import { mkdir, readFile, readdir, rename, stat, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { validateCreatorProject } from "../../src/creator-workflow/contract.ts";
import { readManifest, validateManifest } from "../workflow/manifest.mjs";
import { createStages, signatureConfigForStage } from "../workflow/stages.mjs";
import { fileExists, saveState, signatureFor } from "../workflow/state.mjs";

const inside = (root, target) => {
  const value = relative(root, target);
  return value === "" || (!value.startsWith(`..${sep}`) && value !== ".." && !value.startsWith(sep));
};

const exists = async (path) => {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
};

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const writeJsonAtomic = async (path, value) => {
  const temporary = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporary, path);
};

const rewriteStrings = (value, replacements) => {
  if (typeof value === "string") {
    return replacements.reduce((result, [from, to]) => result.replaceAll(from, to), value);
  }
  if (Array.isArray(value)) return value.map((item) => rewriteStrings(item, replacements));
  if (value && typeof value === "object")
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, rewriteStrings(item, replacements)]));
  return value;
};

const jsonFiles = async (root) => {
  const result = [];
  const visit = async (directory) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile() && entry.name.endsWith(".json")) result.push(path);
    }
  };
  await visit(root);
  return result;
};

const migratedPath = ({ oldPath, legacyProjectDir, targetDir, externalVideoDir, targetVideoDir }) => {
  if (inside(legacyProjectDir, oldPath)) return resolve(targetDir, relative(legacyProjectDir, oldPath));
  if (externalVideoDir && inside(externalVideoDir, oldPath))
    return resolve(targetVideoDir, relative(externalVideoDir, oldPath));
  return oldPath;
};

export const rebaseSucceededWorkflowState = async (manifestPath) => {
  const context = await readManifest(manifestPath);
  if (!(await fileExists(context.paths.state))) return { changed: [] };
  const state = await readJson(context.paths.state);
  const changed = [];
  for (const stage of createStages(context)) {
    const entry = state.stages?.[stage.name];
    if (!entry || !["succeeded", "approved"].includes(entry.status)) continue;
    const outputsExist = await Promise.all((stage.outputs ?? []).map(fileExists)).then((items) => items.every(Boolean));
    if (!outputsExist) continue;
    entry.inputSignature = await signatureFor([
      context.manifest.schemaVersion,
      stage.name,
      stage.inputs,
      ...stage.inputs,
      signatureConfigForStage(context.manifest, stage.name),
    ]);
    entry.outputSignature = await signatureFor(stage.outputs ?? []);
    entry.outputs = stage.outputs;
    entry.storageRebasedAt = new Date().toISOString();
    changed.push(stage.name);
  }
  if (changed.length) await saveState(context.paths.state, state);
  return { changed, statePath: context.paths.state };
};

export const planProjectStorageMigration = async ({
  id,
  legacyRoot = "creator-projects",
  projectsRoot = "projects",
}) => {
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(id ?? "")) throw new Error("Invalid creator project id");
  const legacyProjectDir = resolve(legacyRoot, id);
  const targetDir = resolve(projectsRoot, id);
  if (!(await exists(resolve(legacyProjectDir, "creator-project.json"))))
    throw new Error(`Legacy creator project not found: ${id}`);
  if (await exists(targetDir)) throw new Error(`Target project directory already exists: ${targetDir}`);
  const creator = validateCreatorProject(await readJson(resolve(legacyProjectDir, "creator-project.json")));
  const manifestPath = creator.video?.manifest ? resolve(creator.video.manifest) : undefined;
  const externalVideoDir = manifestPath && !inside(legacyProjectDir, manifestPath) ? dirname(manifestPath) : undefined;
  if (externalVideoDir && !(await exists(manifestPath))) throw new Error(`Video manifest not found: ${manifestPath}`);
  const targetVideoDir = resolve(targetDir, "video");
  return { id, creator, legacyProjectDir, targetDir, manifestPath, externalVideoDir, targetVideoDir };
};

export const migrateProjectStorage = async (options) => {
  const plan = await planProjectStorageMigration(options);
  const { legacyProjectDir, targetDir, manifestPath, externalVideoDir, targetVideoDir } = plan;
  const creatorIdentity = await stat(legacyProjectDir);
  const videoIdentity = externalVideoDir ? await stat(externalVideoDir) : undefined;
  const oldManifest = manifestPath ? await readJson(manifestPath) : undefined;
  const manifestReferences = oldManifest
    ? {
        paths: Object.fromEntries(
          Object.entries(oldManifest.paths ?? {}).map(([key, value]) => [
            key,
            typeof value === "string" ? resolve(dirname(manifestPath), value) : value,
          ]),
        ),
        supplemental: (oldManifest.supplementalMedia?.assets ?? []).map((asset) => ({
          id: asset.id,
          path: resolve(dirname(manifestPath), asset.path),
        })),
      }
    : undefined;
  await mkdir(dirname(targetDir), { recursive: true });
  let creatorMoved = false;
  let videoMoved = false;
  const originalJson = new Map();
  try {
    await rename(legacyProjectDir, targetDir);
    creatorMoved = true;
    const movedCreatorIdentity = await stat(targetDir);
    if (movedCreatorIdentity.dev !== creatorIdentity.dev || movedCreatorIdentity.ino !== creatorIdentity.ino)
      throw new Error("Creator project directory identity changed during migration");
    if (externalVideoDir) {
      if (await exists(targetVideoDir)) throw new Error(`Target video directory already exists: ${targetVideoDir}`);
      await rename(externalVideoDir, targetVideoDir);
      videoMoved = true;
      const movedVideoIdentity = await stat(targetVideoDir);
      if (movedVideoIdentity.dev !== videoIdentity.dev || movedVideoIdentity.ino !== videoIdentity.ino)
        throw new Error("Video workspace directory identity changed during migration");
    }
    const newManifestPath = oldManifest
      ? externalVideoDir
        ? resolve(targetVideoDir, relative(externalVideoDir, manifestPath))
        : resolve(targetDir, relative(legacyProjectDir, manifestPath))
      : undefined;
    const replacements = [
      [legacyProjectDir, targetDir],
      ...(externalVideoDir ? [[externalVideoDir, targetVideoDir]] : []),
    ];
    for (const path of await jsonFiles(targetDir)) {
      const source = await readFile(path, "utf8");
      originalJson.set(path, source);
      const value = JSON.parse(source);
      await writeJsonAtomic(path, rewriteStrings(value, replacements));
    }
    const migratedCreatorPath = resolve(targetDir, "creator-project.json");
    const migratedCreator = await readJson(migratedCreatorPath);
    if (newManifestPath) migratedCreator.video.manifest = newManifestPath;
    validateCreatorProject(migratedCreator);
    await writeJsonAtomic(migratedCreatorPath, migratedCreator);
    if (oldManifest && newManifestPath) {
      const migratedManifest = rewriteStrings(await readJson(newManifestPath), replacements);
      for (const [key, oldPath] of Object.entries(manifestReferences.paths)) {
        const newPath = migratedPath({ oldPath, legacyProjectDir, targetDir, externalVideoDir, targetVideoDir });
        migratedManifest.paths[key] = relative(dirname(newManifestPath), newPath) || ".";
      }
      for (const asset of migratedManifest.supplementalMedia?.assets ?? []) {
        const reference = manifestReferences.supplemental.find((item) => item.id === asset.id);
        if (!reference) continue;
        const newPath = migratedPath({
          oldPath: reference.path,
          legacyProjectDir,
          targetDir,
          externalVideoDir,
          targetVideoDir,
        });
        asset.path = relative(dirname(newManifestPath), newPath);
      }
      validateManifest(migratedManifest);
      await writeJsonAtomic(newManifestPath, migratedManifest);
      await rebaseSucceededWorkflowState(newManifestPath);
    }
    return {
      schemaVersion: "1.0",
      id: plan.id,
      from: legacyProjectDir,
      to: targetDir,
      videoManifest: newManifestPath,
      migratedAt: new Date().toISOString(),
    };
  } catch (error) {
    for (const [path, source] of originalJson) await writeFile(path, source);
    if (videoMoved) await rename(targetVideoDir, externalVideoDir);
    if (creatorMoved) await rename(targetDir, legacyProjectDir);
    throw error;
  }
};

const parseArgs = (argv) =>
  Object.fromEntries(
    argv.flatMap((value, index) => (value.startsWith("--") ? [[value.slice(2), argv[index + 1] ?? true]] : [])),
  );

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const args = parseArgs(process.argv.slice(2));
  if (args["rebase-state"]) {
    const creator = validateCreatorProject(
      await readJson(resolve(args["projects-root"] ?? "projects", args.id, "creator-project.json")),
    );
    if (!creator.video?.manifest) throw new Error(`Creator project has no video manifest: ${args.id}`);
    console.log(JSON.stringify(await rebaseSucceededWorkflowState(creator.video.manifest), null, 2));
    process.exit(0);
  }
  const plan = await planProjectStorageMigration({
    id: args.id,
    legacyRoot: args["legacy-root"] ?? "creator-projects",
    projectsRoot: args["projects-root"] ?? "projects",
  });
  if (!args.apply) {
    console.log(
      JSON.stringify(
        { id: plan.id, from: plan.legacyProjectDir, to: plan.targetDir, video: plan.externalVideoDir },
        null,
        2,
      ),
    );
  } else {
    console.log(
      JSON.stringify(
        await migrateProjectStorage({
          id: args.id,
          legacyRoot: args["legacy-root"] ?? "creator-projects",
          projectsRoot: args["projects-root"] ?? "projects",
        }),
        null,
        2,
      ),
    );
  }
}
