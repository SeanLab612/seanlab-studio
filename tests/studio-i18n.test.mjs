import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import * as contracts from "../studio/contracts.js";
import { supportedLocales, translateText } from "../studio/i18n.js";

const containsHan = (value) => /[\u3400-\u9fff]/u.test(value);

const stringsIn = (value) => {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(stringsIn);
  if (value && typeof value === "object") return Object.values(value).flatMap(stringsIn);
  return [];
};

test("Studio supports Simplified Chinese and English", () => {
  assert.deepEqual(supportedLocales, ["zh-CN", "en"]);
  assert.equal(translateText("设置", "zh-CN"), "设置");
  assert.equal(translateText("设置", "en"), "Settings");
  assert.equal(translateText("已添加 3 份素材", "en"), "3 assets added");
  assert.equal(translateText("查看制作进度，已完成 52%", "en"), "View production progress, 52% complete");
  assert.equal(
    translateText("codex-cli 0.144.0 · 已通过 1 · 待审核 0", "en"),
    "codex-cli 0.144.0 · 1 approved · 0 pending review",
  );
});

test("every Chinese Studio contract label has an English presentation", () => {
  const untranslated = Object.values(contracts)
    .flatMap(stringsIn)
    .filter(containsHan)
    .filter((value) => translateText(value, "en") === value);
  assert.deepEqual([...new Set(untranslated)], []);
});

test("Studio shell exposes the global locale switch", async () => {
  const [html, app, i18n] = await Promise.all([
    readFile(new URL("../studio/index.html", import.meta.url), "utf8"),
    readFile(new URL("../studio/app.js", import.meta.url), "utf8"),
    readFile(new URL("../studio/i18n.js", import.meta.url), "utf8"),
  ]);
  assert.match(html, /id="language-toggle"/);
  assert.match(app, /startI18n\(\)/);
  assert.match(app, /\$\("#language-toggle"\)\.onclick = switchLocale/);
  assert.match(i18n, /attributes: true/);
  assert.match(i18n, /attributeFilter: translatedAttributes/);
});
