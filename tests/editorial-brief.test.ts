import assert from "node:assert/strict";
import test from "node:test";
import {
  EDITORIAL_BRIEF_VERSION,
  PUBLIC_CREATOR_CATEGORIES,
  createEmptyEditorialBrief,
  editorialBriefPrompt,
  editorialQuestionnaire,
  missingEditorialAnswers,
  normalizeEditorialBrief,
} from "../src/creator-workflow/editorial-brief.ts";

const completeAnswers = (category: "github-project" | "news-analysis" | "tutorial") =>
  Object.fromEntries(
    [...editorialQuestionnaire(category).universal, ...editorialQuestionnaire(category).categorySpecific].map(
      (question) => [question.id, question.options?.[0]?.value ?? `${question.label}的创作者答案`],
    ),
  );

test("new creator entry exposes only the three approved directions", () => {
  assert.deepEqual(
    PUBLIC_CREATOR_CATEGORIES.map((category) => category.id),
    ["github-project", "news-analysis", "tutorial"],
  );
});

test("editorial brief asks creators for only three core direction answers", () => {
  const empty = createEmptyEditorialBrief();
  assert.equal(empty.status, "draft");
  assert.deepEqual(
    missingEditorialAnswers("github-project", empty).map((item) => item.id),
    ["relationship-detail", "audience", "takeaway"],
  );

  const complete = normalizeEditorialBrief("github-project", {
    version: EDITORIAL_BRIEF_VERSION,
    status: "draft",
    answers: {
      "relationship-detail": "我已经实际使用并完成了一轮测试",
      audience: "对 AI 工具感兴趣的创作者",
      takeaway: "这个工具可以使用，但要接受时间成本",
    },
  });
  assert.equal(complete.status, "ready");
  assert.deepEqual(missingEditorialAnswers("github-project", complete), []);
});

test("optional inferred category evidence remains available to the narration prompt", () => {
  const normalized = normalizeEditorialBrief("github-project", {
    version: EDITORIAL_BRIEF_VERSION,
    status: "draft",
    answers: {
      "relationship-detail": "我已经实际使用并完成了一轮测试",
      audience: "对 AI 工具感兴趣的创作者",
      takeaway: "这个工具可以使用，但要接受时间成本",
      "project-evidence": "我用三张参考图生成了三个模型",
    },
  });
  assert.equal(normalized.status, "ready");
  assert.ok(editorialBriefPrompt("github-project", normalized).some((item) => item.id === "project-evidence"));
});

test("only registered questions and select values enter the writing direction", () => {
  assert.throws(
    () =>
      normalizeEditorialBrief("github-project", {
        version: EDITORIAL_BRIEF_VERSION,
        status: "draft",
        answers: { ...completeAnswers("github-project"), relationship: "invented-relation" },
      }),
    /选项无效/,
  );
  const normalized = normalizeEditorialBrief("tutorial", {
    version: EDITORIAL_BRIEF_VERSION,
    status: "draft",
    answers: { ...completeAnswers("tutorial"), unknown: "must not pass through" },
  });
  assert.equal(normalized.answers.unknown, undefined);
  assert.ok(editorialBriefPrompt("tutorial", normalized).every((item) => item.question !== "unknown"));
});
