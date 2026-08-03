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

test("locking derives a verbatim screenshot anchor from its one bound narration section", () => {
  const project = {
    materials: [
      {
        id: "material-1",
        kind: "screenshot",
        assetId: "asset-1",
        required: false,
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

test("locking keeps unbound candidates optional and removes upload-time anchors", () => {
  const project = {
    materials: [{ id: "material-2", kind: "screenshot", required: true, anchorText: "手工填写的旧锚点" }],
  };
  const speakerOnly = {
    sections: [{ id: "section-2", narration: "这里继续人物口播。", visualIntent: "speaker", materialIds: [] }],
  };
  assert.equal(bindAuthoredMediaToNarration(project, speakerOnly), true);
  assert.equal(project.materials[0].required, false);
  assert.equal(project.materials[0].anchorText, undefined);
});

test("one registered screenshot may create several narration placements", () => {
  const project = {
    materials: [{ id: "material-1", kind: "screenshot", assetId: "asset-1", required: false }],
  };
  const repeated = {
    sections: [
      { id: "section-a", narration: "这里先展示完整工作台。", visualIntent: "screenshot", materialIds: ["material-1"] },
      { id: "section-b", narration: "后面再次放大审核区域。", visualIntent: "screenshot", materialIds: ["material-1"] },
    ],
  };
  assert.equal(bindAuthoredMediaToNarration(project, repeated), true);
  assert.equal(project.materials[0].required, true);
  assert.deepEqual(project.materials[0].anchorTexts, ["这里先展示完整工作台。", "后面再次放大审核区域。"]);
});

test("locking requires every authored media section to bind one matching available candidate", () => {
  const project = {
    materials: [{ id: "material-2", kind: "screen-recording", assetId: "asset-2", required: false }],
  };
  const unbound = {
    sections: [{ id: "section-2", narration: "这里展示操作过程。", visualIntent: "screen-recording", materialIds: [] }],
  };
  assert.throws(() => bindAuthoredMediaToNarration(project, unbound), /exactly one material before locking/);
  const mismatched = {
    sections: [
      { id: "section-2", narration: "这里展示操作过程。", visualIntent: "screenshot", materialIds: ["material-2"] },
    ],
  };
  assert.throws(() => bindAuthoredMediaToNarration(project, mismatched), /must bind a screenshot material/);
});
