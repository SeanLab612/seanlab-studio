import assert from "node:assert/strict";
import { homedir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import {
  defaultMaterialRequired,
  importCreatorAsset,
  normalizeCreatorSource,
  normalizeLocalPath,
  validateCreatorAssetKind,
} from "../scripts/creator/project-store.mjs";

test("uploaded screenshots and recordings begin as required production evidence", () => {
  assert.equal(defaultMaterialRequired("screenshot"), true);
  assert.equal(defaultMaterialRequired("screen-recording"), true);
  assert.equal(defaultMaterialRequired("speaker-video"), true);
});

test("creator source intake trims visible labels and values", () => {
  assert.deepEqual(normalizeCreatorSource({ label: "  GitHub 仓库 ", value: " https://github.com/example/repo " }), {
    kind: "url",
    label: "GitHub 仓库",
    value: "https://github.com/example/repo",
  });
  assert.throws(() => normalizeCreatorSource({ label: "", value: "https://example.com" }), /名称/);
  assert.throws(() => normalizeCreatorSource({ label: "网站", value: "" }), /内容/);
});

test("creator asset paths accept pasted quotes and spaces", () => {
  const path = "/Users/example/素材/apple ai/demo.MOV";
  assert.equal(normalizeLocalPath(`  \"${path}\"  `), path);
  assert.equal(normalizeLocalPath(`'${path}'`), path);
});

test("creator asset paths expand home and reject empty input", () => {
  assert.equal(normalizeLocalPath("~/video.mov"), resolve(homedir(), "video.mov"));
  assert.throws(() => normalizeLocalPath("  "), /有效/);
});

test("creator asset import rejects unknown material kinds before copying", async () => {
  await assert.rejects(
    () => importCreatorAsset({ projectId: "missing-project", sourcePath: "/tmp/demo.mov", kind: "command" }),
    /不支持的素材类型/,
  );
});

test("creator asset kinds reject files that only have a matching UI label", () => {
  assert.doesNotThrow(() => validateCreatorAssetKind("/tmp/speaker.MOV", "speaker-video"));
  assert.doesNotThrow(() => validateCreatorAssetKind("/tmp/demo.mp4", "screen-recording"));
  assert.doesNotThrow(() => validateCreatorAssetKind("/tmp/result.png", "screenshot"));
  assert.throws(() => validateCreatorAssetKind("/tmp/final-script.txt", "speaker-video"), /视频文件/);
  assert.throws(() => validateCreatorAssetKind("/tmp/notes.pdf", "screenshot"), /图片文件/);
});
