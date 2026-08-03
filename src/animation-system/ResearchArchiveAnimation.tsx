import { AbsoluteFill, interpolate, spring } from "remotion";
import type { ResolvedAnimationCue } from "../visual-production/timeline.ts";
import { AnimationStageVisual } from "./AnimationStageVisual.tsx";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const palette = {
  paper: "#E9E2D4",
  paperLight: "#F4EEE3",
  ink: "#252723",
  graphite: "#555950",
  navy: "#26384B",
  copper: "#A76E42",
  wood: "#76583B",
};

const enter = (frame: number, fps: number, delay = 0) =>
  spring({
    frame: frame - delay,
    fps,
    config: { damping: 18, stiffness: 118, mass: 0.82 },
  });

const localProgress = (frame: number, start: number, duration: number) =>
  interpolate(frame, [start, start + duration], [0, 1], clamp);

const ArchiveSurface = ({
  cue,
  frame,
  fps,
  children,
}: {
  cue: ResolvedAnimationCue;
  frame: number;
  fps: number;
  children: React.ReactNode;
}) => {
  const titleEnter = enter(frame, fps);
  const prototype = cue.animationIntent.prototypeId;
  const labels = {
    "aggregate-decompose": ["聚合与拆解", "观察多个部分如何组成整体"],
    "focus-zoom": ["尺度变焦", "从全局进入关键细节，再返回整体"],
    "threshold-landing": ["阈值与落点", "把标准、实际结果和差距放在同一尺度"],
    "converge-diffuse": ["扩散与汇流", "观察多条独立线索如何汇成共同结论"],
  } as const;
  const [title, note] = labels[prototype as keyof typeof labels] ?? ["研究档案", "动态观察记录"];

  return (
    <AbsoluteFill
      style={{
        overflow: "hidden",
        color: palette.ink,
        backgroundColor: palette.paper,
        backgroundImage: `
          radial-gradient(circle at 18% 24%, rgba(255,255,255,.72), transparent 34%),
          radial-gradient(circle at 76% 62%, rgba(70,62,48,.08), transparent 42%),
          repeating-linear-gradient(0deg, rgba(54,57,52,.025) 0 1px, transparent 1px 5px),
          repeating-linear-gradient(90deg, rgba(255,255,255,.08) 0 1px, transparent 1px 9px)
        `,
        fontFamily: '"Songti SC", "Noto Serif SC", serif',
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: "0 0 auto",
          height: 34,
          background: "#D3C9B7",
          boxShadow: "0 8px 20px rgba(56,46,35,.12)",
          clipPath: "polygon(0 0,100% 0,100% 72%,91% 87%,74% 70%,58% 91%,43% 68%,27% 88%,12% 70%,0 86%)",
        }}
      />
      <svg width="1920" height="1080" viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0, opacity: 0.3 }}>
        <path d="M72 244 H1848 M72 870 H1848 M420 52 V930 M1432 52 V930" stroke={palette.graphite} />
        <path d="M82 268 H1840 M82 846 H1840" stroke={palette.graphite} strokeDasharray="5 10" />
      </svg>
      <div
        style={{
          position: "absolute",
          left: 74,
          top: 68,
          width: 1280,
          opacity: titleEnter,
          transform: `translateY(${(1 - titleEnter) * -22}px)`,
          zIndex: 4,
        }}
      >
        <div
          style={{
            color: palette.navy,
            fontFamily: '"Courier New", monospace',
            fontSize: 18,
            fontWeight: 800,
            letterSpacing: 2.4,
          }}
        >
          RESEARCH ARCHIVE · {prototype.toUpperCase()}
        </div>
        <div style={{ width: 210, height: 2, marginTop: 10, background: palette.copper }} />
        <div style={{ marginTop: 12, fontSize: 58, fontWeight: 850, letterSpacing: 2 }}>{title}</div>
        <div
          style={{
            marginTop: 7,
            color: "rgba(37,39,35,.62)",
            fontFamily: '"PingFang SC", sans-serif',
            fontSize: 20,
            fontWeight: 650,
          }}
        >
          {note}
        </div>
      </div>
      {children}
      <div
        style={{
          position: "absolute",
          left: 430,
          right: 430,
          bottom: 82,
          display: "flex",
          justifyContent: "center",
          gap: 30,
          zIndex: 5,
        }}
      >
        {cue.animationIntent.stages.map((stage, index) => (
          <div
            key={`asset-${stage.id}`}
            style={{
              width: 96,
              height: 76,
              display: "grid",
              placeItems: "center",
              opacity: enter(frame, fps, index * 7),
              background: "rgba(244,238,227,.86)",
              border: `2px solid ${index % 2 ? palette.copper : palette.navy}`,
            }}
          >
            <AnimationStageVisual
              stage={stage}
              size={stage.imageAssetSrc ? 82 : 48}
              color={index % 2 ? palette.copper : palette.navy}
            />
          </div>
        ))}
      </div>
      <div
        style={{
          position: "absolute",
          left: 76,
          right: 76,
          bottom: 30,
          paddingTop: 14,
          display: "flex",
          justifyContent: "space-between",
          borderTop: "1px solid rgba(54,57,52,.2)",
          color: "rgba(37,39,35,.48)",
          fontFamily: '"Courier New", monospace',
          fontSize: 13,
          letterSpacing: 1.7,
        }}
      >
        <span>SEANLAB · MOTION STUDY</span>
        <span>{cue.animationIntent.takeaway}</span>
      </div>
    </AbsoluteFill>
  );
};

const ArchiveLabel = ({
  label,
  action,
  x,
  y,
  opacity,
  accent = palette.navy,
  scale = 1,
}: {
  label: string;
  action: string;
  x: number;
  y: number;
  opacity: number;
  accent?: string;
  scale?: number;
}) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      minWidth: 170,
      maxWidth: 260,
      padding: "17px 22px 16px",
      border: `3px solid ${accent}`,
      background: palette.paperLight,
      boxShadow: "0 12px 20px rgba(48,40,31,.16)",
      opacity,
      transform: `translate(-50%,-50%) scale(${scale})`,
      textAlign: "center",
    }}
  >
    <div style={{ color: accent, fontFamily: '"PingFang SC", sans-serif', fontSize: 25, fontWeight: 900 }}>{label}</div>
    <div
      style={{
        marginTop: 6,
        color: palette.graphite,
        fontFamily: '"PingFang SC", sans-serif',
        fontSize: 16,
        fontWeight: 650,
      }}
    >
      {action}
    </div>
  </div>
);

const AggregateDecomposeScene = ({ cue, frame, fps }: { cue: ResolvedAnimationCue; frame: number; fps: number }) => {
  const stages = cue.animationIntent.stages;
  const duration = Math.max(1, Math.round((cue.end - cue.start) * fps));
  const flow = localProgress(frame, duration * 0.12, duration * 0.58);
  const result = enter(frame, fps, duration * 0.62);
  const center = { x: 1180, y: 570 };
  return (
    <>
      <svg width="1920" height="1080" style={{ position: "absolute", inset: 0 }}>
        {stages.map((stage, index) => {
          const y = 338 + index * (430 / Math.max(1, stages.length - 1));
          return (
            <path
              key={stage.id}
              d={`M 315 ${y} C 650 ${y}, 845 ${center.y + (index - stages.length / 2) * 30}, ${center.x} ${center.y}`}
              fill="none"
              stroke={index % 2 ? palette.copper : palette.navy}
              strokeWidth="3"
              strokeDasharray="7 10"
              strokeDashoffset={(1 - flow) * 250}
              opacity={0.58}
            />
          );
        })}
      </svg>
      {stages.map((stage, index) => {
        const startY = 338 + index * (430 / Math.max(1, stages.length - 1));
        const staggered = Math.max(0, Math.min(1, flow * 1.25 - index * 0.06));
        return (
          <ArchiveLabel
            key={stage.id}
            label={stage.label}
            action={stage.action}
            x={315 + (center.x - 315) * staggered}
            y={startY + (center.y - startY) * staggered}
            opacity={enter(frame, fps, index * 8)}
            scale={1 - staggered * 0.18}
            accent={index % 2 ? palette.copper : palette.navy}
          />
        );
      })}
      <div
        style={{
          position: "absolute",
          left: 1280,
          top: 420,
          width: 390,
          height: 290,
          display: "grid",
          placeItems: "center",
          padding: 32,
          border: "10px solid rgba(92,75,55,.52)",
          background: "rgba(244,238,227,.92)",
          boxShadow: "0 20px 34px rgba(53,42,30,.18)",
          opacity: result,
          transform: `scale(${0.72 + result * 0.28}) rotate(-2deg)`,
          textAlign: "center",
        }}
      >
        <div>
          <div style={{ color: palette.copper, fontFamily: "monospace", fontSize: 17, fontWeight: 900 }}>
            COMBINED RESULT
          </div>
          <div style={{ marginTop: 15, fontSize: 47, fontWeight: 900 }}>{cue.animationIntent.takeaway}</div>
        </div>
      </div>
    </>
  );
};

const FocusZoomScene = ({ cue, frame, fps }: { cue: ResolvedAnimationCue; frame: number; fps: number }) => {
  const stages = cue.animationIntent.stages;
  const duration = Math.max(1, Math.round((cue.end - cue.start) * fps));
  const focus = interpolate(
    frame,
    [duration * 0.2, duration * 0.42, duration * 0.72, duration * 0.9],
    [0, 1, 1, 0],
    clamp,
  );
  const center = { x: 970, y: 585 };
  const selected = Math.min(1, stages.length - 1);
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        transformOrigin: `${center.x}px ${center.y}px`,
        transform: `translateX(${focus * -170}px) scale(${1 + focus * 0.34})`,
      }}
    >
      <svg width="1920" height="1080" style={{ position: "absolute", inset: 0 }}>
        <circle cx={center.x} cy={center.y} r="270" fill="rgba(245,239,226,.4)" stroke={palette.ink} strokeWidth="3" />
        <circle cx={center.x} cy={center.y} r="206" fill="none" stroke={palette.graphite} strokeDasharray="7 12" />
        {stages.map((stage, index) => {
          const angle = (index / stages.length) * Math.PI * 2 - Math.PI / 2;
          const x = center.x + Math.cos(angle) * 270;
          const y = center.y + Math.sin(angle) * 270;
          const active = index === selected;
          return (
            <g key={stage.id} opacity={enter(frame, fps, index * 7)}>
              <line x1={center.x} y1={center.y} x2={x} y2={y} stroke={palette.graphite} strokeWidth="2" />
              <circle cx={x} cy={y} r={active ? 55 + focus * 22 : 36} fill={active ? palette.copper : palette.navy} />
              <text
                x={x}
                y={y + (y < center.y ? -74 : 82)}
                textAnchor="middle"
                fill={palette.ink}
                fontFamily='"PingFang SC", sans-serif'
                fontSize={active ? 25 : 21}
                fontWeight="800"
              >
                {stage.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div
        style={{
          position: "absolute",
          left: center.x,
          top: center.y,
          width: 330,
          transform: "translate(-50%,-50%)",
          textAlign: "center",
        }}
      >
        <div style={{ color: palette.copper, fontFamily: "monospace", fontSize: 17, fontWeight: 900 }}>KEY DETAIL</div>
        <div style={{ marginTop: 12, fontSize: 43, fontWeight: 900 }}>
          {stages[selected]?.label ?? cue.animationIntent.takeaway}
        </div>
        <div style={{ marginTop: 9, color: palette.graphite, fontSize: 20 }}>{stages[selected]?.spokenQuote}</div>
      </div>
    </div>
  );
};

const ThresholdLandingScene = ({ cue, frame, fps }: { cue: ResolvedAnimationCue; frame: number; fps: number }) => {
  const duration = Math.max(1, Math.round((cue.end - cue.start) * fps));
  const actual = localProgress(frame, duration * 0.2, duration * 0.48);
  const landing = enter(frame, fps, duration * 0.62);
  const [target, observed, ...rest] = cue.animationIntent.stages;
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: 240,
          top: 365,
          width: 1080,
          height: 340,
          borderBottom: `4px solid ${palette.ink}`,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 112,
            borderTop: `4px dashed ${palette.copper}`,
          }}
        />
        <div style={{ position: "absolute", left: 0, top: 68, color: palette.copper, fontSize: 22, fontWeight: 900 }}>
          目标线 · {target?.label}
        </div>
        <div
          style={{
            position: "absolute",
            left: 300,
            bottom: 0,
            width: 180,
            height: 250 * actual,
            background: palette.navy,
            boxShadow: "12px 14px 0 rgba(46,42,35,.14)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 520,
            bottom: 0,
            width: 180,
            height: 140 * actual,
            background: palette.copper,
            boxShadow: "12px 14px 0 rgba(46,42,35,.14)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 286,
            top: 292,
            width: 208,
            textAlign: "center",
            fontSize: 23,
            fontWeight: 850,
          }}
        >
          {observed?.label ?? "实际结果"}
        </div>
        <div
          style={{
            position: "absolute",
            left: 506,
            top: 292,
            width: 208,
            textAlign: "center",
            fontSize: 23,
            fontWeight: 850,
          }}
        >
          {rest[0]?.label ?? "差距"}
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          right: 190,
          top: 410,
          width: 360,
          padding: "38px 34px",
          border: `4px solid ${palette.ink}`,
          background: palette.paperLight,
          boxShadow: "14px 18px 0 rgba(72,57,40,.14)",
          opacity: landing,
          transform: `translateY(${(1 - landing) * 45}px) rotate(2deg)`,
        }}
      >
        <div style={{ color: palette.copper, fontFamily: "monospace", fontSize: 17, fontWeight: 900 }}>LANDING</div>
        <div style={{ marginTop: 14, fontSize: 42, fontWeight: 900, lineHeight: 1.15 }}>
          {cue.animationIntent.takeaway}
        </div>
      </div>
    </>
  );
};

const ConvergeDiffuseScene = ({ cue, frame, fps }: { cue: ResolvedAnimationCue; frame: number; fps: number }) => {
  const stages = cue.animationIntent.stages;
  const duration = Math.max(1, Math.round((cue.end - cue.start) * fps));
  const flow = localProgress(frame, duration * 0.12, duration * 0.6);
  const conclusion = enter(frame, fps, duration * 0.64);
  const center = { x: 1110, y: 590 };
  return (
    <>
      <svg width="1920" height="1080" style={{ position: "absolute", inset: 0 }}>
        {stages.map((stage, index) => {
          const x = 260 + (index % 2) * 360;
          const y = 340 + Math.floor(index / 2) * 210;
          const local = Math.max(0, Math.min(1, flow * 1.3 - index * 0.06));
          return (
            <g key={stage.id}>
              <path
                d={`M ${x} ${y} C ${x + 260} ${y}, ${center.x - 220} ${center.y}, ${center.x} ${center.y}`}
                fill="none"
                stroke={index % 2 ? palette.copper : palette.navy}
                strokeWidth="4"
                strokeDasharray="8 10"
                strokeDashoffset={(1 - local) * 260}
                opacity={0.6}
              />
              <circle cx={x} cy={y} r="12" fill={index % 2 ? palette.copper : palette.navy} />
            </g>
          );
        })}
      </svg>
      {stages.map((stage, index) => {
        const x = 260 + (index % 2) * 360;
        const y = 340 + Math.floor(index / 2) * 210;
        return (
          <ArchiveLabel
            key={stage.id}
            label={stage.label}
            action={stage.action}
            x={x}
            y={y}
            opacity={enter(frame, fps, index * 8)}
            accent={index % 2 ? palette.copper : palette.navy}
          />
        );
      })}
      <div
        style={{
          position: "absolute",
          left: center.x,
          top: center.y,
          width: 330,
          height: 330,
          display: "grid",
          placeItems: "center",
          padding: 44,
          borderRadius: "50%",
          border: `7px solid ${palette.paperLight}`,
          outline: `3px solid ${palette.ink}`,
          background: palette.navy,
          color: palette.paperLight,
          boxShadow: "0 22px 38px rgba(41,40,35,.26)",
          opacity: conclusion,
          transform: `translate(-50%,-50%) scale(${0.58 + conclusion * 0.42})`,
          textAlign: "center",
          fontSize: 37,
          fontWeight: 900,
          lineHeight: 1.18,
        }}
      >
        {cue.animationIntent.takeaway}
      </div>
    </>
  );
};

export const ResearchArchiveAnimation = ({
  cue,
  frame,
  fps,
}: {
  cue: ResolvedAnimationCue;
  frame: number;
  fps: number;
}) => {
  if (
    !["aggregate-decompose", "focus-zoom", "threshold-landing", "converge-diffuse"].includes(
      cue.animationIntent.prototypeId,
    )
  )
    throw new Error(`Research Archive cannot render ${cue.animationIntent.prototypeId}`);
  const scene =
    cue.animationIntent.prototypeId === "aggregate-decompose" ? (
      <AggregateDecomposeScene cue={cue} frame={frame} fps={fps} />
    ) : cue.animationIntent.prototypeId === "focus-zoom" ? (
      <FocusZoomScene cue={cue} frame={frame} fps={fps} />
    ) : cue.animationIntent.prototypeId === "threshold-landing" ? (
      <ThresholdLandingScene cue={cue} frame={frame} fps={fps} />
    ) : (
      <ConvergeDiffuseScene cue={cue} frame={frame} fps={fps} />
    );
  return (
    <ArchiveSurface cue={cue} frame={frame} fps={fps}>
      {scene}
    </ArchiveSurface>
  );
};
