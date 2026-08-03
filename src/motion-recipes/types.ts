import type { ApprovedVisualComponentId } from "../visual-brief/types.ts";
import type { CandidateMotionPrimitiveId, MotionPrimitiveId } from "../motion-primitives/types.ts";

export type MotionIntent = "introduce" | "compare" | "progress" | "reorder" | "transform" | "emphasize";

export type MotionRecipeId =
  | "quiet-introduction"
  | "ordered-explanation"
  | "data-comparison"
  | "directional-progress"
  | "conclusion-emphasis";

export type CandidateMotionRecipeId =
  | "state-transition"
  | "rank-reorder"
  | "spring-selection"
  | "bounded-loading"
  | "system-assembly"
  | "evidence-flip";

export type MotionRecipe = {
  id: MotionRecipeId | CandidateMotionRecipeId;
  status: "approved" | "candidate";
  primitives: Array<MotionPrimitiveId | CandidateMotionPrimitiveId>;
  intent: MotionIntent;
  useWhen: string[];
};

export type ComponentMotionProfile = {
  componentId: ApprovedVisualComponentId;
  defaultRecipe: MotionRecipeId;
  allowedByIntent: Partial<Record<MotionIntent, MotionRecipeId | CandidateMotionRecipeId>>;
};
