import assert from "node:assert/strict";
import test from "node:test";
import { resolveAuthoredScenes, suppressCandidatesForAuthoredScenes } from "../src/supplemental-media/alignment.ts";
import type { AuthoredScenePlan, SupplementalMediaProbe } from "../src/supplemental-media/types.ts";

const captions = [
  { start: 0, end: 2.5, zh: "这个项目在 GitHub 上" },
  { start: 2.5, end: 5.5, zh: "已经有大约四千个 Star。" },
  { start: 5.5, end: 8, zh: "它把模板、AI Agent、" },
  { start: 8, end: 10.5, zh: "Remotion 渲染和 MP4 导出接进了同一套流程。" },
];

const asset: SupplementalMediaProbe = {
  id: "github-overview",
  role: "repository-overview",
  sourcePath: "/tmp/github.mp4",
  publicSrc: "projects/demo/supplemental/github-overview.mp4",
  sha256: "abc",
  width: 1600,
  height: 1080,
  fps: 60,
  durationSeconds: 10.7,
  codec: "h264",
  hasAudio: false,
  audioPolicy: "mute",
  required: true,
  clip: { in: 0, out: 10.7 },
};

const plan: AuthoredScenePlan = {
  schemaVersion: "1.0",
  scenes: [
    {
      id: "github-scene",
      type: "screen-evidence",
      assetId: asset.id,
      startAnchor: { text: "这个项目在 GitHub 上已经有大约四千个 Star" },
      endAnchor: { text: "Remotion 渲染和 MP4 导出接进了同一套流程" },
      required: true,
      speakerPip: { shape: "circle", preferredPosition: "top-right" },
    },
  ],
};

test("aligns authored spoken-text anchors to ordered semantic captions", () => {
  const timeline = resolveAuthoredScenes({ plan, captions, assets: [asset] });
  assert.equal(timeline.status, "resolved");
  assert.equal(timeline.scenes.length, 1);
  assert.deepEqual(
    {
      start: timeline.scenes[0].start,
      end: timeline.scenes[0].end,
      startCue: timeline.scenes[0].startCue,
      endCue: timeline.scenes[0].endCue,
    },
    { start: 0, end: 10.5, startCue: 0, endCue: 3 },
  );
  assert.equal(timeline.scenes[0].videoSrc, asset.publicSrc);
  assert.equal(timeline.scenes[0].playbackRate, 1);
  assert.equal(timeline.scenes[0].speakerPip.objectPosition, "50% 35%");
});

test("centers authored PIP on the detected speaker position", () => {
  const timeline = resolveAuthoredScenes({
    plan,
    captions,
    assets: [asset],
    speakerFaceCenterX: 0.6596,
  });
  assert.equal(timeline.scenes[0].speakerPip.objectPosition, "86% 35%");
  const rectanglePlan: AuthoredScenePlan = {
    ...plan,
    scenes: [{ ...plan.scenes[0], speakerPip: { shape: "rounded-rectangle", preferredPosition: "top-left" } }],
  };
  const rectangleTimeline = resolveAuthoredScenes({
    plan: rectanglePlan,
    captions,
    assets: [asset],
    speakerFaceCenterX: 0.6596,
  });
  assert.equal(rectangleTimeline.scenes[0].speakerPip.objectPosition, "100% 35%");
});

test("blocks a required scene when the authored narration is longer than its clip", () => {
  const shortAsset = { ...asset, clip: { in: 0, out: 5 } };
  const timeline = resolveAuthoredScenes({ plan, captions, assets: [shortAsset] });
  assert.equal(timeline.status, "blocked");
  assert.equal(timeline.summary.requiredUnresolved, 1);
  assert.match(timeline.unresolved[0].reason, /below the 0.8 safety limit/);
});

test("time-fits a mildly short recording without changing the speaker timeline", () => {
  const slightlyShort = { ...asset, clip: { in: 0, out: 9 } };
  const timeline = resolveAuthoredScenes({ plan, captions, assets: [slightlyShort] });
  assert.equal(timeline.status, "resolved");
  assert.equal(timeline.scenes[0].start, 0);
  assert.equal(timeline.scenes[0].end, 10.5);
  assert.ok(Math.abs(timeline.scenes[0].playbackRate - 9 / 10.5) < 0.0001);
});

test("reports an unknown optional asset without blocking the remaining workflow", () => {
  const optionalPlan: AuthoredScenePlan = {
    ...plan,
    scenes: [{ ...plan.scenes[0], assetId: "missing", required: false }],
  };
  const timeline = resolveAuthoredScenes({ plan: optionalPlan, captions, assets: [asset] });
  assert.equal(timeline.status, "empty");
  assert.equal(timeline.summary.requiredUnresolved, 0);
  assert.equal(timeline.unresolved.length, 1);
});

test("authored recording scenes deterministically suppress overlapping semantic candidates", () => {
  const candidates = [
    { id: "before", start: 0, end: 2, materializationStatus: "planned" },
    { id: "overlap", start: 4, end: 9, materializationStatus: "planned" },
    { id: "after", start: 12, end: 14, materializationStatus: "planned" },
  ];
  const directed = suppressCandidatesForAuthoredScenes(candidates, [{ id: "screen", start: 5, end: 11 }]);
  assert.equal(directed[0].materializationStatus, "planned");
  assert.equal(directed[1].materializationStatus, "skipped");
  assert.match(directed[1].materializationReason ?? "", /screen/);
  assert.equal(directed[2].materializationStatus, "planned");
});
