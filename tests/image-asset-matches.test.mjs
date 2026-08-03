import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

test("project animation stages prefer compatible image assets and retain an auditable icon fallback", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "seanlab-image-matches-"));
  try {
    await mkdir(resolve(root, ".asset-library/images"), { recursive: true });
    await writeFile(
      resolve(root, ".asset-library/images/registry.json"),
      JSON.stringify({
        schemaVersion: "1.0",
        assets: [
          {
            id: "recorder-paper",
            subject: "录音机 · paper-editorial",
            templateId: "paper-editorial",
            file: "recorder-paper/asset.png",
            promotedAt: "2026-07-28T00:00:00.000Z",
          },
        ],
      }),
    );
    const script = `
      import { buildProjectImageAssetMatches } from ${JSON.stringify(new URL("../scripts/creator/image-asset-matches.mjs", import.meta.url).href)};
      const result = await buildProjectImageAssetMatches({
        narration: {
          opening: "直接提出本期问题",
          overview: "本期介绍",
          transitionAnchor: "进入正文",
          sections: [{
            id: "recorder",
            title: "录音机测试",
            narration: "这里用录音机测试图片素材匹配。录音机还会进入第二个画面。",
            visualIntent: "semantic-visual",
            visualOpportunities: [],
            materialIds: [],
            recordingInstruction: null
          }],
          conclusion: "总结"
        },
        storyboard: {
          sections: {
            recorder: {
              beats: [{
                id: "recorder-beat-1",
                exactSpokenQuote: "这里用录音机测试图片素材匹配。",
                primaryVisualType: "animation",
                animationIntent: {
                  prototypeId: "process-flow",
                  styleProfileId: "paper-editorial",
                  takeaway: "录音机测试",
                  stages: [{
                    id: "stage-1",
                    spokenQuote: "这里用录音机测试图片素材匹配。",
                    action: "进入动画",
                    label: "录音机"
                  }]
                }
              }, {
                id: "recorder-beat-2",
                exactSpokenQuote: "录音机还会进入第二个画面。",
                primaryVisualType: "component"
              }]
            }
          }
        }
      });
      process.stdout.write(JSON.stringify(result));
    `;
    const { stdout } = await promisify(execFile)(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", script], {
      cwd: process.cwd(),
      env: { ...process.env, REMOTION_MD_CREATOR_ROOT: root },
    });
    const matches = JSON.parse(stdout);
    const recorder = matches.find((item) => item.beatId === "recorder-beat-1");
    assert.equal(matches.length, 1);
    assert.equal(recorder.stageId, "stage-1");
    assert.equal(recorder.styleProfileId, "paper-editorial");
    assert.equal(recorder.decision.kind, "image");
    assert.equal(recorder.decision.recommended.asset.id, "recorder-paper");
    assert.match(recorder.decision.reason, /用于动画阶段/);
    assert.match(recorder.decision.fallbackIconId, /^system\./);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
