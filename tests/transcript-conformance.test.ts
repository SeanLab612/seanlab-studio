import assert from "node:assert/strict";
import test from "node:test";
import { stripDisplayPunctuation } from "../src/workflow/captions.ts";
import {
  conformEnglishTermsToLockedScript,
  conformTranscriptToLockedScript,
  extractLockedScriptText,
} from "../src/workflow/transcript-conformance.ts";

const transcript = (text: string) => ({
  text,
  words: [...text].map((character, index) => ({
    text: character,
    start: index * 0.1,
    end: (index + 1) * 0.1,
    type: "word",
  })),
});

test("locked narration helper removes the markdown title", () => {
  assert.equal(extractLockedScriptText("# 标题\n\nhi,大家好。"), "hi,大家好。");
});

test("corrects a context-bound Latin project name without changing timing", () => {
  const raw = transcript("今天我们来介绍西安lab这个项目的完整工作流程。");
  const { transcript: corrected, report } = conformTranscriptToLockedScript(
    raw,
    "# SeanLab Video\n\n今天我们来介绍SeanLab这个项目的完整工作流程。",
  );
  assert.match(corrected.text ?? "", /SeanLab/u);
  assert.equal(report.changes.length, 1);
  assert.equal(report.changes[0].reason, "script-term");
  assert.equal(corrected.words[0].start, raw.words[0].start);
  assert.equal(corrected.words.at(-1)?.end, raw.words.at(-1)?.end);
});

test("script punctuation does not break a context-bound project-name correction", () => {
  const raw = transcript("最明显的是机身顶部旋钮还有西安lab项目和红色按钮");
  const { transcript: corrected, report } = conformTranscriptToLockedScript(
    raw,
    "# 测试\n\n最明显的是机身、顶部旋钮，还有SeanLab项目和红色按钮。",
  );
  assert.match(corrected.text ?? "", /SeanLab/u);
  assert.ok(report.changes.some((change) => change.reason === "script-term"));
});

test("normalizes misheard English names in sequence while preserving Chinese wording", () => {
  const parts = ["我测试过", "Mixure", "然后连接", "Blender", "和", "MCP", "，它的问题很准确。"];
  const raw = {
    text: parts.join(""),
    words: parts.map((text, index) => ({
      text,
      start: index,
      end: index + 0.8,
      type: "word",
    })),
  };
  const { transcript: corrected, report } = conformTranscriptToLockedScript(
    raw,
    "# 测试\n\n我测试过 Meshy，然后连接 Blender 和 MCP，它的问题很明确。",
  );
  assert.match(corrected.text ?? "", /Meshy/u);
  assert.match(corrected.text ?? "", /问题很准确/u);
  assert.ok(report.changes.every((change) => change.reason === "script-term"));
});

test("caption-only English conformance does not alter the upstream transcript", () => {
  const words = [
    { text: "比较", start: 0, end: 0.4, type: "word" },
    { text: "Mixure", start: 0.4, end: 1, type: "word" },
  ];
  const result = conformEnglishTermsToLockedScript(words, "# 测试\n\n比较 Meshy。");
  assert.equal(result.words[1].text, "Meshy");
  assert.equal(words[1].text, "Mixure");
  assert.equal(result.changes.length, 1);
});

test("viewer captions preserve dots inside English technical names", () => {
  assert.equal(stripDisplayPunctuation("创建 THREE.Group，并展示 Three.js。"), "创建 THREE.Group并展示 Three.js");
});

test("preserves a real spoken deviation instead of forcing the locked wording", () => {
  const raw = transcript("这里我实际用了三天，最后还是放弃了。");
  const { transcript: corrected, report } = conformTranscriptToLockedScript(
    raw,
    "# 测试\n\n这里我实际用了三天，最后决定继续使用。",
  );
  assert.equal(corrected.text, raw.text);
  assert.equal(report.changes.length, 0);
});

test("skips safely when a video project has no locked narration reference", () => {
  const raw = transcript("保留原始转录。");
  const result = conformTranscriptToLockedScript(raw);
  assert.equal(result.transcript.text, raw.text);
  assert.equal(result.report.status, "skipped");
});
