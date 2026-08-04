import assert from "node:assert/strict";
import test from "node:test";
import {
  createExistingNarrationPackage,
  spokenTextFromInputScript,
} from "../scripts/creator/narration.mjs";

test("existing-video mode removes subtitle timing but preserves every spoken sentence", () => {
  const subtitle = `WEBVTT

1
00:00:00.000 --> 00:00:02.000
第一句介绍主题。

2
00:00:02.000 --> 00:00:04.000
第二句提出问题。第三句补充背景。

3
00:00:04.000 --> 00:00:07.000
第四句解释机制。第五句给出结果。第六句完成总结。`;
  const spoken = spokenTextFromInputScript(subtitle);
  assert.equal(
    spoken,
    "第一句介绍主题。\n第二句提出问题。第三句补充背景。\n第四句解释机制。第五句给出结果。第六句完成总结。",
  );
  const narration = createExistingNarrationPackage({ title: "已有视频测试", inputScript: subtitle });
  assert.equal(narration.sections.length, 2);
  for (const sentence of ["第一句介绍主题。", "第二句提出问题。", "第三句补充背景。", "第四句解释机制。", "第五句给出结果。", "第六句完成总结。"]) {
    assert.equal(narration.fullScript.includes(sentence), true);
  }
  assert.deepEqual(narration.shootingGuide, ["使用已经录制的口播原片，不需要重新拍摄；后续仅设计视觉方案和特效。"]);
});
