import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  applyRevision,
  revisionRequestPathForOperator,
  validateRevisionRequest,
} from "../scripts/operations/revisions.mjs";
import { createManifest, readManifest, writeManifest } from "../scripts/workflow/manifest.mjs";
import { createStages } from "../scripts/workflow/stages.mjs";
import { hashFile, loadState, saveState } from "../scripts/workflow/state.mjs";

const visualCue = () => ({
  start: 10,
  end: 18,
  eyebrow: "ARGUMENT",
  title: "原始论点",
  subtitle: "原始论点",
  subtitleEn: "Original argument",
  accent: "#48a7ff",
  layoutTemplateId: "speaker-center-left",
  generatedVisual: {
    schemaVersion: "1.0",
    segment: { id: "segment-1", start: 10, end: 18, text: "这是一段测试口播" },
    analysis: { rhetoric: "historical-timeline" },
    component: { id: "historical-timeline", status: "approved", selectionReason: "fixture" },
    narrative: {
      eyebrow: "ARGUMENT",
      title: "原始论点",
      subtitleZh: "原始论点",
      subtitleEn: "Original argument",
    },
    props: { items: [{ label: "一" }, { label: "二" }, { label: "三" }] },
  },
});

const setupProject = async () => {
  const root = await mkdtemp(join(tmpdir(), "remotion-revision-"));
  const projectRoot = join(root, "project");
  const manifestPath = join(projectRoot, "project.json");
  const source = join(root, "source.mp4");
  const transcript = join(root, "transcript.json");
  await writeFile(source, "source");
  await writeFile(transcript, JSON.stringify({ words: [] }));
  const manifest = createManifest({
    id: "revision-test",
    title: "Revision",
    source,
    transcript,
    outputPath: manifestPath,
  });
  manifest.providers.translation.provider = "offline";
  manifest.providers.semanticPlanning.provider = "fixture";
  await writeManifest(manifest, manifestPath);
  const context = await readManifest(manifestPath);
  await mkdir(context.paths.workspace, { recursive: true });
  const captions = [{ start: 0, end: 2, zh: "保留口播", en: "Old translation", role: "caption" }];
  const plan = { schemaVersion: "1.0", status: "review", overlayCues: [visualCue()] };
  const props = { overlayCues: [visualCue()], subtitleCues: captions };
  await writeFile(join(context.paths.workspace, "captions-verbatim.json"), `${JSON.stringify(captions, null, 2)}\n`);
  await writeFile(join(context.paths.workspace, "captions-semantic.json"), `${JSON.stringify(captions, null, 2)}\n`);
  await writeFile(context.paths.captionsSource, `${JSON.stringify(captions, null, 2)}\n`);
  await writeFile(context.paths.planning, `${JSON.stringify(plan, null, 2)}\n`);
  await writeFile(context.paths.reviewProps, `${JSON.stringify(props, null, 2)}\n`);
  await writeFile(context.paths.finalProps, `${JSON.stringify(props, null, 2)}\n`);
  await mkdir(join(context.paths.workspace, "visual-qa"), { recursive: true });
  await mkdir(join(context.paths.workspace, "regression"), { recursive: true });
  await writeFile(context.paths.reviewEvidence, JSON.stringify({ kind: "review-evidence" }));
  await writeFile(join(context.paths.workspace, "visual-qa/qa-report.json"), JSON.stringify({ status: "passed" }));
  await writeFile(context.paths.regressionReport, JSON.stringify({ status: "passed" }));
  const stages = createStages(context);
  const state = await loadState({
    statePath: context.paths.state,
    projectId: manifest.project.id,
    manifestPath,
    stageNames: stages.map(({ name }) => name),
  });
  for (const name of state.stageOrder) state.stages[name].status = name === "human-approval" ? "approved" : "succeeded";
  await saveState(context.paths.state, state);
  return { root, manifestPath, context };
};

test("revision contract rejects unknown fields, unsafe mixing, and arbitrary operator paths", () => {
  const base = {
    schemaVersion: "1.0",
    revisionId: "revision-001",
    projectId: "revision-test",
    reviewer: "Reviewer",
    reason: "Review correction",
    decision: "revision-requested",
    expected: { manifestSha256: "a".repeat(64), captionsSha256: "b".repeat(64) },
    operations: [
      { type: "edit-policy.update", patch: { keptGapSeconds: 0.3 } },
      { type: "translation.update", cueIndex: 0, expectedZh: "保留口播", en: "New" },
    ],
  };
  assert.throws(() => validateRevisionRequest(base), /must be separate requests/);
  assert.throws(() => validateRevisionRequest({ ...base, shell: "rm -rf /" }), /unsupported fields/);
  assert.throws(
    () => revisionRequestPathForOperator({ projectId: "revision-test", revisionId: "../escape" }),
    /invalid/,
  );
});

test("an English-only caption revision preserves semantic planning and resumes at validation", async () => {
  const { root, manifestPath, context } = await setupProject();
  const captionsPath = join(context.paths.workspace, "captions-verbatim.json");
  const revisionPath = join(root, "translation-revision.json");
  await writeFile(
    revisionPath,
    JSON.stringify({
      schemaVersion: "1.0",
      revisionId: "translation-001",
      projectId: "revision-test",
      reviewer: "Human reviewer",
      reason: "Use the reviewed canonical English sentence",
      decision: "revision-requested",
      expected: { captionsSha256: await hashFile(captionsPath) },
      operations: [{ type: "translation.update", cueIndex: 0, expectedZh: "保留口播", en: "Reviewed translation" }],
    }),
  );
  const result = await applyRevision({ manifestPath, revisionPath });
  const captions = JSON.parse(await readFile(captionsPath, "utf8"));
  const semanticCaptions = JSON.parse(await readFile(context.paths.semanticCaptions, "utf8"));
  const reviewProps = JSON.parse(await readFile(context.paths.reviewProps, "utf8"));
  const finalProps = JSON.parse(await readFile(context.paths.finalProps, "utf8"));
  const state = JSON.parse(await readFile(context.paths.state, "utf8"));
  assert.equal(captions[0].zh, "保留口播");
  assert.equal(captions[0].en, "Reviewed translation");
  assert.equal(semanticCaptions[0].en, "Reviewed translation");
  assert.equal(reviewProps.subtitleCues[0].en, "Reviewed translation");
  assert.equal(finalProps.subtitleCues[0].en, "Reviewed translation");
  assert.equal(result.earliestStaleStage, "validate");
  assert.equal(state.stages.translate.status, "succeeded");
  assert.equal(state.stages["semantic-plan"].status, "succeeded");
  assert.equal(state.stages.validate.status, "stale");
  assert.equal(state.stages["human-approval"].status, "pending");
  await assert.rejects(() => applyRevision({ manifestPath, revisionPath }), /already been applied/);
});

test("a visual revision updates plan and render props together and preserves semantic planning", async () => {
  const { root, manifestPath, context } = await setupProject();
  const revisionPath = join(root, "visual-revision.json");
  await writeFile(
    revisionPath,
    JSON.stringify({
      schemaVersion: "1.0",
      revisionId: "visual-001",
      projectId: "revision-test",
      reviewer: "Human reviewer",
      reason: "Shorten the title and move the overlay away from the speaker",
      decision: "revision-requested",
      expected: {
        planningSha256: await hashFile(context.paths.planning),
        reviewPropsSha256: await hashFile(context.paths.reviewProps),
      },
      operations: [
        {
          type: "visual-cue.update",
          cueIndex: 0,
          expectedSegmentId: "segment-1",
          patch: { title: "精简后的论点", layoutTemplateId: "speaker-center-right", start: 11, end: 17.5 },
        },
      ],
    }),
  );
  const result = await applyRevision({ manifestPath, revisionPath });
  const plan = JSON.parse(await readFile(context.paths.planning, "utf8"));
  const props = JSON.parse(await readFile(context.paths.reviewProps, "utf8"));
  const state = JSON.parse(await readFile(context.paths.state, "utf8"));
  assert.equal(plan.overlayCues[0].title, "精简后的论点");
  assert.equal(props.overlayCues[0].layoutTemplateId, "speaker-center-right");
  assert.equal(plan.overlayCues[0].generatedVisual.segment.start, 11);
  assert.equal(result.earliestStaleStage, "component-props");
  assert.equal(state.stages["semantic-plan"].status, "succeeded");
  assert.equal(state.stages["component-props"].status, "stale");
  assert.equal(state.stages["review-base"].status, "succeeded");
});

test("a rejection revokes approval without invalidating completed review evidence", async () => {
  const { root, manifestPath, context } = await setupProject();
  const revisionPath = join(root, "rejection.json");
  await writeFile(
    revisionPath,
    JSON.stringify({
      schemaVersion: "1.0",
      revisionId: "rejection-001",
      projectId: "revision-test",
      reviewer: "Human reviewer",
      reason: "The visual pacing needs revision",
      decision: "rejected",
      expected: {
        reviewEvidenceSha256: await hashFile(context.paths.reviewEvidence),
        visualQaReportSha256: await hashFile(join(context.paths.workspace, "visual-qa/qa-report.json")),
        regressionReportSha256: await hashFile(context.paths.regressionReport),
      },
      operations: [],
    }),
  );
  const result = await applyRevision({ manifestPath, revisionPath });
  const state = JSON.parse(await readFile(context.paths.state, "utf8"));
  assert.equal(result.earliestStaleStage, "human-approval");
  assert.equal(state.stages["review-evidence"].status, "succeeded");
  assert.equal(state.stages["visual-qa"].status, "succeeded");
  assert.equal(state.stages["human-approval"].status, "pending");
});

test("a caption-policy revision can select punctuation-free display without changing segmentation", async () => {
  const { root, manifestPath, context } = await setupProject();
  const revisionPath = join(root, "caption-policy.json");
  await writeFile(
    revisionPath,
    JSON.stringify({
      schemaVersion: "1.0",
      revisionId: "caption-policy-001",
      projectId: "revision-test",
      reviewer: "Human reviewer",
      reason: "Use pause-based phrases without displayed sentence punctuation",
      decision: "revision-requested",
      expected: { manifestSha256: await hashFile(manifestPath) },
      operations: [{ type: "caption-policy.update", patch: { displayPunctuation: "none" } }],
    }),
  );
  const result = await applyRevision({ manifestPath, revisionPath });
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const state = JSON.parse(await readFile(context.paths.state, "utf8"));
  assert.equal(manifest.policies.captions.displayPunctuation, "none");
  assert.equal(result.changed[0], "manifest.policies.captions.displayPunctuation");
  assert.equal(result.earliestStaleStage, "captions");
  assert.equal(state.stages["edit-plan"].status, "succeeded");
  assert.equal(state.stages.captions.status, "stale");
});

test("an edit-policy revision persists the reviewed removals and preserves upstream stages", async () => {
  const { root, manifestPath, context } = await setupProject();
  const stateBefore = JSON.parse(await readFile(context.paths.state, "utf8"));
  stateBefore.stages.preflight.inputSignature = "old-manifest-signature";
  await saveState(context.paths.state, stateBefore);
  const revisionPath = join(root, "edit-policy.json");
  await writeFile(
    revisionPath,
    JSON.stringify({
      schemaVersion: "1.0",
      revisionId: "edit-policy-001",
      projectId: "revision-test",
      reviewer: "Human reviewer",
      reason: "Restore breathing room and remove the reviewed retake",
      decision: "revision-requested",
      expected: { manifestSha256: await hashFile(manifestPath) },
      operations: [
        {
          type: "edit-policy.update",
          patch: {
            keptGapSeconds: 0.32,
            manualRemovals: [{ start: 12.4, end: 13.2, reason: "Reviewed false start" }],
          },
        },
      ],
    }),
  );
  const result = await applyRevision({ manifestPath, revisionPath });
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const state = JSON.parse(await readFile(context.paths.state, "utf8"));
  assert.equal(manifest.policies.edit.keptGapSeconds, 0.32);
  assert.equal(manifest.policies.edit.manualRemovals[0].reason, "Reviewed false start");
  assert.equal(result.earliestStaleStage, "edit-plan");
  assert.equal(state.stages.transcribe.status, "succeeded");
  assert.equal(state.stages.layout.status, "succeeded");
  assert.equal(state.stages["edit-plan"].status, "stale");
  assert.notEqual(state.stages.preflight.inputSignature, "old-manifest-signature");
});

test("a stale baseline is rejected before any artifact changes", async () => {
  const { root, manifestPath, context } = await setupProject();
  const captionsPath = join(context.paths.workspace, "captions-verbatim.json");
  const before = await readFile(captionsPath, "utf8");
  const revisionPath = join(root, "stale.json");
  await writeFile(
    revisionPath,
    JSON.stringify({
      schemaVersion: "1.0",
      revisionId: "stale-001",
      projectId: "revision-test",
      reviewer: "Human reviewer",
      reason: "This request was based on an older caption review",
      decision: "revision-requested",
      expected: { captionsSha256: "0".repeat(64) },
      operations: [{ type: "translation.update", cueIndex: 0, expectedZh: "保留口播", en: "Changed" }],
    }),
  );
  await assert.rejects(() => applyRevision({ manifestPath, revisionPath }), /baseline conflict/);
  assert.equal(await readFile(captionsPath, "utf8"), before);
});
