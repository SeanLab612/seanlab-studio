export const VISUAL_PACING_REVIEW_SCALE = 2 / 3;

export const visualPacingReviewDimensions = ({ width, height }) => ({
  width: width * VISUAL_PACING_REVIEW_SCALE,
  height: height * VISUAL_PACING_REVIEW_SCALE,
});
