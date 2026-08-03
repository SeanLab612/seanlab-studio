import assert from "node:assert/strict";
import test from "node:test";
import {
  buildNarrationPrompt,
  NARRATION_EDITORIAL_METHOD_VERSION,
} from "../scripts/creator/narration.mjs";

const project = (category) => ({
  brief: { topic: "介绍 SeanLab Video", category },
  materials: [],
});

test("narration prompt requires one premise and evidence-led modules", () => {
  const prompt = buildNarrationPrompt(project("tool-review"), []);
  assert.equal(NARRATION_EDITORIAL_METHOD_VERSION, "1.0");
  assert.match(prompt, /一个核心问题或判断/);
  assert.match(prompt, /二到六个自然的证据模块/);
  assert.match(prompt, /证据先于判断/);
  assert.match(prompt, /删除“成熟、完整、可靠、先进、领先、专业”等定性词/);
  assert.match(prompt, /失败、限制或未知项/);
  assert.match(prompt, /结论必须回答开头的问题/);
  assert.match(prompt, /不要把 sourceContext 的目录顺序当成口播顺序/);
});

test("category guidance distinguishes reviews from announcements and benchmark promotion", () => {
  const toolPrompt = buildNarrationPrompt(project("tool-review"), []);
  const modelPrompt = buildNarrationPrompt(project("model-review"), []);
  const newsPrompt = buildNarrationPrompt(project("news-analysis"), []);
  assert.match(toolPrompt, /代表性工作流和结果证据/);
  assert.match(modelPrompt, /不得用一次跑分代表整体可用性/);
  assert.match(newsPrompt, /不能把预测写成事实/);
});

test("media and visual forms remain silent evidence aids", () => {
  const prompt = buildNarrationPrompt(
    {
      brief: { topic: "介绍 SeanLab Video", category: "tool-review" },
      materials: [{ id: "studio-shot", type: "screenshot", description: "Studio 项目界面" }],
    },
    [],
  );
  assert.match(prompt, /截图和录屏只是候选/);
  assert.match(prompt, /不要为迁就素材重复口播或编造内容/);
  assert.match(prompt, /不得出现“使用某某组件”/);
  assert.match(prompt, /不规定整篇必须覆盖多少种形式/);
});

test("creator editorial answers control angle, first-person evidence, and optional CTA", () => {
  const prompt = buildNarrationPrompt(
    {
      brief: {
        topic: "介绍 SeanLab Video",
        category: "github-project",
        editorialBrief: {
          version: "1.0",
          status: "ready",
          answers: {
            motivation: "我想解释自己为什么做这个项目",
            relationship: "creator",
            "relationship-detail": "这是我持续使用的本地制作流程",
            audience: "独立视频创作者",
            takeaway: "自动化之后仍需要人工审核",
            "call-to-action": "",
            "project-problem": "减少重复整理剪辑资料",
            "project-evidence": "完成过一次从写稿到交付的真实项目",
            "project-focus": "experience",
            "project-boundary": "当前只面向本地个人使用",
            "project-verdict": "适合愿意审核过程的创作者",
          },
        },
      },
      materials: [],
    },
    [],
  );
  assert.match(prompt, /creatorEditorialDirection/);
  assert.match(prompt, /优先级高于资料目录顺序/);
  assert.match(prompt, /不得虚构 creatorEditorialDirection 中没有的第一人称体验/);
  assert.match(prompt, /为空时，不得自行添加关注、点赞、收藏/);
  assert.match(prompt, /真实关系和主要角度/);
});

test("approved creator lessons influence style but are not treated as episode facts", () => {
  const prompt = buildNarrationPrompt(project("github-project"), [], {
    creatorWritingGuidance: [
      { id: "problem-first-hook", guidance: "开场立刻用具体问题建立观看理由。" },
      { id: "minimal-engineering-jargon", guidance: "非必要不使用工程术语。" },
    ],
  });
  assert.match(prompt, /创作者已审核通过的长期写作偏好/);
  assert.match(prompt, /开场立刻用具体问题/);
  assert.match(prompt, /不是本期事实来源/);
});
