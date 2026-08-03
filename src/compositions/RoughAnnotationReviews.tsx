import { useCurrentFrame, useVideoConfig } from "remotion";
import {
  RoughAnnotation,
  type RoughAnnotationEffect,
  type RoughAnnotationItem,
  ReviewStage,
} from "../components/review";

const cases: Array<{ effect: RoughAnnotationEffect; label: string; text: string; accent: string }> = [
  { effect: "circle", label: "聚焦概念", text: "语义证据", accent: "#6EA8FF" },
  { effect: "underline", label: "轻量强调", text: "先理解，再呈现", accent: "#59D98E" },
  { effect: "highlight", label: "强重点", text: "证据相关性优先", accent: "#F3B545" },
  { effect: "box", label: "框定结论", text: "本地确定性", accent: "#59D98E" },
  { effect: "crossed-off", label: "否定判断", text: "越多越好", accent: "#FF626B" },
  { effect: "strike-through", label: "纠正旧说法", text: "Agent 直接选组件", accent: "#FF626B" },
  { effect: "bracket", label: "归组范围", text: "文字 · 标题 · 证据", accent: "#B59CFF" },
];

const useTime = () => ({ frame: useCurrentFrame(), fps: useVideoConfig().fps });

const itemsFor = (effect: RoughAnnotationEffect, text: string): RoughAnnotationItem[] => [{ id: effect, effect, text }];

export const RoughAnnotationEffectReview = ({ index }: { index: number }) => {
  const t = useTime();
  const item = cases[index];
  return (
    <ReviewStage
      eyebrow="ROUGH ANNOTATION"
      title={`${item.label} · ${item.effect}`}
      subtitleZh="标注只作用于口播证据支持的短语"
      subtitleEn="Annotations are limited to short evidence-bound phrases."
      accent={item.accent}
    >
      <RoughAnnotation {...t} headline="语义意图 → 本地确定性映射" items={itemsFor(item.effect, item.text)} />
    </ReviewStage>
  );
};

export const RoughAnnotationNegationReview = () => {
  const t = useTime();
  return (
    <ReviewStage
      eyebrow="EVIDENCE-BOUND NEGATION"
      title="明确否定，不做无依据发散"
      subtitleZh="不是越多越好，也不是越高越好"
      subtitleEn="More is not always better, and higher is not always better."
      accent="#FF626B"
    >
      <RoughAnnotation
        {...t}
        headline="反例：不是越多越好，不是越高越好"
        items={[
          { id: "more", text: "越多越好", effect: "crossed-off" },
          { id: "higher", text: "越高越好", effect: "crossed-off" },
        ]}
      />
    </ReviewStage>
  );
};

export const RoughAnnotationSequenceReview = ({ backgroundSrc }: { backgroundSrc?: string }) => {
  const { frame, fps } = useTime();
  const index = Math.min(cases.length - 1, Math.floor(frame / 36));
  const localFrame = frame - index * 36;
  const item = cases[index];
  return (
    <ReviewStage
      eyebrow="ROUGH ANNOTATION"
      title="七种效果，一个语义组件"
      subtitleZh={`${index + 1}/7 · ${item.label}`}
      subtitleEn={`${index + 1}/7 · Deterministic semantic annotation`}
      accent={item.accent}
      backgroundSrc={backgroundSrc}
    >
      <RoughAnnotation
        frame={localFrame}
        fps={fps}
        headline={`LOCAL ROUTER · ${item.effect}`}
        items={itemsFor(item.effect, item.text)}
      />
    </ReviewStage>
  );
};

export const roughAnnotationReviewDefinitions = cases.map((item, index) => ({
  id: `ReviewRoughAnnotation${item.effect
    .split("-")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("")}`,
  index,
}));
