import assert from "node:assert/strict";
import test from "node:test";

const fadeFrames = (durationSeconds: number, fps: number) => Math.min(4, Math.max(0.1, (durationSeconds * fps) / 3));

test("subtitle fades remain ordered for short and long cues", () => {
  for (const duration of [0.05, 0.1, 0.2, 0.5, 1, 4]) {
    const totalFrames = duration * 30;
    assert.ok(fadeFrames(duration, 30) * 2 < totalFrames);
  }
});
