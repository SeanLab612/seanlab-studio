import assert from "node:assert/strict";
import {mkdtemp, readFile, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join, resolve} from "node:path";
import test from "node:test";
import {
  ANIMATION_TEMPLATE_IDS,
  createManifest,
  motionReviewModeFor,
  resolveProjectPaths,
  reviewModeFor,
  validateManifest,
  writeManifest,
} from "../scripts/workflow/manifest.mjs";
import {STAGE_STATUSES, fileExists, loadState, saveState, signatureFor, writeArtifactLedger} from "../scripts/workflow/state.mjs";
import {
  assertQaApprovalAllowed,
  approvedDeliveryStartIndex,
  createStages,
  dependentStageNames,
  executionClassForStage,
  hasPlannedDependency,
  signatureConfigForStage,
  shouldBlockImplicitSemanticReplan,
  TARGET_STAGE,
  timeoutPolicyForStage,
} from "../scripts/workflow/stages.mjs";

test("recut provider schema declares explicit types for strict Codex structured output", async () => {
  const schema = JSON.parse(await readFile(resolve("schemas/recut-provider-plan.schema.json"), "utf8"));
  assert.equal(schema.properties.schemaVersion.type, "string");
  assert.equal(schema.properties.candidates.items.properties.kind.type, "string");
});

test("creates a portable manifest and resolves project-relative paths", async () => {
  assert.deepEqual(ANIMATION_TEMPLATE_IDS, ["paper-editorial"]);
  const root = await mkdtemp(join(tmpdir(), "video-remotion-"));
  const source = join(root, "source.mp4");
  const transcript = join(root, "transcript.json");
  const output = join(root, "project", "project.json");
  await writeFile(source, "video");
  await writeFile(transcript, "{}");
  const manifest = createManifest({id: "demo-project", title: "Demo", source, transcript, outputPath: output});
  assert.equal(manifest.policies.animation.templateId, "paper-editorial");
  manifest.policies.animation.templateId = "stop-motion-machine";
  assert.equal(validateManifest(manifest).policies.animation.templateId, "paper-editorial");
  manifest.policies.animation = {
    mode: "per-cue",
    allowedTemplateIds: ["paper-editorial", "stop-motion-machine", "research-archive"],
  };
  assert.deepEqual(validateManifest(manifest).policies.animation.allowedTemplateIds, ["paper-editorial"]);
  await writeManifest(manifest, output);
  const stored = JSON.parse(await readFile(output, "utf8"));
  assert.equal(validateManifest(stored).project.id, "demo-project");
  const paths = resolveProjectPaths(stored, output);
  assert.equal(paths.source, resolve(source));
  assert.equal(paths.transcript, resolve(transcript));
  assert.equal(paths.conformedTranscript, resolve(root, "project", "workspace/transcript-conformed.json"));
  assert.equal(paths.workspace, resolve(root, "project", "workspace"));
  assert.equal(stored.workflow.reviewMode, "static");
  assert.equal(paths.reviewEvidence, resolve(root, "project", "workspace/review-evidence.json"));
  assert.equal(paths.resolvedSceneTimeline, resolve(root, "project", "workspace/resolved-scene-timeline.json"));
  assert.equal(stored.policies.edit.version, "2.0");
  assert.equal(stored.policies.visualDirection.maximumVisualsPerMinute, 12);
  assert.equal(stored.policies.visualDirection.minimumBreathingGapSeconds, 0.6);
  assert.equal(stored.policies.visualDirection.minimumVisibleSeconds, 2.2);
  assert.equal(stored.policies.visualDirection.repetitionWindowSeconds, 12);
  assert.equal(stored.policies.visualDirection.maximumVisualCoverageRatio, 1);
  assert.equal(stored.policies.visualDirection.maximumAnimationCoverageRatio, 0.25);
  assert.equal(stored.providers.recutPlanning.provider, "codex-cli");
  assert.equal(paths.recutPreview, resolve(root, "project", "workspace/recut-preview-720p.mp4"));
  assert.equal(paths.visualPacingReview, resolve(root, "project", "workspace/visual-pacing-review-720p.mp4"));
});

test("rejects manifests that can bypass human approval", () => {
  const manifest = createManifest({id: "demo-project", title: "Demo", source: "a", transcript: "b", outputPath: resolve("project.json")});
  manifest.workflow.requireHumanApproval = false;
  assert.throws(() => validateManifest(manifest), /requireHumanApproval/);
});

test("source-only initialization selects cached video-use transcription", () => {
  const manifest = createManifest({
    id: "source-only",
    title: "Source only",
    source: "/tmp/camera.MP4",
    outputPath: "/tmp/projects/source-only/project.json",
  });
  assert.equal(manifest.providers.transcription.provider, "video-use-scribe");
  assert.equal(manifest.paths.transcript, "workspace/transcripts/camera.json");
});

test("supplemental recordings require a typed authored scene plan and resolve as stage inputs", () => {
  const manifest = createManifest({id: "screen-project", title: "Screen", source: "/tmp/source.mp4", transcript: "/tmp/transcript.json", outputPath: "/tmp/screen-project/project.json"});
  manifest.supplementalMedia = {
    version: "1.0",
    assets: [{id: "github-overview", path: "../../media/github.mp4", role: "repository-overview", orientation: "landscape", required: true, audioPolicy: "mute"}],
  };
  assert.throws(() => validateManifest(manifest), /authoredScenePlan/);
  manifest.paths.authoredScenePlan = "scene-plan.json";
  assert.doesNotThrow(() => validateManifest(manifest));
  const paths = resolveProjectPaths(manifest, "/tmp/screen-project/project.json");
  const stage = createStages({manifest, paths}).find(({name}) => name === "supplemental-probe");
  assert.ok(stage.inputs.includes(paths.supplementalMedia[0].path));
  assert.deepEqual(stage.outputs, [paths.supplementalMediaManifest]);
});

test("registered image evidence adds deterministic probing and bounded transition review", () => {
  const manifest = createManifest({id: "image-project", title: "Image", source: "/tmp/source.mp4", transcript: "/tmp/transcript.json", outputPath: "/tmp/image-project/project.json"});
  manifest.imageEvidence = {
    version: "1.0",
    assets: [
      {
        id: "github-result",
        path: "../../media/result.png",
        role: "result",
        description: "展示项目生成结果",
        sourceLabel: "GitHub",
        required: true,
        fit: "contain",
        focalPoint: {x: 0.5, y: 0.5},
      },
    ],
  };
  assert.throws(() => validateManifest(manifest), /spoken anchorText/);
  manifest.imageEvidence.assets[0].anchorText = "这里展示项目生成结果";
  assert.doesNotThrow(() => validateManifest(manifest));
  const paths = resolveProjectPaths(manifest, "/tmp/image-project/project.json");
  const stages = createStages({manifest, paths});
  const imageProbe = stages.find(({name}) => name === "image-probe");
  const transitionReview = stages.find(({name}) => name === "media-transition-review");
  assert.ok(imageProbe.inputs.includes(paths.imageEvidence[0].path));
  assert.deepEqual(imageProbe.outputs, [paths.imageEvidenceManifest]);
  assert.deepEqual(transitionReview.outputs, [paths.mediaTransitionReview]);
  assert.ok(stages.find(({name}) => name === "visual-direction").inputs.includes(paths.imageEvidenceManifest));
  assert.ok(stages.find(({name}) => name === "validate").inputs.includes(paths.imageEvidenceManifest));
  assert.ok(stages.find(({name}) => name === "qa-capture").dependsOn.includes("media-transition-review"));
  assert.ok(stages.find(({name}) => name === "review-evidence").inputs.includes(paths.mediaTransitionReview));
});

test("legacy asset profiles do not gain new image and transition stages retroactively", () => {
  const manifest = createManifest({
    id: "legacy-project",
    title: "Legacy",
    source: "/tmp/source.mp4",
    transcript: "/tmp/transcript.json",
    outputPath: "/tmp/legacy-project/project.json",
  });
  manifest.assetProfile.semanticComponents = 18;
  manifest.supplementalMedia = {
    version: "1.0",
    assets: [
      {
        id: "legacy-screen",
        path: "../../media/screen.mp4",
        role: "screen-evidence",
        orientation: "any",
        required: true,
        audioPolicy: "mute",
      },
    ],
  };
  manifest.paths.authoredScenePlan = "scene-plan.json";
  const paths = resolveProjectPaths(manifest, "/tmp/legacy-project/project.json");
  const stages = createStages({manifest, paths});
  assert.equal(stages.some(({name}) => name === "image-probe"), false);
  assert.equal(stages.some(({name}) => name === "media-transition-review"), false);
  assert.equal(stages.find(({name}) => name === "semantic-plan").inputs.includes(paths.imageEvidenceManifest), false);
  assert.equal(stages.find(({name}) => name === "qa-capture").inputs.includes(paths.imageEvidenceManifest), false);
});

test("the open-source manifest rejects fixed brand bumper insertion", () => {
  const manifest = createManifest({id: "brand-project", title: "Brand", source: "/tmp/source.mp4", transcript: "/tmp/transcript.json", outputPath: "/tmp/brand-project/project.json"});
  manifest.brand = {
    version: "1.0",
    enabled: true,
    profileId: "seanlab-1.0",
    insertion: {
      id: "opening-overview",
      profileId: "seanlab-1.0",
      required: true,
      afterAnchor: {text: "这就是本期内容"},
    },
    soundPolicy: {enabled: true, maximumEventsPerMinute: 6},
  };
  assert.throws(() => validateManifest(manifest), /does not insert a fixed brand bumper/);
  const paths = resolveProjectPaths(manifest, "/tmp/brand-project/project.json");
  const stages = createStages({manifest, paths});
  const names = stages.map(({name}) => name);
  assert.equal(names.includes("brand-align"), false);
  assert.equal(names.includes("brand-review"), false);
});

test("input and output signatures change with file content", async () => {
  const root = await mkdtemp(join(tmpdir(), "video-remotion-hash-"));
  const file = join(root, "artifact.json");
  await writeFile(file, "one");
  const first = await signatureFor([file]);
  await writeFile(file, "two");
  const second = await signatureFor([file]);
  assert.notEqual(first, second);
});

test("stage names that match directories remain safe signature values", async () => {
  const first = await signatureFor(["regression-fixtures"]);
  const second = await signatureFor(["regression-fixtures"]);
  assert.equal(first, second);
});

test("static mode retires a prior conditional review-render state", async () => {
  const root = await mkdtemp(join(tmpdir(), "workflow-conditional-stage-"));
  const statePath = join(root, "state.json");
  await writeFile(
    statePath,
    JSON.stringify({
      schemaVersion: "1.0",
      projectId: "demo",
      stages: {ingest: {status: "succeeded"}, "review-render": {status: "succeeded"}},
      events: [],
    }),
  );
  const state = await loadState({
    statePath,
    projectId: "demo",
    manifestPath: "project.json",
    stageNames: ["ingest"],
    conditionalStageNames: ["review-render"],
  });
  assert.equal(state.stages["review-render"], undefined);
  assert.deepEqual(state.stageOrder, ["ingest"]);
});

test("state persists structured stage status", async () => {
  const root = await mkdtemp(join(tmpdir(), "video-remotion-state-"));
  const statePath = join(root, "run-state.json");
  const state = await loadState({statePath, projectId: "demo", manifestPath: "project.json", stageNames: ["ingest", "review-render"]});
  state.stages.ingest.status = "succeeded";
  await saveState(statePath, state);
  assert.equal(JSON.parse(await readFile(statePath, "utf8")).stages.ingest.status, "succeeded");
  assert.equal(await fileExists(statePath), true);
});

test("an interrupted Studio stage is a valid resumable workflow state", () => {
  assert.ok(STAGE_STATUSES.includes("interrupted"));
});

test("artifact ledger exposes the regression gate result", async () => {
  const root = await mkdtemp(join(tmpdir(), "video-remotion-regression-ledger-"));
  const reportPath = join(root, "report.json");
  const ledgerPath = join(root, "artifact-ledger.json");
  await writeFile(
    reportPath,
    JSON.stringify({
      status: "passed",
      reportSha256: "fixture-sha",
      profileId: "foundation-0.1.13",
      fixtureId: "workflow-owned-20260711",
      summary: {errors: 0, warnings: 0},
      findings: [],
    }),
  );
  await writeArtifactLedger(ledgerPath, {
    projectId: "regression-project",
    stageOrder: ["regression-fixtures"],
    stages: {"regression-fixtures": {status: "succeeded", outputs: [reportPath]}},
  });
  const ledger = JSON.parse(await readFile(ledgerPath, "utf8"));
  assert.equal(ledger.regression.status, "passed");
  assert.equal(ledger.regression.fixtureId, "workflow-owned-20260711");
});

test("review target includes resumable QA before human approval", () => {
  const manifest = createManifest({id: "qa-project", title: "QA", source: "/tmp/source.mp4", transcript: "/tmp/transcript.json", outputPath: "/tmp/qa-project/project.json"});
  const paths = resolveProjectPaths(manifest, "/tmp/qa-project/project.json");
  const names = createStages({manifest, paths}).map((stage) => stage.name);
  assert.equal(names[0], "preflight");
  assert.ok(names.indexOf("preflight") < names.indexOf("ingest"));
  assert.ok(names.indexOf("preflight") < names.indexOf("supplemental-probe"));
  assert.ok(names.indexOf("visual-input-preflight") < names.indexOf("translate"));
  assert.ok(names.indexOf("translate") < names.indexOf("scene-align"));
  assert.ok(names.indexOf("scene-align") < names.indexOf("visual-direction"));
  assert.equal(TARGET_STAGE.review, "agent-review");
  assert.equal(TARGET_STAGE.approval, "human-approval");
  assert.equal(TARGET_STAGE.delivery, "delivery-validate");
  assert.equal(names.includes("review-render"), false);
  assert.equal(motionReviewModeFor(manifest), "conditional-excerpts");
  assert.equal(manifest.render.delivery.resolution, "1080p");
  assert.equal(manifest.render.delivery.frameRate, 60);
  assert.ok(names.indexOf("recut-plan") < names.indexOf("edit-plan"));
  assert.ok(names.indexOf("edit-plan") < names.indexOf("recut-review"));
  assert.ok(names.indexOf("recut-review") < names.indexOf("recut-approval"));
  assert.ok(names.indexOf("recut-approval") < names.indexOf("edit-promote"));
  assert.ok(names.indexOf("edit-promote") < names.indexOf("captions"));
  assert.equal(TARGET_STAGE.recut, "recut-review");
  assert.ok(names.indexOf("review-base") < names.indexOf("qa-capture"));
  assert.ok(names.indexOf("qa-capture") < names.indexOf("visual-qa"));
  assert.ok(names.indexOf("visual-qa") < names.indexOf("visual-pacing-review"));
  assert.ok(names.indexOf("visual-pacing-review") < names.indexOf("review-evidence"));
  assert.deepEqual(
    createStages({manifest, paths}).find(({name}) => name === "visual-pacing-review").outputs,
    [paths.motionRiskReviewReport],
  );
  assert.ok(names.indexOf("visual-qa") < names.indexOf("human-approval"));
  assert.ok(names.indexOf("review-evidence") < names.indexOf("regression-fixtures"));
  assert.ok(names.indexOf("regression-fixtures") < names.indexOf("agent-review"));
  assert.ok(names.indexOf("agent-review") < names.indexOf("human-approval"));
  assert.ok(names.indexOf("regression-fixtures") < names.indexOf("human-approval"));
  assert.ok(names.indexOf("human-approval") < names.indexOf("delivery-render"));
  assert.ok(names.indexOf("delivery-render") < names.indexOf("delivery-validate"));
  const delivery = createStages({manifest, paths}).find(({name}) => name === "delivery-render");
  const reviewEvidence = createStages({manifest, paths}).find(({name}) => name === "review-evidence");
  assert.equal(delivery.inputs.includes(resolve(paths.workspace, "delivery-props.json")), true);
  assert.equal(reviewEvidence.inputs.includes(resolve(paths.workspace, "delivery-props.json")), true);
  assert.ok(delivery.inputs.includes(paths.reviewProps));
  assert.ok(delivery.inputs.includes(paths.source));
  assert.ok(delivery.inputs.includes(paths.manifest));
  assert.ok(names.indexOf("transcribe") < names.indexOf("terminology"));
  assert.ok(names.indexOf("terminology") < names.indexOf("captions"));
  assert.ok(names.indexOf("terminology") < names.indexOf("semantic-plan"));
});

test("strict review mode retains a full review render while legacy manifests remain compatible", () => {
  const manifest = createManifest({id: "strict-project", title: "Strict", source: "/tmp/source.mp4", transcript: "/tmp/transcript.json", outputPath: "/tmp/strict-project/project.json"});
  manifest.workflow.reviewMode = "full-video";
  const paths = resolveProjectPaths(manifest, "/tmp/strict-project/project.json");
  const stages = createStages({manifest, paths});
  assert.ok(stages.some(({name}) => name === "review-render"));
  assert.equal(stages.some(({name}) => name === "visual-pacing-review"), false);
  assert.deepEqual(stages.find(({name}) => name === "qa-capture").dependsOn, ["review-render"]);
  assert.deepEqual(stages.find(({name}) => name === "review-evidence").dependsOn, ["visual-qa"]);
  delete manifest.workflow.reviewMode;
  delete manifest.workflow.motionReviewMode;
  assert.equal(reviewModeFor(manifest), "full-video");
  assert.doesNotThrow(() => validateManifest(manifest));

  const legacy = structuredClone(manifest);
  delete legacy.policies.edit.version;
  assert.deepEqual(signatureConfigForStage(legacy, "edit-plan"), legacy.policies.edit);
  assert.deepEqual(signatureConfigForStage(legacy, "review-evidence"), {
    implementationVersion: "1.4",
    reviewMode: "full-video",
  });
  assert.deepEqual(signatureConfigForStage(legacy, "visual-pacing-review"), {
    implementationVersion: "1.0",
    review: {width: 1280, height: 720, crf: 25},
    typographyPolicy: legacy.policies.typography,
  });
});

test("terminology changes invalidate language stages but not transcription", () => {
  const manifest = createManifest({id: "terms-project", title: "Terms", source: "/tmp/source.mp4", transcript: "/tmp/transcript.json", outputPath: "/tmp/terms-project/project.json"});
  const beforeTranscribe = signatureConfigForStage(manifest, "transcribe");
  const beforeTerminology = structuredClone(signatureConfigForStage(manifest, "terminology"));
  manifest.terminology.domains = ["laboratory-biopharma"];
  assert.deepEqual(signatureConfigForStage(manifest, "transcribe"), beforeTranscribe);
  assert.notDeepEqual(signatureConfigForStage(manifest, "terminology"), beforeTerminology);
});

test("locked narration conformance is local, auditable, and feeds recut planning", () => {
  const manifest = createManifest({id: "script-project", title: "Script", source: "/tmp/source.mp4", transcript: "/tmp/transcript.json", outputPath: "/tmp/script-project/project.json"});
  manifest.paths.referenceScript = "../authoring/final-script.md";
  const paths = resolveProjectPaths(manifest, "/tmp/script-project/project.json");
  const stages = createStages({manifest, paths});
  const conformance = stages.find(({name}) => name === "transcript-conformance");
  const recut = stages.find(({name}) => name === "recut-plan");
  assert.deepEqual(conformance.inputs, [paths.transcript, paths.referenceScript]);
  assert.deepEqual(conformance.outputs, [paths.conformedTranscript, paths.transcriptConformanceReport]);
  assert.equal(conformance.command.at(-1), "scripts/conform-transcript.mjs");
  assert.deepEqual(recut.dependsOn, ["transcript-conformance"]);
  assert.deepEqual(recut.inputs, [paths.conformedTranscript]);
});

test("visual QA policy changes do not invalidate transcript or translation signatures", () => {
  const manifest = createManifest({id: "qa-project", title: "QA", source: "/tmp/source.mp4", transcript: "/tmp/transcript.json", outputPath: "/tmp/qa-project/project.json"});
  const beforeTranscribe = signatureConfigForStage(manifest, "transcribe");
  const beforeTranslate = signatureConfigForStage(manifest, "translate");
  manifest.policies.visualQa.minimumFontPx = 14;
  assert.deepEqual(signatureConfigForStage(manifest, "transcribe"), beforeTranscribe);
  assert.deepEqual(signatureConfigForStage(manifest, "translate"), beforeTranslate);
  assert.equal(signatureConfigForStage(manifest, "visual-qa").policy.minimumFontPx, 14);
});

test("failed visual QA blocks ordinary approval and requires an explicit waiver", () => {
  assert.throws(() => assertQaApprovalAllowed({status: "failed"}), /Visual QA contains errors/);
  assert.equal(assertQaApprovalAllowed({status: "failed"}, "reviewer accepted named finding"), true);
  assert.equal(assertQaApprovalAllowed({status: "passed"}), true);
});

test("dependency-aware invalidation preserves the base cut for visual-only revisions", () => {
  const manifest = createManifest({id: "dag-project", title: "DAG", source: "/tmp/source.mp4", transcript: "/tmp/transcript.json", outputPath: "/tmp/dag-project/project.json"});
  const paths = resolveProjectPaths(manifest, "/tmp/dag-project/project.json");
  const stages = createStages({manifest, paths});
  const visualDependents = dependentStageNames(stages, "component-props");
  assert.ok(visualDependents.includes("review-evidence"));
  assert.ok(visualDependents.includes("visual-qa"));
  assert.equal(visualDependents.includes("review-base"), false);
  const editDependents = dependentStageNames(stages, "edit-plan");
  assert.ok(editDependents.includes("review-base"));
  assert.ok(editDependents.includes("qa-capture"));
});

test("caption source and translated output have independent resumable signatures", () => {
  const manifest = createManifest({id: "caption-project", title: "Captions", source: "/tmp/source.mp4", transcript: "/tmp/transcript.json", outputPath: "/tmp/caption-project/project.json"});
  const paths = resolveProjectPaths(manifest, "/tmp/caption-project/project.json");
  const stages = createStages({manifest, paths});
  const captions = stages.find(({name}) => name === "captions");
  const translate = stages.find(({name}) => name === "translate");
  assert.deepEqual(captions.outputs, [paths.captionsSource, paths.semanticCaptionsSource, paths.captionsSrt]);
  assert.deepEqual(translate.inputs, [paths.semanticCaptionsSource, paths.terminologyProfile]);
  assert.deepEqual(translate.outputs, [paths.semanticCaptions, paths.captions]);
  assert.equal(captions.outputs.includes(paths.captions), false);
});

test("Codex semantic planning is isolated from deterministic component materialization", () => {
  const manifest = createManifest({id: "codex-project", title: "Codex", source: "/tmp/source.mp4", transcript: "/tmp/transcript.json", outputPath: "/tmp/codex-project/project.json"});
  const paths = resolveProjectPaths(manifest, "/tmp/codex-project/project.json");
  const stages = createStages({manifest, paths});
  const semantic = stages.find(({name}) => name === "semantic-plan");
  const props = stages.find(({name}) => name === "component-props");
  const direction = stages.find(({name}) => name === "visual-direction");
  const validate = stages.find(({name}) => name === "validate");
  assert.equal(manifest.providers.semanticPlanning.provider, "codex-cli");
  assert.deepEqual(semantic.outputs, [paths.semanticNarrativePlan, paths.semanticProviderReport]);
  assert.equal(semantic.command.at(-1), "scripts/plan-semantic-narrative.mjs");
  assert.deepEqual(props.outputs, [paths.componentCandidates]);
  assert.ok(props.inputs.includes(paths.semanticNarrativePlan));
  assert.equal(props.command.at(-1), "scripts/generate-visual-briefs.mjs");
  assert.deepEqual(direction.inputs, [
    paths.componentCandidates,
    paths.semanticNarrativePlan,
    paths.semanticCaptions,
    paths.resolvedSceneTimeline,
    paths.imageEvidenceManifest,
  ]);
  assert.ok(direction.outputs.includes(paths.visualDirectionPlan));
  assert.ok(direction.outputs.includes(paths.visualDirectionReport));
  assert.ok(direction.outputs.includes(paths.planning));
  assert.equal(direction.command.at(-1), "scripts/direct-visual-pacing.mjs");
  assert.deepEqual(validate.dependsOn, ["visual-direction"]);
});

test("visual-direction policy changes invalidate only visual planning and downstream stages", () => {
  const manifest = createManifest({id: "direction-project", title: "Direction", source: "/tmp/source.mp4", transcript: "/tmp/transcript.json", outputPath: "/tmp/direction-project/project.json"});
  const paths = resolveProjectPaths(manifest, "/tmp/direction-project/project.json");
  const stages = createStages({manifest, paths});
  const beforeSemantic = structuredClone(signatureConfigForStage(manifest, "semantic-plan"));
  const beforeDirection = structuredClone(signatureConfigForStage(manifest, "visual-direction"));
  manifest.policies.visualDirection.maximumVisualsPerMinute = 6;
  assert.deepEqual(signatureConfigForStage(manifest, "semantic-plan"), beforeSemantic);
  assert.notDeepEqual(signatureConfigForStage(manifest, "visual-direction"), beforeDirection);
  const dependents = dependentStageNames(stages, "visual-direction");
  assert.ok(dependents.includes("validate"));
  assert.ok(dependents.includes("review-evidence"));
  assert.equal(dependents.includes("component-props"), false);
});

test("dry-run propagates a planned stage to its direct dependent", () => {
  const planned = new Set(["visual-direction"]);
  assert.equal(hasPlannedDependency({dependsOn: ["visual-direction"]}, planned), true);
  assert.equal(hasPlannedDependency({dependsOn: ["component-props"]}, planned), false);
  assert.equal(hasPlannedDependency({}, planned), false);
});

test("execution preview distinguishes provider calls and bounded render work", () => {
  const manifest = createManifest({id: "preview-project", title: "Preview", source: "/tmp/source.mp4", transcript: "/tmp/transcript.json", outputPath: "/tmp/preview-project/project.json"});
  assert.equal(executionClassForStage("semantic-plan", manifest), "codex");
  assert.equal(executionClassForStage("recut-plan", manifest), "codex");
  assert.equal(executionClassForStage("recut-review", manifest), "video-render");
  assert.equal(executionClassForStage("translate", manifest), "translation-provider");
  assert.equal(executionClassForStage("qa-capture", manifest), "static-render");
  assert.equal(executionClassForStage("delivery-render", manifest), "video-render");
  assert.ok(timeoutPolicyForStage("delivery-render", manifest).idleTimeoutMs > 0);
  assert.equal(timeoutPolicyForStage("delivery-render", manifest).timeoutMs, 6 * 60 * 60 * 1000);
  assert.equal(timeoutPolicyForStage("semantic-plan", manifest).timeoutMs, 1_860_000);
});

test("typography changes invalidate local materialization without invalidating semantic planning", () => {
  const manifest = createManifest({id: "font-project", title: "Font", source: "/tmp/source.mp4", transcript: "/tmp/transcript.json", outputPath: "/tmp/font-project/project.json"});
  const semantic = structuredClone(signatureConfigForStage(manifest, "semantic-plan"));
  const component = structuredClone(signatureConfigForStage(manifest, "component-props"));
  assert.equal("typographyPolicy" in semantic, false);
  assert.deepEqual(component.typographyPolicy, {version: "typography-2.0", mode: "system-only"});
  manifest.policies.typography.mode = "auto";
  assert.deepEqual(signatureConfigForStage(manifest, "semantic-plan"), semantic);
  assert.notDeepEqual(signatureConfigForStage(manifest, "component-props"), component);
});

test("approved delivery starts from the frozen package instead of replaying providers", () => {
  const stages = [{name: "semantic-plan"}, {name: "human-approval"}, {name: "delivery-render"}, {name: "delivery-validate"}];
  assert.equal(
    approvedDeliveryStartIndex({stages, requestedStartIndex: 0, untilStage: "delivery-validate", approvalStatus: "approved"}),
    2,
  );
  assert.equal(
    approvedDeliveryStartIndex({stages, requestedStartIndex: 0, fromValue: "semantic-plan", untilStage: "delivery-validate", approvalStatus: "approved"}),
    0,
  );
});

test("ordinary force is rejected before execution when it would cross a frozen semantic plan", () => {
  assert.equal(
    shouldBlockImplicitSemanticReplan({
      force: true,
      replanSemantic: false,
      semanticHasHistory: true,
      semanticStageIndex: 11,
      startIndex: 0,
      endIndex: 14,
    }),
    true,
  );
  assert.equal(
    shouldBlockImplicitSemanticReplan({
      force: false,
      replanSemantic: true,
      semanticHasHistory: true,
      semanticStageIndex: 11,
      startIndex: 0,
      endIndex: 14,
    }),
    false,
  );
});
