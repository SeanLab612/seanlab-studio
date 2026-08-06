import assert from "node:assert/strict";
import test from "node:test";
import {
  estimateDelivery,
  normalizeDeliveryProfile,
  resolveDeliveryProfile,
} from "../scripts/creator/delivery-profile.mjs";

const source4k60 = { width: 3840, height: 2160, fps: 60 };

test("delivery profile only accepts the approved MP4 H.264 resolution and fps matrix", () => {
  assert.equal(normalizeDeliveryProfile({ resolution: "720p", frameRate: 30 }).resolution, "720p");
  assert.deepEqual(normalizeDeliveryProfile({ resolution: "2k", frameRate: 30 }), {
    schemaVersion: "1.0",
    resolution: "2k",
    frameRate: 30,
    format: "mp4",
    codec: "h264",
  });
  assert.throws(() => normalizeDeliveryProfile({ resolution: "8k", frameRate: 30 }), /不支持的成片分辨率/);
  assert.throws(() => normalizeDeliveryProfile({ resolution: "4k", frameRate: 24 }), /不支持的成片帧率/);
});

test("delivery profile avoids meaningless upscaling and duplicated frames", () => {
  const effective = resolveDeliveryProfile({
    profile: { resolution: "4k", frameRate: 60 },
    source: { width: 1920, height: 1080, fps: 30 },
  });
  assert.equal(effective.width, 1920);
  assert.equal(effective.height, 1080);
  assert.equal(effective.fps, 30);
  assert.equal(effective.warnings.length, 2);
});

test("720p is available as a lightweight preview delivery profile", () => {
  const effective = resolveDeliveryProfile({
    profile: { resolution: "720p", frameRate: 30 },
    source: source4k60,
  });
  assert.equal(effective.width, 1280);
  assert.equal(effective.height, 720);
  assert.equal(effective.fps, 30);
});

test("historical estimator is calibrated to the completed html 4K60 delivery", () => {
  const estimate = estimateDelivery({
    profile: { resolution: "4k", frameRate: 60 },
    source: source4k60,
    durationSeconds: 140.992,
  });
  assert.deepEqual(estimate.renderMinutes, { low: 62, high: 107 });
  assert.ok(estimate.finalBytes.low < 2372685654 && estimate.finalBytes.high > 2372685654);
  const smaller = estimateDelivery({
    profile: { resolution: "1080p", frameRate: 30 },
    source: source4k60,
    durationSeconds: 140.992,
  });
  assert.ok(smaller.renderMinutes.high < estimate.renderMinutes.low);
});
