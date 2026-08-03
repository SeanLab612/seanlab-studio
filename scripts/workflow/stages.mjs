import { resolve } from "node:path";
import {
  brandFoundationEnabled,
  intelligentRecutEnabled,
  motionReviewModeFor,
  reviewModeFor,
  typographyPolicyFor,
} from "./manifest.mjs";

export const TYPOGRAPHY_POLICY_VERSION = "typography-2.0";

export const CONDITIONAL_STAGE_NAMES = Object.freeze([
  "review-render",
  "recut-plan",
  "recut-review",
  "recut-approval",
  "edit-promote",
  "brand-align",
  "brand-review",
  "media-transition-review",
  "visual-pacing-review",
]);

const imageEvidenceContractEnabledFor = (manifest) =>
  (manifest.assetProfile?.semanticComponents ?? 0) >= 19 || (manifest.imageEvidence?.assets?.length ?? 0) > 0;

export const createStages = ({ manifest, paths }) => {
  const reviewMode = reviewModeFor(manifest);
  const fullVideoReview = reviewMode === "full-video";
  const motionReviewMode = motionReviewModeFor(manifest);
  const conditionalMotionReview = !fullVideoReview && motionReviewMode === "conditional-excerpts";
  const recutEnabled = intelligentRecutEnabled(manifest);
  const brandEnabled = brandFoundationEnabled(manifest);
  const structuredSemantic = ["codex-cli", "claude-code"].includes(manifest.providers.semanticPlanning.provider);
  const canonicalEditStage = recutEnabled ? "edit-promote" : "edit-plan";
  const canonicalTimingStage = brandEnabled ? "brand-align" : canonicalEditStage;
  const imageEvidenceContractEnabled = imageEvidenceContractEnabledFor(manifest);
  const transcriptConformanceEnabled = Boolean(paths.referenceScript);
  const canonicalTranscriptStage = transcriptConformanceEnabled ? "transcript-conformance" : "transcribe";
  const canonicalTranscript = transcriptConformanceEnabled ? paths.conformedTranscript : paths.transcript;
  const mediaTransitionReviewEnabled =
    imageEvidenceContractEnabled &&
    ((manifest.supplementalMedia?.assets?.length ?? 0) > 0 || (manifest.imageEvidence?.assets?.length ?? 0) > 0);
  return [
    {
      name: "preflight",
      dependsOn: [],
      inputs: [paths.manifest, paths.source, ...(paths.regressionRegistry ? [paths.regressionRegistry] : [])],
      outputs: [paths.preflightReport],
      command: ["node", "scripts/project-preflight.mjs"],
    },
    { name: "ingest", dependsOn: ["preflight"], inputs: [paths.source], outputs: [], verifyOnly: true },
    {
      name: "probe",
      dependsOn: ["ingest"],
      inputs: [paths.source],
      outputs: [resolve(paths.workspace, "media-manifest.json")],
      command: ["node", "scripts/probe-media.mjs"],
    },
    {
      name: "supplemental-probe",
      dependsOn: ["preflight"],
      inputs: [paths.manifest, ...paths.supplementalMedia.map((asset) => asset.path)],
      outputs: [paths.supplementalMediaManifest],
      command: ["node", "scripts/probe-supplemental-media.mjs"],
    },
    ...(imageEvidenceContractEnabled
      ? [
          {
            name: "image-probe",
            dependsOn: ["preflight"],
            inputs: [paths.manifest, ...paths.imageEvidence.map((asset) => asset.path)],
            outputs: [paths.imageEvidenceManifest],
            command: ["node", "scripts/probe-image-evidence.mjs"],
          },
        ]
      : []),
    manifest.providers.transcription.provider === "existing-word-json"
      ? { name: "transcribe", dependsOn: ["ingest"], inputs: [paths.transcript], outputs: [], verifyOnly: true }
      : {
          name: "transcribe",
          dependsOn: ["ingest"],
          inputs: [paths.source],
          outputs: [paths.transcript],
          command: ["node", "scripts/transcribe-video.mjs"],
        },
    ...(transcriptConformanceEnabled
      ? [
          {
            name: "transcript-conformance",
            dependsOn: ["transcribe"],
            inputs: [paths.transcript, paths.referenceScript],
            outputs: [paths.conformedTranscript, paths.transcriptConformanceReport],
            command: ["node", "--experimental-strip-types", "scripts/conform-transcript.mjs"],
          },
        ]
      : []),
    {
      name: "terminology",
      dependsOn: ["preflight"],
      inputs: paths.terminologyOverrides ? [paths.terminologyOverrides] : [],
      outputs: [paths.terminologyProfile, paths.terminologyReview],
      command: ["node", "--experimental-strip-types", "scripts/build-terminology-profile.mjs"],
    },
    {
      name: "layout",
      dependsOn: ["ingest", "probe"],
      inputs: [paths.source],
      outputs: [resolve(paths.workspace, "layout-manifest.json")],
      command: ["python3", "scripts/detect-layout.py"],
    },
    ...(recutEnabled
      ? [
          {
            name: "recut-plan",
            dependsOn: [canonicalTranscriptStage],
            inputs: [canonicalTranscript],
            outputs: [paths.recutProviderPlan, paths.recutProviderReport],
            command: ["node", "--experimental-strip-types", "scripts/plan-recut-candidates.mjs"],
          },
        ]
      : []),
    {
      name: "edit-plan",
      dependsOn: [recutEnabled ? "recut-plan" : canonicalTranscriptStage],
      inputs: [
        canonicalTranscript,
        ...(recutEnabled ? [paths.recutProviderPlan] : []),
        ...(recutEnabled && paths.authoredScenePlan ? [paths.authoredScenePlan] : []),
      ],
      outputs: recutEnabled
        ? [paths.proposedEdl, paths.recutCandidates, paths.recutReview]
        : [resolve(paths.workspace, "edl.json")],
      command: ["node", "--experimental-strip-types", "scripts/build-edit-plan.mjs"],
    },
    ...(recutEnabled
      ? [
          {
            name: "recut-review",
            dependsOn: ["edit-plan", "probe"],
            inputs: [paths.proposedEdl, paths.recutCandidates, resolve(paths.workspace, "media-manifest.json")],
            outputs: [paths.recutPreview],
            command: ["node", "scripts/render-recut-preview.mjs"],
          },
          {
            name: "recut-approval",
            dependsOn: ["recut-review"],
            inputs: [paths.proposedEdl, paths.recutCandidates, paths.recutReview, paths.recutPreview],
            outputs: [],
            approval: true,
            approvalKind: "recut",
          },
          {
            name: "edit-promote",
            dependsOn: ["recut-approval"],
            inputs: [paths.proposedEdl, paths.recutCandidates, paths.recutReview, paths.recutPreview],
            outputs: [resolve(paths.workspace, "edl.json")],
            command: ["node", "scripts/promote-edit-plan.mjs"],
          },
        ]
      : []),
    ...(brandEnabled
      ? [
          {
            name: "brand-align",
            dependsOn: [canonicalEditStage, canonicalTranscriptStage],
            inputs: [canonicalTranscript, resolve(paths.workspace, "edl.json")],
            outputs: [paths.brandTimeline, paths.brandReview],
            command: ["node", "--experimental-strip-types", "scripts/align-brand-bumper.mjs"],
          },
        ]
      : []),
    {
      name: "captions",
      dependsOn: [canonicalTimingStage, "terminology"],
      inputs: [
        canonicalTranscript,
        resolve(paths.workspace, "edl.json"),
        paths.terminologyProfile,
        ...(paths.referenceScript ? [paths.referenceScript] : []),
        ...(brandEnabled ? [paths.brandTimeline] : []),
      ],
      outputs: [paths.captionsSource, paths.semanticCaptionsSource, paths.captionsSrt],
      command: ["node", "--experimental-strip-types", "scripts/build-captions.mjs"],
    },
    {
      name: "visual-input-preflight",
      dependsOn: ["captions", "supplemental-probe"],
      inputs: [
        paths.semanticCaptionsSource,
        paths.supplementalMediaManifest,
        ...(paths.authoredScenePlan ? [paths.authoredScenePlan] : []),
        ...(paths.authoredVisualPlan ? [paths.authoredVisualPlan] : []),
      ],
      outputs: [resolve(paths.workspace, "visual-input-preflight.json")],
      command: ["node", "--experimental-strip-types", "scripts/preflight-visual-inputs.mjs"],
    },
    {
      name: "translate",
      dependsOn: ["visual-input-preflight", "terminology"],
      inputs: [paths.semanticCaptionsSource, paths.terminologyProfile],
      outputs: [paths.semanticCaptions, paths.captions],
      command: ["codex-cli", "claude-code", "fixture"].includes(manifest.providers.translation.provider)
        ? ["node", "scripts/translate-captions-agent.mjs"]
        : ["python3", "scripts/translate_captions.py"],
    },
    {
      name: "scene-align",
      dependsOn: ["translate", "supplemental-probe"],
      inputs: [
        paths.semanticCaptions,
        paths.supplementalMediaManifest,
        resolve(paths.workspace, "layout-manifest.json"),
        ...(paths.authoredScenePlan ? [paths.authoredScenePlan] : []),
      ],
      outputs: [paths.resolvedSceneTimeline, paths.sceneAlignmentReport],
      command: ["node", "--experimental-strip-types", "scripts/align-authored-scenes.mjs"],
    },
    {
      name: "semantic-plan",
      dependsOn: [
        "translate",
        "layout",
        canonicalEditStage,
        "terminology",
        ...(imageEvidenceContractEnabled ? ["image-probe"] : []),
      ],
      inputs: [
        resolve(paths.workspace, "edl.json"),
        paths.semanticCaptions,
        paths.captions,
        resolve(paths.workspace, "layout-manifest.json"),
        paths.terminologyProfile,
        ...(imageEvidenceContractEnabled ? [paths.imageEvidenceManifest] : []),
      ],
      outputs: structuredSemantic
        ? [paths.semanticNarrativePlan, paths.semanticProviderReport]
        : [paths.planning, paths.reviewProps],
      command: structuredSemantic
        ? ["node", "--experimental-strip-types", "scripts/plan-semantic-narrative.mjs"]
        : [
            "node",
            "--experimental-strip-types",
            "--experimental-specifier-resolution=node",
            "scripts/generate-visual-briefs.mjs",
          ],
    },
    structuredSemantic
      ? {
          name: "component-props",
          dependsOn: ["semantic-plan"],
          inputs: [
            paths.semanticNarrativePlan,
            paths.semanticCaptions,
            paths.captions,
            resolve(paths.workspace, "layout-manifest.json"),
            paths.terminologyProfile,
            ...(imageEvidenceContractEnabled ? [paths.imageEvidenceManifest] : []),
          ],
          outputs: [paths.componentCandidates],
          command: [
            "node",
            "--experimental-strip-types",
            "--experimental-specifier-resolution=node",
            "scripts/generate-visual-briefs.mjs",
          ],
        }
      : {
          name: "component-props",
          dependsOn: ["semantic-plan"],
          inputs: [paths.planning, paths.reviewProps],
          outputs: [],
          verifyOnly: true,
        },
    structuredSemantic
      ? {
          name: "visual-direction",
          dependsOn: ["component-props", "scene-align"],
          inputs: [
            paths.componentCandidates,
            paths.semanticNarrativePlan,
            paths.semanticCaptions,
            paths.resolvedSceneTimeline,
            ...(imageEvidenceContractEnabled ? [paths.imageEvidenceManifest] : []),
            ...(brandEnabled ? [paths.brandTimeline] : []),
          ],
          outputs: [
            paths.visualDirectionPlan,
            paths.visualDirectionReport,
            paths.visualDirectionReview,
            paths.visualDirectionTimeline,
            paths.planning,
            paths.reviewProps,
            ...(brandEnabled ? [paths.soundPlan, paths.soundReport, paths.soundTimeline] : []),
          ],
          command: [
            "node",
            "--experimental-strip-types",
            "--experimental-specifier-resolution=node",
            "scripts/direct-visual-pacing.mjs",
          ],
        }
      : {
          name: "visual-direction",
          dependsOn: ["component-props", "scene-align"],
          inputs: [paths.planning, paths.reviewProps, paths.resolvedSceneTimeline],
          outputs: [],
          verifyOnly: true,
        },
    {
      name: "validate",
      dependsOn: ["visual-direction"],
      inputs: [
        paths.planning,
        paths.reviewProps,
        paths.finalProps,
        paths.resolvedSceneTimeline,
        ...(imageEvidenceContractEnabled ? [paths.imageEvidenceManifest] : []),
        ...(brandEnabled ? [paths.brandTimeline] : []),
      ],
      outputs: [resolve(paths.workspace, "validation-report.json")],
      command: ["node", "--experimental-strip-types", "scripts/validate-generated-workflow.mjs"],
    },
    {
      name: "review-base",
      dependsOn: [canonicalEditStage],
      inputs: [resolve(paths.workspace, "edl.json")],
      outputs: [resolve("public", "projects", manifest.project.id, "review-cut-1080p.mp4")],
      command: ["node", "scripts/render-review-base.mjs"],
    },
    ...(brandEnabled
      ? [
          {
            name: "brand-review",
            dependsOn: ["validate", "review-base"],
            inputs: [
              paths.brandTimeline,
              paths.soundPlan,
              paths.reviewProps,
              resolve(paths.workspace, "media-manifest.json"),
              resolve("public", "projects", manifest.project.id, "review-cut-1080p.mp4"),
            ],
            outputs: [paths.brandBumperPreview, paths.brandTransitionPreview, paths.brandSoundReview],
            command: ["node", "scripts/render-brand-sound-review.mjs"],
          },
        ]
      : []),
    ...(mediaTransitionReviewEnabled
      ? [
          {
            name: "media-transition-review",
            dependsOn: ["validate", "review-base"],
            inputs: [
              paths.reviewProps,
              resolve(paths.workspace, "media-manifest.json"),
              resolve("public", "projects", manifest.project.id, "review-cut-1080p.mp4"),
            ],
            outputs: [paths.mediaTransitionReview],
            command: ["node", "scripts/render-media-transition-review.mjs"],
          },
        ]
      : []),
    ...(fullVideoReview
      ? [
          {
            name: "review-render",
            dependsOn: ["validate", "review-base"],
            inputs: [paths.reviewProps, resolve("public", "projects", manifest.project.id, "review-cut-1080p.mp4")],
            outputs: [resolve(paths.workspace, "review-1080p.mp4")],
            command: ["npx", "remotion", "render", "src/index.ts", "GeneratedWorkflowReview"],
          },
        ]
      : []),
    {
      name: "qa-capture",
      dependsOn: fullVideoReview
        ? [
            "review-render",
            ...(brandEnabled ? ["brand-review"] : []),
            ...(mediaTransitionReviewEnabled ? ["media-transition-review"] : []),
          ]
        : [
            "validate",
            "review-base",
            ...(brandEnabled ? ["brand-review"] : []),
            ...(mediaTransitionReviewEnabled ? ["media-transition-review"] : []),
          ],
      inputs: [
        paths.planning,
        paths.reviewProps,
        resolve("src/visual-qa/contracts.ts"),
        ...(imageEvidenceContractEnabled ? [paths.imageEvidenceManifest] : []),
        paths.visualDirectionPlan,
        paths.resolvedSceneTimeline,
        resolve("public", "projects", manifest.project.id, "review-cut-1080p.mp4"),
        ...(fullVideoReview ? [resolve(paths.workspace, "review-1080p.mp4")] : []),
      ],
      outputs: [
        resolve(paths.workspace, "visual-qa/frame-plan.json"),
        resolve(paths.workspace, "visual-qa/frames-manifest.json"),
        resolve(paths.workspace, "visual-qa/qa-contracts.json"),
      ],
      command: ["node", "--experimental-strip-types", "scripts/capture-qa-frames.mjs"],
    },
    {
      name: "visual-qa",
      dependsOn: ["qa-capture"],
      inputs: [
        resolve(paths.workspace, "visual-qa/frame-plan.json"),
        resolve(paths.workspace, "visual-qa/frames-manifest.json"),
        resolve(paths.workspace, "visual-qa/qa-contracts.json"),
        resolve("schemas/visual-qa-report.schema.json"),
        ...(fullVideoReview ? [resolve(paths.workspace, "review-1080p.mp4")] : []),
      ],
      outputs: [
        resolve(paths.workspace, "visual-qa/qa-report.json"),
        resolve(paths.workspace, "visual-qa/contact-sheet.png"),
        resolve(paths.workspace, "visual-qa/title-continuity-contact-sheet.png"),
        resolve(paths.workspace, "visual-qa/image-metrics.json"),
      ],
      command: ["node", "scripts/analyze-visual-qa.mjs"],
    },
    ...(!fullVideoReview
      ? [
          {
            name: "visual-pacing-review",
            dependsOn: ["visual-qa"],
            inputs: [
              paths.reviewProps,
              paths.visualDirectionPlan,
              resolve(paths.workspace, "visual-qa/qa-report.json"),
              resolve("public", "projects", manifest.project.id, "review-cut-1080p.mp4"),
            ],
            outputs: [conditionalMotionReview ? paths.motionRiskReviewReport : paths.visualPacingReview],
            command: [
              "node",
              conditionalMotionReview
                ? "scripts/render-motion-risk-review.mjs"
                : "scripts/render-visual-pacing-review.mjs",
            ],
          },
        ]
      : []),
    {
      name: "review-evidence",
      dependsOn: [fullVideoReview ? "visual-qa" : "visual-pacing-review"],
      inputs: [
        paths.planning,
        paths.reviewProps,
        paths.finalProps,
        resolve("schemas/review-evidence.schema.json"),
        paths.semanticNarrativePlan,
        paths.semanticProviderReport,
        paths.componentCandidates,
        paths.visualDirectionPlan,
        paths.visualDirectionReport,
        paths.supplementalMediaManifest,
        paths.resolvedSceneTimeline,
        paths.sceneAlignmentReport,
        ...(brandEnabled
          ? [
              paths.brandTimeline,
              paths.brandReview,
              paths.soundPlan,
              paths.soundReport,
              paths.soundTimeline,
              paths.brandBumperPreview,
              paths.brandTransitionPreview,
              paths.brandSoundReview,
            ]
          : []),
        ...(mediaTransitionReviewEnabled
          ? [paths.mediaTransitionEntryPreview, paths.mediaTransitionExitPreview, paths.mediaTransitionReview]
          : []),
        ...(recutEnabled
          ? [
              resolve(paths.workspace, "edl.json"),
              paths.recutProviderPlan,
              paths.recutProviderReport,
              paths.recutCandidates,
              paths.recutReview,
              paths.recutPreview,
            ]
          : []),
        resolve(paths.workspace, "visual-qa/frame-plan.json"),
        resolve(paths.workspace, "visual-qa/frames-manifest.json"),
        resolve(paths.workspace, "visual-qa/image-metrics.json"),
        resolve(paths.workspace, "visual-qa/contact-sheet.png"),
        resolve(paths.workspace, "visual-qa/title-continuity-contact-sheet.png"),
        resolve(paths.workspace, "visual-qa/qa-report.json"),
        ...(!fullVideoReview
          ? [conditionalMotionReview ? paths.motionRiskReviewReport : paths.visualPacingReview]
          : []),
        ...(fullVideoReview ? [resolve(paths.workspace, "review-1080p.mp4")] : []),
      ],
      outputs: [paths.reviewEvidence, paths.reviewEvidenceSummary],
      command: ["node", "scripts/build-review-evidence.mjs"],
    },
    {
      name: "regression-fixtures",
      dependsOn: ["review-evidence", "semantic-plan", "captions"],
      inputs: [
        paths.planning,
        paths.captions,
        paths.terminologyProfile,
        resolve(paths.workspace, "visual-qa/qa-report.json"),
        ...(paths.regressionRegistry ? [paths.regressionRegistry] : []),
        ...(paths.regressionExpected ? [paths.regressionExpected] : []),
      ],
      outputs: [paths.regressionReport, paths.regressionReview],
      command: ["node", "--experimental-strip-types", "scripts/fixtures/check-project.mjs"],
    },
    {
      name: "human-approval",
      dependsOn: ["review-evidence", "visual-qa", "regression-fixtures"],
      inputs: [paths.reviewEvidence, resolve(paths.workspace, "visual-qa/qa-report.json"), paths.regressionReport],
      outputs: [],
      approval: true,
    },
    {
      name: "delivery-render",
      dependsOn: ["human-approval"],
      inputs: [
        paths.source,
        paths.manifest,
        resolve(paths.workspace, "media-manifest.json"),
        resolve(paths.workspace, "edl.json"),
        paths.reviewProps,
        paths.finalProps,
        ...(imageEvidenceContractEnabled ? [paths.imageEvidenceManifest] : []),
        paths.resolvedSceneTimeline,
        paths.reviewEvidence,
        ...(brandEnabled ? [paths.brandTimeline, paths.soundPlan] : []),
      ],
      outputs: [
        resolve(paths.workspace, "delivery-source-resolution.mp4"),
        resolve(paths.workspace, "delivery-render-report.json"),
      ],
      delivery: true,
      command: ["node", "scripts/render-delivery.mjs"],
    },
    {
      name: "delivery-validate",
      dependsOn: ["delivery-render"],
      inputs: [
        resolve(paths.workspace, "delivery-source-resolution.mp4"),
        resolve(paths.workspace, "delivery-render-report.json"),
        resolve("schemas/delivery-validation.schema.json"),
        resolve(paths.workspace, "media-manifest.json"),
        resolve(paths.workspace, "edl.json"),
        ...(brandEnabled ? [paths.brandTimeline] : []),
      ],
      outputs: [paths.deliveryValidation],
      command: ["node", "scripts/validate-delivery.mjs"],
    },
  ];
};

export const TARGET_STAGE = {
  recut: "recut-review",
  plan: "validate",
  review: "regression-fixtures",
  delivery: "delivery-validate",
};

export const dependentStageNames = (stages, stageName, { includeSelf = false } = {}) => {
  const selected = new Set(includeSelf ? [stageName] : []);
  let changed = true;
  while (changed) {
    changed = false;
    for (const stage of stages) {
      if (
        selected.has(stage.name) ||
        !(stage.dependsOn ?? []).some((dependency) => dependency === stageName || selected.has(dependency))
      )
        continue;
      selected.add(stage.name);
      changed = true;
    }
  }
  return stages.map(({ name }) => name).filter((name) => selected.has(name));
};

export const hasPlannedDependency = (stage, plannedStageNames) =>
  (stage.dependsOn ?? []).some((dependency) => plannedStageNames.has(dependency));

export const approvedDeliveryStartIndex = ({ stages, requestedStartIndex, fromValue, untilStage, approvalStatus }) =>
  !fromValue && untilStage === "delivery-validate" && approvalStatus === "approved"
    ? stages.findIndex(({ name }) => name === "delivery-render")
    : requestedStartIndex;

export const shouldBlockImplicitSemanticReplan = ({
  force,
  replanSemantic,
  semanticHasHistory,
  semanticStageIndex,
  startIndex,
  endIndex,
}) =>
  force && !replanSemantic && semanticHasHistory && semanticStageIndex >= startIndex && semanticStageIndex <= endIndex;

export const assertQaApprovalAllowed = (qaReport, waiverReason) => {
  if (qaReport.status === "failed" && !waiverReason)
    throw new Error("Visual QA contains errors. Fix them or approve with --waive-qa <reason>.");
  return true;
};

export const executionClassForStage = (stageName, manifest) => {
  if (stageName === "recut-plan" && manifest.providers.recutPlanning?.provider === "codex-cli") return "codex";
  if (stageName === "semantic-plan" && manifest.providers.semanticPlanning.provider === "codex-cli") return "codex";
  if (stageName === "recut-plan" && manifest.providers.recutPlanning?.provider === "claude-code") return "agent";
  if (stageName === "semantic-plan" && manifest.providers.semanticPlanning.provider === "claude-code") return "agent";
  if (stageName === "translate" && manifest.providers.translation.provider === "codex-cli") return "codex";
  if (stageName === "translate" && manifest.providers.translation.provider === "claude-code") return "agent";
  if (stageName === "translate" && manifest.providers.translation.provider === "mimo") return "translation-provider";
  if (
    [
      "recut-review",
      "review-base",
      "review-render",
      "brand-review",
      "media-transition-review",
      "visual-pacing-review",
      "delivery-render",
    ].includes(stageName)
  )
    return "video-render";
  if (stageName === "qa-capture") return "static-render";
  return "local";
};

export const timeoutPolicyForStage = (stageName, manifest) => {
  if (stageName === "recut-plan") {
    const seconds = Number(manifest.providers.recutPlanning?.timeoutSeconds ?? 300);
    const attempts = Number(manifest.providers.recutPlanning?.maxRetries ?? 0) + 1;
    return { timeoutMs: (seconds * attempts + 60) * 1000 };
  }
  if (stageName === "semantic-plan") {
    const seconds = Number(manifest.providers.semanticPlanning.timeoutSeconds ?? 300);
    const attempts = Number(manifest.providers.semanticPlanning.maxRetries ?? 0) + 1;
    // plan-semantic-narrative may request up to three complete schema-valid
    // plans while repairing workflow-level density validation. Each complete
    // request owns its configured provider retries, so the stage timeout must
    // cover all bounded repair rounds instead of terminating a valid retry.
    const validationRounds = 3;
    return { timeoutMs: (seconds * attempts * validationRounds + 60) * 1000 };
  }
  if (stageName === "translate") {
    const seconds = Number(manifest.providers.translation.timeoutSeconds ?? 90);
    const attempts = Number(manifest.providers.translation.maxRetries ?? 0) + 1;
    return { timeoutMs: (seconds * attempts + 60) * 1000 };
  }
  if (stageName === "delivery-render") return { timeoutMs: 6 * 60 * 60 * 1000, idleTimeoutMs: 10 * 60 * 1000 };
  if (["review-render", "visual-pacing-review"].includes(stageName))
    return { timeoutMs: 60 * 60 * 1000, idleTimeoutMs: 8 * 60 * 1000 };
  if (stageName === "review-base") return { timeoutMs: 30 * 60 * 1000, idleTimeoutMs: 5 * 60 * 1000 };
  if (stageName === "recut-review") return { timeoutMs: 20 * 60 * 1000, idleTimeoutMs: 5 * 60 * 1000 };
  if (stageName === "media-transition-review") return { timeoutMs: 20 * 60 * 1000, idleTimeoutMs: 5 * 60 * 1000 };
  if (stageName === "qa-capture") return { timeoutMs: 20 * 60 * 1000, idleTimeoutMs: 4 * 60 * 1000 };
  return { timeoutMs: 10 * 60 * 1000 };
};

export const signatureConfigForStage = (manifest, stageName) => {
  if (stageName === "preflight")
    return {
      providers: manifest.providers,
      terminology: manifest.terminology,
      regression: manifest.regression,
      assetProfile: manifest.assetProfile,
      render: manifest.render,
    };
  if (stageName === "transcribe") return manifest.providers.transcription;
  if (stageName === "transcript-conformance")
    return { implementationVersion: "1.0", referenceScript: manifest.paths.referenceScript ?? null };
  if (stageName === "recut-plan")
    return {
      implementationVersion: "2.0",
      provider: manifest.providers.recutPlanning,
    };
  if (stageName === "supplemental-probe") return manifest.supplementalMedia ?? { version: "1.0", assets: [] };
  if (stageName === "image-probe") return manifest.imageEvidence ?? { version: "1.0", assets: [] };
  if (stageName === "terminology") return manifest.terminology;
  if (stageName === "layout") return manifest.policies.layout;
  if (stageName === "edit-plan")
    return intelligentRecutEnabled(manifest)
      ? { implementationVersion: "2.0", policy: manifest.policies.edit }
      : manifest.policies.edit;
  if (stageName === "brand-align") return { implementationVersion: "1.0", brand: manifest.brand };
  if (stageName === "brand-review") return { implementationVersion: "1.0", brand: manifest.brand };
  if (stageName === "media-transition-review")
    return { implementationVersion: "1.0", soundPolicy: manifest.brand?.soundPolicy ?? null };
  if (stageName === "recut-review") return { implementationVersion: "2.0", width: 1280, height: 720 };
  if (stageName === "recut-approval" || stageName === "edit-promote") return { implementationVersion: "2.0" };
  if (stageName === "captions")
    return {
      implementationVersion: "1.1",
      captions: manifest.policies.captions,
      terminology: manifest.terminology,
      brand: manifest.brand ?? null,
    };
  if (stageName === "translate")
    return { translation: manifest.providers.translation, terminology: manifest.terminology };
  if (stageName === "scene-align")
    return { implementationVersion: "1.2", authoredScenePlan: manifest.paths.authoredScenePlan ?? null };
  if (["semantic-plan", "component-props", "validate"].includes(stageName))
    return {
      ...(stageName === "validate"
        ? { implementationVersion: imageEvidenceContractEnabledFor(manifest) ? "1.2" : "1.1" }
        : {}),
      semanticPlanning: manifest.providers.semanticPlanning,
      terminology: manifest.terminology,
      assetProfile: manifest.assetProfile,
      ...(stageName === "semantic-plan" ? {} : { typographyPolicy: typographyPolicyFor(manifest) }),
    };
  if (stageName === "visual-direction")
    return {
      implementationVersion: imageEvidenceContractEnabledFor(manifest)
        ? brandFoundationEnabled(manifest)
          ? "1.4"
          : "1.3"
        : brandFoundationEnabled(manifest)
          ? "1.2"
          : "1.1",
      policy: manifest.policies.visualDirection ?? null,
      brand: manifest.brand ?? null,
    };
  if (stageName === "review-base") return { edit: manifest.policies.edit, review: manifest.render.review };
  if (stageName === "review-render")
    return {
      review: manifest.render.review,
      assetProfile: manifest.assetProfile,
      typographyPolicy: typographyPolicyFor(manifest),
    };
  if (stageName === "visual-pacing-review")
    return motionReviewModeFor(manifest) === "conditional-excerpts"
      ? {
          implementationVersion: "2.0",
          motionReviewMode: "conditional-excerpts",
          review: { width: 960, height: 540, fps: 30, crf: 28, paddingSeconds: 0.75 },
          typographyPolicy: typographyPolicyFor(manifest),
        }
      : {
          implementationVersion: "1.0",
          review: { width: 1280, height: 720, crf: 25 },
          typographyPolicy: typographyPolicyFor(manifest),
        };
  if (["qa-capture", "visual-qa"].includes(stageName))
    return {
      implementationVersion:
        stageName === "visual-qa" ? "1.3" : imageEvidenceContractEnabledFor(manifest) ? "1.2" : "1.1",
      policy: manifest.policies.visualQa,
      reviewMode: reviewModeFor(manifest),
      typographyPolicy: typographyPolicyFor(manifest),
    };
  if (stageName === "review-evidence")
    return intelligentRecutEnabled(manifest)
      ? {
          implementationVersion: brandFoundationEnabled(manifest)
            ? imageEvidenceContractEnabledFor(manifest)
              ? "1.6"
              : "1.5"
            : imageEvidenceContractEnabledFor(manifest)
              ? "1.5"
              : "1.4",
          reviewMode: reviewModeFor(manifest),
          ...(motionReviewModeFor(manifest) === "conditional-excerpts"
            ? { motionReviewMode: "conditional-excerpts" }
            : {}),
          recutEnabled: true,
          brandEnabled: brandFoundationEnabled(manifest),
        }
      : motionReviewModeFor(manifest) === "conditional-excerpts"
        ? {
            implementationVersion: "1.5",
            reviewMode: reviewModeFor(manifest),
            motionReviewMode: motionReviewModeFor(manifest),
          }
        : { implementationVersion: "1.4", reviewMode: reviewModeFor(manifest) };
  if (stageName === "regression-fixtures")
    return manifest.regression ?? { profileId: "foundation-0.1.13", enabled: false };
  if (stageName === "delivery-render")
    return {
      implementationVersion: "1.2",
      delivery: manifest.render.delivery,
      typographyPolicy: typographyPolicyFor(manifest),
      brand: manifest.brand ?? null,
    };
  if (stageName === "delivery-validate")
    return {
      implementationVersion: "1.2",
      delivery: manifest.render.delivery,
      brand: manifest.brand ?? null,
    };
  return null;
};
