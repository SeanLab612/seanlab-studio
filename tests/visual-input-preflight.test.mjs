import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const writeJson = async (path, value) => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
};

test("visual input preflight blocks an unsafe authored recording before provider stages", async () => {
  const root = await mkdtemp(join(tmpdir(), "remotion-visual-input-preflight-"));
  const captions = join(root, "captions-source.json");
  const media = join(root, "supplemental.json");
  const scenes = join(root, "scenes.json");
  const config = join(root, "runtime.json");
  await writeJson(captions, [{ start: 0, end: 10, zh: "从这里开始到这里结束" }]);
  await writeJson(media, {
    schemaVersion: "1.0",
    assets: [{ id: "recording", clip: { in: 0, out: 5 }, publicSrc: "recording.mp4", fps: 30, width: 1920, height: 1080 }],
  });
  await writeJson(scenes, {
    schemaVersion: "1.0",
    scenes: [
      {
        id: "scene-1",
        type: "screen-evidence",
        assetId: "recording",
        startAnchor: { text: "从这里开始到这里结束" },
        endAnchor: { text: "从这里开始到这里结束" },
        required: true,
        speakerPip: { shape: "circle", preferredPosition: "top-right" },
      },
    ],
  });
  await writeJson(config, {
    editDir: root,
    semanticCaptionSourceFile: captions,
    supplementalMediaManifestFile: media,
    authoredScenePlanFile: scenes,
  });
  await assert.rejects(
    execFileAsync(process.execPath, ["--experimental-strip-types", "scripts/preflight-visual-inputs.mjs", config], {
      cwd: resolve("."),
    }),
    (error) => /INPUT_SCENE_DURATION_UNSAFE|playback rate 0\.500/.test(`${error.stderr}\n${error.stdout}`),
  );
  await assert.rejects(readFile(join(root, "visual-input-preflight.json"), "utf8"));
});
