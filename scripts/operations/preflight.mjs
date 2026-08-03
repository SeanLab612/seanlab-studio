import { access, mkdir, readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { resolve } from "node:path";
import { homedir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { STAGE_STATUSES, fileExists } from "../workflow/state.mjs";
import { CONDITIONAL_STAGE_NAMES } from "../workflow/stages.mjs";

const result = (id, label, status, summary, details = {}, remediation) => ({
  id,
  label,
  status,
  summary,
  details,
  remediation,
});

const assertWritable = async (path) => {
  await mkdir(path, { recursive: true });
  await access(path, constants.W_OK);
};

const safeJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const execFileAsync = promisify(execFile);

const sourceCheck = async (paths) => {
  try {
    const info = await stat(paths.source);
    if (!info.isFile() || info.size === 0) throw new Error("Source must be a non-empty file");
    return result("source", "Source video", "passed", `${info.size} bytes`, { path: paths.source, bytes: info.size });
  } catch (error) {
    return result(
      "source",
      "Source video",
      "failed",
      error.message,
      { path: paths.source },
      "Relink a valid source video.",
    );
  }
};

const transcriptCheck = async (manifest, paths) => {
  if (manifest.providers.transcription.provider === "video-use-scribe") {
    const videoUseHome = resolve(process.env.VIDEO_USE_HOME ?? `${homedir()}/Developer/video-use`);
    const helper = resolve(videoUseHome, "helpers/transcribe.py");
    const available = await fileExists(helper);
    return result(
      "transcript",
      "Transcript input",
      available ? "passed" : "failed",
      available ? "video-use transcription helper is available" : "video-use transcription helper is missing",
      { provider: "video-use-scribe", helper },
      available ? undefined : "Set VIDEO_USE_HOME to an installation containing helpers/transcribe.py.",
    );
  }
  try {
    const data = await safeJson(paths.transcript);
    const wordCount = Array.isArray(data.words) ? data.words.length : undefined;
    return result(
      "transcript",
      "Transcript input",
      "passed",
      wordCount === undefined ? "Existing transcript JSON is readable" : `${wordCount} timed words`,
      { provider: "existing-word-json", path: paths.transcript, wordCount },
    );
  } catch (error) {
    return result(
      "transcript",
      "Transcript input",
      "failed",
      error.message,
      { provider: "existing-word-json", path: paths.transcript },
      "Provide valid JSON or select video-use-scribe in the manifest.",
    );
  }
};

const providerCheck = async (manifest) => {
  const required = [manifest.providers.translation, manifest.providers.semanticPlanning]
    .filter((provider) => provider.provider === "mimo")
    .map((provider) => provider.apiKeyEnv ?? "MIMO_API_KEY");
  const missing = [...new Set(required)].filter((name) => !process.env[name]);
  let agent;
  const selectedAgent = [
    manifest.providers.translation.provider,
    manifest.providers.semanticPlanning.provider,
    manifest.providers.recutPlanning?.provider,
  ].find((provider) => ["codex-cli", "claude-code"].includes(provider));
  if (selectedAgent) {
    try {
      const command = selectedAgent === "codex-cli" ? "codex" : "claude";
      const authArgs = selectedAgent === "codex-cli" ? ["login", "status"] : ["auth", "status"];
      const [{ stdout: version }, { stdout: login, stderr }] = await Promise.all([
        execFileAsync(command, ["--version"], { timeout: 15_000 }),
        execFileAsync(command, authArgs, { timeout: 15_000 }),
      ]);
      agent = {
        id: selectedAgent,
        available: true,
        authenticated: selectedAgent === "claude-code" || /logged in/i.test(`${login}\n${stderr}`),
        version: version.trim(),
      };
    } catch (error) {
      agent = { id: selectedAgent, available: false, authenticated: false, error: String(error.message ?? error) };
    }
  }
  const agentFailed = agent && (!agent.available || !agent.authenticated);
  return result(
    "providers",
    "Provider configuration",
    missing.length || agentFailed ? "failed" : "passed",
    missing.length
      ? `Missing environment variables: ${missing.join(", ")}`
      : agentFailed
        ? `${agent.id} is missing or not authenticated`
        : "Selected providers are configured",
    {
      translation: manifest.providers.translation.provider,
      semanticPlanning: manifest.providers.semanticPlanning.provider,
      recutPlanning: manifest.providers.recutPlanning?.provider ?? "disabled",
      requiredEnvironmentVariables: [...new Set(required)],
      agent,
    },
    missing.length
      ? "Export the named variables without adding secrets to the manifest."
      : agentFailed
        ? `Install and authenticate ${agent.id}.`
        : undefined,
  );
};

const assetProfileCheck = (manifest, currentAssetProfile) => {
  if (!manifest.assetProfile)
    return result(
      "asset-profile",
      "Reusable asset profile",
      "warning",
      "Manifest does not pin an asset profile",
      {},
      "Upgrade the manifest before reproducible rendering.",
    );
  const mismatches = Object.entries(currentAssetProfile)
    .filter(([key, value]) => manifest.assetProfile[key] !== value)
    .map(([key, value]) => ({ key, expected: value, actual: manifest.assetProfile[key] }));
  return result(
    "asset-profile",
    "Reusable asset profile",
    mismatches.length ? "failed" : "passed",
    mismatches.length ? `${mismatches.length} pinned inventory values differ` : manifest.assetProfile.id,
    { mismatches },
    mismatches.length
      ? "Regenerate or deliberately migrate the project manifest to the current asset profile."
      : undefined,
  );
};

const terminologyCheck = (manifest) => {
  const domains = manifest.terminology?.domains ?? [];
  return result(
    "terminology",
    "Terminology domains",
    domains.length ? "passed" : "warning",
    domains.length ? domains.join(", ") : "No domain packs selected; global terms only",
    { version: manifest.terminology?.version, domains },
  );
};

const productionContractsCheck = async () => {
  try {
    const { stdout } = await execFileAsync(
      process.execPath,
      [
        "--experimental-strip-types",
        "--experimental-specifier-resolution=node",
        "scripts/validate-production-contracts.mjs",
      ],
      { timeout: 30_000 },
    );
    const details = JSON.parse(stdout.trim().split("\n").at(-1));
    return result(
      "production-contracts",
      "Visual production contracts",
      "passed",
      `${details.components} components have motion and QA contracts`,
      details,
    );
  } catch (error) {
    return result(
      "production-contracts",
      "Visual production contracts",
      "failed",
      String(error.stderr || error.message).trim(),
      {},
      "This is a Studio defect. Repair the named registry, motion profile, or QA bounds before running the project.",
    );
  }
};

const supplementalMediaCheck = async (_manifest, paths) => {
  const assets = paths.supplementalMedia ?? [];
  if (!assets.length)
    return result("supplemental-media", "Supplemental media", "passed", "No authored recording scenes configured", {
      assets: 0,
    });
  try {
    await access(paths.authoredScenePlan);
    const plan = await safeJson(paths.authoredScenePlan);
    if (plan.schemaVersion !== "1.0" || !Array.isArray(plan.scenes))
      throw new Error("Authored scene plan must use schemaVersion 1.0");
    const ids = new Set(assets.map((asset) => asset.id));
    const unknown = plan.scenes.filter((scene) => !ids.has(scene.assetId)).map((scene) => scene.assetId);
    if (unknown.length) throw new Error(`Authored scene plan references unknown assets: ${unknown.join(", ")}`);
    for (const asset of assets) await access(asset.path);
    return result(
      "supplemental-media",
      "Supplemental media",
      "passed",
      `${assets.length} asset(s), ${plan.scenes.length} scene(s)`,
      {
        assets: assets.map((asset) => ({ id: asset.id, role: asset.role, required: asset.required })),
        authoredScenePlan: paths.authoredScenePlan,
      },
    );
  } catch (error) {
    return result(
      "supplemental-media",
      "Supplemental media",
      "failed",
      error.message,
      { authoredScenePlan: paths.authoredScenePlan },
      "Restore every configured recording and a valid authored scene plan before running the workflow.",
    );
  }
};

const brandAssetsCheck = async (manifest) => {
  if (!manifest.brand?.enabled)
    return result("brand-assets", "SeanLab brand assets", "passed", "Brand foundation is disabled", {
      enabled: false,
    });
  try {
    const registryPath = resolve("src/sound-design/generated-registry.json");
    const registry = await safeJson(registryPath);
    if (registry.schemaVersion !== "1.0" || !Array.isArray(registry.assets) || !registry.assets.length)
      throw new Error("Sound registry is empty or unsupported");
    for (const asset of registry.assets) {
      const path = resolve("public", asset.file);
      const bytes = await readFile(path);
      const sha256 = createHash("sha256").update(bytes).digest("hex");
      if (sha256 !== asset.sha256) throw new Error(`Sound asset checksum differs: ${asset.id}`);
      if (!Number.isFinite(asset.meanVolumeDb) || !Number.isFinite(asset.peakDbfs))
        throw new Error(`Sound asset lacks loudness metadata: ${asset.id}`);
    }
    return result(
      "brand-assets",
      "SeanLab brand assets",
      "passed",
      `${manifest.brand.profileId}, ${registry.assets.length} frozen sound assets`,
      { profileId: manifest.brand.profileId, registryPath },
    );
  } catch (error) {
    return result(
      "brand-assets",
      "SeanLab brand assets",
      "failed",
      error.message,
      { profileId: manifest.brand.profileId },
      "Regenerate and review the owned local SeanLab sound registry before rendering.",
    );
  }
};

const regressionCheck = async (manifest, paths) => {
  if (!manifest.regression?.enabled)
    return result(
      "regression",
      "Regression profile",
      "warning",
      "Project regression is disabled",
      { profileId: manifest.regression?.profileId },
      "Enable and pin a project fixture before release acceptance when one is available.",
    );
  try {
    const registry = await safeJson(paths.regressionRegistry);
    const fixture = registry.fixtures?.find((item) => item.id === manifest.regression.fixtureId);
    if (!fixture) throw new Error(`Fixture not found: ${manifest.regression.fixtureId}`);
    await access(paths.regressionExpected);
    for (const source of fixture.sources ?? []) {
      if (source.gitPolicy !== "local-only") continue;
      const sourcePath = resolve(process.cwd(), source.path);
      await access(sourcePath);
    }
    return result("regression", "Regression profile", "passed", `${registry.profileId} / ${fixture.id}`, {
      registry: paths.regressionRegistry,
      expected: paths.regressionExpected,
      fixtureId: fixture.id,
    });
  } catch (error) {
    return result(
      "regression",
      "Regression profile",
      "failed",
      error.message,
      { registry: paths.regressionRegistry, expected: paths.regressionExpected },
      "Restore the pinned registry, expected manifest, and any required local-only source reference.",
    );
  }
};

const outputCheck = async (paths) => {
  try {
    await assertWritable(paths.workspace);
    const overlap = resolve(paths.source).startsWith(`${resolve(paths.workspace)}/`);
    if (overlap) throw new Error("Source video must not live inside the generated workspace");
    return result("output", "Output workspace", "passed", "Writable and separate from the source", {
      workspace: paths.workspace,
    });
  } catch (error) {
    return result(
      "output",
      "Output workspace",
      "failed",
      error.message,
      { workspace: paths.workspace },
      "Choose a writable workspace outside the source-media location.",
    );
  }
};

const resumabilityCheck = async (manifest, paths, stages, activeStage) => {
  if (!(await fileExists(paths.state)))
    return result("resume", "Resumable state", "passed", "Fresh project; no prior state", { mode: "fresh" });
  try {
    const state = await safeJson(paths.state);
    if (state.projectId !== manifest.project.id) throw new Error("Run-state projectId does not match the manifest");
    const validStages = new Set([...stages.map((stage) => stage.name), ...CONDITIONAL_STAGE_NAMES]);
    const invalid = Object.entries(state.stages ?? {}).filter(
      ([name, value]) => !validStages.has(name) || !STAGE_STATUSES.includes(value.status),
    );
    if (invalid.length) throw new Error(`Run state contains ${invalid.length} unsupported stage entries`);
    const interrupted = Object.entries(state.stages ?? {})
      .filter(([name, value]) => value.status === "running" && name !== activeStage)
      .map(([name]) => name);
    const stale = Object.entries(state.stages ?? {})
      .filter(([, value]) => value.status === "stale")
      .map(([name]) => name);
    return result(
      "resume",
      "Resumable state",
      interrupted.length ? "warning" : "passed",
      interrupted.length
        ? `Interrupted stages can be resumed: ${interrupted.join(", ")}`
        : stale.length
          ? `${stale.length} stale stage(s) will be rebuilt from the narrowest valid point`
          : "Prior stage state is structurally resumable",
      { mode: "resume", interrupted, stale, updatedAt: state.updatedAt },
      interrupted.length ? "Resume normally; do not delete valid upstream artifacts." : undefined,
    );
  } catch (error) {
    return result(
      "resume",
      "Resumable state",
      "failed",
      error.message,
      { statePath: paths.state },
      "Repair or archive the invalid run-state before starting paid or render stages.",
    );
  }
};

export const runProjectPreflight = async ({ context, stages, currentAssetProfile, activeStage } = {}) => {
  const { manifest, manifestPath, paths } = context;
  const checks = [
    result("manifest", "Project manifest", "passed", `${manifest.schemaVersion} / ${manifest.project.id}`, {
      manifestPath,
    }),
    await sourceCheck(paths),
    await transcriptCheck(manifest, paths),
    await providerCheck(manifest),
    assetProfileCheck(manifest, currentAssetProfile),
    terminologyCheck(manifest),
    await productionContractsCheck(),
    await brandAssetsCheck(manifest),
    await supplementalMediaCheck(manifest, paths),
    await regressionCheck(manifest, paths),
    await outputCheck(paths),
    await resumabilityCheck(manifest, paths, stages, activeStage),
  ];
  const summary = {
    passed: checks.filter((item) => item.status === "passed").length,
    warnings: checks.filter((item) => item.status === "warning").length,
    failed: checks.filter((item) => item.status === "failed").length,
  };
  return {
    schemaVersion: "1.0",
    kind: "project-preflight",
    generatedAt: new Date().toISOString(),
    projectId: manifest.project.id,
    status: summary.failed ? "failed" : summary.warnings ? "warning" : "passed",
    summary,
    checks,
  };
};
