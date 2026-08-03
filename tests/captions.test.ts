import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCaptionChannels,
  buildVerbatimCaptions,
  correctTerminology,
  mapKeptWords,
  stripDisplayPunctuation,
} from "../src/workflow/captions.ts";
import { TERMINOLOGY_PROFILE_VERSION, resolveTerminologyProfile } from "../src/terminology/index.ts";

test("corrects domain terms without summarizing the sentence", () => {
  assert.equal(correctTerminology("使用Limits更换流动向并等待机械稳定"), "使用LIMS更换流动相并等待基线稳定");
});

test("terminology correction preserves surrounding text inside one timestamped word", () => {
  const words = [{ text: "Agent、remotion渲染", start: 0, end: 1, type: "word" }];
  const captions = buildVerbatimCaptions(words, [{ start: 0, end: 2, outputStart: 0 }], undefined, {
    maximumDurationSeconds: 4.5,
    maximumCharacters: 22,
    pauseBreakSeconds: 0.35,
    softPunctuationMinimumCharacters: 10,
    orphanMaximumCharacters: 3,
    displayPunctuation: "source",
  });
  assert.equal(captions.map((cue) => cue.zh).join(""), "Agent、Remotion渲染");
});

test("terminology correction replaces every SeanLab ASR variant across word boundaries", () => {
  const words = [
    { text: "Xi'an", start: 0, end: 0.3, type: "word" },
    { text: "Lab，", start: 0.3, end: 0.6, type: "word" },
    { text: "Xian", start: 0.8, end: 1.1, type: "word" },
    { text: " Lab，", start: 1.1, end: 1.4, type: "word" },
    { text: "Xi'anLab。", start: 1.6, end: 2, type: "word" },
  ];
  const captions = buildVerbatimCaptions(words, [{ start: 0, end: 3, outputStart: 0 }], undefined, {
    maximumDurationSeconds: 4.5,
    maximumCharacters: 40,
    pauseBreakSeconds: 0.35,
    softPunctuationMinimumCharacters: 10,
    orphanMaximumCharacters: 3,
    displayPunctuation: "source",
  });
  assert.equal(captions.map((cue) => cue.zh).join(""), "SeanLab，SeanLab，SeanLab。");
});

test("caption terminology does not duplicate a canonical suffix across ASR words", () => {
  const profile = resolveTerminologyProfile({
    version: TERMINOLOGY_PROFILE_VERSION,
    domains: [],
    projectOverrides: [
      {
        id: "seanlab-studio",
        kind: "brand",
        domains: ["global"],
        canonicalZh: "SeanLab Studio",
        canonicalEn: "SeanLab Studio",
        sourceVariants: ["ShareLab"],
        safeAsrCorrection: true,
      },
    ],
  });
  const words = [
    { text: "ShareLab", start: 0, end: 0.4, type: "word" },
    { text: " Studio", start: 0.4, end: 0.8, type: "word" },
    { text: "很好用。", start: 0.8, end: 1.2, type: "word" },
  ];
  const captions = buildVerbatimCaptions(words, [{ start: 0, end: 2, outputStart: 0 }], profile, {
    maximumDurationSeconds: 4.5,
    maximumCharacters: 40,
    pauseBreakSeconds: 0.35,
    softPunctuationMinimumCharacters: 10,
    orphanMaximumCharacters: 3,
    displayPunctuation: "source",
  });
  assert.equal(captions.map((cue) => cue.zh).join(""), "SeanLab Studio很好用。");
});

test("maps kept source words onto the edited output timeline", () => {
  const words = [
    { text: "甲", start: 10, end: 10.2, type: "word" },
    { text: "乙", start: 20, end: 20.2, type: "word" },
  ];
  const mapped = mapKeptWords(words, [
    { start: 9.9, end: 10.3, outputStart: 0 },
    { start: 19.9, end: 20.3, outputStart: 0.4 },
  ]);
  assert.deepEqual(
    mapped.map(({ text, start }) => [text, Number(start.toFixed(1))]),
    [
      ["甲", 0.1],
      ["乙", 0.5],
    ],
  );
});

test("caption text preserves every spoken word while omitting sentence punctuation", () => {
  const words = "这是完整口播。"
    .split("")
    .map((text, index) => ({ text, start: index * 0.1, end: index * 0.1 + 0.08, type: "word" }));
  const captions = buildVerbatimCaptions(words, [{ start: 0, end: 2, outputStart: 0 }]);
  assert.equal(captions.map((cue) => cue.zh).join(""), "这是完整口播");
});

test("display punctuation removal preserves semantic numeric punctuation", () => {
  assert.equal(stripDisplayPunctuation("精度 91.5，延迟 8:30；成本 1,200。"), "精度 91.5延迟 8:30成本 1,200");
});

test("semantic captions retain punctuation while display captions share timing and may omit it", () => {
  const words = "先理解任务，再选择工具。"
    .split("")
    .map((text, index) => ({ text, start: index * 0.1, end: index * 0.1 + 0.08, type: "word" }));
  const channels = buildCaptionChannels(words, [{ start: 0, end: 3, outputStart: 0 }]);
  assert.equal(channels.semantic.map((cue) => cue.zh).join(""), "先理解任务，再选择工具。");
  assert.equal(channels.display.map((cue) => cue.zh).join(""), "先理解任务再选择工具");
  assert.deepEqual(
    channels.display.map(({ start, end }) => ({ start, end })),
    channels.semantic.map(({ start, end }) => ({ start, end })),
  );
});
