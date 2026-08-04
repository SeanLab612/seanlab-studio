import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";

test("the pinned project Agent chooses image ingredients for animation stages", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "seanlab-animation-assets-"));
  const previousRoot = process.env.REMOTION_MD_CREATOR_ROOT;
  process.env.REMOTION_MD_CREATOR_ROOT = root;
  try {
    await mkdir(resolve(root, ".asset-library/images"), { recursive: true });
    await mkdir(resolve(root, "agent-plan/authoring"), { recursive: true });
    await writeFile(
      resolve(root, ".asset-library/images/registry.json"),
      JSON.stringify({
        schemaVersion: "1.0",
        assets: [
          {
            id: "recorder-paper",
            subject: "纸张录音机",
            templateId: "paper-editorial",
            file: "recorder-paper/asset.png",
          },
        ],
      }),
    );
    const { planAnimationAssets } = await import(
      `../scripts/creator/animation-asset-planner.mjs?root=${Date.now()}`
    );
    let adapterOptions;
    const storyboard = {
      schemaVersion: "3.0",
      sections: {
        workflow: {
          mode: "animation",
          status: "suggested",
          animationIntent: {
            prototypeId: "process-flow",
            styleProfileId: "paper-editorial",
            takeaway: "录音流程",
            stages: [
              {
                id: "stage-1",
                spokenQuote: "先打开录音机",
                action: "录音",
                label: "录音机",
              },
            ],
          },
        },
      },
    };
    const planned = await planAnimationAssets({
      project: {
        project: { id: "agent-plan" },
        agent: { id: "codex-cli", model: "gpt-test", fallback: "none" },
      },
      storyboard,
      adapterFactory: (options) => {
        adapterOptions = options;
        return {
          completeJson: async () => ({
            schemaVersion: "1.0",
            bindings: [
              {
                targetId: "workflow/section/stage-1",
                imageAssetId: "recorder-paper",
                reason: "录音机与阶段中的具体对象直接对应",
              },
            ],
          }),
          getLastRunMetadata: () => ({ provider: "codex-cli", model: "gpt-test" }),
        };
      },
    });
    assert.match(adapterOptions.schemaPath, /animation-asset-plan\.schema\.json$/);
    assert.equal(planned.sections.workflow.animationIntent.stages[0].imageAssetId, "recorder-paper");
    assert.match(planned.sections.workflow.animationIntent.stages[0].iconId, /^system\./);
    const report = JSON.parse(
      await readFile(resolve(root, "agent-plan/authoring/animation-asset-provider-report.json"), "utf8"),
    );
    assert.equal(report.agent.fallback, "none");
    assert.equal(report.plan.bindings[0].imageAssetId, "recorder-paper");

    await writeFile(
      resolve(root, ".asset-library/images/registry.json"),
      JSON.stringify({ schemaVersion: "1.0", assets: [] }),
    );
    let emptyInventoryCalledAgent = false;
    const fallbackStoryboard = structuredClone(storyboard);
    delete fallbackStoryboard.sections.workflow.animationIntent.stages[0].imageAssetId;
    const fallback = await planAnimationAssets({
      project: {
        project: { id: "agent-plan" },
        agent: { id: "codex-cli", model: "gpt-test", fallback: "none" },
      },
      storyboard: fallbackStoryboard,
      adapterFactory: () => {
        emptyInventoryCalledAgent = true;
        throw new Error("Agent must not run for an empty image inventory");
      },
    });
    assert.equal(emptyInventoryCalledAgent, false);
    assert.equal(fallback.sections.workflow.animationIntent.stages[0].imageAssetId, undefined);
    assert.match(fallback.sections.workflow.animationIntent.stages[0].iconId, /^system\./);
    const fallbackReport = JSON.parse(
      await readFile(resolve(root, "agent-plan/authoring/animation-asset-provider-report.json"), "utf8"),
    );
    assert.equal(fallbackReport.provider.provider, "local-icon-fallback");

    const schema = JSON.parse(await readFile(resolve("schemas/animation-asset-plan.schema.json"), "utf8"));
    assert.equal(schema.properties.schemaVersion.type, "string");
  } finally {
    if (previousRoot === undefined) delete process.env.REMOTION_MD_CREATOR_ROOT;
    else process.env.REMOTION_MD_CREATOR_ROOT = previousRoot;
    await rm(root, { recursive: true, force: true });
  }
});
