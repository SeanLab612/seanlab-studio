import assert from "node:assert/strict";
import test from "node:test";
import { validateVisualStoryboard } from "../scripts/creator/visual-storyboard.mjs";
import {
  inferStructuralVisualForm,
  narrationStoryboardSections,
  STRUCTURAL_STORYBOARD_SECTION_IDS,
} from "../src/creator-workflow/storyboard-sections.ts";
import { visualComponentCatalog } from "../studio/contracts.js";

const narration = {
  sections: [{ id: "section-1" }, { id: "section-2" }],
};

test("visual storyboard stores human review outside the Agent narration contract", () => {
  const value = validateVisualStoryboard(
    {
      schemaVersion: "1.0",
      sections: {
        "section-1": {
          mode: "information",
          status: "confirmed",
          form: "two-way-contrast",
          componentId: "binary-versus",
        },
        "section-2": {
          mode: "material",
          status: "suggested",
          materialDisplay: "annotate",
        },
      },
    },
    narration,
  );
  assert.deepEqual(value.sections["section-1"], {
    mode: "information",
    status: "confirmed",
    executionPolicy: "reference",
    form: "two-way-contrast",
    componentId: "binary-versus",
  });
  assert.equal(value.sections["section-2"].materialDisplay, "annotate");
});

test("visual storyboard prunes stale section ids and rejects unsupported choices", () => {
  const value = validateVisualStoryboard(
    {
      schemaVersion: "1.0",
      sections: {
        "section-1": { mode: "speaker", status: "confirmed" },
        "removed-section": { mode: "speaker", status: "confirmed" },
      },
    },
    narration,
  );
  assert.deepEqual(Object.keys(value.sections), ["section-1"]);
  assert.throws(
    () =>
      validateVisualStoryboard(
        { schemaVersion: "1.0", sections: { "section-1": { mode: "video", status: "confirmed" } } },
        narration,
      ),
    /Unsupported storyboard mode/,
  );
  assert.throws(
    () =>
      validateVisualStoryboard(
        {
          schemaVersion: "1.0",
          sections: {
            "section-1": {
              mode: "information",
              status: "confirmed",
              form: "two-way-contrast",
              componentId: "process-steps",
            },
          },
        },
        narration,
      ),
    /incompatible/,
  );
});

test("visual storyboard distinguishes annotated speaker shots from strict speaker-only shots", () => {
  const value = validateVisualStoryboard(
    {
      schemaVersion: "1.0",
      sections: {
        "section-1": { mode: "speaker", status: "confirmed" },
        "section-2": { mode: "speaker-only", status: "confirmed" },
      },
    },
    narration,
  );
  assert.equal(value.sections["section-1"].mode, "speaker");
  assert.equal(value.sections["section-2"].mode, "speaker-only");
});

test("overview is reviewable and all production components have distinct UI preview variants", () => {
  const value = validateVisualStoryboard(
    {
      schemaVersion: "1.0",
      sections: {
        overview: {
          mode: "information",
          status: "confirmed",
          form: "text-emphasis",
          componentId: "rough-annotation",
        },
      },
    },
    narration,
  );
  assert.equal(value.sections.overview.componentId, "rough-annotation");
  assert.equal(visualComponentCatalog.length, 20);
  assert.equal(new Set(visualComponentCatalog.map((item) => item.previewVariant)).size, 20);
});

test("every spoken structural block participates in the visual storyboard", () => {
  const completeNarration = {
    opening: "一个想法，怎样稳定走到最终成片？",
    overview: "这一期看清写稿、审核和交付三个阶段。",
    sections: [
      {
        id: "section-1",
        title: "正文",
        narration: "正文也有自己的视觉方案。",
        visualIntent: "semantic-visual" as const,
        visualOpportunities: [],
        materialIds: [],
        recordingInstruction: null,
      },
    ],
    conclusion: "最后记住，所有口播文字都要经过画面确认。",
  };
  const sections = narrationStoryboardSections(completeNarration as never);
  assert.deepEqual(
    sections.map((section) => section.id),
    ["opening", "overview", "section-1", "conclusion"],
  );
  for (const sectionId of STRUCTURAL_STORYBOARD_SECTION_IDS) {
    const section = sections.find((item) => item.id === sectionId);
    assert.ok(section?.narration.trim());
    assert.ok(section.visualOpportunities.length > 0);
    assert.notEqual(section.visualIntent, "speaker");
  }
  const value = validateVisualStoryboard(
    {
      schemaVersion: "2.0",
      sections: Object.fromEntries(
        STRUCTURAL_STORYBOARD_SECTION_IDS.map((sectionId) => [
          sectionId,
          {
            mode: "information",
            status: "confirmed",
            form: "text-emphasis",
            componentId: "rough-annotation",
          },
        ]),
      ),
    },
    completeNarration,
  );
  assert.deepEqual(Object.keys(value.sections), [...STRUCTURAL_STORYBOARD_SECTION_IDS, "section-1"]);
  assert.deepEqual(value.sections.opening, {
    mode: "information",
    status: "confirmed",
    executionPolicy: "reference",
    form: "text-emphasis",
    componentId: "rough-annotation",
  });
  assert.equal(value.sections["section-1"].mode, "auto");
});

test("generic Chinese classifiers do not become unsupported key statistics", () => {
  assert.equal(inferStructuralVisualForm("一位创作者怎样从一个选题开始制作。"), "plain-language-claim");
  assert.equal(inferStructuralVisualForm("完成三步后交付。"), "number-focus");
});

test("visual storyboard accepts an automatic animation plan plus non-overlapping text annotations", () => {
  const detailedNarration = {
    sections: [
      {
        id: "section-1",
        narration: "素材上传后先进入候选池。只有口播确实需要证据时，才会在审稿阶段绑定。",
      },
    ],
  };
  const value = validateVisualStoryboard(
    {
      schemaVersion: "2.0",
      sections: {
        "section-1": {
          mode: "animation",
          status: "suggested",
          animationIntent: {
            prototypeId: "process-flow",
            styleProfileId: "paper-editorial",
            takeaway: "素材先成为候选，再按证据需求绑定",
            stages: [
              { id: "candidate", spokenQuote: "素材上传后先进入候选池", action: "register", label: "候选池" },
              { id: "binding", spokenQuote: "审稿阶段绑定", action: "bind", label: "审核绑定" },
            ],
          },
          annotations: [
            {
              id: "candidate-pool",
              exactSpokenQuote: "候选池",
              status: "confirmed",
              effect: "circle",
            },
            {
              id: "evidence-binding",
              exactSpokenQuote: "证据",
              status: "confirmed",
              effect: "underline",
            },
          ],
        },
      },
    },
    detailedNarration,
  );
  assert.equal(value.sections["section-1"].mode, "animation");
  assert.equal(value.sections["section-1"].animationIntent.styleProfileId, "paper-editorial");
  assert.equal(value.sections["section-1"].annotations.length, 2);
  assert.equal(value.sections["section-1"].annotations[1].effect, "underline");
});

test("visual storyboard preserves an explicit compatible component choice inside a visual beat", () => {
  const detailedNarration = {
    sections: [{ id: "section-1", narration: "黄仁勋公开表达了对开放权重的支持。" }],
  };
  const value = validateVisualStoryboard(
    {
      schemaVersion: "3.0",
      sections: {
        "section-1": {
          mode: "auto",
          status: "suggested",
          beats: [
            {
              id: "person-evidence",
              exactSpokenQuote: "黄仁勋公开表达了对开放权重的支持",
              status: "suggested",
              primaryVisualType: "component",
              semanticForm: "source-backed-evidence",
              componentId: "person-evidence-card",
              takeover: "partial",
              speakerPresence: "full",
            },
          ],
        },
      },
    },
    detailedNarration,
  );
  assert.equal(value.sections["section-1"].beats[0].componentId, "person-evidence-card");
  assert.throws(
    () =>
      validateVisualStoryboard(
        {
          schemaVersion: "3.0",
          sections: {
            "section-1": {
              mode: "auto",
              status: "suggested",
              beats: [
                {
                  ...value.sections["section-1"].beats[0],
                  componentId: "binary-versus",
                },
              ],
            },
          },
        },
        detailedNarration,
      ),
    /incompatible/,
  );
});

test("visual storyboard rejects overlapping annotations and animation without semantic intent", () => {
  const detailedNarration = { sections: [{ id: "section-1", narration: "素材上传以后先进入候选池。" }] };
  const base = {
    id: "candidate-pool",
    exactSpokenQuote: "候选池",
    status: "confirmed",
    effect: "circle",
  };
  assert.throws(
    () =>
      validateVisualStoryboard(
        {
          schemaVersion: "2.0",
          sections: {
            "section-1": { mode: "animation", status: "suggested" },
          },
        },
        detailedNarration,
      ),
    /requires animation intent/,
  );
  assert.throws(
    () =>
      validateVisualStoryboard(
        {
          schemaVersion: "2.0",
          sections: {
            "section-1": {
              mode: "auto",
              status: "suggested",
              annotations: [base, { ...base, id: "overlap-annotation", effect: "underline" }],
            },
          },
        },
        detailedNarration,
      ),
    /overlap/,
  );
});

test("legacy component emphasis and animation beats migrate into the two-layer contract", () => {
  const detailedNarration = {
    sections: [
      { id: "section-1", narration: "先写稿，再锁稿。" },
      { id: "section-2", narration: "记住锁稿。" },
    ],
  };
  const value = validateVisualStoryboard(
    {
      schemaVersion: "1.0",
      sections: {
        "section-1": {
          mode: "auto",
          status: "suggested",
          beats: [
            {
              id: "workflow-animation",
              exactSpokenQuote: "先写稿，再锁稿。",
              status: "confirmed",
              primaryVisualType: "animation",
              takeover: "full",
              speakerPresence: "circle-pip",
              animationIntent: {
                prototypeId: "process-flow",
                styleProfileId: "paper-editorial",
                takeaway: "写稿后锁稿",
                stages: [
                  { id: "draft", spokenQuote: "先写稿", action: "start", label: "写稿" },
                  { id: "lock", spokenQuote: "再锁稿", action: "finish", label: "锁稿" },
                ],
              },
            },
          ],
        },
        "section-2": {
          mode: "auto",
          status: "suggested",
          beats: [
            {
              id: "script-label",
              exactSpokenQuote: "锁稿",
              status: "confirmed",
              primaryVisualType: "component",
              semanticForm: "text-emphasis",
              takeover: "partial",
              speakerPresence: "full",
            },
          ],
        },
      },
    },
    detailedNarration,
  );
  assert.equal(value.schemaVersion, "3.0");
  assert.equal(value.sections["section-1"].mode, "animation");
  assert.equal(value.sections["section-2"].annotations[0].exactSpokenQuote, "锁稿");
});
