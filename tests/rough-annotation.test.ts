import assert from "node:assert/strict";
import test from "node:test";
import { validateComponentProps } from "../src/visual-brief/generator.ts";

test("rough annotation capacity accepts short evidence phrases and all seven local effects", () => {
  const effects = ["highlight", "underline", "circle", "box", "crossed-off", "strike-through", "bracket"];
  for (const effect of effects) {
    assert.doesNotThrow(() =>
      validateComponentProps("rough-annotation", {
        items: [{ id: effect, text: "证据相关性", effect }],
      }),
    );
  }
});

test("rough annotation capacity rejects long copy, multiline copy, and unsupported effects", () => {
  assert.throws(
    () =>
      validateComponentProps("rough-annotation", {
        items: [{ id: "long", text: "这是一段不应该被手绘标注覆盖的长文案", effect: "highlight" }],
      }),
    /exceeds 14/,
  );
  assert.throws(
    () =>
      validateComponentProps("rough-annotation", {
        items: [{ id: "multiline", text: "第一行\n第二行", effect: "underline" }],
      }),
    /multiline/,
  );
  assert.throws(
    () => validateComponentProps("rough-annotation", { items: [{ id: "bad", text: "证据", effect: "sparkle" }] }),
    /unsupported/,
  );
});
