import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  TERMINOLOGY_PROFILE_VERSION,
  compressViewerTitle,
  correctTerminology,
  normalizeNumbersAndUnits,
  resolveTerminologyProfile,
  validateViewerCopy,
} from "../src/terminology/index.ts";

const cases = JSON.parse(
  await readFile(new URL("./fixtures/terminology-copy-cases.json", import.meta.url), "utf8"),
) as Array<{
  domain: "ai-software" | "finance-markets" | "laboratory-biopharma";
  spoken: string;
  corrected: string;
  displaySource: string;
  expectedTitle: string;
}>;

for (const fixture of cases) {
  test(`${fixture.domain} applies only safe canonical corrections`, () => {
    const profile = resolveTerminologyProfile({ version: TERMINOLOGY_PROFILE_VERSION, domains: [fixture.domain] });
    assert.equal(correctTerminology(fixture.spoken, profile), fixture.corrected);
    assert.equal(compressViewerTitle(fixture.displaySource), fixture.expectedTitle);
  });
}

test("project overrides replace a domain entry with highest precedence", () => {
  const profile = resolveTerminologyProfile({
    version: TERMINOLOGY_PROFILE_VERSION,
    domains: ["ai-software"],
    projectOverrides: [
      {
        id: "deepseek",
        kind: "product",
        domains: ["ai-software"],
        canonicalZh: "深度求索",
        canonicalEn: "DeepSeek",
        sourceVariants: ["deep seek"],
        safeAsrCorrection: true,
      },
    ],
  });
  assert.equal(correctTerminology("使用deep seek", profile), "使用深度求索");
  assert.deepEqual(profile.precedence, ["global", "domain", "project"]);
});

test("project terminology consumes an already spoken canonical suffix once", () => {
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
  assert.equal(correctTerminology("这是 ShareLab Studio。", profile), "这是 SeanLab Studio。");
  assert.equal(correctTerminology("这是 ShareLab 的项目。", profile), "这是 SeanLab Studio 的项目。");
});

test("ai-software corrects canonical Chinese AI researcher names", () => {
  const profile = resolveTerminologyProfile({
    version: TERMINOLOGY_PROFILE_VERSION,
    domains: ["ai-software"],
  });
  assert.equal(correctTerminology("伍恩达提出了一个比喻", profile), "吴恩达提出了一个比喻");
});

test("malformed or ambiguous project terminology is rejected before captions", () => {
  assert.throws(
    () =>
      resolveTerminologyProfile({
        version: TERMINOLOGY_PROFILE_VERSION,
        domains: [],
        projectOverrides: [
          {
            id: "bad id",
            kind: "technical",
            domains: ["global"],
            canonicalZh: "术语",
            canonicalEn: "term",
            sourceVariants: ["错词"],
            safeAsrCorrection: true,
          },
        ],
      }),
    /Invalid terminology id/,
  );
});

test("caption numbers remain spoken while display copy can compact units", () => {
  assert.equal(normalizeNumbersAndUnits("上涨百分之12，变动25基点", "caption"), "上涨百分之12，变动25基点");
  assert.equal(normalizeNumbersAndUnits("上涨百分之12，变动25基点", "display-copy"), "上涨12%，变动25 bp");
});

test("viewer copy rejects production language and enforces role lengths", () => {
  assert.equal(validateViewerCopy("长期成本更低", "display-copy"), true);
  assert.equal(validateViewerCopy("仓库提供多种 product template", "display-copy"), true);
  assert.equal(validateViewerCopy("Review and revise each component", "display-copy"), true);
  assert.throws(() => validateViewerCopy("Open the review frame", "display-copy"), /production terminology/);
  assert.throws(() => validateViewerCopy("组件审核画面", "display-copy"), /production terminology/);
  assert.throws(() => validateViewerCopy("ABCDEFGHIJKLMNOPQRSTUVWXYZ123", "design-label"), /28 characters/);
});
