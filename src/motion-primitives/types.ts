export type MotionPrimitiveId =
  | "fade"
  | "slide"
  | "soft-scale"
  | "stagger"
  | "focus-dim"
  | "count-up"
  | "draw-line"
  | "grow-bar"
  | "traverse-path"
  | "highlight-sweep";

export type CandidateMotionPrimitiveId =
  | "state-morph"
  | "flip-reorder"
  | "spring-settle"
  | "shimmer"
  | "orbit-assemble"
  | "card-flip-3d";

export type MotionPrimitiveDefinition = {
  id: MotionPrimitiveId | CandidateMotionPrimitiveId;
  status: "approved" | "candidate";
  purpose: string;
  bestDurationMs: [number, number];
  useWhen: string[];
  avoidWhen: string[];
  reducedMotion: "final-state" | "opacity-only";
};

export type MotionTiming = {
  frame: number;
  fps: number;
  delayFrames?: number;
  durationMs?: number;
  reducedMotion?: boolean;
};
