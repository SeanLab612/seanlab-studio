import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileExists } from "../workflow/state.mjs";

const hashFileStreaming = (path) =>
  new Promise((resolveHash, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(path);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolveHash(hash.digest("hex")));
  });

const portablePath = (value) => value.split(sep).join("/");

const sanitiseJson = (value, pathMap) => {
  if (Array.isArray(value)) return value.map((item) => sanitiseJson(item, pathMap));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !/(?:apiKey|token|secret|password)$/i.test(key) || key === "apiKeyEnv")
        .map(([key, item]) => [key, sanitiseJson(item, pathMap)]),
    );
  }
  if (typeof value !== "string" || !isAbsolute(value)) return value;
  const exact = pathMap.get(resolve(value));
  return exact ?? `external-reference/${basename(value)}`;
};

const safeWriteJson = async (outputPath, data) => {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(data, null, 2)}\n`);
};

const candidateArtifacts = (context, includeReview) => {
  const { paths } = context;
  return [
    [paths.transcript, "artifacts/transcript-raw.json", "transcript"],
    [paths.conformedTranscript, "artifacts/transcript.json", "transcript-conformance"],
    [paths.transcriptConformanceReport, "artifacts/transcript-conformance-report.json", "transcript-conformance"],
    ...(paths.referenceScript ? [[paths.referenceScript, "configuration/locked-narration.md", "configuration"]] : []),
    [resolve(paths.workspace, "edl.json"), "artifacts/edl.json", "edit-plan"],
    [paths.recutProviderPlan, "artifacts/recut-provider-plan.json", "recut-plan"],
    [paths.recutProviderReport, "artifacts/recut-provider-report.json", "recut-plan"],
    [paths.recutCandidates, "artifacts/recut-candidates.json", "edit-plan"],
    [paths.recutReview, "artifacts/recut-review.md", "edit-plan"],
    [paths.captions, "artifacts/captions-verbatim.json", "captions"],
    [resolve(paths.workspace, "captions-verbatim.srt"), "artifacts/captions-verbatim.srt", "captions"],
    [paths.terminologyProfile, "artifacts/terminology-profile.json", "terminology"],
    [paths.terminologyReview, "artifacts/terminology-review.json", "terminology"],
    ...(paths.terminologyOverrides
      ? [[paths.terminologyOverrides, "configuration/terminology-overrides.json", "configuration"]]
      : []),
    ...(paths.regressionExpected
      ? [[paths.regressionExpected, "configuration/regression-expected.json", "configuration"]]
      : []),
    [paths.planning, "artifacts/visual-brief.json", "visual-brief"],
    [paths.semanticNarrativePlan, "artifacts/semantic-narrative-plan.json", "semantic-plan"],
    [paths.semanticProviderReport, "artifacts/semantic-provider-report.json", "semantic-plan"],
    [paths.componentCandidates, "artifacts/component-candidates.json", "component-props"],
    [paths.visualDirectionPlan, "artifacts/visual-direction-plan.json", "visual-direction"],
    [paths.visualDirectionReport, "artifacts/visual-direction-report.json", "visual-direction"],
    [paths.visualDirectionReview, "artifacts/visual-direction-review.md", "visual-direction"],
    [paths.visualDirectionTimeline, "artifacts/visual-direction-timeline.svg", "visual-direction"],
    [paths.reviewProps, "artifacts/component-props.json", "component-props"],
    [resolve(paths.workspace, "validation-report.json"), "artifacts/validation-report.json", "validation"],
    [resolve(paths.workspace, "visual-qa/qa-report.json"), "artifacts/visual-qa/qa-report.json", "visual-qa"],
    [resolve(paths.workspace, "visual-qa/image-metrics.json"), "artifacts/visual-qa/image-metrics.json", "visual-qa"],
    [paths.reviewEvidence, "artifacts/review-evidence.json", "review-evidence"],
    [paths.reviewEvidenceSummary, "artifacts/review-evidence.md", "review-evidence"],
    [paths.deliveryValidation, "artifacts/delivery-validation.json", "delivery-validation"],
    [paths.regressionReport, "artifacts/regression/report.json", "regression"],
    [paths.regressionReview, "artifacts/regression/review.md", "regression"],
    [paths.preflightReport, "artifacts/preflight-report.json", "preflight"],
    [paths.artifacts, "artifacts/artifact-ledger.json", "ledger"],
    ...(includeReview
      ? [
          [resolve(paths.workspace, "review-1080p.mp4"), "media/review-1080p.mp4", "review-video"],
          [paths.recutPreview, "media/recut-preview-720p.mp4", "recut-preview-video"],
          [
            resolve(paths.workspace, "visual-qa/contact-sheet.png"),
            "media/visual-qa-contact-sheet.png",
            "review-contact-sheet",
          ],
        ]
      : []),
  ];
};

const manifestForBundle = (context) => {
  const manifest = structuredClone(context.manifest);
  const sourceName = basename(context.paths.source);
  manifest.paths = {
    ...manifest.paths,
    source: `external/${sourceName}`,
    transcript: "artifacts/transcript.json",
    workspace: "workspace",
    planning: "artifacts/visual-brief.json",
    reviewProps: "artifacts/component-props.json",
  };
  if (manifest.terminology?.projectOverrides)
    manifest.terminology.projectOverrides = "configuration/terminology-overrides.json";
  if (manifest.regression) {
    manifest.regression = {
      ...manifest.regression,
      enabled: false,
      registry: "configuration/regression-selection.json",
      expectedManifest: context.paths.regressionExpected ? "configuration/regression-expected.json" : undefined,
    };
    manifest.regression = Object.fromEntries(
      Object.entries(manifest.regression).filter(([, value]) => value !== undefined),
    );
  }
  return manifest;
};

const buildPathMap = (entries) => new Map(entries.map(([source, destination]) => [resolve(source), destination]));

const copyPortableArtifact = async ({ source, destination, outputRoot, pathMap }) => {
  const outputPath = resolve(outputRoot, destination);
  await mkdir(dirname(outputPath), { recursive: true });
  if (extname(source).toLowerCase() === ".json") {
    const json = JSON.parse(await readFile(source, "utf8"));
    await safeWriteJson(outputPath, sanitiseJson(json, pathMap));
  } else await copyFile(source, outputPath);
  const info = await stat(outputPath);
  return {
    path: destination,
    bytes: info.size,
    sha256: await hashFileStreaming(outputPath),
  };
};

export const exportPortableBundle = async ({ context, outputPath, includeReview = false }) => {
  const outputRoot = resolve(outputPath);
  if (await fileExists(outputRoot)) throw new Error(`Bundle output already exists: ${outputRoot}`);
  await mkdir(outputRoot, { recursive: false });

  const available = [];
  for (const entry of candidateArtifacts(context, includeReview)) if (await fileExists(entry[0])) available.push(entry);
  const pathMap = buildPathMap(available);
  pathMap.set(resolve(context.manifestPath), "project.json");

  const inventory = [];
  const projectPath = resolve(outputRoot, "project.json");
  await safeWriteJson(projectPath, manifestForBundle(context));
  inventory.push({
    path: "project.json",
    bytes: (await stat(projectPath)).size,
    sha256: await hashFileStreaming(projectPath),
    kind: "manifest",
  });

  const sourceInfo = await stat(context.paths.source);
  const sourceBinding = {
    schemaVersion: "1.0",
    included: false,
    requiredAt: `external/${basename(context.paths.source)}`,
    originalName: basename(context.paths.source),
    bytes: sourceInfo.size,
    sha256: await hashFileStreaming(context.paths.source),
    reason: "Private source video is never included in a portable project bundle.",
  };
  const bindingPath = resolve(outputRoot, "source-binding.json");
  await safeWriteJson(bindingPath, sourceBinding);
  inventory.push({
    path: "source-binding.json",
    bytes: (await stat(bindingPath)).size,
    sha256: await hashFileStreaming(bindingPath),
    kind: "source-binding",
  });

  if (context.manifest.regression?.fixtureId && context.paths.regressionRegistry) {
    const sourceRegistry = JSON.parse(await readFile(context.paths.regressionRegistry, "utf8"));
    const selected = sourceRegistry.fixtures?.find((item) => item.id === context.manifest.regression.fixtureId);
    if (selected) {
      const portableFixture = sanitiseJson(selected, pathMap);
      for (const source of portableFixture.sources ?? []) {
        if (source.gitPolicy === "local-only") source.path = `external/${basename(context.paths.source)}`;
      }
      const selectionPath = resolve(outputRoot, "configuration/regression-selection.json");
      await safeWriteJson(selectionPath, {
        schemaVersion: sourceRegistry.schemaVersion,
        profileId: sourceRegistry.profileId,
        fixtures: [portableFixture],
      });
      inventory.push({
        path: "configuration/regression-selection.json",
        bytes: (await stat(selectionPath)).size,
        sha256: await hashFileStreaming(selectionPath),
        kind: "configuration",
      });
    }
  }

  for (const [source, destination, kind] of available) {
    const copied = await copyPortableArtifact({ source, destination, outputRoot, pathMap });
    inventory.push({ ...copied, kind });
  }

  const bundleManifest = {
    schemaVersion: "1.0",
    kind: "portable-project-bundle",
    createdAt: new Date().toISOString(),
    projectId: context.manifest.project.id,
    sourceIncluded: false,
    reviewVideoIncluded: includeReview && inventory.some((item) => item.kind === "review-video"),
    security: {
      apiSecretsIncluded: false,
      privateSourceIncluded: false,
      reusableRestrictedAssetsIncluded: false,
      logsIncluded: false,
    },
    excluded: [
      "source video",
      "API keys and provider secrets",
      "workflow logs",
      "review video and image contact sheet unless --include-review is explicit",
      "node_modules",
      "local-only regression source media",
      "non-redistributable reusable assets",
    ],
    inventory,
  };
  const bundleManifestPath = resolve(outputRoot, "bundle-manifest.json");
  await safeWriteJson(bundleManifestPath, bundleManifest);
  return { outputRoot, bundleManifestPath, bundleManifest };
};

const collectFiles = async (root, current = root) => {
  const files = [];
  for (const entry of await readdir(current, { withFileTypes: true })) {
    const absolute = join(current, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(root, absolute)));
    else if (entry.isFile()) files.push(portablePath(relative(root, absolute)));
  }
  return files;
};

export const verifyPortableBundle = async (bundlePath) => {
  const root = resolve(bundlePath);
  const manifest = JSON.parse(await readFile(resolve(root, "bundle-manifest.json"), "utf8"));
  const findings = [];
  const declared = new Set(["bundle-manifest.json", ...manifest.inventory.map((item) => item.path)]);
  const actual = new Set(await collectFiles(root));
  for (const path of actual)
    if (!declared.has(path)) findings.push({ severity: "error", rule: "inventory.unlisted", path });
  for (const item of manifest.inventory) {
    const path = resolve(root, item.path);
    if (!path.startsWith(`${root}${sep}`)) {
      findings.push({ severity: "error", rule: "path.escape", path: item.path });
      continue;
    }
    if (!(await fileExists(path))) {
      findings.push({ severity: "error", rule: "inventory.missing", path: item.path });
      continue;
    }
    const sha256 = await hashFileStreaming(path);
    if (sha256 !== item.sha256) findings.push({ severity: "error", rule: "inventory.hash", path: item.path });
    if (/\.(?:mov|mp4)$/i.test(item.path) && item.kind !== "review-video")
      findings.push({ severity: "error", rule: "privacy.source-video", path: item.path });
    if (item.path.endsWith(".json")) {
      const text = await readFile(path, "utf8");
      if (/MIMO_API_KEY\s*[:=]\s*["'][^"']{12,}/i.test(text) || /Bearer\s+[A-Za-z0-9._~+/=-]{12,}/i.test(text))
        findings.push({ severity: "error", rule: "privacy.secret", path: item.path });
      const json = JSON.parse(text);
      const scan = (value) => {
        if (Array.isArray(value)) return value.forEach(scan);
        if (value && typeof value === "object") return Object.values(value).forEach(scan);
        if (typeof value === "string" && isAbsolute(value))
          findings.push({ severity: "error", rule: "privacy.absolute-path", path: item.path });
      };
      scan(json);
    }
  }
  return {
    schemaVersion: "1.0",
    kind: "portable-bundle-verification",
    bundlePath: root,
    status: findings.some((item) => item.severity === "error") ? "failed" : "passed",
    summary: { files: actual.size, findings: findings.length },
    findings,
  };
};
