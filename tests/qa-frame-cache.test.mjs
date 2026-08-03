import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  createQaFrameCacheWriter,
  parseQaFrameCache,
  qaFrameCacheKey,
} from "../scripts/workflow/qa-frame-cache.mjs";

const frame = {
  cueId: "cue-1",
  componentId: "binary-versus",
  layoutId: "speaker-center-left",
  phase: "stable",
  frame: 150,
  timeSeconds: 5,
};
const plan = {
  layout: { layoutTemplateId: "speaker-center-left" },
  overlayCues: [
    { id: "cue-1", start: 2, end: 8, title: "Active" },
    { id: "cue-2", start: 12, end: 18, title: "Unrelated" },
  ],
};
const reviewProps = {
  subtitleCues: [
    { start: 4, end: 6, zh: "当前字幕", en: "Current" },
    { start: 14, end: 16, zh: "其他字幕", en: "Unrelated" },
  ],
};
const input = {
  frame,
  plan,
  reviewProps,
  rendererSha256: "a".repeat(64),
  baseVideoSha256: "b".repeat(64),
};

test("QA frame cache ignores unrelated cues outside the captured frame", () => {
  const changed = structuredClone(input);
  changed.plan.overlayCues[1].title = "Changed elsewhere";
  changed.reviewProps.subtitleCues[1].en = "Changed elsewhere";
  assert.equal(qaFrameCacheKey(input), qaFrameCacheKey(changed));
});

test("QA frame cache changes for active visual, caption, renderer, or base-video inputs", () => {
  const activeVisual = structuredClone(input);
  activeVisual.plan.overlayCues[0].title = "Changed here";
  assert.notEqual(qaFrameCacheKey(input), qaFrameCacheKey(activeVisual));

  const activeCaption = structuredClone(input);
  activeCaption.reviewProps.subtitleCues[0].en = "Changed here";
  assert.notEqual(qaFrameCacheKey(input), qaFrameCacheKey(activeCaption));

  assert.notEqual(qaFrameCacheKey(input), qaFrameCacheKey({ ...input, rendererSha256: "c".repeat(64) }));
  assert.notEqual(qaFrameCacheKey(input), qaFrameCacheKey({ ...input, baseVideoSha256: "d".repeat(64) }));
});

test("invalid QA frame cache documents fail closed", () => {
  assert.deepEqual(parseQaFrameCache({ schemaVersion: "legacy", entries: { stale: true } }), {
    schemaVersion: "1.0",
    entries: {},
  });
});

test("QA frame cache writer serializes atomic snapshots as frames complete", async (context) => {
  const directory = await mkdtemp(join(tmpdir(), "qa-frame-cache-"));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, "frame-cache.json");
  const writer = createQaFrameCacheWriter(path);
  const cache = parseQaFrameCache();

  cache.entries.first = { inputSignature: "first", outputSha256: "a".repeat(64) };
  const firstSave = writer.save(cache);
  cache.entries.second = { inputSignature: "second", outputSha256: "b".repeat(64) };
  const secondSave = writer.save(cache);
  await Promise.all([firstSave, secondSave, writer.flush()]);

  assert.deepEqual(JSON.parse(await readFile(path, "utf8")), cache);
  assert.deepEqual(await readdir(directory), ["frame-cache.json"]);
});
