import coverage from "./wenkai-gb-coverage.json" with { type: "json" };
import { typographyProfileRegistry, typographyRoleRegistry } from "./registry.ts";
import {
  TYPOGRAPHY_POLICY_VERSION,
  type TypographyDecision,
  type TypographyReasonCode,
  type TypographySelectionInput,
} from "./types.ts";

const narrativeComponents = new Set([
  "quote-source-card",
  "rough-annotation",
  "editorial-statement",
  "whole-video-title",
]);
const systemLockedRoles = new Set(["caption", "body", "metric", "label", "source"]);
const autoEligibleRoles = new Set(["display-title", "quote", "annotation"]);
const emphasisEligibleRoles = new Set(["display-title", "component-title", "quote", "annotation"]);

const isCoveredCodepoint = (codepoint: number) => {
  let low = 0;
  let high = coverage.ranges.length - 1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const [start, end] = coverage.ranges[middle];
    if (codepoint < start) high = middle - 1;
    else if (codepoint > end) low = middle + 1;
    else return true;
  }
  return false;
};

export const wenkaiSupportsText = (text: string) =>
  [...text].every((character) => /\s/u.test(character) || isCoveredCodepoint(character.codePointAt(0) ?? 0));

const normalizedLength = (text: string) => [...text.replace(/\s+/gu, "")].length;
const lineCount = (text: string) => text.split(/\r?\n/u).length;
const technicalRatio = (text: string) => {
  const characters = [...text].filter((character) => !/\s/u.test(character));
  if (!characters.length) return 0;
  return characters.filter((character) => /[A-Za-z0-9%/+\-=_.:]/u.test(character)).length / characters.length;
};

const decision = (
  input: TypographySelectionInput,
  profileId: "system-black" | "wenkai-narrative",
  reasonCode: TypographyReasonCode,
  reason: string,
): TypographyDecision => {
  const profile = typographyProfileRegistry[profileId];
  return {
    policyVersion: TYPOGRAPHY_POLICY_VERSION,
    mode: input.mode,
    profileId,
    role: input.role,
    ...(input.componentId ? { componentId: input.componentId } : {}),
    family: profile.family,
    fontWeight: profile.fontWeight,
    reasonCode,
    reason,
    fallback: profileId === "system-black" && input.mode !== "system-only",
  };
};

export const resolveTypography = (input: TypographySelectionInput): TypographyDecision => {
  const text = input.text.trim();
  const role = typographyRoleRegistry[input.role];
  if (input.mode === "system-only")
    return decision(input, "system-black", "system-mode", "项目明确锁定为仅使用系统黑体。");
  if (systemLockedRoles.has(input.role))
    return decision(input, "system-black", "system-role-locked", `${role.label}为稳定阅读角色，只允许系统黑体。`);
  if (!input.componentId || !narrativeComponents.has(input.componentId))
    return decision(input, "system-black", "component-not-eligible", "当前组件不在文楷叙事白名单中。");
  const eligibleRoles = input.mode === "auto" ? autoEligibleRoles : emphasisEligibleRoles;
  if (!eligibleRoles.has(input.role))
    return decision(input, "system-black", "auto-title-conservative", "自动模式不扩大组件标题的文楷使用范围。");
  if (normalizedLength(text) > role.maximumCharacters || lineCount(text) > role.maximumLines)
    return decision(input, "system-black", "copy-capacity", "文字长度或行数超过文楷角色容量。");
  if (technicalRatio(text) > 0.34)
    return decision(input, "system-black", "technical-copy", "英文、数字或技术符号比例过高。");
  if (!wenkaiSupportsText(text)) return decision(input, "system-black", "glyph-coverage", "生产字体不覆盖全部字符。");
  return decision(input, "wenkai-narrative", "wenkai-narrative", "叙事组件、文字角色和容量均允许文楷。");
};
