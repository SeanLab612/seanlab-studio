import type { MediaEntityKind, MediaIntent } from "../media-assets/types.ts";
import type { MotionIntent } from "../motion-recipes/types.ts";
import type { VisualBriefNarrative, VisualRhetoric } from "../visual-brief/types.ts";

export type SemanticRhetoric = Exclude<VisualRhetoric, "process"> | "none";

export type ImageEvidenceIntent = {
  assetId: string;
  purpose: "show" | "prove" | "explain" | "compare";
  caption: string;
};

export type SemanticItem = {
  label: string;
  detail: string;
  value: number | null;
  displayValue: string;
  unit: string;
  timeLabel: string;
  entityId: string;
  entityKind: MediaEntityKind | "none";
  x: number | null;
  y: number | null;
  /** Explicit qualitative axis evidence. Never infer these bands from descriptive copy. */
  xBand?: "none" | "low" | "high";
  yBand?: "none" | "low" | "high";
  /** Explicit directional evidence for a qualitative tradeoff. */
  direction?: "none" | "up" | "down" | "stable";
  /** Inclusive evidence bounds inside the parent segment. New Agent outputs provide these; legacy plans may omit them. */
  startCue?: number;
  endCue?: number;
};

export type SemanticSeries = {
  name: string;
  valueLabel: string;
  points: Array<{ timeLabel: string; value: number }>;
};

export type RoughAnnotationSemanticIntent =
  | "strong-emphasis"
  | "light-emphasis"
  | "focus-concept"
  | "bounded-conclusion"
  | "negation"
  | "correction"
  | "grouping";

export type LocalRoughAnnotationPlan = {
  intent: RoughAnnotationSemanticIntent;
  targets: string[];
  annotations?: Array<{ target: string; intent: RoughAnnotationSemanticIntent }>;
};

export type SemanticNarrativeSegment = {
  startCue: number;
  endCue: number;
  visualPriority: "skip" | "normal" | "high";
  rhetoric: SemanticRhetoric;
  motionIntent: MotionIntent;
  reason: string;
  confidence: number;
  narrative: VisualBriefNarrative & { takeaway: string };
  items: SemanticItem[];
  timeSeries: SemanticSeries[];
  matrix: {
    rows: string[];
    columns: string[];
    values: number[][];
    /** Complete viewer-facing qualitative cells such as 支持/部分支持/不支持. */
    states?: string[][];
    xLabel: string;
    yLabel: string;
  };
  quote: { text: string; sourceName: string; sourceRole: string };
  mediaIntents: MediaIntent[];
  imageEvidence: ImageEvidenceIntent | null;
  /** Locally derived after Agent output validation; never part of the Agent JSON contract. */
  roughAnnotation?: LocalRoughAnnotationPlan;
};

export type VideoIdentity = {
  eyebrow: string;
  title: string;
  subject: string;
  startCue: number;
  endCue: number;
  confidence: number;
};

export type SemanticNarrativePlan = {
  schemaVersion: "1.0";
  analyzedThroughCue: number;
  videoIdentity?: VideoIdentity;
  visualDecisions?: Array<{
    beatId: string;
    action: "use" | "skip";
    reason: string;
  }>;
  segments: SemanticNarrativeSegment[];
};
