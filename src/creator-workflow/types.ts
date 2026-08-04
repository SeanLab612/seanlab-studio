import type { GlobalAgentPin } from "../agents/types.ts";
import type { AnimationTemplateId } from "../animation-system/template-registry.ts";
import type { TypographyProjectPolicy } from "../typography-policy/types.ts";
import type { NarrationVisualForm } from "./visual-authoring.ts";

export const CREATOR_CATEGORIES = [
  "general",
  "github-project",
  "tutorial",
  "news-analysis",
  "tool-review",
  "model-review",
  "biopharma-extra",
  "other",
] as const;

export type CreatorCategory = (typeof CREATOR_CATEGORIES)[number];
export const CREATOR_WORKFLOW_MODES = ["script-first", "visual-post-production"] as const;
export type CreatorWorkflowMode = (typeof CREATOR_WORKFLOW_MODES)[number];
export type CreatorEditorialBrief = {
  version: "1.0";
  status: "draft" | "ready";
  answers: Record<string, string>;
  updatedAt?: string;
};
export type CreatorProjectStatus =
  | "intake"
  | "drafting"
  | "script-review"
  | "script-locked"
  | "awaiting-media"
  | "video-ready"
  | "video-running"
  | "review"
  | "approved"
  | "delivered";

export type CreatorSource = {
  id: string;
  kind: "url" | "file" | "note";
  label: string;
  value: string;
};

export type CreatorMaterial = {
  id: string;
  kind: "screenshot" | "screen-recording" | "reference" | "speaker-video";
  label: string;
  assetId?: string;
  required: boolean;
  description?: string;
  evidenceRole?: "interface" | "result" | "source" | "comparison" | "document" | "other";
  sourceLabel?: string;
  anchorText?: string;
  anchorTexts?: string[];
  fit?: "contain" | "cover";
  focalPoint?: { x: number; y: number };
};

export type CreatorProject = {
  schemaVersion: "1.0";
  project: {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    status: CreatorProjectStatus;
    workflowMode?: CreatorWorkflowMode;
  };
  agent: GlobalAgentPin;
  /** Read-only compatibility for projects created before per-section animation style review. */
  animation?: {
    templateId: AnimationTemplateId;
    lockedAt: string;
  };
  typography?: TypographyProjectPolicy;
  brief: {
    topic: string;
    category: CreatorCategory;
    targetDurationMinutes?: number;
    audience?: string;
    creatorNotes?: string;
    editorialBrief?: CreatorEditorialBrief;
  };
  sources: CreatorSource[];
  materials: CreatorMaterial[];
  authoring: {
    state: "not-started" | "drafted" | "locked";
    inputScript?: string;
    draftScript?: string;
    sourceContext?: string;
    finalScript?: string;
    shootingGuide?: string;
    authoredScenePlan?: string;
    authoredVisualPlan?: string;
    handoff?: string;
    providerReport?: string;
    currentAttemptId?: string;
    currentAttemptSha256?: string;
    lockedAttemptId?: string;
    lockedAttemptSha256?: string;
    lockedAt?: string;
    finalScriptSha256?: string;
  };
  video: {
    projectId?: string;
    manifest?: string;
    sourceAssetId?: string;
  };
};

export type NarrationScriptPackage = {
  schemaVersion: "1.0";
  title: string;
  opening: string;
  overview: string;
  /** Deprecated compatibility field. The public edition does not reserve a bumper anchor. */
  transitionAnchor?: string;
  sections: Array<{
    id: string;
    title: string;
    narration: string;
    visualIntent: "speaker" | "screen-recording" | "screenshot" | "semantic-visual";
    visualOpportunities?: Array<{
      form: NarrationVisualForm;
      evidenceText: string;
    }>;
    materialIds: string[];
    recordingInstruction: string | null;
  }>;
  conclusion: string;
  fullScript: string;
  shootingGuide: string[];
};
