import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";

test("material understanding schema declares strict property types for Codex", async () => {
  const schema = JSON.parse(await readFile("schemas/material-understanding.schema.json", "utf8"));
  for (const [name, property] of Object.entries(schema.properties)) {
    assert.ok(property.type, `root property ${name} must declare a type`);
  }
  for (const collection of ["sources", "materials"]) {
    const item = schema.properties[collection].items;
    assert.equal(item.additionalProperties, false);
    assert.deepEqual(new Set(item.required), new Set(Object.keys(item.properties)));
    for (const [name, property] of Object.entries(item.properties)) {
      assert.ok(property.type, `${collection} item property ${name} must declare a type`);
    }
  }
  assert.equal(schema.properties.materials.items.properties.visibleText.items.maxLength, 50);
});

test("material understanding binds real inputs and becomes stale after intake changes", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "remotion-md-material-understanding-"));
  const previousRoot = process.env.REMOTION_MD_CREATOR_ROOT;
  process.env.REMOTION_MD_CREATOR_ROOT = root;
  try {
    const store = await import(`../scripts/creator/project-store.mjs?material-test=${Date.now()}`);
    const understanding = await import(`../scripts/creator/material-understanding.mjs?material-test=${Date.now()}`);
    const prompt = understanding.materialUnderstandingPrompt({
      project: {
        brief: {
          topic: "测试主题",
          creatorNotes: "测试说明",
          editorialBrief: { version: "1.0", status: "draft", answers: {} },
        },
      },
      sourceContext: [],
      prepared: [],
    });
    assert.match(prompt, /visibleText 每一项只能是画面中逐字可见的短文本/);
    assert.match(prompt, /不得把校对说明本身复制或改写进 visibleText/);
    await store.createCreatorProject({
      id: "material-test",
      title: "素材理解测试",
      topic: "根据真实截图介绍一个工作流",
      creatorNotes: "我会提交一张结果截图，让 Studio 看懂以后再写稿。",
      category: "github-project",
      agentId: "codex-cli",
    });
    await store.addCreatorSource({
      projectId: "material-test",
      label: "创作者笔记",
      value: "截图展示的是工作流最终审核结果。",
    });
    const sourceImage = resolve(root, "source.png");
    await writeFile(sourceImage, "test-image-bytes");
    await store.importCreatorAsset({
      projectId: "material-test",
      sourcePath: sourceImage,
      kind: "screenshot",
      label: "审核结果截图",
    });
    let attachedImages;
    const adapterFactory = () => ({
      completeJson: async ({ imagePaths }) => {
        attachedImages = imagePaths;
        return {
          schemaVersion: "1.0",
          projectSummary: "本期将依据创作者笔记和审核结果截图介绍工作流。",
          sources: [
            {
              sourceId: "source-1",
              summary: "创作者说明截图是最终审核结果。",
              keyFacts: ["截图展示工作流最终审核结果"],
              limitations: [],
            },
          ],
          materials: [
            {
              materialId: "material-1",
              summary: "一张待确认的审核结果截图。",
              visibleText: [],
              visibleActions: [],
              usableEvidence: ["可作为最终结果的画面证据"],
              suggestedUse: "用于说明工作流已经到达审核结果。",
              limitations: ["测试适配器没有执行真实 OCR"],
            },
          ],
        };
      },
      getLastRunMetadata: () => ({ provider: "test-agent" }),
    });
    const report = await understanding.analyzeMaterialUnderstanding("material-test", { adapterFactory });
    assert.equal(report.status, "suggested");
    assert.equal(attachedImages.length, 1);
    const confirmed = await understanding.confirmMaterialUnderstanding("material-test", report.inputSha256);
    assert.equal(confirmed.status, "confirmed");
    await store.addCreatorSource({
      projectId: "material-test",
      label: "补充说明",
      value: "新增内容会使旧理解卡失效。",
    });
    assert.equal((await understanding.loadMaterialUnderstanding("material-test")).status, "stale");
    await assert.rejects(
      understanding.assertConfirmedMaterialUnderstanding("material-test"),
      /重新分析并确认/,
    );
    await store.createCreatorProject({
      id: "material-retry",
      title: "素材理解重试",
      topic: "核对截图按钮",
      creatorNotes: "画面按钮文字应被原样摘录。",
      category: "github-project",
      agentId: "codex-cli",
    });
    const retrySourceImage = resolve(root, "retry-source.png");
    await writeFile(retrySourceImage, "test-image-bytes");
    await store.importCreatorAsset({
      projectId: "material-retry",
      sourcePath: retrySourceImage,
      kind: "screenshot",
      label: "按钮截图",
    });
    let attempts = 0;
    const retryAdapterFactory = () => ({
      completeJson: async ({ user }) => {
        attempts += 1;
        if (attempts === 2) assert.match(user, /上一次输出未通过确定性校验/);
        return {
          schemaVersion: "1.0",
          projectSummary: "核对按钮截图。",
          sources: [],
          materials: [
            {
              materialId: "material-1",
              summary: "按钮截图。",
              visibleText:
                attempts === 1
                  ? ["复位视角 information to be verified by creator, do not use in voice-over script"]
                  : ["复位视角"],
              visibleActions: [],
              usableEvidence: ["按钮文字可见"],
              suggestedUse: "用于介绍界面控制。",
              limitations: [],
            },
          ],
        };
      },
      getLastRunMetadata: () => ({ provider: "test-agent", attemptCount: attempts }),
    });
    const retryReport = await understanding.analyzeMaterialUnderstanding("material-retry", {
      adapterFactory: retryAdapterFactory,
    });
    assert.equal(attempts, 2);
    assert.deepEqual(retryReport.materials[0].visibleText, ["复位视角"]);

    await store.createCreatorProject({
      id: "material-correction",
      title: "素材文字校对",
      topic: "按创作者校对固定截图原文",
      creatorNotes: "校对资料应确定性覆盖模型追加的解释。",
      category: "github-project",
      agentId: "codex-cli",
    });
    await store.addCreatorSource({
      projectId: "material-correction",
      label: "按钮截图文字校对",
      value: "按钮可见文字为“复位视角”。截图中不存在其他后缀。",
    });
    await store.importCreatorAsset({
      projectId: "material-correction",
      sourcePath: retrySourceImage,
      kind: "screenshot",
      label: "按钮截图",
    });
    let correctionAttempts = 0;
    const correctionAdapterFactory = () => ({
      completeJson: async () => {
        correctionAttempts += 1;
        return {
          schemaVersion: "1.0",
          projectSummary: "核对按钮截图。",
          sources: [
            {
              sourceId: "source-1",
              summary: "创作者确认按钮文字。",
              keyFacts: ["按钮文字为复位视角"],
              limitations: [],
            },
          ],
          materials: [
            {
              materialId: "material-1",
              summary: "按钮截图。",
              visibleText: ["复位视角_viewport_state_not_reset"],
              visibleActions: [],
              usableEvidence: ["按钮文字可见"],
              suggestedUse: "用于介绍界面控制。",
              limitations: [],
            },
          ],
        };
      },
      getLastRunMetadata: () => ({ provider: "test-agent", attemptCount: correctionAttempts }),
    });
    const correctedReport = await understanding.analyzeMaterialUnderstanding("material-correction", {
      adapterFactory: correctionAdapterFactory,
    });
    assert.equal(correctionAttempts, 1);
    assert.deepEqual(correctedReport.materials[0].visibleText, ["复位视角"]);
  } finally {
    if (previousRoot === undefined) delete process.env.REMOTION_MD_CREATOR_ROOT;
    else process.env.REMOTION_MD_CREATOR_ROOT = previousRoot;
    await rm(root, { recursive: true, force: true });
  }
});
