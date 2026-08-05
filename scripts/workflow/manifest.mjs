import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, extname, isAbsolute, relative, resolve } from "node:path";

export const PROJECT_SCHEMA_VERSION = "1.0";
export const REVIEW_MODES = Object.freeze(["static", "full-video"]);
export const MOTION_REVIEW_MODES = Object.freeze(["conditional-excerpts", "full-pacing"]);
export const TYPOGRAPHY_MODES = Object.freeze(["auto", "system-only", "wenkai-emphasis"]);
export const ANIMATION_TEMPLATE_IDS = Object.freeze(["paper-editorial"]);
export const typographyPolicyFor = (manifest) =>
  manifest.policies?.typography ?? { version: "system-1.0", mode: "system-only" };

export const reviewModeFor = (manifest) => manifest.workflow?.reviewMode ?? "full-video";
export const motionReviewModeFor = (manifest) => manifest.workflow?.motionReviewMode ?? "full-pacing";
export const intelligentRecutEnabled = (manifest) => manifest.policies?.edit?.version === "2.0";
export const brandFoundationEnabled = () => false;

export const CURRENT_ASSET_PROFILE = Object.freeze({
  id: "foundation-0.1.11",
  designTokens: "1.1",
  motionPrimitives: "2.0",
  motionRecipes: "1.0",
  layoutTemplates: "1.0",
  semanticComponents: 20,
  brandIcons: 16,
  systemIcons: 23,
  chartRecipes: 10,
  peopleCatalog: 149,
  identityAssets: 40,
  approvedPeople: 72,
  approvedIdentityAssets: 31,
  identityAliases: "1.0",
  terminologyProfile: "1.0",
  regressionFixtures: "1.0",
});

const assertObject = (value, label) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
};

export const validateManifest = (manifest) => {
  assertObject(manifest, "manifest");
  if (manifest.schemaVersion !== PROJECT_SCHEMA_VERSION)
    throw new Error(`Unsupported schemaVersion: ${manifest.schemaVersion}`);
  assertObject(manifest.project, "project");
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(manifest.project.id ?? ""))
    throw new Error("project.id must use lowercase letters, numbers, and hyphens");
  if (!manifest.project.title?.trim()) throw new Error("project.title is required");
  if (manifest.agent) {
    assertObject(manifest.agent, "agent");
    if (!["codex-cli", "claude-code", "fixture"].includes(manifest.agent.id))
      throw new Error("agent.id must be codex-cli, claude-code, or fixture");
    if (manifest.agent.fallback !== "none") throw new Error("agent.fallback must be none");
    if (manifest.agent.id !== "fixture") {
      if (
        manifest.providers?.semanticPlanning?.provider !== "fixture" &&
        manifest.providers?.semanticPlanning?.provider !== manifest.agent.id
      )
        throw new Error("providers.semanticPlanning must match the project-wide agent");
      if (
        manifest.providers?.recutPlanning?.provider !== "fixture" &&
        manifest.providers?.recutPlanning?.provider !== manifest.agent.id
      )
        throw new Error("providers.recutPlanning must match the project-wide agent");
    }
  }
  assertObject(manifest.paths, "paths");
  for (const key of ["source", "transcript", "workspace"])
    if (!manifest.paths[key]) throw new Error(`paths.${key} is required`);
  assertObject(manifest.providers?.transcription, "providers.transcription");
  if (!["existing-word-json", "video-use-scribe"].includes(manifest.providers.transcription.provider))
    throw new Error("transcription provider must be existing-word-json or video-use-scribe");
  assertObject(manifest.providers?.translation, "providers.translation");
  if (!["codex-cli", "claude-code", "fixture", "mimo", "offline"].includes(manifest.providers.translation.provider))
    throw new Error("translation provider must be codex-cli, claude-code, fixture, mimo, or offline");
  if (
    manifest.agent?.id !== "fixture" &&
    ["codex-cli", "claude-code"].includes(manifest.providers.translation.provider) &&
    manifest.providers.translation.provider !== manifest.agent.id
  )
    throw new Error("Agent translation provider must match the project-wide agent");
  assertObject(manifest.providers?.semanticPlanning, "providers.semanticPlanning");
  if (!["codex-cli", "claude-code", "mimo", "fixture"].includes(manifest.providers.semanticPlanning.provider))
    throw new Error("semantic planning provider must be codex-cli, claude-code, mimo, or fixture");
  if (manifest.providers.recutPlanning) {
    assertObject(manifest.providers.recutPlanning, "providers.recutPlanning");
    if (!["codex-cli", "claude-code", "fixture"].includes(manifest.providers.recutPlanning.provider))
      throw new Error("recut planning provider must be codex-cli, claude-code, or fixture");
    if (manifest.providers.recutPlanning.provider === "fixture" && !manifest.providers.recutPlanning.fixture)
      throw new Error("fixture recut planning requires providers.recutPlanning.fixture");
  }
  if (
    manifest.providers.semanticPlanning.minimumSegmentSeconds &&
    manifest.providers.semanticPlanning.maximumSegmentSeconds &&
    manifest.providers.semanticPlanning.minimumSegmentSeconds >=
      manifest.providers.semanticPlanning.maximumSegmentSeconds
  )
    throw new Error("semantic planning maximumSegmentSeconds must exceed minimumSegmentSeconds");
  assertObject(manifest.policies?.edit, "policies.edit");
  if (manifest.policies.edit.version !== undefined && !["1.0", "2.0"].includes(manifest.policies.edit.version))
    throw new Error("policies.edit.version must be 1.0 or 2.0");
  if (intelligentRecutEnabled(manifest)) {
    if (!manifest.providers.recutPlanning)
      throw new Error("providers.recutPlanning is required for intelligent recut 2.0");
    for (const key of [
      "minimumCompressedGapSeconds",
      "keptGapSeconds",
      "minimumCandidateConfidence",
      "minimumBoundarySilenceSeconds",
      "maximumCandidateSeconds",
    ])
      if (!(Number.isFinite(manifest.policies.edit[key]) && manifest.policies.edit[key] >= 0))
        throw new Error(`policies.edit.${key} must be a non-negative number`);
    if (manifest.policies.edit.minimumCandidateConfidence > 1)
      throw new Error("policies.edit.minimumCandidateConfidence must not exceed one");
    for (const key of ["manualRemovals", "rejectedCandidateIds", "protectedAnchors"])
      if (!Array.isArray(manifest.policies.edit[key])) throw new Error(`policies.edit.${key} must be an array`);
    const protectedIds = new Set();
    for (const anchor of manifest.policies.edit.protectedAnchors) {
      assertObject(anchor, "policies.edit.protectedAnchors item");
      if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(anchor.id ?? "")) throw new Error("protected recut anchor id is invalid");
      if (protectedIds.has(anchor.id)) throw new Error(`Duplicate protected recut anchor id: ${anchor.id}`);
      protectedIds.add(anchor.id);
      if (typeof anchor.text !== "string" || anchor.text.trim().length < 2)
        throw new Error(`protected recut anchor ${anchor.id} requires text`);
    }
  }
  assertObject(manifest.policies?.captions, "policies.captions");
  if (manifest.policies.captions.segmentation) {
    assertObject(manifest.policies.captions.segmentation, "policies.captions.segmentation");
    for (const key of [
      "maximumDurationSeconds",
      "maximumCharacters",
      "pauseBreakSeconds",
      "softPunctuationMinimumCharacters",
      "orphanMaximumCharacters",
    ])
      if (!(manifest.policies.captions.segmentation[key] > 0))
        throw new Error(`policies.captions.segmentation.${key} must be greater than zero`);
  }
  if (!new Set(["source", "none"]).has(manifest.policies.captions.displayPunctuation ?? "none"))
    throw new Error("policies.captions.displayPunctuation must be source or none");
  assertObject(manifest.policies?.layout, "policies.layout");
  if (manifest.supplementalMedia) {
    assertObject(manifest.supplementalMedia, "supplementalMedia");
    if (manifest.supplementalMedia.version !== "1.0") throw new Error("supplementalMedia.version must be 1.0");
    if (!Array.isArray(manifest.supplementalMedia.assets)) throw new Error("supplementalMedia.assets must be an array");
    const ids = new Set();
    for (const asset of manifest.supplementalMedia.assets) {
      assertObject(asset, "supplementalMedia asset");
      if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(asset.id ?? "")) throw new Error("supplemental media id is invalid");
      if (ids.has(asset.id)) throw new Error(`Duplicate supplemental media id: ${asset.id}`);
      ids.add(asset.id);
      if (!asset.path) throw new Error(`supplemental media ${asset.id} requires a path`);
      if (asset.audioPolicy !== "mute") throw new Error("supplemental media audioPolicy must be mute");
      if (asset.clip && !(asset.clip.in >= 0 && asset.clip.out > asset.clip.in))
        throw new Error(`supplemental media ${asset.id} has an invalid clip range`);
    }
    if (manifest.supplementalMedia.assets.length && !manifest.paths.authoredScenePlan)
      throw new Error("paths.authoredScenePlan is required when supplemental media is configured");
  }
  if (manifest.imageEvidence) {
    assertObject(manifest.imageEvidence, "imageEvidence");
    if (manifest.imageEvidence.version !== "1.0") throw new Error("imageEvidence.version must be 1.0");
    if (!Array.isArray(manifest.imageEvidence.assets)) throw new Error("imageEvidence.assets must be an array");
    const ids = new Set();
    for (const asset of manifest.imageEvidence.assets) {
      assertObject(asset, "imageEvidence asset");
      if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(asset.id ?? "")) throw new Error("image evidence id is invalid");
      if (ids.has(asset.id)) throw new Error(`Duplicate image evidence id: ${asset.id}`);
      ids.add(asset.id);
      if (!asset.path) throw new Error(`image evidence ${asset.id} requires a path`);
      if (!asset.description?.trim()) throw new Error(`image evidence ${asset.id} requires a description`);
      if (asset.required && !asset.anchorText?.trim())
        throw new Error(`required image evidence ${asset.id} requires a spoken anchorText`);
      if (!["contain", "cover"].includes(asset.fit)) throw new Error(`image evidence ${asset.id} has invalid fit`);
      assertObject(asset.focalPoint, `image evidence ${asset.id} focalPoint`);
      if (
        ![asset.focalPoint.x, asset.focalPoint.y].every((value) => Number.isFinite(value) && value >= 0 && value <= 1)
      )
        throw new Error(`image evidence ${asset.id} has invalid focalPoint`);
    }
  }
  if (manifest.brand) {
    assertObject(manifest.brand, "brand");
    if (manifest.brand.version !== "1.0") throw new Error("brand.version must be 1.0");
    if (typeof manifest.brand.enabled !== "boolean") throw new Error("brand.enabled must be boolean");
    if (manifest.brand.enabled) throw new Error("The open-source edition does not insert a fixed brand bumper");
  }
  if (manifest.terminology) {
    assertObject(manifest.terminology, "terminology");
    if (manifest.terminology.version !== "1.0") throw new Error("terminology.version must be 1.0");
    const allowedDomains = new Set(["ai-software", "finance-markets", "laboratory-biopharma"]);
    if (
      !Array.isArray(manifest.terminology.domains) ||
      manifest.terminology.domains.some((item) => !allowedDomains.has(item))
    )
      throw new Error("terminology.domains contains an unsupported domain pack");
  }
  if (manifest.regression) {
    assertObject(manifest.regression, "regression");
    if (manifest.regression.profileId !== "foundation-0.1.13")
      throw new Error("regression.profileId must be foundation-0.1.13");
    if (typeof manifest.regression.enabled !== "boolean") throw new Error("regression.enabled must be boolean");
    if (!manifest.regression.registry) throw new Error("regression.registry is required");
    if (manifest.regression.enabled && (!manifest.regression.fixtureId || !manifest.regression.expectedManifest))
      throw new Error("Enabled regression requires fixtureId and expectedManifest");
  }
  if (manifest.policies?.visualQa) assertObject(manifest.policies.visualQa, "policies.visualQa");
  if (manifest.policies?.typography) {
    assertObject(manifest.policies.typography, "policies.typography");
    if (manifest.policies.typography.version !== "typography-2.0")
      throw new Error("policies.typography.version must be typography-2.0");
    if (!TYPOGRAPHY_MODES.includes(manifest.policies.typography.mode))
      throw new Error("policies.typography.mode is invalid");
  }
  if (manifest.policies?.animation) {
    assertObject(manifest.policies.animation, "policies.animation");
    const normalizeLegacyTemplateId = (id) =>
      id === "stop-motion-machine" || id === "research-archive" ? "paper-editorial" : id;
    if (manifest.policies.animation.mode === "per-cue") {
      manifest.policies.animation.allowedTemplateIds = [
        ...new Set((manifest.policies.animation.allowedTemplateIds ?? []).map(normalizeLegacyTemplateId)),
      ];
      if (
        !Array.isArray(manifest.policies.animation.allowedTemplateIds) ||
        manifest.policies.animation.allowedTemplateIds.length === 0 ||
        manifest.policies.animation.allowedTemplateIds.some((id) => !ANIMATION_TEMPLATE_IDS.includes(id))
      )
        throw new Error("policies.animation.allowedTemplateIds is invalid");
    } else {
      manifest.policies.animation.templateId = normalizeLegacyTemplateId(manifest.policies.animation.templateId);
      if (!ANIMATION_TEMPLATE_IDS.includes(manifest.policies.animation.templateId))
        throw new Error("policies.animation.templateId is invalid");
    }
  }
  if (manifest.policies?.visualDirection) {
    assertObject(manifest.policies.visualDirection, "policies.visualDirection");
    if (manifest.policies.visualDirection.version !== "1.0")
      throw new Error("policies.visualDirection.version must be 1.0");
    for (const key of [
      "maximumVisualsPerMinute",
      "minimumBreathingGapSeconds",
      "minimumVisibleSeconds",
      "maximumAccentSeconds",
      "maximumSupportSeconds",
      "maximumHeroSeconds",
      "maximumContinuousVisualSeconds",
      "repetitionWindowSeconds",
      "minimumHeroGapSeconds",
      "maximumChapterSeconds",
      "maximumChapterCandidates",
    ])
      if (!(manifest.policies.visualDirection[key] > 0))
        throw new Error(`policies.visualDirection.${key} must be greater than zero`);
    for (const key of ["heroConfidence", "supportConfidence", "accentConfidence"])
      if (!(manifest.policies.visualDirection[key] >= 0 && manifest.policies.visualDirection[key] <= 1))
        throw new Error(`policies.visualDirection.${key} must be between zero and one`);
    if (
      !(
        manifest.policies.visualDirection.heroConfidence >= manifest.policies.visualDirection.supportConfidence &&
        manifest.policies.visualDirection.supportConfidence >= manifest.policies.visualDirection.accentConfidence
      )
    )
      throw new Error("visual direction confidence thresholds must descend from hero to accent");
    if (
      !(
        manifest.policies.visualDirection.maximumVisualCoverageRatio > 0 &&
        manifest.policies.visualDirection.maximumVisualCoverageRatio <= 1
      )
    )
      throw new Error("policies.visualDirection.maximumVisualCoverageRatio must be between zero and one");
  }
  if (manifest.assetProfile) {
    assertObject(manifest.assetProfile, "assetProfile");
    if (
      !["foundation-0.1.8", "foundation-0.1.8-motion-2", "foundation-0.1.10", "foundation-0.1.11"].includes(
        manifest.assetProfile.id,
      )
    )
      throw new Error(`Unsupported assetProfile: ${manifest.assetProfile.id}`);
  }
  assertObject(manifest.render?.review, "render.review");
  assertObject(manifest.render?.delivery, "render.delivery");
  if (!["1080p", "2k", "4k", "source"].includes(manifest.render.delivery.resolution ?? "source"))
    throw new Error("render.delivery.resolution is invalid");
  if (![30, 60, "source"].includes(manifest.render.delivery.frameRate ?? "source"))
    throw new Error("render.delivery.frameRate is invalid");
  if ((manifest.render.delivery.codec ?? "h264") !== "h264") throw new Error("render.delivery.codec must be h264");
  if (!["plan", "review", "delivery"].includes(manifest.workflow?.defaultTarget))
    throw new Error("workflow.defaultTarget is invalid");
  if (manifest.workflow.requireHumanApproval !== true) throw new Error("workflow.requireHumanApproval must be true");
  if (!REVIEW_MODES.includes(reviewModeFor(manifest)))
    throw new Error("workflow.reviewMode must be static or full-video");
  if (!MOTION_REVIEW_MODES.includes(motionReviewModeFor(manifest)))
    throw new Error("workflow.motionReviewMode must be conditional-excerpts or full-pacing");
  return manifest;
};

export const resolveProjectPaths = (manifest, manifestPath) => {
  const root = dirname(resolve(manifestPath));
  const absolute = (value) => (isAbsolute(value) ? value : resolve(root, value));
  const workspace = absolute(manifest.paths.workspace);
  const supplementalMedia = (manifest.supplementalMedia?.assets ?? []).map((asset) => ({
    ...asset,
    path: absolute(asset.path),
  }));
  const imageEvidence = (manifest.imageEvidence?.assets ?? []).map((asset) => ({
    ...asset,
    path: absolute(asset.path),
  }));
  return {
    manifest: resolve(manifestPath),
    root,
    source: absolute(manifest.paths.source),
    transcript: absolute(manifest.paths.transcript),
    workspace,
    conformedTranscript: resolve(workspace, "transcript-conformed.json"),
    transcriptConformanceReport: resolve(workspace, "transcript-conformance-report.json"),
    referenceScript: manifest.paths.referenceScript ? absolute(manifest.paths.referenceScript) : undefined,
    planning: manifest.paths.planning ? absolute(manifest.paths.planning) : resolve(workspace, "visual-brief.json"),
    reviewProps: manifest.paths.reviewProps
      ? absolute(manifest.paths.reviewProps)
      : resolve(workspace, "review-props.json"),
    finalProps: resolve(workspace, "delivery-props.json"),
    authoredScenePlan: manifest.paths.authoredScenePlan ? absolute(manifest.paths.authoredScenePlan) : undefined,
    authoredVisualPlan: manifest.paths.authoredVisualPlan ? absolute(manifest.paths.authoredVisualPlan) : undefined,
    supplementalMedia,
    supplementalMediaManifest: resolve(workspace, "supplemental-media-manifest.json"),
    imageEvidence,
    imageEvidenceManifest: resolve(workspace, "image-evidence-manifest.json"),
    resolvedSceneTimeline: resolve(workspace, "resolved-scene-timeline.json"),
    sceneAlignmentReport: resolve(workspace, "scene-alignment.md"),
    state: resolve(workspace, "run-state.json"),
    artifacts: resolve(workspace, "artifacts.json"),
    runtimeConfig: resolve(workspace, "runtime-config.json"),
    terminologyProfile: resolve(workspace, "terminology-profile.json"),
    terminologyReview: resolve(workspace, "terminology-review.json"),
    terminologyOverrides: manifest.terminology?.projectOverrides
      ? absolute(manifest.terminology.projectOverrides)
      : undefined,
    regressionRegistry: manifest.regression?.registry ? absolute(manifest.regression.registry) : undefined,
    regressionExpected: manifest.regression?.expectedManifest
      ? absolute(manifest.regression.expectedManifest)
      : undefined,
    regressionReport: resolve(workspace, "regression/report.json"),
    regressionReview: resolve(workspace, "regression/review.md"),
    revisions: resolve(workspace, "revisions"),
    revisionHistory: resolve(workspace, "revisions/revision-history.json"),
    captionsSource: resolve(workspace, "captions-verbatim.source.json"),
    captions: resolve(workspace, "captions-verbatim.json"),
    semanticCaptionsSource: resolve(workspace, "captions-semantic.source.json"),
    semanticCaptions: resolve(workspace, "captions-semantic.json"),
    semanticNarrativePlan: resolve(workspace, "semantic-narrative-plan.json"),
    semanticProviderReport: resolve(workspace, "semantic-provider-report.json"),
    componentCandidates: resolve(workspace, "component-candidates.json"),
    visualDirectionPlan: resolve(workspace, "visual-direction-plan.json"),
    visualDirectionReport: resolve(workspace, "visual-direction-report.json"),
    visualDirectionReview: resolve(workspace, "visual-direction-review.md"),
    visualDirectionTimeline: resolve(workspace, "visual-direction-timeline.svg"),
    visualPacingReview: resolve(workspace, "visual-pacing-review-720p.mp4"),
    motionRiskReview: resolve(workspace, "motion-risk-review-540p.mp4"),
    motionRiskReviewReport: resolve(workspace, "motion-risk-review.json"),
    reviewEvidence: resolve(workspace, "review-evidence.json"),
    reviewEvidenceSummary: resolve(workspace, "review-evidence.md"),
    productionAgentReview: resolve(workspace, "production-agent-review.json"),
    deliveryValidation: resolve(workspace, "delivery-validation.json"),
    captionsSrt: resolve(workspace, "captions-verbatim.srt"),
    preflightReport: resolve(workspace, "preflight-report.json"),
    recutProviderPlan: resolve(workspace, "recut-provider-plan.json"),
    recutProviderReport: resolve(workspace, "recut-provider-report.json"),
    proposedEdl: resolve(workspace, "edl.proposed.json"),
    recutCandidates: resolve(workspace, "recut-candidates.json"),
    recutReview: resolve(workspace, "recut-review.md"),
    recutPreview: resolve(workspace, "recut-preview-720p.mp4"),
    recutProposalDir: resolve(workspace, "recut-proposal"),
    brandTimeline: resolve(workspace, "brand-timeline.json"),
    brandReview: resolve(workspace, "brand-alignment.md"),
    soundPlan: resolve(workspace, "sound-plan.json"),
    soundReport: resolve(workspace, "sound-report.json"),
    soundTimeline: resolve(workspace, "sound-timeline.svg"),
    brandBumperPreview: resolve(workspace, "brand-review/project-bumper.mp4"),
    brandTransitionPreview: resolve(workspace, "brand-review/transition-preview.mp4"),
    brandSoundReview: resolve(workspace, "brand-review/mix-report.json"),
    mediaTransitionEntryPreview: resolve(workspace, "media-review/entry-preview.mp4"),
    mediaTransitionExitPreview: resolve(workspace, "media-review/exit-preview.mp4"),
    mediaTransitionReview: resolve(workspace, "media-review/transition-report.json"),
    logs: resolve(workspace, "logs"),
  };
};

export const readManifest = async (manifestPath) => {
  const absolutePath = resolve(manifestPath);
  const manifest = validateManifest(JSON.parse(await readFile(absolutePath, "utf8")));
  return { manifest, manifestPath: absolutePath, paths: resolveProjectPaths(manifest, absolutePath) };
};

export const createManifest = ({
  id,
  title,
  source,
  transcript,
  outputPath,
  agentId = "codex-cli",
  agentModel,
  translationProvider = "mimo",
}) => {
  const sourceStem = basename(source, extname(source));
  return {
    schemaVersion: PROJECT_SCHEMA_VERSION,
    project: { id, title, createdAt: new Date().toISOString() },
    agent: {
      id: agentId,
      ...(agentModel ? { model: agentModel } : {}),
      fallback: "none",
      authoringContractVersion: "1.0",
      semanticContractVersion: "1.1",
    },
    paths: {
      source: relative(dirname(outputPath), resolve(source)),
      transcript: transcript
        ? relative(dirname(outputPath), resolve(transcript))
        : `workspace/transcripts/${sourceStem}.json`,
      workspace: "workspace",
    },
    providers: {
      transcription: { provider: transcript ? "existing-word-json" : "video-use-scribe" },
      translation: {
        provider: translationProvider,
        ...(translationProvider === agentId && agentModel ? { model: agentModel } : {}),
        ...(translationProvider === "mimo"
          ? {
              baseUrl: "https://token-plan-cn.xiaomimimo.com/v1",
              model: "mimo-v2.5",
              apiKeyEnv: "MIMO_API_KEY",
            }
          : {}),
        timeoutSeconds: translationProvider === "mimo" ? 90 : 300,
        maxRetries: translationProvider === "mimo" ? 2 : 1,
      },
      semanticPlanning: {
        provider: agentId,
        ...(agentModel ? { model: agentModel } : {}),
        timeoutSeconds: 300,
        maxRetries: 1,
        minimumSegmentSeconds: 7,
        maximumSegmentSeconds: 24,
      },
      recutPlanning: {
        provider: agentId,
        ...(agentModel ? { model: agentModel } : {}),
        timeoutSeconds: 300,
        maxRetries: 1,
      },
    },
    terminology: {
      version: "1.0",
      domains: ["ai-software", "finance-markets", "laboratory-biopharma"],
    },
    regression: {
      profileId: "foundation-0.1.13",
      enabled: false,
      registry: relative(dirname(outputPath), resolve("regression-fixtures/registry.json")),
    },
    policies: {
      edit: {
        version: "2.0",
        minimumCompressedGapSeconds: 0.8,
        keptGapSeconds: 0.24,
        minimumCandidateConfidence: 0.84,
        minimumBoundarySilenceSeconds: 0.12,
        maximumCandidateSeconds: 12,
        manualRemovals: [],
        rejectedCandidateIds: [],
        protectedAnchors: [],
      },
      captions: {
        mode: "verbatim",
        bilingual: true,
        sourceLocale: "zh-CN",
        targetLocale: "en",
        displayPunctuation: "none",
        segmentation: {
          maximumDurationSeconds: 4.5,
          maximumCharacters: 22,
          pauseBreakSeconds: 0.35,
          softPunctuationMinimumCharacters: 10,
          orphanMaximumCharacters: 3,
        },
      },
      layout: { mode: "face-aware", localScrim: true },
      typography: { version: "typography-2.0", mode: "system-only" },
      animation: { templateId: "paper-editorial" },
      visualQa: {
        enabled: true,
        failOnError: true,
        minimumFontPx: 12,
        baselineHammingThreshold: 10,
        maximumCropLoss: 0.45,
        captureConcurrency: 3,
      },
      visualDirection: {
        version: "1.0",
        maximumVisualsPerMinute: 12,
        minimumBreathingGapSeconds: 0.6,
        minimumVisibleSeconds: 2.2,
        maximumAccentSeconds: 8,
        maximumSupportSeconds: 12,
        maximumHeroSeconds: 18,
        maximumContinuousVisualSeconds: 32,
        repetitionWindowSeconds: 12,
        minimumHeroGapSeconds: 42,
        maximumVisualCoverageRatio: 0.95,
        maximumChapterSeconds: 120,
        maximumChapterCandidates: 6,
        heroConfidence: 0.88,
        supportConfidence: 0.72,
        accentConfidence: 0.58,
      },
    },
    assetProfile: { ...CURRENT_ASSET_PROFILE },
    render: {
      review: { width: 1920, height: 1080, codec: "h264", crf: 20 },
      delivery: { mode: "source-resolution", resolution: "1080p", frameRate: 60, codec: "h264", crf: 18 },
    },
    workflow: {
      defaultTarget: "review",
      requireHumanApproval: true,
      reviewMode: "static",
      motionReviewMode: "conditional-excerpts",
    },
  };
};

export const writeManifest = async (manifest, outputPath) => {
  validateManifest(manifest);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
};

export const toRuntimeConfig = ({ manifest, paths }) => ({
  manifestPath: paths.manifest,
  source: paths.source,
  rawTranscript: paths.transcript,
  transcript: paths.referenceScript ? paths.conformedTranscript : paths.transcript,
  transcriptConformanceReportFile: paths.transcriptConformanceReport,
  referenceScript: paths.referenceScript,
  editDir: paths.workspace,
  planningFile: paths.planning,
  reviewPropsFile: paths.reviewProps,
  authoredScenePlanFile: paths.authoredScenePlan,
  authoredVisualPlanFile: paths.authoredVisualPlan,
  supplementalMedia: paths.supplementalMedia,
  supplementalMediaManifestFile: paths.supplementalMediaManifest,
  imageEvidence: paths.imageEvidence,
  imageEvidenceManifestFile: paths.imageEvidenceManifest,
  resolvedSceneTimelineFile: paths.resolvedSceneTimeline,
  sceneAlignmentReportFile: paths.sceneAlignmentReport,
  finalPropsFile: paths.finalProps,
  terminologyProfileFile: paths.terminologyProfile,
  terminologyReviewFile: paths.terminologyReview,
  terminology: {
    version: "1.0",
    domains: ["ai-software", "finance-markets", "laboratory-biopharma"],
    ...(manifest.terminology ?? {}),
    projectOverridesFile: paths.terminologyOverrides,
  },
  regression: {
    profileId: "foundation-0.1.13",
    enabled: false,
    ...(manifest.regression ?? {}),
    registryFile: paths.regressionRegistry,
    expectedManifestFile: paths.regressionExpected,
    reportFile: paths.regressionReport,
    reviewFile: paths.regressionReview,
  },
  publicReviewFile: resolve("public", "projects", manifest.project.id, "review-cut-1080p.mp4"),
  reviewVideoSrc: `projects/${manifest.project.id}/review-cut-1080p.mp4`,
  publicDeliveryFile: resolve("public", "projects", manifest.project.id, "delivery-cut-source.mp4"),
  deliveryVideoSrc: `projects/${manifest.project.id}/delivery-cut-source.mp4`,
  reviewOutputFile: resolve(paths.workspace, "review-1080p.mp4"),
  visualPacingReviewFile: paths.visualPacingReview,
  motionRiskReviewFile: paths.motionRiskReview,
  motionRiskReviewReportFile: paths.motionRiskReviewReport,
  validationReportFile: resolve(paths.workspace, "validation-report.json"),
  deliveryOutputFile: resolve(paths.workspace, "delivery-source-resolution.mp4"),
  reviewWidth: manifest.render.review.width,
  reviewHeight: manifest.render.review.height,
  translation: manifest.providers.translation,
  captionSegmentation: manifest.policies.captions.segmentation,
  captionDisplayPunctuation: manifest.policies.captions.displayPunctuation ?? "none",
  typographyPolicy: typographyPolicyFor(manifest),
  captionSourceFile: paths.captionsSource,
  captionsFile: paths.captions,
  semanticCaptionSourceFile: paths.semanticCaptionsSource,
  semanticCaptionsFile: paths.semanticCaptions,
  semanticNarrativePlanFile: paths.semanticNarrativePlan,
  semanticProviderReportFile: paths.semanticProviderReport,
  componentCandidatesFile: ["codex-cli", "claude-code"].includes(manifest.providers.semanticPlanning.provider)
    ? paths.componentCandidates
    : undefined,
  visualDirectionPlanFile: paths.visualDirectionPlan,
  visualDirectionReportFile: paths.visualDirectionReport,
  visualDirectionReviewFile: paths.visualDirectionReview,
  visualDirectionTimelineFile: paths.visualDirectionTimeline,
  visualDirection: manifest.policies.visualDirection,
  animationTemplateId: manifest.policies.animation.templateId,
  animationTemplateIds:
    manifest.policies.animation.mode === "per-cue" ? manifest.policies.animation.allowedTemplateIds : undefined,
  reviewMode: reviewModeFor(manifest),
  motionReviewMode: motionReviewModeFor(manifest),
  reviewEvidenceFile: paths.reviewEvidence,
  reviewEvidenceSummaryFile: paths.reviewEvidenceSummary,
  productionAgentReviewFile: paths.productionAgentReview,
  productionReview: manifest.providers.semanticPlanning,
  deliveryValidationFile: paths.deliveryValidation,
  captionSrtFile: paths.captionsSrt,
  semanticPlanning: manifest.providers.semanticPlanning,
  recutPlanning: manifest.providers.recutPlanning
    ? {
        ...manifest.providers.recutPlanning,
        fixtureFile: manifest.providers.recutPlanning.fixture
          ? isAbsolute(manifest.providers.recutPlanning.fixture)
            ? manifest.providers.recutPlanning.fixture
            : resolve(paths.root, manifest.providers.recutPlanning.fixture)
          : undefined,
      }
    : undefined,
  recutProviderPlanFile: paths.recutProviderPlan,
  recutProviderReportFile: paths.recutProviderReport,
  proposedEdlFile: paths.proposedEdl,
  recutCandidatesFile: paths.recutCandidates,
  recutReviewFile: paths.recutReview,
  recutPreviewFile: paths.recutPreview,
  recutProposalDir: paths.recutProposalDir,
  recutEnabled: intelligentRecutEnabled(manifest),
  brand: manifest.brand,
  brandEnabled: brandFoundationEnabled(manifest),
  brandTimelineFile: paths.brandTimeline,
  brandReviewFile: paths.brandReview,
  soundPlanFile: paths.soundPlan,
  soundReportFile: paths.soundReport,
  soundTimelineFile: paths.soundTimeline,
  brandBumperPreviewFile: paths.brandBumperPreview,
  brandTransitionPreviewFile: paths.brandTransitionPreview,
  brandSoundReviewFile: paths.brandSoundReview,
  mediaTransitionReviewEnabled:
    (manifest.supplementalMedia?.assets?.length ?? 0) > 0 || (manifest.imageEvidence?.assets?.length ?? 0) > 0,
  mediaTransitionEntryPreviewFile: paths.mediaTransitionEntryPreview,
  mediaTransitionExitPreviewFile: paths.mediaTransitionExitPreview,
  mediaTransitionReviewFile: paths.mediaTransitionReview,
  assetProfile: manifest.assetProfile,
  transcription: manifest.providers.transcription,
  minimumCompressedGapSeconds: manifest.policies.edit.minimumCompressedGapSeconds,
  keptGapSeconds: manifest.policies.edit.keptGapSeconds,
  manualRemovals: manifest.policies.edit.manualRemovals,
  editPolicy: {
    ...manifest.policies.edit,
    protectedAnchors: [
      ...(manifest.policies.edit.protectedAnchors ?? []),
      ...(brandFoundationEnabled(manifest)
        ? [
            {
              id: `brand-${manifest.brand.insertion.id}`,
              text: manifest.brand.insertion.afterAnchor.text,
              occurrence: manifest.brand.insertion.afterAnchor.occurrence,
              paddingBeforeSeconds: 0.25,
              paddingAfterSeconds: 0.45,
            },
          ]
        : []),
    ],
  },
  visualQa: {
    ...(manifest.policies.visualQa ?? { enabled: true, failOnError: false }),
    outputDir: resolve(paths.workspace, "visual-qa"),
    reportFile: resolve(paths.workspace, "visual-qa/qa-report.json"),
    baselineFile: resolve("visual-baselines", "16x9", `${manifest.project.id}.json`),
  },
  delivery: manifest.render.delivery,
  projectId: manifest.project.id,
});
