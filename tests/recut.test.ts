import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { createRecutPlanningPrompt, parseRecutProviderPlan } from "../src/recut-planning/index.ts";
import { materializeRecutPlan, packTranscriptForRecut } from "../src/workflow/recut.ts";

const transcript = {
  words: [
    { text: "今天", start: 0.2, end: 0.4, type: "word" },
    { text: "我们", start: 0.4, end: 0.6, type: "word" },
    { text: "介绍。", start: 0.6, end: 0.9, type: "word" },
    { text: "今天", start: 1.3, end: 1.5, type: "word" },
    { text: "我们", start: 1.5, end: 1.7, type: "word" },
    { text: "介绍。", start: 1.7, end: 2, type: "word" },
    { text: "项目", start: 3.2, end: 3.5, type: "word" },
    { text: "结束", start: 3.5, end: 3.8, type: "word" },
  ],
};

const policy = {
  minimumCompressedGapSeconds: 0.8,
  keptGapSeconds: 0.24,
  minimumCandidateConfidence: 0.84,
  minimumBoundarySilenceSeconds: 0.12,
  maximumCandidateSeconds: 12,
  manualRemovals: [],
  rejectedCandidateIds: [],
  protectedAnchors: [],
};

test("packs a word-level transcript without losing stable speech indexes", () => {
  const packed = packTranscriptForRecut(transcript);
  assert.equal(packed.words.length, 8);
  assert.match(packed.markdown, /w0-w2/);
  assert.match(packed.markdown, /今天我们介绍/);
});

test("provider planning stays conservative and validates exact word ranges", () => {
  const prompt = createRecutPlanningPrompt(transcript);
  assert.match(prompt.system, /Do not rewrite speech/);
  assert.deepEqual(
    parseRecutProviderPlan(
      {
        schemaVersion: "1.0",
        candidates: [
          {
            kind: "duplicate-retake",
            startWord: 0,
            endWord: 2,
            confidence: 0.97,
            reason: "The same complete line is delivered cleanly immediately afterwards.",
          },
        ],
      },
      transcript,
    ).candidates[0].endWord,
    2,
  );
  assert.throws(
    () =>
      parseRecutProviderPlan(
        {
          schemaVersion: "1.0",
          candidates: [{ kind: "false-start", startWord: 0, endWord: 99, confidence: 1, reason: "bad" }],
        },
        transcript,
      ),
    /word range/,
  );
});

test("a rejected recut note is included in the next conservative planning prompt", () => {
  const prompt = createRecutPlanningPrompt(transcript, { reviewFeedback: "保留结尾前的停顿" });
  assert.match(prompt.user, /保留结尾前的停顿/);
  assert.match(prompt.user, /creator rejected the previous proposal/i);
});

test("materializes only safe high-confidence retakes and compresses long pauses", () => {
  const result = materializeRecutPlan({
    transcript,
    policy,
    providerPlan: {
      candidates: [
        {
          kind: "duplicate-retake",
          startWord: 0,
          endWord: 2,
          confidence: 0.97,
          reason: "Earlier duplicate",
        },
        {
          kind: "false-start",
          startWord: 3,
          endWord: 4,
          confidence: 0.98,
          reason: "Unsafe partial phrase",
        },
      ],
    },
  });
  const duplicate = result.candidates.find((candidate) => candidate.kind === "duplicate-retake");
  const unsafe = result.candidates.find((candidate) => candidate.kind === "false-start");
  const pause = result.candidates.find((candidate) => candidate.kind === "long-pause");
  assert.equal(duplicate?.disposition, "recommended");
  assert.equal(unsafe?.disposition, "unsafe-boundary");
  assert.equal(pause?.disposition, "recommended");
  assert.equal(result.removals.length, 2);
  assert.ok(result.summary.proposedSavingsSeconds > 1);
  assert.equal(result.ranges.at(-1)?.outputEnd, result.summary.proposedDurationSeconds);
});

test("protects authored spoken anchors from both semantic and pause cuts", () => {
  const result = materializeRecutPlan({
    transcript,
    policy,
    authoredScenePlan: {
      scenes: [
        {
          id: "opening-demo",
          startAnchor: { text: "今天我们介绍", occurrence: 1 },
          endAnchor: { text: "项目结束" },
        },
      ],
    },
    providerPlan: {
      candidates: [
        {
          kind: "duplicate-retake",
          startWord: 0,
          endWord: 2,
          confidence: 0.99,
          reason: "Would otherwise be eligible",
        },
      ],
    },
  });
  assert.equal(result.candidates.find((candidate) => candidate.kind === "duplicate-retake")?.disposition, "protected");
  assert.equal(result.protectedRanges.length, 2);
  assert.equal(result.unresolvedProtectedAnchors.length, 0);
});

test("preserves non-speech transcript events instead of compressing across them", () => {
  const withEvent = structuredClone(transcript);
  withEvent.words.splice(6, 0, { text: "(笑声)", start: 2.4, end: 2.7, type: "audio_event" });
  const result = materializeRecutPlan({ transcript: withEvent, policy, providerPlan: { candidates: [] } });
  const pause = result.candidates.find((candidate) => candidate.kind === "long-pause");
  assert.equal(pause?.disposition, "protected");
  assert.ok(result.protectedRanges.some((range) => range.reason.includes("audio event")));
});

test("allows a reviewed manual removal to override a transcript audio event", () => {
  const withEvent = structuredClone(transcript);
  withEvent.words.splice(6, 0, { text: "(物品撞击声)", start: 2.1, end: 3.1, type: "audio_event" });
  const result = materializeRecutPlan({
    transcript: withEvent,
    policy: {
      ...policy,
      manualRemovals: [{ start: 2.05, end: 3.15, reason: "Creator confirmed the off-camera interruption" }],
    },
    providerPlan: { candidates: [] },
  });
  assert.ok(
    result.removals.some((removal) => removal.source === "manual" && removal.start === 2.05 && removal.end === 3.15),
  );
});

test("still rejects a manual removal that overlaps a spoken anchor", () => {
  assert.throws(
    () =>
      materializeRecutPlan({
        transcript,
        policy: {
          ...policy,
          manualRemovals: [{ start: 0.15, end: 0.75, reason: "Must not override protected speech" }],
          protectedAnchors: [{ id: "opening", text: "今天我们介绍" }],
        },
        providerPlan: { candidates: [] },
      }),
    /overlaps protected range opening/,
  );
});

test("promotes only the exact recut artifacts bound by explicit approval", async () => {
  const root = await mkdtemp(join(tmpdir(), "remotion-md-recut-promotion-"));
  const proposedEdlFile = join(root, "edl.proposed.json");
  const recutCandidatesFile = join(root, "recut-candidates.json");
  const recutReviewFile = join(root, "recut-review.md");
  const recutPreviewFile = join(root, "recut-preview-720p.mp4");
  const stateFile = join(root, "run-state.json");
  const configFile = join(root, "runtime-config.json");
  const reviewedFiles = [proposedEdlFile, recutCandidatesFile, recutReviewFile, recutPreviewFile];
  await writeFile(proposedEdlFile, JSON.stringify({ version: 2, totalDurationS: 8, ranges: [] }));
  await writeFile(
    recutCandidatesFile,
    JSON.stringify({ schemaVersion: "2.0", status: "proposed", summary: { proposedDurationSeconds: 8 } }),
  );
  await writeFile(recutReviewFile, "# review\n");
  await writeFile(recutPreviewFile, "video-one");
  await writeFile(
    configFile,
    JSON.stringify({ editDir: root, proposedEdlFile, recutCandidatesFile, recutReviewFile, recutPreviewFile }),
  );

  const runPromotion = () =>
    spawnSync(process.execPath, ["scripts/promote-edit-plan.mjs", configFile], {
      cwd: process.cwd(),
      encoding: "utf8",
    });
  await writeFile(stateFile, JSON.stringify({ stages: { "recut-approval": { status: "pending" } } }));
  assert.notEqual(runPromotion().status, 0);

  const reviewSha256 = createHash("sha256");
  for (const file of reviewedFiles) reviewSha256.update(await readFile(file));
  await writeFile(
    stateFile,
    JSON.stringify({ stages: { "recut-approval": { status: "approved", reviewSha256: reviewSha256.digest("hex") } } }),
  );
  const approved = runPromotion();
  assert.equal(approved.status, 0, approved.stderr);
  assert.deepEqual(JSON.parse(await readFile(join(root, "edl.json"), "utf8")), {
    version: 2,
    totalDurationS: 8,
    ranges: [],
  });

  await writeFile(recutPreviewFile, "video-tampered");
  const tampered = runPromotion();
  assert.notEqual(tampered.status, 0);
  assert.match(tampered.stderr, /changed after approval/);
});
