import assert from "node:assert/strict";
import test from "node:test";
import { mergeInferredEditorialAnswers } from "../scripts/creator/editorial-intake.mjs";

test("free-form intake accepts only answers backed by an exact creator quote", () => {
  const creatorBrief =
    "这是我自己创建并实际使用的项目。我想让独立视频创作者看到从写稿到交付的完整流程，结尾提醒大家点赞收藏。";
  const result = mergeInferredEditorialAnswers({
    category: "github-project",
    creatorBrief,
    currentBrief: {
      version: "1.0",
      status: "draft",
      answers: { audience: "独立视频创作者" },
    },
    inference: {
      answers: [
        { id: "relationship", answer: "creator", evidenceQuote: "这是我自己创建并实际使用的项目" },
        {
          id: "motivation",
          answer: "展示从写稿到交付的完整流程",
          evidenceQuote: "从写稿到交付的完整流程",
        },
        { id: "call-to-action", answer: "点赞收藏", evidenceQuote: "点赞收藏" },
        { id: "project-boundary", answer: "只适合本地使用", evidenceQuote: "这句话并不存在" },
        { id: "project-focus", answer: "unsupported-option", evidenceQuote: "完整流程" },
      ],
    },
  });

  assert.equal(result.editorialBrief.answers.relationship, "creator");
  assert.equal(result.editorialBrief.answers.audience, "独立视频创作者");
  assert.equal(result.editorialBrief.answers["call-to-action"], "点赞收藏");
  assert.equal(result.editorialBrief.answers["project-boundary"], undefined);
  assert.equal(result.editorialBrief.answers["project-focus"], undefined);
  assert.deepEqual(result.ignored, ["project-boundary", "project-focus"]);
  assert.equal(result.editorialBrief.status, "draft");
});
