import assert from "node:assert/strict";
import test from "node:test";
import { suggestedVisualStoryboard } from "../scripts/creator/visual-storyboard.mjs";

test("every structural and body paragraph receives an automatic visual suggestion", () => {
  const narration = {
    opening: "五种画面怎样融合成完整视频？",
    overview: "这一期我们看五种画面怎样融合成完整视频。",
    sections: [
      {
        id: "body-one",
        title: "实际流程",
        narration: "上传素材，然后写稿，最后交付。",
        visualIntent: "semantic-visual",
        visualOpportunities: [],
        materialIds: [],
        recordingInstruction: null,
      },
    ],
    conclusion: "最后总结一下，这套流程让制作过程更清楚。",
  };
  const storyboard = suggestedVisualStoryboard(narration);
  assert.deepEqual(Object.keys(storyboard.sections), [
    "opening",
    "overview",
    "body-one",
    "conclusion",
  ]);
  assert.equal(storyboard.sections.opening.mode, "auto");
  assert.ok(storyboard.sections.opening.beats.length > 0);
  assert.ok(
    Object.entries(storyboard.sections)
      .filter(([sectionId]) => sectionId !== "opening")
      .every(([, review]) => review.mode === "auto"),
  );
  assert.ok(Object.values(storyboard.sections).every((review) => review.status === "suggested"));
});

test("opening uses the same creator-reviewable visual planning as other sections", () => {
  const narration = {
    title: "实测图片转三维：一张图片能不能变成 3D 模型？",
    opening: "一张图片能不能变成 3D 模型？",
    overview: "这一期测试图片转三维模型。",
    sections: [],
    conclusion: "以上就是测试结果。",
  };
  const storyboard = suggestedVisualStoryboard(narration, {
    schemaVersion: "2.0",
    sections: {
      opening: {
        mode: "speaker",
        status: "suggested",
        componentId: "binary-versus",
        episodeTag: "图片转 3D 实测",
      },
    },
  });
  assert.equal(storyboard.sections.opening.mode, "speaker");
  assert.equal(storyboard.sections.opening.componentId, "binary-versus");
  assert.equal(storyboard.sections.opening.episodeTag, "图片转 3D 实测");
  assert.ok(storyboard.sections.opening.beats.length > 0);
});

test("one narration section may receive several non-overlapping beats and a three-image evidence group", () => {
  const narration = {
    title: "三模型实测",
    opening: "三个模型的实际生成效果怎么样？",
    overview:
      "这次我实际测试了录音机、机械车和机器人三个模型。我的整体评分是 8 分，但生成比较耗时。",
    sections: [
      {
        id: "recording-result",
        title: "录音机测试",
        narration:
          "第一个测试是录音机。生成结果保留了关键布局，我可以在浏览器里旋转和缩放。完整流程用了 59 分钟。",
        visualIntent: "screen-recording",
        visualOpportunities: [
          { form: "number-focus", evidenceText: "完整流程用了 59 分钟。" },
        ],
        materialIds: ["recording-radio"],
        recordingInstruction: "旋转录音机模型",
      },
    ],
    conclusion: "三个模型都完成了测试。",
  };
  const materials = [
    { id: "source-radio", kind: "screenshot", label: "录音机输入参考图", evidenceRole: "source" },
    { id: "source-car", kind: "screenshot", label: "机械车输入参考图", evidenceRole: "source" },
    { id: "source-robot", kind: "screenshot", label: "机器人输入参考图", evidenceRole: "source" },
    { id: "result-radio", kind: "screenshot", label: "录音机最终模型", evidenceRole: "result" },
    { id: "recording-radio", kind: "screen-recording", label: "录音机模型交互录屏" },
  ];
  const storyboard = suggestedVisualStoryboard(narration, undefined, materials);
  const imageGroup = storyboard.sections.overview.beats.find((beat) => beat.primaryVisualType === "image");
  assert.deepEqual(imageGroup.materialIds, ["source-radio", "source-car", "source-robot"]);
  assert.deepEqual(
    storyboard.sections["recording-result"].beats.map((beat) => beat.primaryVisualType),
    ["image", "screen-demo", "component"],
  );
  assert.match(storyboard.sections["recording-result"].beats[1].exactSpokenQuote, /浏览器/);
});

test("an explicitly selected screenshot is preserved before semantic animation and component suggestions", () => {
  const narration = {
    title: "介绍 SeanLab Studio",
    opening: "怎样从一个选题开始制作视频？",
    overview: "这一期介绍完整工作流。",
    sections: [
      {
        id: "start",
        title: "从创建项目开始",
        narration:
          "这一段先说明总体目的。实际开始时，先创建一个创作项目，写下这期要讲什么。后面再选择制作方式、内容分类和创作助手。",
        visualIntent: "screenshot",
        visualOpportunities: [
          {
            form: "ordered-progression",
            evidenceText: "实际开始时，先创建一个创作项目，写下这期要讲什么。",
          },
          {
            form: "category-map",
            evidenceText: "后面再选择制作方式、内容分类和创作助手。",
          },
        ],
        materialIds: ["create-project-dialog"],
        recordingInstruction: null,
      },
    ],
    conclusion: "以上就是开始方式。",
  };
  const materials = [
    { id: "create-project-dialog", kind: "screenshot", label: "创建创作项目弹窗" },
  ];

  const storyboard = suggestedVisualStoryboard(narration, undefined, materials);
  const beats = storyboard.sections.start.beats;

  assert.equal(beats[0].primaryVisualType, "image");
  assert.equal(beats[0].materialId, "create-project-dialog");
  assert.deepEqual(beats[0].materialIds, ["create-project-dialog"]);
  assert.match(beats[0].exactSpokenQuote, /先创建一个创作项目/);
  assert.doesNotMatch(beats[0].exactSpokenQuote, /总体目的/);
  assert.ok(beats.slice(1).some((beat) => ["animation", "component"].includes(beat.primaryVisualType)));
});
