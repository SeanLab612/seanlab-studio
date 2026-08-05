import type { GeneratedVisualBrief } from "../visual-brief/types.ts";

export const TITLE_CONTINUITY_REPETITION_WINDOW_SECONDS = 28;

export type VisualImportance = "hero" | "support" | "accent" | "none";

export type WholeVideoTitleCue = {
  id: string;
  start: number;
  end: number;
  eyebrow: string;
  title: string;
  accent: string;
  sourceStartCue: number;
  sourceEndCue: number;
  confidence: number;
  placementReason: string;
};

export type VisualDirectionPolicy = {
  version: "1.0";
  maximumVisualsPerMinute: number;
  minimumBreathingGapSeconds: number;
  minimumVisibleSeconds: number;
  maximumAccentSeconds: number;
  maximumSupportSeconds: number;
  maximumHeroSeconds: number;
  maximumContinuousVisualSeconds: number;
  repetitionWindowSeconds: number;
  minimumHeroGapSeconds: number;
  maximumVisualCoverageRatio: number;
  minimumVisualCoverageRatio?: number;
  maximumAnimationCoverageRatio?: number;
  maximumChapterSeconds: number;
  maximumChapterCandidates: number;
  heroConfidence: number;
  supportConfidence: number;
  accentConfidence: number;
};

export type VisualDirectionCandidate = {
  id: string;
  semanticIndex: number;
  startCue: number;
  endCue: number;
  start: number;
  end: number;
  visualPriority: "skip" | "normal" | "high";
  confidence: number;
  rhetoric: string;
  reason: string;
  materializationStatus: "planned" | "skipped" | "blocked";
  materializationReason?: string;
  creatorConstraint?: {
    sectionId: string;
    mode: "information" | "speaker" | "speaker-only" | "material";
    visualBeatId?: string;
  };
  overlayCue?: {
    start: number;
    end: number;
    eyebrow: string;
    title: string;
    subtitle: string;
    subtitleEn: string;
    accent: string;
    generatedVisual: GeneratedVisualBrief;
    layoutTemplateId: string;
    contentScale: number;
  };
};

export type VisualDirectionDecision = {
  candidateId: string;
  semanticIndex: number;
  startCue: number;
  endCue: number;
  sourceStart: number;
  sourceEnd: number;
  displayStart: number | null;
  displayEnd: number | null;
  action: "show" | "skip";
  importance: VisualImportance;
  rhetoric: string;
  componentId: string | null;
  chapterId: string;
  boundaryActions: Array<"single-caption" | "merge-captions" | "split-adjacent-claim">;
  adjustments: Array<
    | "delayed-for-breathing"
    | "extended-for-readability"
    | "extended-backward-for-readability"
    | "shortened-to-tier-budget"
  >;
  reasons: string[];
  creatorConstraint?: {
    sectionId: string;
    mode: "information" | "speaker" | "speaker-only" | "material";
    visualBeatId?: string;
  };
};

export type VisualDirectionPlan = {
  schemaVersion: "1.0";
  policy: VisualDirectionPolicy;
  durationSeconds: number;
  chapters: Array<{
    id: string;
    label: string;
    startCue: number;
    endCue: number;
    candidateIds: string[];
  }>;
  decisions: VisualDirectionDecision[];
  titleCues?: WholeVideoTitleCue[];
};
