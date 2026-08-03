import { interpolate } from "remotion";
import type { MotionTiming } from "./types.ts";

export const easeOutCubic = (value: number) => 1 - (1 - value) ** 3;
export const easeInOutCubic = (value: number) => (value < 0.5 ? 4 * value ** 3 : 1 - (-2 * value + 2) ** 3 / 2);

export const motionProgress = ({
  frame,
  fps,
  delayFrames = 0,
  durationMs = 360,
  reducedMotion = false,
}: MotionTiming) => {
  if (reducedMotion) return 1;
  const durationFrames = Math.max(1, Math.round((durationMs / 1000) * fps));
  const linear = interpolate(frame - delayFrames, [0, durationFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return easeOutCubic(linear);
};

export const staggerDelay = (index: number, fps: number, intervalMs = 90) =>
  Math.round(index * (intervalMs / 1000) * fps);

export const countAtProgress = (from: number, to: number, progress: number, decimals = 0) =>
  Number((from + (to - from) * easeInOutCubic(progress)).toFixed(decimals));

export const springSettleProgress = (linearProgress: number, damping = 7, oscillations = 1.15) => {
  const value = Math.max(0, Math.min(1, linearProgress));
  if (value === 1) return 1;
  return 1 - Math.exp(-damping * value) * Math.cos(oscillations * Math.PI * 2 * value);
};

export const linearMotionProgress = ({
  frame,
  fps,
  delayFrames = 0,
  durationMs = 500,
  reducedMotion = false,
}: MotionTiming) => {
  if (reducedMotion) return 1;
  const durationFrames = Math.max(1, Math.round((durationMs / 1000) * fps));
  return interpolate(frame - delayFrames, [0, durationFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
};
