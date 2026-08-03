import { APPROVED_COMPONENT_IDS } from "../visual-brief/types.ts";
import type { ComponentMotionProfile, MotionRecipe } from "./types.ts";

export const approvedMotionRecipeRegistry: MotionRecipe[] = [
  {
    id: "quiet-introduction",
    status: "approved",
    primitives: ["fade", "slide", "soft-scale"],
    intent: "introduce",
    useWhen: ["single card", "title", "identity"],
  },
  {
    id: "ordered-explanation",
    status: "approved",
    primitives: ["stagger", "focus-dim", "traverse-path"],
    intent: "progress",
    useWhen: ["steps", "factors", "timeline"],
  },
  {
    id: "data-comparison",
    status: "approved",
    primitives: ["stagger", "grow-bar", "count-up"],
    intent: "compare",
    useWhen: ["ranking", "bars", "statistics"],
  },
  {
    id: "directional-progress",
    status: "approved",
    primitives: ["draw-line", "traverse-path", "focus-dim"],
    intent: "progress",
    useWhen: ["trend", "causal chain", "process"],
  },
  {
    id: "conclusion-emphasis",
    status: "approved",
    primitives: ["soft-scale", "highlight-sweep"],
    intent: "emphasize",
    useWhen: ["winner", "takeaway", "final state"],
  },
];

export const motionPack2RecipeRegistry: MotionRecipe[] = [
  {
    id: "state-transition",
    status: "approved",
    primitives: ["state-morph"],
    intent: "transform",
    useWhen: ["same entity changes state"],
  },
  {
    id: "rank-reorder",
    status: "approved",
    primitives: ["flip-reorder", "spring-settle"],
    intent: "reorder",
    useWhen: ["ranking changes over time"],
  },
  {
    id: "spring-selection",
    status: "approved",
    primitives: ["spring-settle"],
    intent: "emphasize",
    useWhen: ["one selected option lands"],
  },
  {
    id: "bounded-loading",
    status: "approved",
    primitives: ["shimmer", "state-morph"],
    intent: "progress",
    useWhen: ["loading resolves into content"],
  },
  {
    id: "system-assembly",
    status: "approved",
    primitives: ["orbit-assemble", "spring-settle"],
    intent: "transform",
    useWhen: ["modules assemble around one core"],
  },
  {
    id: "evidence-flip",
    status: "approved",
    primitives: ["card-flip-3d"],
    intent: "transform",
    useWhen: ["front evidence reveals reverse detail"],
  },
];

approvedMotionRecipeRegistry.push(...motionPack2RecipeRegistry);

const profile = (
  componentId: ComponentMotionProfile["componentId"],
  defaultRecipe: ComponentMotionProfile["defaultRecipe"],
  allowedByIntent: ComponentMotionProfile["allowedByIntent"],
): ComponentMotionProfile => ({ componentId, defaultRecipe, allowedByIntent });

export const componentMotionProfiles: ComponentMotionProfile[] = [
  profile("distribution-bars", "data-comparison", { compare: "data-comparison", emphasize: "conclusion-emphasis" }),
  profile("scenario-branches", "directional-progress", {
    compare: "data-comparison",
    progress: "directional-progress",
    transform: "state-transition",
  }),
  profile("market-cap-lines", "directional-progress", { compare: "data-comparison", progress: "directional-progress" }),
  profile("person-evidence-card", "quiet-introduction", {
    introduce: "quiet-introduction",
    transform: "evidence-flip",
  }),
  profile("factor-sequence", "ordered-explanation", {
    progress: "ordered-explanation",
    emphasize: "conclusion-emphasis",
  }),
  profile("ranked-metric-list", "data-comparison", {
    compare: "data-comparison",
    reorder: "rank-reorder",
    emphasize: "conclusion-emphasis",
  }),
  profile("binary-versus", "data-comparison", { compare: "data-comparison", transform: "state-transition" }),
  profile("key-stat-summary", "data-comparison", { introduce: "quiet-introduction", emphasize: "conclusion-emphasis" }),
  profile("media-comparison", "quiet-introduction", { compare: "data-comparison", transform: "evidence-flip" }),
  profile("image-evidence-inset", "quiet-introduction", {
    introduce: "quiet-introduction",
    emphasize: "conclusion-emphasis",
  }),
  profile("process-steps", "ordered-explanation", { progress: "ordered-explanation", transform: "state-transition" }),
  profile("causal-chain", "directional-progress", { progress: "directional-progress" }),
  profile("quote-source-card", "quiet-introduction", { introduce: "quiet-introduction", transform: "evidence-flip" }),
  profile("historical-timeline", "ordered-explanation", { progress: "ordered-explanation" }),
  profile("decision-matrix", "quiet-introduction", { introduce: "quiet-introduction", emphasize: "spring-selection" }),
  profile("model-classification-map", "quiet-introduction", {
    introduce: "quiet-introduction",
    transform: "state-transition",
  }),
  profile("capability-surface-grid", "data-comparison", { compare: "data-comparison", progress: "bounded-loading" }),
  profile("tradeoff-scale", "data-comparison", { compare: "data-comparison", transform: "state-transition" }),
  profile("rough-annotation", "conclusion-emphasis", {
    introduce: "quiet-introduction",
    emphasize: "conclusion-emphasis",
    transform: "state-transition",
  }),
];

if (componentMotionProfiles.length !== APPROVED_COMPONENT_IDS.length)
  throw new Error("Motion profiles must cover all approved components.");
