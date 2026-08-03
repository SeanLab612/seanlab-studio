import assert from "node:assert/strict";
import test from "node:test";
import {
  contextWithDeliveryProfileOverride,
  deliveryProfileOverrideFromOptions,
} from "../scripts/workflow/delivery-profile-override.mjs";

test("delivery profile overrides are complete, delivery-only, and normalized", () => {
  assert.equal(
    deliveryProfileOverrideFromOptions({ resolution: undefined, frameRate: undefined, until: "review" }),
    undefined,
  );
  assert.throws(
    () => deliveryProfileOverrideFromOptions({ resolution: "4k", frameRate: undefined, until: "delivery" }),
    /must be provided together/,
  );
  assert.throws(
    () => deliveryProfileOverrideFromOptions({ resolution: "4k", frameRate: "source", until: "review" }),
    /require --until delivery/,
  );
  assert.deepEqual(
    deliveryProfileOverrideFromOptions({ resolution: "4k", frameRate: "30", until: "delivery" }),
    {
      schemaVersion: "1.0",
      resolution: "4k",
      frameRate: 30,
      format: "mp4",
      codec: "h264",
      mode: "selectable-profile",
      crf: 18,
    },
  );
});

test("delivery profile override changes only the in-memory workflow context", () => {
  const context = {
    manifest: {
      project: { id: "fixture" },
      render: {
        review: { width: 1280, height: 720 },
        delivery: {
          mode: "source-resolution",
          resolution: "source",
          frameRate: "source",
          codec: "h264",
          crf: 18,
        },
      },
    },
  };
  const override = deliveryProfileOverrideFromOptions({
    resolution: "4k",
    frameRate: "source",
    until: "delivery",
  });
  const derived = contextWithDeliveryProfileOverride(context, override);
  assert.equal(context.manifest.render.delivery.mode, "source-resolution");
  assert.equal(context.manifest.render.delivery.resolution, "source");
  assert.equal(derived.manifest.render.delivery.mode, "selectable-profile");
  assert.equal(derived.manifest.render.delivery.resolution, "4k");
  assert.notEqual(derived.manifest, context.manifest);
});
