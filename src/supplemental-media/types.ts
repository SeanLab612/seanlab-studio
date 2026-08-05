export const SUPPLEMENTAL_MEDIA_ROLES = [
  "repository-overview",
  "webpage",
  "result-showcase",
  "mobile-recording",
  "screen-evidence",
] as const;

export const PIP_SHAPES = ["circle", "rounded-rectangle"] as const;
export const PIP_POSITIONS = ["top-left", "top-right", "bottom-left", "bottom-right"] as const;
// Keeps a bottom-positioned PIP above the 16:9 subtitle safe area (y >= 820).
export const PIP_BOTTOM_SAFE_OFFSET = 280;

export type SupplementalMediaRole = (typeof SUPPLEMENTAL_MEDIA_ROLES)[number];
export type PipShape = (typeof PIP_SHAPES)[number];
export type PipPosition = (typeof PIP_POSITIONS)[number];

export type SupplementalMediaAsset = {
  id: string;
  path: string;
  role: SupplementalMediaRole;
  orientation: "landscape" | "portrait" | "square" | "any";
  required: boolean;
  executionPolicy?: "locked" | "reference";
  visualBeatId?: string;
  audioPolicy: "mute";
  clip?: { in: number; out: number };
  description?: string;
};

export type SupplementalMediaProbe = {
  id: string;
  role: SupplementalMediaRole;
  sourcePath: string;
  publicSrc: string;
  sha256: string;
  width: number;
  height: number;
  fps: number;
  durationSeconds: number;
  codec: string;
  hasAudio: boolean;
  audioPolicy: "mute";
  required: boolean;
  executionPolicy?: "locked" | "reference";
  visualBeatId?: string;
  clip: { in: number; out: number };
};

export type TextAnchor = {
  text: string;
  occurrence?: number;
};

export type AuthoredScreenScene = {
  id: string;
  type: "screen-evidence" | "result-showcase";
  assetId: string;
  startAnchor: TextAnchor;
  endAnchor: TextAnchor;
  required: boolean;
  executionPolicy?: "locked" | "reference";
  visualBeatId?: string;
  speakerPip: {
    shape: PipShape;
    preferredPosition: PipPosition;
    size?: number;
    objectPosition?: string;
  };
};

export type AuthoredScenePlan = {
  schemaVersion: "1.0";
  scenes: AuthoredScreenScene[];
};

export type ResolvedScreenScene = {
  id: string;
  type: AuthoredScreenScene["type"];
  assetId: string;
  videoSrc: string;
  start: number;
  end: number;
  sourceStart: number;
  sourceEnd: number;
  playbackRate: number;
  sourceFps: number;
  width: number;
  height: number;
  required: boolean;
  confidence: number;
  startCue: number;
  endCue: number;
  speakerPip: AuthoredScreenScene["speakerPip"];
};

export type ResolvedSceneTimeline = {
  schemaVersion: "1.0";
  status: "resolved" | "blocked" | "empty";
  scenes: ResolvedScreenScene[];
  unresolved: Array<{ sceneId: string; required: boolean; reason: string }>;
  summary: { authored: number; resolved: number; requiredUnresolved: number };
};
