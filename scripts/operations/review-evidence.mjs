import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import { fileExists } from "../workflow/state.mjs";

const canonicalHash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

const hashFile = (path) =>
  new Promise((done, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(path);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => done(hash.digest("hex")));
  });

const insideWorkspace = (workspace, path) => {
  const relativePath = relative(workspace, path);
  return relativePath !== ".." && !relativePath.startsWith(`..${sep}`) && !relativePath.startsWith(sep);
};

const describe = async (workspace, path, kind) => {
  const absolute = resolve(path);
  if (!insideWorkspace(workspace, absolute))
    throw new Error(`Review evidence must stay inside the workspace: ${absolute}`);
  const info = await stat(absolute);
  if (!info.isFile()) throw new Error(`Review evidence artifact must be a file: ${absolute}`);
  return {
    kind,
    path: relative(workspace, absolute).split(sep).join("/"),
    bytes: info.size,
    sha256: await hashFile(absolute),
  };
};

export const buildReviewEvidence = async ({ config }) => {
  const workspace = resolve(config.editDir);
  const qaDir = resolve(config.visualQa.outputDir);
  const framesManifestPath = resolve(qaDir, "frames-manifest.json");
  const framesManifest = JSON.parse(await readFile(framesManifestPath, "utf8"));
  const qaReport = JSON.parse(await readFile(resolve(config.visualQa.reportFile), "utf8"));
  const recutCandidates = config.recutEnabled
    ? JSON.parse(await readFile(resolve(config.recutCandidatesFile), "utf8"))
    : undefined;
  const required = [
    [config.planningFile, "visual-plan"],
    [config.reviewPropsFile, "render-props"],
    [config.finalPropsFile, "delivery-render-props"],
    [resolve(qaDir, "frame-plan.json"), "frame-plan"],
    [framesManifestPath, "frames-manifest"],
    [resolve(qaDir, "qa-contracts.json"), "qa-contracts"],
    [resolve(qaDir, "image-metrics.json"), "image-metrics"],
    [resolve(qaDir, "contact-sheet.png"), "contact-sheet"],
    [resolve(qaDir, "title-continuity-contact-sheet.png"), "title-continuity-contact-sheet"],
    [config.visualQa.reportFile, "qa-report"],
  ];
  const optional = [
    [config.semanticNarrativePlanFile, "semantic-narrative-plan"],
    [config.semanticProviderReportFile, "semantic-provider-report"],
    [config.componentCandidatesFile, "component-candidates"],
    [config.supplementalMediaManifestFile, "supplemental-media-manifest"],
    [config.imageEvidenceManifestFile, "image-evidence-manifest"],
    [config.resolvedSceneTimelineFile, "resolved-scene-timeline"],
    [config.sceneAlignmentReportFile, "scene-alignment-report"],
    [config.visualDirectionPlanFile, "visual-direction-plan"],
    [config.visualDirectionReportFile, "visual-direction-report"],
    [config.visualDirectionReviewFile, "visual-direction-review"],
    [config.visualDirectionTimelineFile, "visual-direction-timeline"],
    [config.terminologyReviewFile, "terminology-review"],
  ];
  if (config.recutEnabled)
    required.push(
      [resolve(config.editDir, "edl.json"), "approved-recut-edl"],
      [config.recutProviderPlanFile, "recut-provider-plan"],
      [config.recutProviderReportFile, "recut-provider-report"],
      [config.recutCandidatesFile, "recut-candidates"],
      [config.recutReviewFile, "recut-review"],
      [config.recutPreviewFile, "recut-preview-video"],
    );
  if (config.brandEnabled)
    required.push(
      [config.brandTimelineFile, "brand-timeline"],
      [config.brandReviewFile, "brand-alignment-report"],
      [config.soundPlanFile, "sound-event-plan"],
      [config.soundReportFile, "sound-registry-report"],
      [config.soundTimelineFile, "sound-event-timeline"],
      [config.brandBumperPreviewFile, "brand-bumper-preview"],
      [config.brandTransitionPreviewFile, "brand-transition-preview"],
      [config.brandSoundReviewFile, "brand-sound-mix-report"],
    );
  if (config.mediaTransitionReviewEnabled)
    optional.push(
      [config.mediaTransitionEntryPreviewFile, "media-transition-entry-preview"],
      [config.mediaTransitionExitPreviewFile, "media-transition-exit-preview"],
    );
  if (config.mediaTransitionReviewEnabled) required.push([config.mediaTransitionReviewFile, "media-transition-report"]);
  if (config.reviewMode === "full-video") required.push([config.reviewOutputFile, "review-video"]);
  else if (config.motionReviewMode === "conditional-excerpts") {
    required.push([config.motionRiskReviewReportFile, "motion-risk-review-report"]);
    const motionReport = JSON.parse(await readFile(resolve(config.motionRiskReviewReportFile), "utf8"));
    if (motionReport.preview?.path)
      required.push([resolve(workspace, motionReport.preview.path), "motion-risk-review-video"]);
  } else required.push([config.visualPacingReviewFile, "visual-pacing-review-video"]);
  for (const frame of framesManifest.frames ?? []) required.push([frame.file, "risk-frame"]);

  const artifacts = [];
  for (const [path, kind] of required) {
    if (!path || !(await fileExists(resolve(path))))
      throw new Error(`Missing required review evidence: ${path ?? kind}`);
    artifacts.push(await describe(workspace, path, kind));
  }
  for (const [path, kind] of optional)
    if (path && (await fileExists(resolve(path)))) artifacts.push(await describe(workspace, path, kind));
  artifacts.sort((left, right) => left.path.localeCompare(right.path));

  const binding = {
    schemaVersion: "1.0",
    projectId: config.projectId,
    reviewMode: config.reviewMode,
    qaStatus: qaReport.status,
    qaReportSha256: qaReport.reportSha256,
    artifacts,
  };
  return {
    ...binding,
    kind: "review-evidence",
    generatedAt: new Date().toISOString(),
    approvalBindingSha256: canonicalHash(binding),
    summary: {
      semanticComponents: qaReport.summary?.semanticCues ?? 0,
      authoredScreenScenes: qaReport.summary?.authoredScreenScenes ?? 0,
      titleContinuityCues: qaReport.summary?.titleContinuityCues ?? 0,
      visualGroups: qaReport.summary?.visualGroups ?? 0,
      riskFrames: framesManifest.frames?.length ?? 0,
      speakerOnlyFrames: (framesManifest.frames ?? []).filter((frame) => frame.phase === "speaker-only").length,
      qaErrors: qaReport.summary?.errors ?? 0,
      qaWarnings: qaReport.summary?.warnings ?? 0,
      fullReviewVideoIncluded: config.reviewMode === "full-video",
      motionReviewMode: config.motionReviewMode ?? "full-pacing",
      visualPacingReviewIncluded:
        config.reviewMode !== "full-video" && config.motionReviewMode !== "conditional-excerpts",
      motionRiskReviewIncluded:
        config.reviewMode !== "full-video" &&
        config.motionReviewMode === "conditional-excerpts" &&
        artifacts.some((artifact) => artifact.kind === "motion-risk-review-video"),
      motionRiskReviewRequired:
        config.reviewMode !== "full-video" &&
        config.motionReviewMode === "conditional-excerpts" &&
        artifacts.some((artifact) => artifact.kind === "motion-risk-review-video"),
      recutEnabled: Boolean(config.recutEnabled),
      recutCandidates: recutCandidates?.summary?.candidateCount ?? 0,
      recutRemovals: recutCandidates?.summary?.removalCount ?? 0,
      recutSavingsSeconds: recutCandidates?.summary?.proposedSavingsSeconds ?? 0,
      recutPreviewIncluded: Boolean(config.recutEnabled),
      brandEnabled: Boolean(config.brandEnabled),
      brandBumperPreviewIncluded: Boolean(config.brandEnabled),
      brandTransitionPreviewIncluded: Boolean(config.brandEnabled),
      mediaTransitionPreviewIncluded:
        Boolean(config.mediaTransitionReviewEnabled) &&
        (await fileExists(resolve(config.mediaTransitionEntryPreviewFile))) &&
        (await fileExists(resolve(config.mediaTransitionExitPreviewFile))),
    },
  };
};

export const verifyReviewEvidence = async ({ evidencePath, workspace }) => {
  const root = resolve(workspace);
  const evidence = JSON.parse(await readFile(resolve(evidencePath), "utf8"));
  if (evidence.schemaVersion !== "1.0" || evidence.kind !== "review-evidence")
    throw new Error("Review evidence uses an unsupported contract");
  if (!(evidence.artifacts ?? []).some((artifact) => artifact.kind === "delivery-render-props"))
    throw new Error("Review evidence does not bind the delivery render props");
  for (const artifact of evidence.artifacts ?? []) {
    const absolute = resolve(root, artifact.path);
    if (!insideWorkspace(root, absolute))
      throw new Error(`Review evidence path escapes the workspace: ${artifact.path}`);
    if (!(await fileExists(absolute))) throw new Error(`Review evidence artifact is missing: ${artifact.path}`);
    if ((await hashFile(absolute)) !== artifact.sha256)
      throw new Error(`Review evidence artifact changed after capture: ${artifact.path}`);
  }
  const binding = {
    schemaVersion: evidence.schemaVersion,
    projectId: evidence.projectId,
    reviewMode: evidence.reviewMode,
    qaStatus: evidence.qaStatus,
    qaReportSha256: evidence.qaReportSha256,
    artifacts: evidence.artifacts,
  };
  if (canonicalHash(binding) !== evidence.approvalBindingSha256)
    throw new Error("Review evidence approval binding is invalid");
  return evidence;
};
