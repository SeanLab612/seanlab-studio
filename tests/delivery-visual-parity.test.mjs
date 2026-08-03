import assert from "node:assert/strict";
import test from "node:test";
import {
  assertDeliveryVisualParity,
  compareDeliveryVisualParity,
} from "../scripts/operations/delivery-visual-parity.mjs";

const reviewed = {
  overlayCues: [{ id: "component-1", start: 5, end: 9 }],
  animationCues: [{ id: "animation-1", start: 12, end: 18 }],
};

test("delivery visual parity passes when reviewed primary visuals are preserved", () => {
  assert.equal(compareDeliveryVisualParity(reviewed, structuredClone(reviewed)).status, "passed");
});

test("delivery visual parity blocks an omitted reviewed animation", () => {
  const report = compareDeliveryVisualParity(reviewed, { overlayCues: reviewed.overlayCues });
  assert.equal(report.status, "failed");
  assert.deepEqual(report.omitted.map((item) => `${item.kind}:${item.id}`), ["animationCues:animation-1"]);
  assert.throws(
    () => assertDeliveryVisualParity(reviewed, { overlayCues: reviewed.overlayCues }),
    (error) => error.operationalCode === "DELIVERY_VISUAL_PARITY_FAILED",
  );
});

test("delivery visual parity accepts only an explicit reasoned fallback", () => {
  const delivery = {
    overlayCues: reviewed.overlayCues,
    visualDeliveryFallbacks: [
      {
        reviewKind: "animationCues",
        reviewCueId: "animation-1",
        replacementKind: "speaker",
        reason: "Creator explicitly chose the speaker shot for final delivery.",
      },
    ],
  };
  assert.equal(compareDeliveryVisualParity(reviewed, delivery).status, "passed");
});
