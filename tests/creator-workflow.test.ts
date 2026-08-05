import assert from "node:assert/strict";
import test from "node:test";
import {
  composeNarrationScript,
  validateCreatorProject,
  validateNarrationScriptPackage,
} from "../src/creator-workflow/contract.ts";

const narration = {
  schemaVersion: "1.0" as const,
  title: "html-video 工具测评",
  opening: "一个网页动画，为什么很难稳定输出成视频？",
  overview: "这一期我们来看一个把网页变成视频的项目。",
  sections: [
    {
      id: "project-context",
      title: "项目定位",
      narration: "它解决的是网页动画难以稳定输出视频的问题。",
      visualIntent: "semantic-visual" as const,
      visualOpportunities: [
        {
          form: "cause-to-result" as const,
          evidenceText: "它解决的是网页动画难以稳定输出视频的问题。",
        },
      ],
      materialIds: [],
      recordingInstruction: null,
    },
    {
      id: "result-demo",
      title: "成果展示",
      narration: "这里可以看到它生成后的实际画面。",
      visualIntent: "screen-recording" as const,
      visualOpportunities: [
        { form: "source-backed-evidence" as const, evidenceText: "这里可以看到它生成后的实际画面。" },
      ],
      materialIds: ["material-1"],
      recordingInstruction: "展示成果页面，不录制安装流程。",
    },
  ],
  conclusion: "它更适合需要可编排网页视觉的创作者。",
  fullScript: "",
  shootingGuide: ["先录人物口播，再按成果段录制无声画面。"],
};

test("narration package is derived from structured creator-editable sections", () => {
  narration.fullScript = composeNarrationScript(narration);
  assert.doesNotThrow(() => validateNarrationScriptPackage(narration));
  assert.throws(
    () => validateNarrationScriptPackage({ ...narration, fullScript: `${narration.fullScript}\n额外的未审计内容` }),
    /structured sections/,
  );
});

test("the canonical full script can be rebuilt from Agent sections", () => {
  const output = { ...narration, fullScript: "模型返回了一个不一致的冗余全文" };
  const normalized = { ...output, fullScript: composeNarrationScript(output) };
  assert.doesNotThrow(() => validateNarrationScriptPackage(normalized));
});

test("visual opportunities remain semantic, evidence-bound, and backward compatible", () => {
  const normalized = validateNarrationScriptPackage(narration);
  assert.equal(normalized.sections[0].visualOpportunities?.[0].form, "cause-to-result");
  assert.throws(
    () =>
      validateNarrationScriptPackage({
        ...narration,
        sections: narration.sections.map((section, index) =>
          index === 0
            ? {
                ...section,
                visualOpportunities: [{ form: "cause-to-result" as const, evidenceText: "原稿里不存在" }],
              }
            : section,
        ),
      }),
    /quote its narration exactly/,
  );
  const legacy = validateNarrationScriptPackage({
    ...narration,
    sections: narration.sections.map(({ visualOpportunities: _visualOpportunities, ...section }) => section),
  });
  assert.deepEqual(
    legacy.sections.map((section) => section.visualOpportunities),
    [[], []],
  );
});

test("narration sections may bind several required materials for downstream planning", () => {
  assert.doesNotThrow(() =>
    validateNarrationScriptPackage({
      ...narration,
      sections: narration.sections.map((section, index) =>
        index === 1 ? { ...section, materialIds: ["material-1", "material-2"] } : section,
      ),
    }),
  );
  assert.doesNotThrow(() =>
    validateNarrationScriptPackage({
      ...narration,
      sections: narration.sections.map((section, index) => (index === 1 ? { ...section, materialIds: [] } : section)),
    }),
  );
});

test("creator projects pin one Agent without fallback", () => {
  const now = new Date().toISOString();
  const project = {
    schemaVersion: "1.0" as const,
    project: {
      id: "html-video-review",
      title: "HTML Video",
      createdAt: now,
      updatedAt: now,
      status: "intake" as const,
    },
    agent: {
      id: "claude-code" as const,
      fallback: "none" as const,
      authoringContractVersion: "1.0" as const,
      semanticContractVersion: "1.1" as const,
    },
    animation: { templateId: "paper-editorial" as const, lockedAt: now },
    typography: { version: "typography-2.0" as const, mode: "auto" as const },
    brief: { topic: "介绍 html-video", category: "tool-review" as const },
    sources: [],
    materials: [],
    authoring: { state: "not-started" as const },
    video: {},
  };
  assert.equal(validateCreatorProject(project).agent.id, "claude-code");
  assert.equal(validateCreatorProject(project).animation?.templateId, "paper-editorial");
  assert.equal(
    validateCreatorProject({
      ...project,
      animation: { templateId: "stop-motion-machine", lockedAt: now },
    }).animation?.templateId,
    "paper-editorial",
  );
  assert.equal(validateCreatorProject(project).typography?.mode, "auto");
  assert.throws(
    () => validateCreatorProject({ ...project, agent: { ...project.agent, fallback: "automatic" } }),
    /fallback/,
  );
  assert.throws(
    () => validateCreatorProject({ ...project, typography: { ...project.typography, mode: "agent-selected" } }),
    /typography mode/,
  );
  assert.throws(
    () =>
      validateCreatorProject({
        ...project,
        animation: { ...project.animation, templateId: "unregistered-template" as "paper-editorial" },
      }),
    /animation template/,
  );
  assert.throws(
    () =>
      validateCreatorProject({
        ...project,
        project: { ...project.project, status: "unknown-status" as "intake" },
      }),
    /status/,
  );
  assert.throws(
    () =>
      validateCreatorProject({
        ...project,
        project: { ...project.project, id: 12 as unknown as string },
      }),
    /id/,
  );
  assert.throws(
    () =>
      validateCreatorProject({
        ...project,
        sources: [
          { id: "source-1", kind: "url", label: "A", value: "https://example.com" },
          { id: "source-1", kind: "note", label: "B", value: "duplicate" },
        ],
      }),
    /source id/,
  );
  assert.throws(
    () =>
      validateCreatorProject({
        ...project,
        authoring: { ...project.authoring, finalScript: "../outside.md" },
      }),
    /inside the project directory/,
  );
  assert.throws(
    () =>
      validateCreatorProject({
        ...project,
        video: { projectId: "html-video", manifest: "/tmp/project.json", sourceAssetId: "missing-asset" },
      }),
    /registered material asset/,
  );
});
