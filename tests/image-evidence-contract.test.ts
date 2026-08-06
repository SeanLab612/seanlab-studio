import assert from "node:assert/strict";
import test from "node:test";
import { bindAuthoredMediaToNarration, imageEvidenceProtectedAnchor } from "../scripts/creator/lock-handoff.mjs";

const narration = {
  sections: [
    {
      id: "section-1",
      narration: "项目创建时，还会选定参与内容理解的 Agent。选定以后，它会跟着这个项目继续。",
      visualIntent: "screenshot",
      materialIds: ["material-1"],
    },
  ],
};

test("required screenshots bind once and derive their anchor from the latest narration", () => {
  const project = {
    materials: [
      {
        id: "material-1",
        kind: "screenshot",
        assetId: "asset-1",
        required: true,
        anchorText: "项目创建时固定 Agent",
      },
    ],
  };
  assert.equal(bindAuthoredMediaToNarration(project, narration), true);
  assert.equal(project.materials[0].required, true);
  assert.match(project.materials[0].anchorText, /^项目创建时，还会选定参与内容理解的Agent/);
  assert.ok(narration.sections[0].narration.replace(/\s+/g, "").includes(project.materials[0].anchorText));
  assert.deepEqual(imageEvidenceProtectedAnchor(project.materials[0]), {
    id: "image-asset-1",
    text: project.materials[0].anchorText,
    paddingBeforeSeconds: 0.2,
    paddingAfterSeconds: 0.35,
  });
});

test("locking rejects a required uploaded visual that the narration omitted", () => {
  const project = {
    materials: [{ id: "material-2", kind: "screenshot", required: true, anchorText: "手工填写的旧锚点" }],
  };
  const speakerOnly = {
    sections: [{ id: "section-2", narration: "这里继续人物口播。", visualIntent: "speaker", materialIds: [] }],
  };
  assert.throws(() => bindAuthoredMediaToNarration(project, speakerOnly), /must bind exactly one narration section/);
});

test("one required screenshot cannot be duplicated across narration placements", () => {
  const project = {
    materials: [{ id: "material-1", kind: "screenshot", assetId: "asset-1", required: true }],
  };
  const repeated = {
    sections: [
      { id: "section-a", narration: "这里先展示完整工作台。", visualIntent: "screenshot", materialIds: ["material-1"] },
      { id: "section-b", narration: "后面再次放大审核区域。", visualIntent: "screenshot", materialIds: ["material-1"] },
    ],
  };
  assert.throws(() => bindAuthoredMediaToNarration(project, repeated), /must bind exactly one narration section/);
});

test("excluded media stays out of the handoff while a user override becomes mandatory", () => {
  const project = {
    materials: [{ id: "material-2", kind: "screen-recording", assetId: "asset-2", required: false }],
  };
  const unbound = {
    sections: [{ id: "section-2", narration: "这里展示操作过程。", visualIntent: "screen-recording", materialIds: [] }],
  };
  assert.doesNotThrow(() => bindAuthoredMediaToNarration(project, unbound));
  const bound = {
    sections: [
      { id: "section-2", narration: "这里展示操作过程。", visualIntent: "screenshot", materialIds: ["material-2"] },
    ],
  };
  assert.throws(() => bindAuthoredMediaToNarration(project, bound), /references an excluded material/);
  project.materials[0].required = true;
  assert.doesNotThrow(() => bindAuthoredMediaToNarration(project, bound));
});
