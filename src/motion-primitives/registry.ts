import type { MotionPrimitiveDefinition } from "./types.ts";

const baseMotionPrimitiveRegistry: MotionPrimitiveDefinition[] = [
  {
    id: "fade",
    status: "approved",
    purpose: "Quietly introduce or remove information",
    bestDurationMs: [220, 420],
    useWhen: ["titles", "cards", "labels"],
    avoidWhen: ["repeated pulsing"],
    reducedMotion: "opacity-only",
  },
  {
    id: "slide",
    status: "approved",
    purpose: "Establish spatial origin with a short translation",
    bestDurationMs: [280, 460],
    useWhen: ["side-column overlays"],
    avoidWhen: ["long travel across the frame"],
    reducedMotion: "opacity-only",
  },
  {
    id: "soft-scale",
    status: "approved",
    purpose: "Give a compact surface a controlled landing",
    bestDurationMs: [280, 420],
    useWhen: ["glass cards", "stats"],
    avoidWhen: ["bouncy elastic motion"],
    reducedMotion: "final-state",
  },
  {
    id: "stagger",
    status: "approved",
    purpose: "Reveal related items in reading order",
    bestDurationMs: [70, 130],
    useWhen: ["lists", "steps", "rankings"],
    avoidWhen: ["independent simultaneous reveals"],
    reducedMotion: "final-state",
  },
  {
    id: "focus-dim",
    status: "approved",
    purpose: "De-emphasize completed context without hiding it",
    bestDurationMs: [220, 380],
    useWhen: ["factor narration", "branches", "steps"],
    avoidWhen: ["rankings that must remain fully comparable"],
    reducedMotion: "opacity-only",
  },
  {
    id: "count-up",
    status: "approved",
    purpose: "Land one meaningful number",
    bestDurationMs: [520, 920],
    useWhen: ["key stats", "scores", "percentages"],
    avoidWhen: ["identifiers", "dates", "many simultaneous values"],
    reducedMotion: "final-state",
  },
  {
    id: "draw-line",
    status: "approved",
    purpose: "Explain direction or growth",
    bestDurationMs: [480, 900],
    useWhen: ["trends", "connections"],
    avoidWhen: ["decorative underlines with no meaning"],
    reducedMotion: "final-state",
  },
  {
    id: "grow-bar",
    status: "approved",
    purpose: "Encode a magnitude from a common baseline",
    bestDurationMs: [460, 820],
    useWhen: ["comparison", "ranking"],
    avoidWhen: ["values without a common scale"],
    reducedMotion: "final-state",
  },
  {
    id: "traverse-path",
    status: "approved",
    purpose: "Show progress through a causal or procedural route",
    bestDurationMs: [700, 1200],
    useWhen: ["process", "causal chain", "timeline"],
    avoidWhen: ["unordered factors"],
    reducedMotion: "final-state",
  },
  {
    id: "highlight-sweep",
    status: "approved",
    purpose: "Provide one premium emphasis pass",
    bestDurationMs: [480, 760],
    useWhen: ["winner", "final conclusion"],
    avoidWhen: ["continuous loops", "every card"],
    reducedMotion: "final-state",
  },
];

export const motionPack2PrimitiveRegistry: MotionPrimitiveDefinition[] = [
  {
    id: "state-morph",
    status: "approved",
    purpose: "Continuously interpolate one meaningful UI state into another",
    bestDurationMs: [420, 760],
    useWhen: ["before and after", "status transition", "shape-preserving change"],
    avoidWhen: ["unrelated scenes", "decorative shape shifting"],
    reducedMotion: "final-state",
  },
  {
    id: "flip-reorder",
    status: "approved",
    purpose: "Preserve item identity while ranking or order changes",
    bestDurationMs: [520, 900],
    useWhen: ["ranking change", "priority reorder"],
    avoidWhen: ["initial list entrance", "items changing identity"],
    reducedMotion: "final-state",
  },
  {
    id: "spring-settle",
    status: "approved",
    purpose: "Add one controlled overshoot as an element lands",
    bestDurationMs: [420, 700],
    useWhen: ["selected state", "drag release", "important landing"],
    avoidWhen: ["every list item", "continuous bouncing"],
    reducedMotion: "final-state",
  },
  {
    id: "shimmer",
    status: "approved",
    purpose: "Communicate a bounded loading or pending state",
    bestDurationMs: [700, 1200],
    useWhen: ["loading", "data pending", "one transition interval"],
    avoidWhen: ["permanent decoration", "readable content"],
    reducedMotion: "opacity-only",
  },
  {
    id: "orbit-assemble",
    status: "approved",
    purpose: "Assemble related modules around one core concept",
    bestDurationMs: [800, 1300],
    useWhen: ["hub and spoke", "system assembly", "brand lockup"],
    avoidWhen: ["unrelated categories", "continuous orbit"],
    reducedMotion: "final-state",
  },
  {
    id: "card-flip-3d",
    status: "approved",
    purpose: "Reveal the reverse side of the same evidence card",
    bestDurationMs: [520, 820],
    useWhen: ["question to answer", "front to detail", "before to after"],
    avoidWhen: ["different unrelated cards", "rapid repeated flipping"],
    reducedMotion: "final-state",
  },
];

export const motionPrimitiveRegistry: MotionPrimitiveDefinition[] = [
  ...baseMotionPrimitiveRegistry,
  ...motionPack2PrimitiveRegistry,
];

export const getMotionPrimitive = (id: MotionPrimitiveDefinition["id"]) => {
  const primitive = motionPrimitiveRegistry.find((entry) => entry.id === id);
  if (!primitive) throw new Error(`Unknown motion primitive: ${id}`);
  return primitive;
};
