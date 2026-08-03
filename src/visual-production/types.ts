import type { NarrationVisualForm } from "../creator-workflow/visual-authoring.ts";
import type { SystemIconId } from "../icons/registry.ts";
import type { ApprovedVisualComponentId } from "../visual-brief/types.ts";

export const PRIMARY_VISUAL_TYPES = ["speaker", "component", "image", "screen-demo", "animation"] as const;
export type PrimaryVisualType = (typeof PRIMARY_VISUAL_TYPES)[number];

export const TAKEOVER_MODES = ["none", "partial", "full"] as const;
export type TakeoverMode = (typeof TAKEOVER_MODES)[number];

export const SPEAKER_PRESENCE_MODES = ["full", "circle-pip", "hidden"] as const;
export type SpeakerPresenceMode = (typeof SPEAKER_PRESENCE_MODES)[number];

export const ANIMATION_PROTOTYPE_IDS = [
  "process-flow",
  "state-transition",
  "evidence-gate",
  "causal-chain",
  "before-after",
  "layered-system",
  "aggregate-decompose",
  "focus-zoom",
  "threshold-landing",
  "converge-diffuse",
] as const;
export type AnimationPrototypeId = (typeof ANIMATION_PROTOTYPE_IDS)[number];

export const ANIMATION_STYLE_PROFILE_IDS = ["paper-editorial", "stop-motion-machine", "research-archive"] as const;
export type AnimationStyleProfileId = (typeof ANIMATION_STYLE_PROFILE_IDS)[number];

export type AnimationStageIntent = {
  id: string;
  spokenQuote: string;
  action: string;
  label: string;
  imageAssetId?: string;
  imageAssetLabel?: string;
  imageAssetSrc?: string;
  iconId?: SystemIconId;
};

export type AnimationIntent = {
  prototypeId: AnimationPrototypeId;
  styleProfileId: AnimationStyleProfileId;
  stages: AnimationStageIntent[];
  takeaway: string;
};

export const TEXT_ANNOTATION_EFFECTS = [
  "highlight",
  "underline",
  "circle",
  "box",
  "crossed-off",
  "strike-through",
  "bracket",
] as const;
export type TextAnnotationEffect = (typeof TEXT_ANNOTATION_EFFECTS)[number];

export type TextAnnotation = {
  id: string;
  exactSpokenQuote: string;
  quoteOccurrence?: number;
  status: "suggested" | "confirmed";
  effect: TextAnnotationEffect;
};

export type ResolvedTextAnnotation = TextAnnotation & {
  sectionId: string;
  start: number;
  end: number;
  startCue: number;
  endCue: number;
  exactSpokenQuoteSha256?: string;
  finalScriptSha256?: string;
};

export type VisualBeat = {
  id: string;
  exactSpokenQuote: string;
  quoteOccurrence?: number;
  status: "suggested" | "confirmed";
  primaryVisualType: PrimaryVisualType;
  semanticForm?: NarrationVisualForm;
  componentId?: ApprovedVisualComponentId;
  materialId?: string;
  materialIds?: string[];
  materialDisplay?: "full" | "crop" | "annotate";
  animationIntent?: AnimationIntent;
  takeover: TakeoverMode;
  speakerPresence: SpeakerPresenceMode;
};

export type ResolvedVisualBeat = VisualBeat & {
  sectionId: string;
  materialAssetId?: string;
  materialAssetIds?: string[];
  exactSpokenQuoteSha256: string;
  finalScriptSha256: string;
  quoteStart: number;
  quoteEnd: number;
};

export type VisualInterval = {
  id: string;
  start: number;
  end: number;
  primaryVisualType: PrimaryVisualType;
  takeover: TakeoverMode;
  speakerPresence: SpeakerPresenceMode;
};
