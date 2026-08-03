import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveAuthoredVisualAnchor,
  resolveAuthoredVisualRange,
} from "../src/creator-workflow/authored-visual-alignment.ts";

test("authored visual anchors prefer the full spoken passage over an earlier repeated project name", () => {
  const captions = [
    { zh: "SeanLab Video 就是我为了解决这个问题做出来的" },
    { zh: "我叫 Sean" },
    { zh: "SeanLab Video 是我持续开发" },
    { zh: "也真正用在自己视频制作里的项目" },
  ];
  const result = resolveAuthoredVisualAnchor(
    "我叫 Sean。SeanLab Video 是我持续开发，也真正用在自己视频制作里的项目。",
    captions,
  );
  assert.deepEqual({ startCue: result?.startCue, endCue: result?.endCue }, { startCue: 1, endCue: 3 });
});

test("authored visual anchors tolerate small transcription differences", () => {
  const captions = [
    { zh: "自动制作不等于自动通过" },
    { zh: "我会先连续播放 720P 预览" },
    { zh: "看剪辑有没有突然跳动" },
  ];
  const result = resolveAuthoredVisualAnchor(
    "自动制作不等于自动通过。我会先连续播放七百二十P预览，看剪辑有没有突然跳动。",
    captions,
  );
  assert.equal(result?.startCue, 0);
  assert.equal(result?.endCue, 2);
});

test("authored visual ranges bind the full reviewed section instead of only its opening words", () => {
  const captions = [
    { zh: "先说为什么要做这件事" },
    { zh: "中间解释两种方案的差别" },
    { zh: "再给出实际使用结果" },
    { zh: "最后说明它不适合谁" },
  ];
  const result = resolveAuthoredVisualRange(
    { anchorText: "先说为什么要做这件事", endAnchorText: "最后说明它不适合谁" },
    captions,
  );
  assert.deepEqual({ startCue: result?.startCue, endCue: result?.endCue }, { startCue: 0, endCue: 3 });
});
