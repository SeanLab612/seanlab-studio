export type OverlayCard = {
  eyebrow: string;
  title: string;
  subtitle?: string;
  accent: string;
};

export type VisualMetaphor = "model-map" | "core-node" | "capability-grid" | "tradeoff-scale";

export type VisualBrief = {
  claim: string;
  rhetoric:
    | "classification"
    | "positioning"
    | "capability"
    | "tradeoff"
    | "comparison"
    | "historical-timeline"
    | "process-steps"
    | "ranking"
    | "decision-matrix";
  metaphor: VisualMetaphor | string;
  primaryText: string;
  secondaryText: string;
  detail?: string;
  labels?: string[];
  selectedId?: string;
  itemDetails?: string[];
  centerLabel?: string;
  centerValue?: string;
  rows?: string[];
  columns?: string[];
  values?: number[][];
  tradeoffs?: Array<{ label: string; value: number; previousValue?: number; color?: string; note?: string }>;
  // 扩展字段
  items?: Array<Record<string, unknown>>;
  nodes?: Array<Record<string, unknown>>;
  points?: Array<Record<string, unknown>>;
  activeIndex?: number;
  headline?: string;
  takeaway?: string;
  relation?: string;
  mode?: string;
  metricLabel?: string;
  xLabel?: string;
  yLabel?: string;
  highlightIds?: string[];
  lowLabel?: string;
  highLabel?: string;
};

export type OverlayCue = OverlayCard & {
  start: number;
  end: number;
  subtitleEn?: string;
  keywords?: string[];
  visualBrief?: VisualBrief;
  generatedVisual?: import("../visual-brief/generator").GeneratedVisualBrief;
  layoutTemplateId?: import("../layout-templates").LayoutTemplateId;
  contentScale?: number;
  visualImportance?: "hero" | "support" | "accent";
  chapterId?: string;
};

export type SubtitleCue = { start: number; end: number; zh: string; en?: string; role?: "caption" };

export type ScreenScene = import("../supplemental-media/types").ResolvedScreenScene;
export type WholeVideoTitleCue = import("../visual-direction/types").WholeVideoTitleCue;
export type SoundEvent = import("../sound-design/types").SoundEvent;
export type AnimationCue = import("../visual-production/timeline").ResolvedAnimationCue;
export type TextAnnotationCue = import("../visual-production/types").ResolvedTextAnnotation;
export type ImageCue = {
  id: string;
  start: number;
  end: number;
  assetId: string;
  src: string;
  sources?: Array<{ assetId: string; src: string; fit: "contain" | "cover"; label: string }>;
  fit: "contain" | "cover";
  label: string;
  speakerPresence: "circle-pip" | "hidden";
};

export type OverlayProps = {
  outputFps?: number;
  headline: string;
  chapter: string;
  speaker: string;
  subtitle: string;
  subtitleEn?: string;
  timelineLabel: string;
  cards: OverlayCard[];
  keywords: string[];
  videoSrc?: string;
  overlayCues?: OverlayCue[];
  subtitleCues?: SubtitleCue[];
  screenScenes?: ScreenScene[];
  titleCues?: WholeVideoTitleCue[];
  soundEvents?: SoundEvent[];
  animationCues?: AnimationCue[];
  annotationCues?: TextAnnotationCue[];
  imageCues?: ImageCue[];
  overlayScale?: number;
  overlaySide?: "left" | "right";
  layoutTemplateId?: import("../layout-templates").LayoutTemplateId;
  typography?: import("../typography-policy/types.ts").TypographyProjectPolicy;
};

export const sampleOverlayProps: OverlayProps = {
  headline: "AI 交易系统",
  chapter: "CASE STUDY",
  speaker: "话语",
  subtitle: "你的这个交易逻辑的根据",
  subtitleEn: "What is the basis of your trading logic?",
  timelineLabel: "SAME 10-YEAR CURVE",
  cards: [
    {
      eyebrow: "STATIC THEORY",
      title: "数据层",
      subtitle: "固定假设 + 样本边界",
      accent: "#FF626B",
    },
    {
      eyebrow: "EVOLVING LOGIC",
      title: "逻辑层",
      subtitle: "迭代规则 + 决策约束",
      accent: "#59D98E",
    },
  ],
  keywords: ["责任型", "能力型", "判死刑", "长期曲线"],
};
