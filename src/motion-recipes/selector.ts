import type { ApprovedVisualComponentId } from "../visual-brief/types.ts";
import { approvedMotionRecipeRegistry, componentMotionProfiles } from "./registry.ts";
import type { MotionIntent } from "./types.ts";

export const selectMotionRecipe = ({
  componentId,
  intent,
  allowCandidates = false,
}: {
  componentId: ApprovedVisualComponentId;
  intent?: MotionIntent;
  allowCandidates?: boolean;
}) => {
  const profile = componentMotionProfiles.find((entry) => entry.componentId === componentId);
  if (!profile) throw new Error(`Missing motion profile for ${componentId}`);
  const requested = intent ? profile.allowedByIntent[intent] : undefined;
  if (requested && (allowCandidates || approvedMotionRecipeRegistry.some((recipe) => recipe.id === requested)))
    return requested;
  return profile.defaultRecipe;
};

export const resolveMotionSelection = ({
  componentId,
  intent,
  allowCandidates = false,
}: {
  componentId: ApprovedVisualComponentId;
  intent?: MotionIntent;
  allowCandidates?: boolean;
}) => {
  const recipeId = selectMotionRecipe({ componentId, intent, allowCandidates });
  const recipe = approvedMotionRecipeRegistry.find((entry) => entry.id === recipeId);
  return { intent: intent ?? recipe?.intent ?? "introduce", recipeId };
};
