import { approvedComponentRegistry } from "../src/components/library/registry.ts";
import { approvedMotionRecipeRegistry, componentMotionProfiles } from "../src/motion-recipes/registry.ts";
import { componentQaContracts, layoutQaContracts } from "../src/visual-qa/contracts.ts";

const componentIds = Object.keys(approvedComponentRegistry).sort();
const motionByComponent = new Map(componentMotionProfiles.map((item) => [item.componentId, item]));
const qaByComponent = new Map(componentQaContracts.map((item) => [item.componentId, item]));
const recipeIds = new Set(approvedMotionRecipeRegistry.map((item) => item.id));
const missingMotion = componentIds.filter((id) => !motionByComponent.has(id));
const missingQa = componentIds.filter((id) => !qaByComponent.has(id));
if (missingMotion.length) throw new Error(`Missing motion profile for: ${missingMotion.join(", ")}`);
if (missingQa.length) throw new Error(`Missing component QA contract for: ${missingQa.join(", ")}`);
for (const id of componentIds) {
  const motion = motionByComponent.get(id);
  if (!recipeIds.has(motion.defaultRecipe)) throw new Error(`Missing motion recipe ${motion.defaultRecipe} for ${id}`);
  const bounds = qaByComponent.get(id).contentBounds;
  if (
    ![bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite) ||
    bounds.x < 0 ||
    bounds.y < 0 ||
    bounds.width <= 0 ||
    bounds.height <= 0 ||
    bounds.x + bounds.width > 1920 ||
    bounds.y + bounds.height > 1080
  )
    throw new Error(`Invalid component QA bounds for ${id}`);
}
for (const layout of layoutQaContracts) {
  if (layout.canvas.width !== 1920 || layout.canvas.height !== 1080)
    throw new Error(`Invalid layout QA canvas for ${layout.layoutId}`);
  if (!layout.contentBounds?.length) throw new Error(`Missing layout QA bounds for ${layout.layoutId}`);
}
console.log(
  JSON.stringify({
    schemaVersion: "1.0",
    components: componentIds.length,
    motionProfiles: componentMotionProfiles.length,
    componentQaContracts: componentQaContracts.length,
    layoutQaContracts: layoutQaContracts.length,
  }),
);
