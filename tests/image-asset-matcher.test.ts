import assert from "node:assert/strict";
import test from "node:test";
import { matchImageAssets, recommendImageAssetOrIcon } from "../src/visual-production/image-asset-matcher.ts";

const assets = [
  {
    id: "recorder-paper",
    subject: "录音机 · paper-editorial",
    templateId: "paper-editorial",
    promotedAt: "2026-07-28T00:00:00.000Z",
  },
  {
    id: "camera",
    subject: "复古相机",
    keywords: ["相机", "拍摄设备"],
    promotedAt: "2026-07-27T00:00:00.000Z",
  },
];

test("image matcher ranks an explicit library subject before icon fallback", () => {
  const decision = recommendImageAssetOrIcon("这里用录音机演示三个处理步骤。", assets);
  assert.equal(decision.kind, "image");
  if (decision.kind !== "image") return;
  assert.equal(decision.recommended.asset.id, "recorder-paper");
  assert.deepEqual(decision.recommended.matchedTerms, ["录音机"]);
  assert.equal(decision.recommended.score, 12);
  assert.equal(decision.fallbackIconId, "system.flow");
});

test("manual image keywords carry more weight than inferred subject terms", () => {
  const matches = matchImageAssets("拍摄设备需要保持稳定，相机只是其中一种选择。", assets);
  assert.equal(matches[0].asset.id, "camera");
  assert.ok(matches[0].matchedTerms.includes("拍摄设备"));
  assert.ok(matches[0].score >= 30);
});

test("image matcher keeps the deterministic local icon when no image clears the threshold", () => {
  const first = recommendImageAssetOrIcon("分析结果趋势", assets);
  const second = recommendImageAssetOrIcon("分析结果趋势", assets);
  assert.equal(first.kind, "icon");
  assert.equal(second.kind, "icon");
  assert.equal(first.fallbackIconId, "system.line-chart");
  assert.deepEqual(first, second);
});

test("low-weight prompt-only overlap cannot displace the icon fallback", () => {
  const decision = recommendImageAssetOrIcon("需要一个抽象流程", [
    {
      id: "weak",
      subject: "未命名素材",
      prompt: "抽象流程",
    },
  ]);
  assert.equal(decision.kind, "icon");
});

test("comparison and negation mentions do not trigger an unrelated image recommendation", () => {
  assert.equal(recommendImageAssetOrIcon("机械车比录音机复杂得多。", assets).kind, "icon");
  assert.equal(recommendImageAssetOrIcon("这里不是录音机，也不像录音机。", assets).kind, "icon");
});

test("human exclusion terms override positive metadata matches", () => {
  const decision = recommendImageAssetOrIcon("手机录音也可以使用录音机完成。", [
    {
      id: "recorder",
      subject: "录音机",
      keywords: ["录音机"],
      excludedTerms: ["手机录音"],
    },
  ]);
  assert.equal(decision.kind, "icon");
  assert.match(decision.reason, /人工排除词/);
});

test("display names and applicable scenes participate in deterministic matching", () => {
  const matches = matchImageAssets("播客录音需要一台桌面设备。", [
    {
      id: "podcast-recorder",
      displayName: "桌面录音设备",
      applicableScenes: ["播客录音"],
    },
  ]);
  assert.equal(matches[0].asset.id, "podcast-recorder");
  assert.ok(matches[0].matchedTerms.includes("播客录音"));
});
