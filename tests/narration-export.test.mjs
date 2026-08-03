import assert from "node:assert/strict";
import test from "node:test";
import {
  narrationMarkdown,
  narrationPlainText,
  narrationPrintHtml,
} from "../scripts/creator/narration-export.mjs";

const narration = {
  title: "SeanLab Video",
  fullScript: "大家好，这里是 SeanLab。",
  shootingGuide: ["看镜头", "保留停顿"],
};

test("narration exports remain local, readable, and print-to-PDF ready", () => {
  assert.match(narrationMarkdown(narration), /^# SeanLab Video/m);
  assert.match(narrationMarkdown(narration), /- 看镜头/);
  assert.match(narrationPlainText(narration), /1\. 看镜头/);
  assert.match(narrationPrintHtml(narration), /window\.print/);
  assert.match(narrationPrintHtml(narration), /存储为 PDF/);
});
