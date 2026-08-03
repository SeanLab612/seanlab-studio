import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { typographyProfileRegistry, typographyRoleRegistry } from "../src/typography-policy/registry.ts";
import { resolveTypography, wenkaiSupportsText } from "../src/typography-policy/selector.ts";

const choose = (
  mode: "auto" | "system-only" | "wenkai-emphasis",
  role:
    | "caption"
    | "display-title"
    | "component-title"
    | "body"
    | "metric"
    | "label"
    | "source"
    | "quote"
    | "annotation",
  text: string,
  componentId?: "quote-source-card" | "rough-annotation" | "whole-video-title",
) => resolveTypography({ mode, role, text, componentId });

test("typography policy keeps reading roles on the system profile", () => {
  for (const role of ["caption", "body", "metric", "label", "source"] as const) {
    const result = choose("wenkai-emphasis", role, "稳定清晰的正文 72%");
    assert.equal(result.profileId, "system-black");
    assert.equal(result.reasonCode, "system-role-locked");
  }
  assert.deepEqual(typographyRoleRegistry.caption.allowedProfiles, ["system-black"]);
});

test("auto mode uses WenKai only for bounded narrative roles", () => {
  assert.equal(
    choose("auto", "quote", "不是越多越好，而是每一处都有依据。", "quote-source-card").profileId,
    "wenkai-narrative",
  );
  assert.equal(choose("auto", "annotation", "重点看证据", "rough-annotation").profileId, "wenkai-narrative");
  assert.equal(choose("auto", "display-title", "把复杂内容讲清楚", "whole-video-title").profileId, "wenkai-narrative");
  assert.equal(choose("auto", "component-title", "引用证据", "quote-source-card").profileId, "system-black");
});

test("WenKai emphasis expands only eligible component titles", () => {
  assert.equal(
    choose("wenkai-emphasis", "component-title", "引用证据", "quote-source-card").profileId,
    "wenkai-narrative",
  );
  assert.equal(
    resolveTypography({
      mode: "wenkai-emphasis",
      role: "component-title",
      text: "关键数据",
      componentId: "key-stat-summary",
    }).reasonCode,
    "component-not-eligible",
  );
});

test("capacity, technical copy, missing glyphs, and explicit system mode fall back safely", () => {
  assert.equal(
    choose(
      "auto",
      "quote",
      "这是一段明显超过四十四个字符容量的引用文字，需要确保任何真实项目都不会因为字体风格而挤压布局安全区域。",
      "quote-source-card",
    ).reasonCode,
    "copy-capacity",
  );
  assert.equal(
    choose("auto", "display-title", "Agent API v2.5 / 96% PASS", "whole-video-title").reasonCode,
    "technical-copy",
  );
  assert.equal(
    choose("auto", "display-title", `未覆盖字符${String.fromCodePoint(0x10ffff)}`, "whole-video-title").reasonCode,
    "glyph-coverage",
  );
  assert.equal(choose("system-only", "quote", "任何文字", "quote-source-card").reasonCode, "system-mode");
  assert.equal(wenkaiSupportsText(String.fromCodePoint(0x10ffff)), false);
});

test("production WenKai font and coverage are frozen to the registered release", async () => {
  const profile = typographyProfileRegistry["wenkai-narrative"];
  const bytes = await readFile(resolve("public", profile.file));
  assert.equal(createHash("sha256").update(bytes).digest("hex"), profile.sha256);
  const coverage = JSON.parse(await readFile(resolve("src/typography-policy/wenkai-gb-coverage.json"), "utf8"));
  assert.equal(coverage.sourceSha256, profile.sha256);
  assert.equal(coverage.codepointCount, 46_490);
  assert.ok(coverage.ranges.length > 2_000);
});
