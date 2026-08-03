import { Box, Bracket, Circle, CrossedOff, Highlight, StrikeThrough, Underline } from "@remotion/rough-notation";
import type React from "react";
import { interpolate } from "remotion";
import { enter, palette, rise } from "./shared";
import { useTypographyDecision } from "../../typography-policy";
import { resolveComponentAccent } from "../../design-tokens";

export type RoughAnnotationEffect =
  | "highlight"
  | "underline"
  | "circle"
  | "box"
  | "crossed-off"
  | "strike-through"
  | "bracket";

export type RoughAnnotationItem = {
  id: string;
  text: string;
  effect: RoughAnnotationEffect;
  color?: string;
};

export type RoughAnnotationProps = {
  frame: number;
  fps: number;
  headline?: string;
  items: RoughAnnotationItem[];
  layout?: "row" | "stack";
  reducedMotion?: boolean;
  activeIndex?: number;
  activeProgress?: number;
  compact?: boolean;
  textColor?: string;
  zone?: { left: number; top: number; width: number; minHeight: number };
};

const colorFor = (effect: RoughAnnotationEffect) => {
  if (effect === "highlight") return "#F3B545";
  if (effect === "crossed-off" || effect === "strike-through") return palette.red;
  if (effect === "bracket") return palette.violet;
  if (effect === "circle") return palette.blue;
  return palette.mint;
};

const AnnotatedText: React.FC<{
  item: RoughAnnotationItem;
  progress: number;
  seed: number;
}> = ({ item, progress, seed }) => {
  const typography = useTypographyDecision({
    text: item.text,
    role: "annotation",
    componentId: "rough-annotation",
  });
  const color = resolveComponentAccent(item.color, colorFor(item.effect));
  const shared = { progress, seed, color, strokeWidth: 6, iterations: 2 } as const;
  const content = <span style={{ fontFamily: typography.family, fontWeight: typography.fontWeight }}>{item.text}</span>;

  switch (item.effect) {
    case "highlight":
      return (
        <Highlight progress={progress} seed={seed} color={color} iterations={2} padding={{ top: 4, bottom: 3 }}>
          {content}
        </Highlight>
      );
    case "underline":
      return <Underline {...shared}>{content}</Underline>;
    case "circle":
      return (
        <Circle {...shared} padding={{ left: 14, right: 14, top: 7, bottom: 7 }} box="around">
          {content}
        </Circle>
      );
    case "box":
      return (
        <Box {...shared} padding={{ left: 14, right: 14, top: 8, bottom: 8 }}>
          {content}
        </Box>
      );
    case "crossed-off":
      return <CrossedOff {...shared}>{content}</CrossedOff>;
    case "strike-through":
      return <StrikeThrough {...shared}>{content}</StrikeThrough>;
    case "bracket":
      return (
        <Bracket
          progress={progress}
          seed={seed}
          color={color}
          strokeWidth={6}
          bracketLeft
          bracketRight
          padding={{ left: 12, right: 12, top: 5, bottom: 5 }}
        >
          {content}
        </Bracket>
      );
  }
};

export const RoughAnnotation: React.FC<RoughAnnotationProps> = ({
  frame,
  fps,
  headline,
  items,
  layout = items.length > 1 ? "stack" : "row",
  reducedMotion = false,
  activeIndex = items.length - 1,
  activeProgress = 1,
  compact = false,
  textColor = palette.paper,
  zone = { left: 74, top: 250, width: 780, minHeight: 390 },
}) => {
  const intro = reducedMotion ? 1 : enter(frame, fps, 5);
  const annotationSize = (text: string) => {
    const length = [...text].length;
    if (compact) return length <= 6 ? 62 : length <= 12 ? 54 : length <= 18 ? 46 : 40;
    if (items.length === 1) return length <= 6 ? 104 : length <= 10 ? 92 : length <= 14 ? 78 : 66;
    return length <= 6 ? 88 : length <= 10 ? 78 : length <= 14 ? 68 : 58;
  };
  return (
    <div
      style={{
        position: "absolute",
        left: zone.left,
        top: zone.top,
        width: zone.width,
        minHeight: zone.minHeight,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        ...rise(intro),
      }}
    >
      {headline ? (
        <div
          style={{
            color: palette.muted,
            fontSize: 24,
            fontWeight: 750,
            letterSpacing: 2.2,
            marginBottom: 38,
          }}
        >
          {headline}
        </div>
      ) : null}
      <div
        style={{
          display: "flex",
          flexDirection: layout === "row" ? "row" : "column",
          alignItems: layout === "row" ? "center" : "flex-start",
          gap: layout === "row" ? 40 : 34,
          flexWrap: "wrap",
        }}
      >
        {items.map((item, index) => {
          const start = 14 + index * 18;
          const drawProgress = reducedMotion
            ? 1
            : interpolate(frame, [start, start + Math.round(fps * 0.7)], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
          const progress = index < activeIndex ? 1 : index === activeIndex ? Math.min(drawProgress, activeProgress) : 0;
          return (
            <div
              key={item.id}
              style={{
                color: textColor,
                fontSize: annotationSize(item.text),
                fontWeight: 850,
                lineHeight: 1.22,
                letterSpacing: 0.5,
                whiteSpace: "nowrap",
                opacity: index < activeIndex ? 0.55 : index === activeIndex ? activeProgress : 0,
              }}
            >
              <AnnotatedText item={item} progress={progress} seed={20260718 + index} />
            </div>
          );
        })}
      </div>
    </div>
  );
};
