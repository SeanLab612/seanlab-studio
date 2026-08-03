import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";

test("accepted writing lessons persist only canonical guidance and never episode facts", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "remotion-md-writing-profile-"));
  process.env.REMOTION_MD_CREATOR_ROOT = root;
  const projectId = "learning-test";
  const authoring = resolve(root, projectId, "authoring");
  await mkdir(authoring, { recursive: true });
  await writeFile(
    resolve(authoring, "writing-learning.json"),
    `${JSON.stringify({
      schemaVersion: "1.0",
      projectId,
      category: "github-project",
      generatedAt: new Date().toISOString(),
      summary: "本期提到了不应进入长期档案的 SeanLab Studio 事实",
      status: "suggested",
      lessonIds: ["problem-first-hook"],
      lessons: [
        {
          id: "problem-first-hook",
          guidance: "开场立刻用具体问题、变化或结果建立观看理由，不先罗列功能。",
        },
      ],
    })}\n`,
  );
  const profile = await import(`../scripts/creator/writing-profile.mjs?root=${Date.now()}`);
  const accepted = await profile.acceptWritingLessons(projectId, ["problem-first-hook"]);
  assert.equal(accepted.profile.lessons.length, 1);
  assert.equal(accepted.profile.lessons[0].id, "problem-first-hook");
  const saved = await readFile(resolve(root, ".creator-profile/writing-lessons.json"), "utf8");
  assert.doesNotMatch(saved, /SeanLab Studio/);
  assert.match(saved, /problem-first-hook/);
});
