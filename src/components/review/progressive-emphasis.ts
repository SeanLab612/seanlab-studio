export type ProgressiveEmphasisState = "completed" | "active" | "pending";

export type ProgressiveEmphasis = {
  state: ProgressiveEmphasisState;
  opacity: number;
  brightness: number;
  saturation: number;
  scale: number;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export const resolveProgressiveEmphasis = ({
  index,
  activeIndex,
  activeProgress = 1,
}: {
  index: number;
  activeIndex: number;
  activeProgress?: number;
}): ProgressiveEmphasis => {
  const progress = clamp01(activeProgress);
  if (index < activeIndex) {
    return {
      state: "completed",
      opacity: 0.38,
      brightness: 0.64,
      saturation: 0.58,
      scale: 0.985,
    };
  }
  if (index > activeIndex) {
    return {
      state: "pending",
      opacity: 0.56,
      brightness: 0.76,
      saturation: 0.72,
      scale: 0.985,
    };
  }
  return {
    state: "active",
    opacity: 0.82 + progress * 0.18,
    brightness: 0.9 + progress * 0.1,
    saturation: 0.9 + progress * 0.1,
    scale: 0.985 + progress * 0.015,
  };
};
