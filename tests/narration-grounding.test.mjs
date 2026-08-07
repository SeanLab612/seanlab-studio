import assert from "node:assert/strict";
import test from "node:test";
import {
  assertPerspectiveRewritePreservesProductionContract,
  assertNarrationSourceGrounding,
  assertUsableSourceContext,
  auditNarrationPerspective,
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
  assert.match(prompt, /允许短句和现场感/);
  assert.match(prompt, /不能暗含新的产品能力、数据、评价或来源外结论/);
  assert.match(prompt, /写稿阶段不生成视觉方案/);
  assert.match(prompt, /不得出现“使用某某组件”/);
  assert.match(prompt, /每个 required 素材 id 必须且只能写入一个语义最匹配的 section\.materialIds/);
  assert.match(prompt, /一个 section 可以承接多份相关素材/);
  assert.match(prompt, /不要决定时间码、布局、组件、动画、裁剪方式或素材出现顺序/);
  assert.match(prompt, /录屏演示可以直接讲界面、用户动作和操作结果/);
  assert.match(prompt, /不要因为素材来自录屏就删掉这条叙事链/);
  assert.match(prompt, /从录屏中可以看到/);
  assert.match(prompt, /具备 20 种已审批信息组件和 10 种数据图表形式/);
  assert.match(prompt, /观点陈述/);
  assert.match(prompt, /适合信息组件的表达触发条件/);
  assert.match(prompt, /不是覆盖指标/);
  for (const componentId of Object.keys(approvedComponentRegistry)) assert.doesNotMatch(prompt, new RegExp(componentId));
});

test("narration perspective audit preserves direct walkthrough narration", () => {
  const walkthrough = narrationOutputForPerspective(
    "我们可以看到设计工具的界面。点击一个模板，进入设计，再输入我们的需求。",
  );
  assert.equal(auditNarrationPerspective(walkthrough).needsReview, false);
});

test("narration perspective audit finds source-observer and generic AI scaffolding", () => {
  const reportStyle = narrationOutputForPerspective(
    "从上传的录屏中可以看到一个输入框。值得注意的是，这段材料反映了模板选择能力。",
  );
  const audit = auditNarrationPerspective(reportStyle);
  assert.equal(audit.needsReview, true);
  assert.ok(audit.signals.some((item) => item.kind === "source-observer"));
  assert.ok(audit.signals.some((item) => item.kind === "generic-ai-scaffolding"));
});

test("perspective rewrite cannot change production bindings", () => {
  const before = narrationOutputForPerspective("打开页面后，左侧是输入区域。");
  const after = structuredClone(before);
  after.sections[0].narration = "打开页面，左侧就是输入区域。";
  assert.doesNotThrow(() => assertPerspectiveRewritePreservesProductionContract(before, after));
  after.sections[0].materialIds = ["different-material"];
  assert.throws(() => assertPerspectiveRewritePreservesProductionContract(before, after), /素材绑定或生产字段/);
});

function narrationOutputForPerspective(narration) {
  return {
    schemaVersion: "1.0",
    title: "设计工具演示",
    opening: "设计工具怎么开始设计？",
    overview: "这里直接走一遍完整操作。",
    sections: [
      {
        id: "walkthrough",
        title: "进入设计",
        narration,
        visualIntent: "semantic-visual",
        visualOpportunities: [],
        materialIds: ["screen-1"],
        recordingInstruction: null,
      },
    ],
    conclusion: "这就是从模板进入设计的过程。",
    fullScript: "",
    shootingGuide: ["展示已登记录屏。"],
  };
}

test("visual authoring forms cover every approved component without exposing component ids to the Agent", () => {
  const coverage = NARRATION_VISUAL_FORMS.flatMap((form) => form.componentCoverage).sort();
  assert.deepEqual(coverage, Object.keys(approvedComponentRegistry).sort());
});

test("narration qualifier terms remain visible for audit without acting as a hard blocker", () => {
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
  const report = assertNarrationSourceGrounding({
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
  });
  assert.deepEqual(new Set(report.unsupportedQualifierTerms), new Set(["开源", "工具", "受欢迎"]));
  assert.deepEqual(report.unsupportedNumberClaims, []);
});

test("narration deterministic grounding still blocks unsupported exact numbers and unknown material ids", () => {
  const base = {
    schemaVersion: "1.0",
    title: "项目介绍",
    opening: "这个项目如何工作？",
    overview: "这里看它的完整过程。",
    sections: [
      {
        id: "one",
        title: "入口",
        narration: "它有 12 个入口。",
        visualIntent: "semantic-visual",
        visualOpportunities: [],
        materialIds: [],
        recordingInstruction: null,
      },
      {
        id: "two",
        title: "结果",
        narration: "访客可以输入文字。",
        visualIntent: "semantic-visual",
        visualOpportunities: [],
        materialIds: [],
        recordingInstruction: null,
      },
    ],
    conclusion: "最后回到输入本身。",
    fullScript: "",
    shootingGuide: ["展示现有素材。"],
  };
  assert.throws(
    () =>
      assertNarrationSourceGrounding({
        narration: base,
        project: { ...project, materials: [] },
        sourceContext: [{ status: "resolved", label: "README", content: "访客可以输入文字。" }],
      }),
    /无法核对的明确数字：12/,
  );
  assert.throws(
    () =>
      assertNarrationSourceGrounding({
        narration: {
          ...base,
          sections: base.sections.map((section, index) =>
            index === 0 ? { ...section, narration: "访客可以输入文字。", materialIds: ["missing"] } : section,
          ),
        },
        project: { ...project, materials: [] },
        sourceContext: [{ status: "resolved", label: "README", content: "访客可以输入文字。" }],
      }),
    /不存在的素材：missing/,
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
