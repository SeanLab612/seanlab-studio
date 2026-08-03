import { AbsoluteFill, interpolate, spring } from "remotion";
import type { ResolvedAnimationCue } from "../visual-production/timeline.ts";
import { AnimationStageVisual } from "./AnimationStageVisual.tsx";
import { animationConnectorPath, animationStageLayout } from "./layouts.ts";
import { DrawnArrow, MarkerUnderline, PaperNote, PaperTape } from "./primitives.tsx";

const ink = "#292722";
const mutedInk = "rgba(41,39,34,.58)";
const colors = ["#F05E4F", "#8B6BCB", "#F3A31B", "#2E9B68", "#E26355", "#5D82C8"];
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const titles: Partial<Record<ResolvedAnimationCue["animationIntent"]["prototypeId"], string>> = {
  "process-flow": "事情是这样一步步发生的",
  "state-transition": "状态正在发生变化",
  "evidence-gate": "满足条件，才允许通过",
  "causal-chain": "原因如何一步步带来结果",
  "before-after": "改变前后，差别在哪里",
  "layered-system": "每一层负责不同的事情",
};

export const PaperEditorialAnimation = ({
  cue,
  frame,
  fps,
}: {
  cue: ResolvedAnimationCue;
  frame: number;
  fps: number;
}) => {
  const enter = spring({ frame, fps, config: { damping: 17, stiffness: 118, mass: 0.9 } });
  const durationFrames = Math.max(1, Math.round((cue.end - cue.start) * fps));
  const stages = cue.animationIntent.stages;
  const stageWindow = durationFrames / Math.max(2, stages.length + 0.6);
  const positions = animationStageLayout(cue.animationIntent.prototypeId, stages.length);
  return (
    <AbsoluteFill style={{ overflow: "hidden", background: "#F2EEDF", color: ink }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(41,39,34,.025) 1px, transparent 1px), linear-gradient(90deg, rgba(41,39,34,.02) 1px, transparent 1px)",
          backgroundSize: "34px 34px",
        }}
      />
      <div style={{ position: "absolute", inset: 0, background: "rgba(255,251,239,.12)" }} />
      <div style={{ position: "absolute", left: 96, top: 76, width: 780, opacity: enter }}>
        <PaperTape style={{ left: -12, top: -18, transform: "rotate(-3deg)" }} />
        <div style={{ position: "relative", fontFamily: '"Kaiti SC", STKaiti, serif', fontSize: 25, fontWeight: 800 }}>
          {titles[cue.animationIntent.prototypeId] ?? "口播关系正在变成画面"}
        </div>
        <div
          style={{
            position: "relative",
            fontFamily: '"PingFang SC", sans-serif',
            fontSize: 54,
            fontWeight: 900,
            lineHeight: 1.08,
            marginTop: 8,
          }}
        >
          {cue.animationIntent.takeaway}
        </div>
        <div style={{ width: 620, marginTop: 4 }}>
          <MarkerUnderline progress={interpolate(frame, [8, 28], [0, 1], clamp)} />
        </div>
      </div>

      <svg width="1920" height="1080" viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0 }}>
        {positions.slice(0, -1).map((position, index) => {
          const next = positions[index + 1];
          const start = Math.round((index + 0.72) * stageWindow);
          const arrowProgress = interpolate(frame, [start, start + Math.round(fps * 0.42)], [0, 1], clamp);
          const d = animationConnectorPath(position, next);
          return <DrawnArrow key={`arrow-${stages[index].id}`} d={d} progress={arrowProgress} color={colors[index]} />;
        })}
      </svg>

      {stages.map((stage, index) => {
        const delay = Math.round(index * stageWindow);
        const stageEnter = spring({ frame: frame - delay, fps, config: { damping: 16, stiffness: 126, mass: 0.82 } });
        const position = positions[index];
        return (
          <PaperNote
            key={stage.id}
            style={{
              left: position.x,
              top: position.y,
              width: position.width,
              minHeight: position.minHeight,
              padding: "28px 24px 22px",
              transform: `rotate(${index % 2 ? 1.4 : -1.6}deg) scale(${0.92 + stageEnter * 0.08})`,
              opacity: stageEnter,
            }}
          >
            <PaperTape
              color={colors[index]}
              style={{ left: 98, top: -13, transform: `rotate(${index % 2 ? -2 : 2}deg)` }}
            />
            <div
              style={{ fontFamily: '"Kaiti SC", STKaiti, serif', fontSize: 18, fontWeight: 900, color: colors[index] }}
            >
              {String(index + 1).padStart(2, "0")} · {stage.action}
            </div>
            <div style={{ height: 104, display: "grid", placeItems: "center", marginTop: 8 }}>
              <AnimationStageVisual stage={stage} size={96} color={colors[index]} />
            </div>
            <div style={{ fontFamily: '"PingFang SC", sans-serif', fontSize: 28, fontWeight: 850, marginTop: 12 }}>
              {stage.label}
            </div>
            <div style={{ fontFamily: '"Kaiti SC", STKaiti, serif', fontSize: 17, color: mutedInk, marginTop: 10 }}>
              {stage.spokenQuote}
            </div>
          </PaperNote>
        );
      })}
    </AbsoluteFill>
  );
};
