import type { AnimationPrototypeId, AnimationStyleProfileId } from "./types.ts";

export type AnimationPrototypeRegistration = {
  id: AnimationPrototypeId;
  label: string;
  relationship: string;
  minimumStages: number;
  maximumStages: number;
  semanticStatus: "approved";
  rendererStatus: "candidate" | "approved";
  compatibleStyleIds: readonly AnimationStyleProfileId[];
  defaultStyleId: AnimationStyleProfileId;
};

export const animationPrototypeRegistry: Record<AnimationPrototypeId, AnimationPrototypeRegistration> = {
  "process-flow": {
    id: "process-flow",
    label: "流程推进",
    relationship: "ordered progression",
    minimumStages: 2,
    maximumStages: 6,
    semanticStatus: "approved",
    rendererStatus: "approved",
    compatibleStyleIds: ["stop-motion-machine", "paper-editorial"],
    defaultStyleId: "stop-motion-machine",
  },
  "state-transition": {
    id: "state-transition",
    label: "状态变化",
    relationship: "state change",
    minimumStages: 2,
    maximumStages: 5,
    semanticStatus: "approved",
    rendererStatus: "approved",
    compatibleStyleIds: ["paper-editorial", "stop-motion-machine"],
    defaultStyleId: "paper-editorial",
  },
  "evidence-gate": {
    id: "evidence-gate",
    label: "证据门",
    relationship: "conditional evidence binding",
    minimumStages: 2,
    maximumStages: 5,
    semanticStatus: "approved",
    rendererStatus: "approved",
    compatibleStyleIds: ["stop-motion-machine", "paper-editorial"],
    defaultStyleId: "stop-motion-machine",
  },
  "causal-chain": {
    id: "causal-chain",
    label: "因果链",
    relationship: "directed cause and effect",
    minimumStages: 2,
    maximumStages: 5,
    semanticStatus: "approved",
    rendererStatus: "approved",
    compatibleStyleIds: ["paper-editorial", "stop-motion-machine"],
    defaultStyleId: "paper-editorial",
  },
  "before-after": {
    id: "before-after",
    label: "前后变化",
    relationship: "before and after",
    minimumStages: 2,
    maximumStages: 4,
    semanticStatus: "approved",
    rendererStatus: "approved",
    compatibleStyleIds: ["paper-editorial", "stop-motion-machine"],
    defaultStyleId: "paper-editorial",
  },
  "layered-system": {
    id: "layered-system",
    label: "系统分层",
    relationship: "roles and layers",
    minimumStages: 2,
    maximumStages: 6,
    semanticStatus: "approved",
    rendererStatus: "approved",
    compatibleStyleIds: ["paper-editorial", "stop-motion-machine"],
    defaultStyleId: "paper-editorial",
  },
  "aggregate-decompose": {
    id: "aggregate-decompose",
    label: "聚合与拆解",
    relationship: "parts combine into a whole or a whole separates into parts",
    minimumStages: 2,
    maximumStages: 6,
    semanticStatus: "approved",
    rendererStatus: "approved",
    compatibleStyleIds: ["research-archive"],
    defaultStyleId: "research-archive",
  },
  "focus-zoom": {
    id: "focus-zoom",
    label: "尺度变焦",
    relationship: "whole to key detail and back to whole",
    minimumStages: 2,
    maximumStages: 6,
    semanticStatus: "approved",
    rendererStatus: "approved",
    compatibleStyleIds: ["research-archive"],
    defaultStyleId: "research-archive",
  },
  "threshold-landing": {
    id: "threshold-landing",
    label: "阈值与落点",
    relationship: "target or standard compared with an observed landing",
    minimumStages: 2,
    maximumStages: 4,
    semanticStatus: "approved",
    rendererStatus: "approved",
    compatibleStyleIds: ["research-archive"],
    defaultStyleId: "research-archive",
  },
  "converge-diffuse": {
    id: "converge-diffuse",
    label: "扩散与汇流",
    relationship: "independent sources converge into a shared conclusion or diffuse from one origin",
    minimumStages: 2,
    maximumStages: 6,
    semanticStatus: "approved",
    rendererStatus: "approved",
    compatibleStyleIds: ["research-archive"],
    defaultStyleId: "research-archive",
  },
};

export const PAPER_EDITORIAL_STYLE = Object.freeze({
  id: "paper-editorial" as const,
  status: "approved" as const,
  speakerPip: {
    shape: "circle" as const,
    preferredPosition: "top-right" as const,
    diameterRatio: 0.14,
    edgeRatio: 0.05,
  },
});

export const STOP_MOTION_MACHINE_STYLE = Object.freeze({
  id: "stop-motion-machine" as const,
  status: "approved" as const,
  speakerPip: {
    shape: "circle" as const,
    preferredPosition: "top-right" as const,
    diameterRatio: 0.14,
    edgeRatio: 0.05,
  },
});

export const RESEARCH_ARCHIVE_STYLE = Object.freeze({
  id: "research-archive" as const,
  status: "approved" as const,
  speakerPip: {
    shape: "circle" as const,
    preferredPosition: "top-right" as const,
    diameterRatio: 0.14,
    edgeRatio: 0.05,
  },
});
