import assert from "node:assert/strict";
import test from "node:test";
import {
  assertNarrationSourceGrounding,
  assertUsableSourceContext,
  buildNarrationPrompt,
} from "../scripts/creator/narration.mjs";
import { approvedComponentRegistry } from "../src/components/library/registry.ts";
import { NARRATION_VISUAL_FORMS } from "../src/creator-workflow/visual-authoring.ts";

const project = {
  agent: { id: "claude-code", fallback: "none" },
  brief: { topic: "介绍 remotion-md", category: "tool-review" },
  sources: [{ id: "source-1", label: "项目仓库", kind: "url", value: "https://github.com/example/repo" }],
  materials: [],
};

test("narration stops before Agent execution when every registered source failed", () => {
  assert.throws(
    () =>
      assertUsableSourceContext(project.sources, [
        { id: "source-1", label: "项目仓库", kind: "url", status: "failed", error: "HTTP 404" },
      ]),
    /已停止写稿.*HTTP 404/,
  );
});

test("narration accepts at least one resolved source and forbids generic project claims in its prompt", () => {
  const sourceContext = [
    { id: "source-1", label: "项目仓库", kind: "url", status: "resolved", content: "README: resumable workflow" },
    { id: "source-2", label: "失效页面", kind: "url", status: "failed", error: "HTTP 404" },
  ];
  assert.doesNotThrow(() => assertUsableSourceContext(project.sources, sourceContext));
  const prompt = buildNarrationPrompt(project, sourceContext);
  assert.match(prompt, /真实工作流、核心能力、差异化优点和限制/);
  assert.match(prompt, /不得用常识补齐/);
  assert.match(prompt, /不得把 Star、下载量、用户数等指标推断/);
  assert.match(prompt, /原始口播原话/);
  assert.match(prompt, /允许短句和现场感/);
  assert.match(prompt, /不能暗含新的产品能力、数据、评价或来源外结论/);
  assert.match(prompt, /可用于组织口播内容的语义视觉形式/);
  assert.match(prompt, /不得为了覆盖形式增加无关内容/);
  assert.match(prompt, /不得出现“使用某某组件”/);
  assert.match(prompt, /evidenceText 必须逐字摘自同一 section\.narration/);
  assert.match(prompt, /section\.materialIds 最多记录一个首选素材/);
  assert.match(prompt, /一组直接相关的截图可以由下游合并成一个图片节拍/);
  assert.match(prompt, /录屏必须只覆盖它能够证明的短句/);
  for (const componentId of Object.keys(approvedComponentRegistry)) assert.doesNotMatch(prompt, new RegExp(componentId));
});

test("visual authoring forms cover every approved component without exposing component ids to the Agent", () => {
  const coverage = NARRATION_VISUAL_FORMS.flatMap((form) => form.componentCoverage).sort();
  assert.deepEqual(coverage, Object.keys(approvedComponentRegistry).sort());
});

test("narration source grounding blocks unsupported project claims before persistence", () => {
  const narration = {
    schemaVersion: "1.0",
    title: "四千星开源工具",
    opening: "这个项目的星标数量能说明什么？",
    overview: "这个项目有四千个星。",
    sections: [
      {
        id: "stars",
        title: "GitHub 数据",
        narration: "它在 GitHub 上大约有四千个星。",
        visualIntent: "screenshot",
        materialIds: ["material-1"],
        recordingInstruction: null,
      },
    ],
    conclusion: "这是一个受欢迎的开源工具。",
    fullScript: "",
    shootingGuide: [],
  };
  assert.throws(
    () =>
      assertNarrationSourceGrounding({
        narration,
        project: {
          ...project,
          brief: { topic: "说明项目在 GitHub 上大约有四千个星", category: "tool-review" },
          materials: [{ id: "material-1", label: "GitHub 截图", description: "显示 4K Stars" }],
        },
        sourceContext: [
          {
            id: "source-1",
            label: "原始口播",
            kind: "note",
            status: "resolved",
            content: "这个项目在 GitHub 上已经大约有四千个星。",
          },
        ],
      }),
    /开源.*受欢迎|受欢迎.*开源/,
  );
});

test("rewrite prompt bundles current narration and explicit creator instructions", () => {
  const currentNarration = { title: "旧稿", sections: [{ title: "泛泛介绍" }] };
  const prompt = buildNarrationPrompt(
    project,
    [{ id: "source-1", label: "项目仓库", kind: "url", status: "resolved", content: "真实项目工作流" }],
    { currentNarration, rewriteInstructions: "重点讲静态审核和可恢复执行" },
  );
  assert.match(prompt, /这是需要重写的当前稿件/);
  assert.match(prompt, /旧稿/);
  assert.match(prompt, /重点讲静态审核和可恢复执行/);
});
