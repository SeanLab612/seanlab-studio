import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { getLayoutTemplate } from "../../src/layout-templates/registry.ts";
import { APPROVED_COMPONENT_IDS } from "../../src/visual-brief/types.ts";
import { validateComponentProps, validateViewerFacingNarrative } from "../../src/visual-brief/generator.ts";
import { readManifest, validateManifest } from "../workflow/manifest.mjs";
import {
  fileExists,
  hashFile,
  loadState,
  recordEvent,
  saveState,
  signatureFor,
  writeArtifactLedger,
} from "../workflow/state.mjs";
import {
  CONDITIONAL_STAGE_NAMES,
  createStages,
  dependentStageNames,
  signatureConfigForStage,
} from "../workflow/stages.mjs";

const revisionIdPattern = /^[a-z0-9][a-z0-9-]{2,63}$/;
const allowedOperationTypes = new Set([
  "edit-policy.update",
  "caption-policy.update",
  "translation.update",
  "visual-cue.update",
]);
const captionPolicyKeys = new Set([
  "maximumDurationSeconds",
  "maximumCharacters",
  "pauseBreakSeconds",
  "softPunctuationMinimumCharacters",
  "orphanMaximumCharacters",
  "displayPunctuation",
]);
const visualPatchKeys = new Set([
  "start",
  "end",
  "eyebrow",
  "title",
  "subtitle",
  "subtitleEn",
  "accent",
  "layoutTemplateId",
  "component",
]);

const assertObject = (value, label) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
};
const assertOnlyKeys = (value, allowed, label) => {
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknown.length) throw new Error(`${label} contains unsupported fields: ${unknown.join(", ")}`);
};
const assertNonEmptyString = (value, label, maximum = 1000) => {
  if (typeof value !== "string" || !value.trim() || value.length > maximum)
    throw new Error(`${label} must be a non-empty string no longer than ${maximum} characters`);
};

const validateManualRemovals = (value) => {
  if (!Array.isArray(value)) throw new Error("edit-policy.update.patch.manualRemovals must be an array");
  for (const [index, item] of value.entries()) {
    assertObject(item, `manualRemovals[${index}]`);
    assertOnlyKeys(item, new Set(["start", "end", "reason"]), `manualRemovals[${index}]`);
    if (!(Number.isFinite(item.start) && item.start >= 0 && Number.isFinite(item.end) && item.end > item.start))
      throw new Error(`manualRemovals[${index}] must have a non-negative start and a greater end`);
    assertNonEmptyString(item.reason, `manualRemovals[${index}].reason`, 240);
  }
};

export const validateRevisionRequest = (input) => {
  assertObject(input, "revision request");
  assertOnlyKeys(
    input,
    new Set([
      "schemaVersion",
      "revisionId",
      "projectId",
      "reviewer",
      "reason",
      "decision",
      "createdAt",
      "expected",
      "operations",
    ]),
    "revision request",
  );
  if (input.schemaVersion !== "1.0") throw new Error("revision schemaVersion must be 1.0");
  if (!revisionIdPattern.test(input.revisionId ?? "")) throw new Error("revisionId is invalid");
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(input.projectId ?? "")) throw new Error("projectId is invalid");
  assertNonEmptyString(input.reviewer, "reviewer", 120);
  assertNonEmptyString(input.reason, "reason");
  if (!new Set(["rejected", "revision-requested"]).has(input.decision)) throw new Error("decision is invalid");
  assertObject(input.expected, "expected");
  assertOnlyKeys(
    input.expected,
    new Set([
      "manifestSha256",
      "captionsSha256",
      "planningSha256",
      "reviewPropsSha256",
      "reviewVideoSha256",
      "reviewEvidenceSha256",
      "visualQaReportSha256",
      "regressionReportSha256",
    ]),
    "expected",
  );
  for (const [key, value] of Object.entries(input.expected))
    if (!/^[a-f0-9]{64}$/.test(value)) throw new Error(`expected.${key} must be a SHA-256 hash`);
  if (!Array.isArray(input.operations)) throw new Error("operations must be an array");
  if (input.decision === "revision-requested" && input.operations.length === 0)
    throw new Error("revision-requested requires at least one operation");
  if (input.decision === "rejected" && input.operations.length > 0)
    throw new Error("rejected records review rejection only; use revision-requested for corrective operations");
  if (
    input.decision === "rejected" &&
    (!(input.expected.reviewEvidenceSha256 || input.expected.reviewVideoSha256) ||
      !["visualQaReportSha256", "regressionReportSha256"].every((key) => input.expected[key]))
  )
    throw new Error("a rejection must bind review evidence, visual QA, and regression report hashes");

  const families = new Set();
  for (const [index, operation] of input.operations.entries()) {
    assertObject(operation, `operations[${index}]`);
    if (!allowedOperationTypes.has(operation.type))
      throw new Error(`Unsupported revision operation: ${operation.type}`);
    if (operation.type.endsWith("policy.update")) families.add("policy");
    if (operation.type === "translation.update") families.add("translation");
    if (operation.type === "visual-cue.update") families.add("visual");
    if (operation.type === "edit-policy.update") {
      assertOnlyKeys(operation, new Set(["type", "patch"]), `operations[${index}]`);
      assertObject(operation.patch, `operations[${index}].patch`);
      if (Object.keys(operation.patch).length === 0) throw new Error(`operations[${index}].patch must not be empty`);
      assertOnlyKeys(
        operation.patch,
        new Set([
          "minimumCompressedGapSeconds",
          "keptGapSeconds",
          "minimumCandidateConfidence",
          "minimumBoundarySilenceSeconds",
          "maximumCandidateSeconds",
          "manualRemovals",
          "rejectedCandidateIds",
          "protectedAnchors",
        ]),
        `operations[${index}].patch`,
      );
      if (
        operation.patch.minimumCompressedGapSeconds !== undefined &&
        !(operation.patch.minimumCompressedGapSeconds >= 0.1)
      )
        throw new Error("minimumCompressedGapSeconds must be at least 0.1");
      if (operation.patch.keptGapSeconds !== undefined && !(operation.patch.keptGapSeconds >= 0))
        throw new Error("keptGapSeconds must be non-negative");
      if (
        operation.patch.minimumCandidateConfidence !== undefined &&
        !(
          Number.isFinite(operation.patch.minimumCandidateConfidence) &&
          operation.patch.minimumCandidateConfidence >= 0 &&
          operation.patch.minimumCandidateConfidence <= 1
        )
      )
        throw new Error("minimumCandidateConfidence must be between zero and one");
      if (
        operation.patch.minimumBoundarySilenceSeconds !== undefined &&
        !(operation.patch.minimumBoundarySilenceSeconds >= 0.06)
      )
        throw new Error("minimumBoundarySilenceSeconds must be at least 0.06");
      if (operation.patch.maximumCandidateSeconds !== undefined && !(operation.patch.maximumCandidateSeconds > 0))
        throw new Error("maximumCandidateSeconds must be greater than zero");
      if (operation.patch.manualRemovals !== undefined) validateManualRemovals(operation.patch.manualRemovals);
      if (operation.patch.rejectedCandidateIds !== undefined) {
        if (
          !Array.isArray(operation.patch.rejectedCandidateIds) ||
          operation.patch.rejectedCandidateIds.some((id) => !/^[a-z0-9][a-z0-9-]{2,80}$/.test(id))
        )
          throw new Error("rejectedCandidateIds must contain stable candidate ids");
      }
      if (operation.patch.protectedAnchors !== undefined) {
        if (!Array.isArray(operation.patch.protectedAnchors)) throw new Error("protectedAnchors must be an array");
        for (const [anchorIndex, anchor] of operation.patch.protectedAnchors.entries()) {
          assertObject(anchor, `protectedAnchors[${anchorIndex}]`);
          assertOnlyKeys(
            anchor,
            new Set(["id", "text", "occurrence", "paddingBeforeSeconds", "paddingAfterSeconds"]),
            `protectedAnchors[${anchorIndex}]`,
          );
          if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(anchor.id ?? ""))
            throw new Error(`protectedAnchors[${anchorIndex}].id is invalid`);
          assertNonEmptyString(anchor.text, `protectedAnchors[${anchorIndex}].text`, 500);
        }
      }
    }
    if (operation.type === "caption-policy.update") {
      assertOnlyKeys(operation, new Set(["type", "patch"]), `operations[${index}]`);
      assertObject(operation.patch, `operations[${index}].patch`);
      if (Object.keys(operation.patch).length === 0) throw new Error(`operations[${index}].patch must not be empty`);
      assertOnlyKeys(operation.patch, captionPolicyKeys, `operations[${index}].patch`);
      for (const [key, value] of Object.entries(operation.patch)) {
        if (key === "displayPunctuation") {
          if (!new Set(["source", "none"]).has(value)) throw new Error("displayPunctuation must be source or none");
        } else if (!(Number.isFinite(value) && value > 0)) throw new Error(`${key} must be greater than zero`);
      }
    }
    if (operation.type === "translation.update") {
      assertOnlyKeys(operation, new Set(["type", "cueIndex", "expectedZh", "en"]), `operations[${index}]`);
      if (!Number.isInteger(operation.cueIndex) || operation.cueIndex < 0)
        throw new Error("translation cueIndex is invalid");
      assertNonEmptyString(operation.expectedZh, "translation expectedZh");
      assertNonEmptyString(operation.en, "translation en");
    }
    if (operation.type === "visual-cue.update") {
      assertOnlyKeys(operation, new Set(["type", "cueIndex", "expectedSegmentId", "patch"]), `operations[${index}]`);
      if (!Number.isInteger(operation.cueIndex) || operation.cueIndex < 0)
        throw new Error("visual cueIndex is invalid");
      assertNonEmptyString(operation.expectedSegmentId, "visual expectedSegmentId", 160);
      assertObject(operation.patch, `operations[${index}].patch`);
      if (Object.keys(operation.patch).length === 0) throw new Error(`operations[${index}].patch must not be empty`);
      assertOnlyKeys(operation.patch, visualPatchKeys, `operations[${index}].patch`);
    }
  }
  if (families.size > 1)
    throw new Error(
      "Policy, translation, and visual-cue revisions must be separate requests so resume cannot overwrite a reviewed edit",
    );
  return input;
};

export const revisionArtifactHashes = async (paths) => {
  const entries = [
    ["manifestSha256", paths.manifest],
    ["captionsSha256", paths.captions],
    ["planningSha256", paths.planning],
    ["reviewPropsSha256", paths.reviewProps],
    ["reviewVideoSha256", resolve(paths.workspace, "review-1080p.mp4")],
    ["reviewEvidenceSha256", paths.reviewEvidence],
    ["visualQaReportSha256", resolve(paths.workspace, "visual-qa/qa-report.json")],
    ["regressionReportSha256", paths.regressionReport],
  ];
  return Object.fromEntries(
    await Promise.all(
      entries.map(async ([key, path]) => [key, (await fileExists(path)) ? await hashFile(path) : undefined]),
    ),
  );
};

const earliestStageForOperations = (operations) => {
  const types = new Set(operations.map(({ type }) => type));
  if (types.has("edit-policy.update")) return "edit-plan";
  if (types.has("caption-policy.update")) return "captions";
  if (types.has("translation.update")) return "validate";
  if (types.has("visual-cue.update")) return "component-props";
  return "human-approval";
};

export const previewRevisionImpact = async ({ manifestPath, request: input }) => {
  const context = await readManifest(manifestPath);
  const request = validateRevisionRequest(input);
  if (request.projectId !== context.manifest.project.id)
    throw new Error("Revision projectId does not match the project manifest");
  const actual = await revisionArtifactHashes(context.paths);
  assertBaseline(request.expected, actual, request.operations);
  const stages = createStages(context);
  const earliestStage = earliestStageForOperations(request.operations);
  const staleStages = dependentStageNames(stages, earliestStage, { includeSelf: true });
  const stageSet = new Set(staleStages);
  return {
    schemaVersion: "1.0",
    revisionId: request.revisionId,
    earliestStage,
    staleStages,
    approvalWillBeRevoked: true,
    providerCalls: {
      recutAgent: stageSet.has("recut-plan"),
      translation: stageSet.has("translate"),
      semanticAgent: stageSet.has("semantic-plan"),
    },
    outputs: {
      recutPreview: stageSet.has("recut-review"),
      staticReview: stageSet.has("qa-capture") || stageSet.has("review-evidence"),
      delivery: stageSet.has("delivery-render"),
    },
  };
};

const assertBaseline = (expected, actual, operations) => {
  const required = new Set();
  for (const operation of operations) {
    if (operation.type.endsWith("policy.update")) required.add("manifestSha256");
    if (operation.type === "translation.update") required.add("captionsSha256");
    if (operation.type === "visual-cue.update") {
      required.add("planningSha256");
      required.add("reviewPropsSha256");
    }
  }
  for (const key of required) if (!expected[key]) throw new Error(`${key} is required for these revision operations`);
  for (const [key, value] of Object.entries(expected))
    if (actual[key] !== value)
      throw new Error(`Revision baseline conflict for ${key}: the reviewed artifact has changed`);
};

const updateVisualCue = (cue, operation) => {
  if (!cue) throw new Error(`Visual cue ${operation.cueIndex} does not exist`);
  const segmentId = cue.generatedVisual?.segment?.id;
  if (segmentId !== operation.expectedSegmentId)
    throw new Error(
      `Visual cue ${operation.cueIndex} is ${segmentId ?? "unknown"}, expected ${operation.expectedSegmentId}`,
    );
  const patch = operation.patch;
  for (const key of ["eyebrow", "title", "subtitle", "subtitleEn", "accent"])
    if (patch[key] !== undefined) assertNonEmptyString(patch[key], `visual patch ${key}`, key === "accent" ? 40 : 240);
  const start = patch.start ?? cue.start;
  const end = patch.end ?? cue.end;
  if (!(Number.isFinite(start) && start >= 0 && Number.isFinite(end) && end > start))
    throw new Error("Visual cue timing must have a non-negative start and a greater end");
  cue.start = start;
  cue.end = end;
  cue.generatedVisual.segment.start = start;
  cue.generatedVisual.segment.end = end;
  for (const key of ["eyebrow", "title", "subtitle", "subtitleEn", "accent"])
    if (patch[key] !== undefined) cue[key] = patch[key];
  if (patch.eyebrow !== undefined) cue.generatedVisual.narrative.eyebrow = patch.eyebrow;
  if (patch.title !== undefined) cue.generatedVisual.narrative.title = patch.title;
  if (patch.subtitle !== undefined) cue.generatedVisual.narrative.subtitleZh = patch.subtitle;
  if (patch.subtitleEn !== undefined) cue.generatedVisual.narrative.subtitleEn = patch.subtitleEn;
  if (patch.layoutTemplateId !== undefined) {
    getLayoutTemplate(patch.layoutTemplateId);
    cue.layoutTemplateId = patch.layoutTemplateId;
  }
  if (patch.component !== undefined) {
    assertObject(patch.component, "visual patch component");
    assertOnlyKeys(patch.component, new Set(["id", "props"]), "visual patch component");
    if (!APPROVED_COMPONENT_IDS.includes(patch.component.id))
      throw new Error("Visual revision must select an approved component");
    assertObject(patch.component.props, "visual patch component.props");
    validateComponentProps(patch.component.id, patch.component.props);
    cue.generatedVisual.component = {
      id: patch.component.id,
      status: "approved",
      selectionReason: "Explicit human revision",
    };
    cue.generatedVisual.props = patch.component.props;
  } else validateComponentProps(cue.generatedVisual.component.id, cue.generatedVisual.props);
  validateViewerFacingNarrative(cue.generatedVisual.narrative);
};

const markStaleFrom = (state, stages, earliestStage) => {
  if (!stages.some(({ name }) => name === earliestStage))
    throw new Error(`Unknown invalidation stage: ${earliestStage}`);
  const stale = [];
  for (const name of dependentStageNames(stages, earliestStage, { includeSelf: true })) {
    const entry = state.stages[name] ?? { status: "pending" };
    if (name === "human-approval" || name === "recut-approval") {
      entry.status = name === "human-approval" ? "pending" : "stale";
      for (const key of [
        "approvedAt",
        "reviewSha256",
        "reviewEvidenceSha256",
        "reviewMode",
        "qaSha256",
        "regressionSha256",
        "qaReportSha256",
        "qaWaiver",
        "snapshot",
        "approvalBindingSha256",
      ])
        delete entry[key];
    } else if (["succeeded", "approved", "failed", "running"].includes(entry.status)) entry.status = "stale";
    state.stages[name] = entry;
    stale.push(name);
  }
  return stale;
};

const canonicalHash = (value) =>
  createHash("sha256")
    .update(`${JSON.stringify(value, null, 2)}\n`)
    .digest("hex");

export const applyRevision = async ({ manifestPath, revisionPath }) => {
  const context = await readManifest(manifestPath);
  const { manifest, paths } = context;
  const request = validateRevisionRequest(JSON.parse(await readFile(resolve(revisionPath), "utf8")));
  if (request.projectId !== manifest.project.id)
    throw new Error("Revision projectId does not match the project manifest");
  const stages = createStages(context);
  const stageOrder = stages.map(({ name }) => name);
  const state = await loadState({
    statePath: paths.state,
    projectId: manifest.project.id,
    manifestPath: paths.manifest,
    stageNames: stageOrder,
    conditionalStageNames: CONDITIONAL_STAGE_NAMES,
  });
  const history = (await fileExists(paths.revisionHistory))
    ? JSON.parse(await readFile(paths.revisionHistory, "utf8"))
    : { schemaVersion: "1.0", projectId: manifest.project.id, revisions: [] };
  if (history.revisions.some((entry) => entry.revisionId === request.revisionId))
    throw new Error(`Revision ${request.revisionId} has already been applied`);

  const before = await revisionArtifactHashes(paths);
  assertBaseline(request.expected, before, request.operations);
  let earliestStage = earliestStageForOperations(request.operations);
  const changed = [];
  const operationTypes = new Set(request.operations.map(({ type }) => type));
  const refreshInputSignature = async (stageName) => {
    const stage = stages.find(({ name }) => name === stageName);
    const entry = state.stages[stageName];
    if (!stage || !entry) return;
    entry.inputSignature = await signatureFor([
      manifest.schemaVersion,
      stage.name,
      stage.inputs,
      ...stage.inputs,
      signatureConfigForStage(manifest, stage.name),
    ]);
  };
  const refreshOutputSignature = async (stageName) => {
    const stage = stages.find(({ name }) => name === stageName);
    const entry = state.stages[stageName];
    if (!stage || !entry) return;
    entry.outputSignature = await signatureFor(stage.outputs ?? []);
  };

  for (const operation of request.operations) {
    if (operation.type === "edit-policy.update") {
      manifest.policies.edit = { ...manifest.policies.edit, ...operation.patch };
      earliestStage = "edit-plan";
      changed.push(...Object.keys(operation.patch).map((key) => `manifest.policies.edit.${key}`));
    }
    if (operation.type === "caption-policy.update") {
      const { displayPunctuation, ...segmentationPatch } = operation.patch;
      manifest.policies.captions.segmentation = {
        ...manifest.policies.captions.segmentation,
        ...segmentationPatch,
      };
      if (displayPunctuation !== undefined) manifest.policies.captions.displayPunctuation = displayPunctuation;
      if (earliestStage !== "edit-plan") earliestStage = "captions";
      changed.push(
        ...Object.keys(segmentationPatch).map((key) => `manifest.policies.captions.segmentation.${key}`),
        ...(displayPunctuation === undefined ? [] : ["manifest.policies.captions.displayPunctuation"]),
      );
    }
  }
  if (operationTypes.has("edit-policy.update") || operationTypes.has("caption-policy.update")) {
    validateManifest(manifest);
    await writeFile(paths.manifest, `${JSON.stringify(manifest, null, 2)}\n`);
    await refreshInputSignature("preflight");
  }

  if (operationTypes.has("translation.update")) {
    const captionPaths = [paths.semanticCaptions, paths.captions].filter(
      (path, index, values) => path && values.indexOf(path) === index,
    );
    const captionDocuments = [];
    for (const path of captionPaths) {
      if (!(await fileExists(path))) continue;
      captionDocuments.push({ path, captions: JSON.parse(await readFile(path, "utf8")) });
    }
    if (!captionDocuments.length) throw new Error("Caption artifacts are unavailable");
    for (const operation of request.operations) {
      for (const { captions } of captionDocuments) {
        const cue = captions[operation.cueIndex];
        if (!cue) throw new Error(`Caption cue ${operation.cueIndex} does not exist`);
        if (cue.zh !== operation.expectedZh)
          throw new Error(`Caption cue ${operation.cueIndex} Chinese text no longer matches`);
        cue.en = operation.en;
      }
      changed.push(`captions[${operation.cueIndex}].en`);
    }
    for (const { path, captions } of captionDocuments) await writeFile(path, `${JSON.stringify(captions, null, 2)}\n`);

    const propsPaths = [paths.reviewProps, paths.finalProps].filter(
      (path, index, values) => path && values.indexOf(path) === index,
    );
    for (const path of propsPaths) {
      if (!(await fileExists(path))) continue;
      const props = JSON.parse(await readFile(path, "utf8"));
      if (!Array.isArray(props.subtitleCues)) continue;
      for (const operation of request.operations) {
        const cue = props.subtitleCues[operation.cueIndex];
        if (!cue || cue.zh !== operation.expectedZh)
          throw new Error(`Render caption cue ${operation.cueIndex} no longer matches`);
        cue.en = operation.en;
      }
      await writeFile(path, `${JSON.stringify(props, null, 2)}\n`);
    }

    earliestStage = "validate";
    const translate = state.stages.translate;
    if (translate) {
      translate.outputSignature = await signatureFor(
        stages.find(({ name }) => name === "translate")?.outputs ?? captionPaths,
      );
      await refreshInputSignature("translate");
    }
    // English-only caption corrections do not change Chinese semantic evidence,
    // scene anchors, component selection, or visual direction. Rebind those
    // succeeded stages to the corrected bilingual caption artifacts so the
    // workflow resumes at deterministic validation instead of calling an Agent.
    for (const stageName of ["scene-align", "semantic-plan", "component-props", "visual-direction"])
      await refreshInputSignature(stageName);
    await refreshOutputSignature("visual-direction");
  }

  if (operationTypes.has("visual-cue.update")) {
    const plan = JSON.parse(await readFile(paths.planning, "utf8"));
    const reviewProps = JSON.parse(await readFile(paths.reviewProps, "utf8"));
    const deliveryPropsPath = resolve(paths.workspace, "delivery-props.json");
    const deliveryProps = (await fileExists(deliveryPropsPath))
      ? JSON.parse(await readFile(deliveryPropsPath, "utf8"))
      : undefined;
    for (const operation of request.operations) {
      updateVisualCue(plan.overlayCues[operation.cueIndex], operation);
      updateVisualCue(reviewProps.overlayCues[operation.cueIndex], operation);
      if (deliveryProps?.overlayCues?.[operation.cueIndex])
        updateVisualCue(deliveryProps.overlayCues[operation.cueIndex], operation);
      changed.push(...Object.keys(operation.patch).map((key) => `overlayCues[${operation.cueIndex}].${key}`));
    }
    await writeFile(paths.planning, `${JSON.stringify(plan, null, 2)}\n`);
    await writeFile(paths.reviewProps, `${JSON.stringify(reviewProps, null, 2)}\n`);
    if (deliveryProps) await writeFile(deliveryPropsPath, `${JSON.stringify(deliveryProps, null, 2)}\n`);
    earliestStage = "component-props";
    const semantic = state.stages["semantic-plan"];
    if (semantic) semantic.outputSignature = await signatureFor([paths.planning, paths.reviewProps]);
  }

  const approvalWasRevoked = state.stages["human-approval"]?.status === "approved";
  const staleStages = markStaleFrom(state, stages, earliestStage);
  recordEvent(state, {
    event: request.decision === "rejected" ? "review.rejected" : "review.revision-applied",
    revisionId: request.revisionId,
    stage: earliestStage,
  });
  await saveState(paths.state, state);
  const after = await revisionArtifactHashes(paths);
  const entry = {
    revisionId: request.revisionId,
    requestSha256: canonicalHash(request),
    appliedAt: new Date().toISOString(),
    reviewer: request.reviewer,
    reason: request.reason,
    decision: request.decision,
    operations: request.operations.map(({ type }) => type),
    changed,
    earliestStaleStage: earliestStage,
    staleStages,
    approvalRevoked: approvalWasRevoked,
    before,
    after,
  };
  history.revisions.push(entry);
  await mkdir(paths.revisions, { recursive: true });
  await writeFile(resolve(paths.revisions, `${request.revisionId}.json`), `${JSON.stringify(request, null, 2)}\n`);
  await writeFile(paths.revisionHistory, `${JSON.stringify(history, null, 2)}\n`);
  state.revisions = {
    count: history.revisions.length,
    latestRevisionId: request.revisionId,
    latestDecision: request.decision,
    latestAppliedAt: entry.appliedAt,
  };
  await saveState(paths.state, state);
  await writeArtifactLedger(paths.artifacts, state);
  return entry;
};

export const revisionRequestPathForOperator = ({ projectId, revisionId }) => {
  if (!revisionIdPattern.test(revisionId ?? "")) throw new Error("revisionId is invalid");
  const projectRoot = resolve("projects", projectId);
  const path = resolve(projectRoot, "revisions", `${revisionId}.json`);
  if (dirname(path) !== resolve(projectRoot, "revisions") || basename(path) !== `${revisionId}.json`)
    throw new Error("revision path is outside the registered project");
  return path;
};
