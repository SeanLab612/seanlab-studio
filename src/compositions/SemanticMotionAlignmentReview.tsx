import type React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { ReviewStage } from "../components/review";
import { GeneratedVisual } from "../visual-brief/GeneratedVisual";
import type { GeneratedVisualBrief, VisualComponentId, VisualRhetoric } from "../visual-brief/generator";

const sceneFrames = 180;

const rhetoric: Record<VisualComponentId, VisualRhetoric> = {
  "distribution-bars": "distribution",
  "scenario-branches": "scenario",
  "market-cap-lines": "trend",
  "person-evidence-card": "person-evidence",
  "factor-sequence": "factor-sequence",
  "ranked-metric-list": "ranking",
  "binary-versus": "comparison",
  "key-stat-summary": "key-stat",
  "media-comparison": "media-comparison",
  "image-evidence-inset": "image-evidence",
  "process-steps": "process-steps",
  "causal-chain": "causal-chain",
  "quote-source-card": "quote-source",
  "historical-timeline": "historical-timeline",
  "decision-matrix": "decision-matrix",
  "model-classification-map": "model-classification",
  "core-positioning-node": "core-positioning",
  "capability-surface-grid": "capability-surface",
  "tradeoff-scale": "tradeoff",
  "rough-annotation": "rough-annotation",
};

const brief = (id: string, componentId: VisualComponentId, title: string, props: Record<string, unknown>) =>
  ({
    schemaVersion: "1.0",
    segment: { id, start: 0, end: 6, text: title },
    analysis: { rhetoric: rhetoric[componentId] },
    component: { id: componentId, status: "approved", selectionReason: "Evidence-timed review fixture." },
    narrative: { eyebrow: "TIMING REVIEW", title, subtitleZh: title, subtitleEn: title },
    props,
  }) satisfies GeneratedVisualBrief;

const scenes = [
  {
    title: "按口播逐项说明素材边界",
    subtitle: "当前项进入，讲完的项变暗，尚未讲到的项不提前出现",
    accent: "#59D98E",
    brief: brief("factor-timing", "factor-sequence", "只从准备好的素材中选择", {
      items: [
        { id: "prepare", title: "提前加入素材", detail: "素材先进入当前项目" },
        { id: "describe", title: "写清展示内容", detail: "明确每份素材展示什么" },
        { id: "bound", title: "限定选择范围", detail: "只选择已登记的素材" },
        { id: "avoid", title: "避免无关图片", detail: "不为丰富画面临时插图" },
      ],
      activeIndexTimeline: [
        { at: 0, index: 0 },
        { at: 1.4, index: 1 },
        { at: 2.8, index: 2 },
        { at: 4.2, index: 3 },
      ],
      summary: "画面状态严格跟随当前证据",
    }),
  },
  {
    title: "流程随着讲述向前推进",
    subtitle: "每一步只在对应口播开始后进入",
    accent: "#6EA8FF",
    brief: brief("process-timing", "process-steps", "从内容到成片的制作流程", {
      items: [
        { id: "script", title: "写稿", detail: "先明确要讲什么" },
        { id: "shoot", title: "拍摄", detail: "录制人物原片" },
        { id: "make", title: "制作", detail: "按证据加入画面" },
        { id: "review", title: "审核", detail: "检查节奏与表达" },
      ],
      activeIndexTimeline: [
        { at: 0, index: 0 },
        { at: 1.4, index: 1 },
        { at: 2.8, index: 2 },
        { at: 4.2, index: 3 },
      ],
      takeaway: "先说到，后出现",
    }),
  },
  {
    title: "左右比较不会提前揭示第二项",
    subtitle: "第二种做法在口播真正讲到时才进入",
    accent: "#F3B545",
    brief: brief("comparison-timing", "binary-versus", "两种制作方式各有特点", {
      items: [
        { id: "manual", label: "手工选择", metric: "逐段处理", detail: "控制直接，但重复工作较多" },
        { id: "workflow", label: "工作流制作", metric: "证据驱动", detail: "自动执行，同时保留人工审核" },
      ],
      relation: "VS",
      activeIndexTimeline: [
        { at: 0, index: 0 },
        { at: 3, index: 1 },
      ],
      takeaway: "对比项按真实讲述顺序进入",
    }),
  },
  {
    title: "否定表达按目标逐个标注",
    subtitle: "只有明确说出的目标才会被划掉",
    accent: "#FF626B",
    brief: brief("annotation-timing", "rough-annotation", "选择标准不是越多越好", {
      headline: "选择标准",
      layout: "stack",
      items: [
        { id: "more", text: "越多越好", effect: "crossed-off" },
        { id: "higher", text: "越高越好", effect: "crossed-off" },
      ],
      activeIndexTimeline: [
        { at: 0, index: 0 },
        { at: 3, index: 1 },
      ],
    }),
  },
] as const;

export const SemanticMotionAlignmentReview: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sceneIndex = Math.min(scenes.length - 1, Math.floor(frame / sceneFrames));
  const scene = scenes[sceneIndex];
  const localFrame = frame - sceneIndex * sceneFrames;
  return (
    <ReviewStage
      eyebrow="SEMANTIC MOTION ALIGNMENT"
      title={scene.title}
      subtitleZh={scene.subtitle}
      subtitleEn={`Evidence-timed fixture ${sceneIndex + 1} / ${scenes.length}`}
      accent={scene.accent}
    >
      <GeneratedVisual brief={scene.brief} frame={localFrame} fps={fps} />
    </ReviewStage>
  );
};
