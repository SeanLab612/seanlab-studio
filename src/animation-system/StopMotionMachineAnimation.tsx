import type { CSSProperties } from "react";
import { AbsoluteFill, interpolate, spring } from "remotion";
import type { ResolvedAnimationCue } from "../visual-production/timeline.ts";
import { AnimationStageVisual } from "./AnimationStageVisual.tsx";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ink = "#302820";
const paper = "#DDC9A5";
const cream = "#F0DFC0";
const palette = ["#B94A37", "#D6A43A", "#327076", "#C85A3F", "#497691", "#A36A46"];

const titles: Partial<Record<ResolvedAnimationCue["animationIntent"]["prototypeId"], string>> = {
  "process-flow": "步骤正在向前推进",
  "state-transition": "状态如何一步步改变",
  "evidence-gate": "满足条件，机器才会放行",
  "causal-chain": "问题如何被逐步放大",
  "before-after": "改变前后，结果有何不同",
  "layered-system": "不同部分如何共同运转",
};

const enterSpring = (frame: number, fps: number, start: number) =>
  frame < start
    ? 0
    : spring({
        frame: frame - start,
        fps,
        config: { damping: 18, stiffness: 132, mass: 0.82 },
      });

const MachinePlate = ({
  number,
  label,
  active,
  style,
}: {
  number: string;
  label: string;
  active: boolean;
  style: CSSProperties;
}) => (
  <div
    style={{
      position: "absolute",
      minWidth: 190,
      height: 68,
      padding: "0 18px",
      display: "flex",
      alignItems: "center",
      gap: 14,
      color: ink,
      background: paper,
      border: `5px solid ${ink}`,
      boxShadow: `0 10px 0 rgba(0,0,0,.3), 0 0 ${active ? 28 : 0}px rgba(214,164,58,.44)`,
      boxSizing: "border-box",
      ...style,
    }}
  >
    <b style={{ fontFamily: '"Courier New", monospace', fontSize: 18 }}>{number}</b>
    <b style={{ fontFamily: '"Songti SC", "PingFang SC", serif', fontSize: 27, letterSpacing: 2 }}>{label}</b>
  </div>
);

const Gear = ({ rotation, active }: { rotation: number; active: boolean }) => (
  <div
    style={{
      width: 66,
      height: 66,
      borderRadius: "50%",
      border: `13px dotted ${active ? "#D6A43A" : "#5E5144"}`,
      transform: `rotate(${rotation}deg)`,
      boxSizing: "border-box",
    }}
  />
);

export const StopMotionMachineAnimation = ({
  cue,
  frame,
  fps,
}: {
  cue: ResolvedAnimationCue;
  frame: number;
  fps: number;
}) => {
  const quantizedFrame = Math.floor(frame / 2) * 2;
  const stages = cue.animationIntent.stages;
  const durationFrames = Math.max(1, Math.round((cue.end - cue.start) * fps));
  const stageWindow = durationFrames / Math.max(2, stages.length + 0.45);
  const activeIndex = Math.min(stages.length - 1, Math.max(0, Math.floor(quantizedFrame / stageWindow)));
  const slotWidth = 1680 / stages.length;
  const machineWidth = Math.min(286, Math.max(210, slotWidth - 34));
  const machineEnter = enterSpring(quantizedFrame, fps, 0);
  const beltTravel = interpolate(quantizedFrame, [0, durationFrames], [0, -260], clamp);
  const shake = Math.sin(quantizedFrame * 1.7) * 1.5;
  const takeawayLength = [...cue.animationIntent.takeaway].length;
  const takeawayFontSize = takeawayLength > 18 ? 54 : takeawayLength > 14 ? 62 : 72;

  return (
    <AbsoluteFill
      style={{
        overflow: "hidden",
        color: cream,
        background:
          "radial-gradient(circle at 50% 44%, rgba(73,63,52,.84), rgba(19,17,15,.97) 68%), repeating-linear-gradient(88deg,rgba(255,255,255,.025) 0 2px,transparent 2px 7px)",
        fontFamily: '"Songti SC", "PingFang SC", serif',
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 86,
          top: 54,
          width: 1260,
          opacity: machineEnter,
          transform: `translateY(${(1 - machineEnter) * -70}px) rotate(${shake * 0.05}deg)`,
        }}
      >
        <div style={{ fontSize: 28, color: "rgba(240,223,192,.68)", letterSpacing: 4 }}>
          {titles[cue.animationIntent.prototypeId] ?? "语义正在进入视觉系统"}
        </div>
        <div
          style={{
            marginTop: 8,
            fontSize: takeawayFontSize,
            fontWeight: 950,
            letterSpacing: takeawayFontSize < 60 ? 3 : 5,
            textShadow: `0 7px 0 ${ink}`,
          }}
        >
          {cue.animationIntent.takeaway}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 56,
          right: 56,
          top: 580,
          height: 92,
          border: "8px solid #24201C",
          background:
            "repeating-linear-gradient(90deg,#171717 0 62px,#EEE2C7 62px 76px,#171717 76px 138px,#EEE2C7 138px 152px)",
          transform: `translateX(${beltTravel}px)`,
          boxShadow: "0 18px 28px rgba(0,0,0,.52)",
        }}
      />

      {stages.map((stage, index) => {
        const delay = Math.round(index * stageWindow);
        const enter = enterSpring(quantizedFrame, fps, delay);
        const active = index === activeIndex;
        const left = 80 + index * slotWidth + (slotWidth - machineWidth) / 2;
        const top = 302 + (index % 2) * 42;
        const accent = palette[index % palette.length];
        return (
          <div key={stage.id}>
            <div
              style={{
                position: "absolute",
                left,
                top,
                width: machineWidth,
                height: 286,
                opacity: enter,
                color: ink,
                background: index % 2 ? accent : paper,
                border: `10px solid ${ink}`,
                boxShadow: `14px 18px 0 rgba(0,0,0,.3), 0 0 ${active ? 32 : 0}px rgba(214,164,58,.35)`,
                transform: `translateY(${(1 - enter) * (index % 2 ? -120 : 140)}px) rotate(${index % 2 ? 1.2 : -1.2}deg)`,
                boxSizing: "border-box",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: 22,
                  right: 22,
                  top: 22,
                  height: 172,
                  display: "grid",
                  placeItems: "center",
                  background: index % 2 ? cream : "#292A28",
                  border: "7px solid rgba(48,40,32,.72)",
                }}
              >
                <AnimationStageVisual
                  stage={stage}
                  size={Math.min(142, machineWidth * 0.54)}
                  color={index % 2 ? ink : cream}
                />
              </div>
              <div
                style={{ position: "absolute", left: 24, bottom: 24, display: "flex", alignItems: "center", gap: 18 }}
              >
                <Gear rotation={quantizedFrame * (active ? 2.2 : 0.7)} active={active} />
                <div style={{ maxWidth: machineWidth - 130, fontSize: 18, fontWeight: 900, lineHeight: 1.2 }}>
                  {stage.action}
                </div>
              </div>
            </div>
            <MachinePlate
              number={String(index + 1).padStart(2, "0")}
              label={stage.label}
              active={active}
              style={{
                left,
                top: 720 + (index % 2) * 12,
                width: machineWidth,
                opacity: enter,
                transform: `translateY(${(1 - enter) * 36}px)`,
              }}
            />
          </div>
        );
      })}

      {cue.animationIntent.prototypeId === "evidence-gate" ? (
        <div
          style={{
            position: "absolute",
            right: 86,
            top: 250,
            width: 34,
            height: interpolate(quantizedFrame, [durationFrames * 0.72, durationFrames * 0.9], [340, 62], clamp),
            background: "#B94A37",
            border: `7px solid ${ink}`,
            boxShadow: "12px 14px 0 rgba(0,0,0,.3)",
          }}
        />
      ) : null}

      <div
        style={{
          position: "absolute",
          left: 62,
          bottom: 44,
          fontFamily: '"Courier New", monospace',
          fontSize: 16,
          letterSpacing: 2,
          color: "rgba(232,215,184,.58)",
        }}
      >
        STOP MOTION SYSTEM · {cue.animationIntent.prototypeId.toUpperCase()} · FRAME{" "}
        {String(quantizedFrame).padStart(3, "0")}
      </div>
    </AbsoluteFill>
  );
};
