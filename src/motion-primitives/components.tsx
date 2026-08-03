import type React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { countAtProgress, motionProgress, springSettleProgress } from "./progress";

export const MotionReveal: React.FC<{
  children: React.ReactNode;
  delayFrames?: number;
  durationMs?: number;
  distance?: number;
  scaleFrom?: number;
  reducedMotion?: boolean;
  style?: React.CSSProperties;
}> = ({ children, delayFrames, durationMs, distance = 14, scaleFrom = 0.975, reducedMotion, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = motionProgress({ frame, fps, delayFrames, durationMs, reducedMotion });
  return (
    <div
      style={{
        opacity: progress,
        transform:
          progress >= 0.999
            ? "none"
            : `translate3d(0, ${interpolate(progress, [0, 1], [distance, 0])}px, 0) scale(${interpolate(progress, [0, 1], [scaleFrom, 1])})`,
        filter: reducedMotion ? "none" : `blur(${interpolate(progress, [0, 1], [5, 0])}px)`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export const FocusDim: React.FC<{
  children: React.ReactNode;
  active: boolean;
  dimOpacity?: number;
  reducedMotion?: boolean;
  style?: React.CSSProperties;
}> = ({ children, active, dimOpacity = 0.24, reducedMotion, style }) => (
  <div
    style={{
      opacity: active ? 1 : dimOpacity,
      filter: active || reducedMotion ? "none" : "saturate(0.58) blur(0.15px)",
      transform: active || reducedMotion ? "none" : "scale(0.985)",
      transition: "none",
      ...style,
    }}
  >
    {children}
  </div>
);

export const AnimatedNumber: React.FC<{
  from?: number;
  to: number;
  delayFrames?: number;
  durationMs?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  reducedMotion?: boolean;
}> = ({ from = 0, to, delayFrames, durationMs = 720, decimals, prefix = "", suffix = "", reducedMotion }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = motionProgress({ frame, fps, delayFrames, durationMs, reducedMotion });
  return <>{`${prefix}${countAtProgress(from, to, progress, decimals)}${suffix}`}</>;
};

export const DrawLine: React.FC<{
  progress: number;
  width?: number;
  color?: string;
  strokeWidth?: number;
}> = ({ progress, width = 220, color = "#6EA8FF", strokeWidth = 4 }) => (
  <svg width={width} height={strokeWidth * 4} viewBox={`0 0 ${width} ${strokeWidth * 4}`}>
    <line
      x1={2}
      x2={width - 2}
      y1={strokeWidth * 2}
      y2={strokeWidth * 2}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      pathLength={1}
      strokeDasharray={1}
      strokeDashoffset={1 - progress}
    />
  </svg>
);

export const GrowBar: React.FC<{
  progress: number;
  width?: number;
  height?: number;
  color?: string;
}> = ({ progress, width = 240, height = 12, color = "#59D98E" }) => (
  <div style={{ width, height, borderRadius: 999, background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
    <div
      style={{
        width: `${Math.max(0, Math.min(1, progress)) * 100}%`,
        height: "100%",
        borderRadius: 999,
        background: `linear-gradient(90deg, ${color}88, ${color})`,
        boxShadow: `0 0 18px ${color}44`,
      }}
    />
  </div>
);

export const TraversePath: React.FC<{ progress: number; width?: number; color?: string }> = ({
  progress,
  width = 260,
  color = "#F3B545",
}) => {
  const x = interpolate(progress, [0, 1], [12, width - 12]);
  return (
    <svg width={width} height={42} viewBox={`0 0 ${width} 42`}>
      <path d={`M12 21 H${width - 12}`} stroke="rgba(255,255,255,0.14)" strokeWidth={3} strokeLinecap="round" />
      <path
        d={`M12 21 H${width - 12}`}
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1 - progress}
      />
      <circle cx={x} cy={21} r={7} fill={color} />
      <circle cx={x} cy={21} r={13} fill="none" stroke={`${color}55`} strokeWidth={2} />
    </svg>
  );
};

export const HighlightSweep: React.FC<{
  progress: number;
  color?: string;
  style?: React.CSSProperties;
}> = ({ progress, color = "rgba(255,255,255,0.42)", style }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      overflow: "hidden",
      pointerEvents: "none",
      borderRadius: "inherit",
      ...style,
    }}
  >
    <div
      style={{
        position: "absolute",
        top: "-30%",
        bottom: "-30%",
        width: "28%",
        left: `${interpolate(progress, [0, 1], [-38, 112])}%`,
        transform: "skewX(-18deg)",
        background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
        opacity: progress > 0 && progress < 1 ? 0.7 : 0,
      }}
    />
  </div>
);

export const StateMorph: React.FC<{
  progress: number;
  fromLabel: string;
  toLabel: string;
  fromColor?: string;
  toColor?: string;
  width?: number;
}> = ({ progress, fromLabel, toLabel, fromColor = "#6EA8FF", toColor = "#59D98E", width = 250 }) => {
  const value = Math.max(0, Math.min(1, progress));
  const color = value < 0.5 ? fromColor : toColor;
  return (
    <div
      style={{
        width: interpolate(value, [0, 1], [width * 0.72, width]),
        height: interpolate(value, [0, 1], [54, 72]),
        borderRadius: interpolate(value, [0, 1], [27, 22]),
        background: `${color}20`,
        border: `1px solid ${color}88`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color,
        fontSize: interpolate(value, [0, 1], [18, 24]),
        fontWeight: 800,
        letterSpacing: interpolate(value, [0, 1], [2.2, 0.4]),
        position: "relative",
      }}
    >
      <span style={{ opacity: interpolate(value, [0, 0.48], [1, 0], { extrapolateRight: "clamp" }) }}>{fromLabel}</span>
      <span
        style={{
          position: "absolute",
          opacity: interpolate(value, [0.52, 1], [0, 1], { extrapolateLeft: "clamp" }),
        }}
      >
        {toLabel}
      </span>
    </div>
  );
};

export const FlipReorder: React.FC<{
  items: Array<{ id: string; label: string; fromIndex: number; toIndex: number; color?: string }>;
  progress: number;
  rowHeight?: number;
  width?: number;
}> = ({ items, progress, rowHeight = 56, width = 330 }) => (
  <div style={{ position: "relative", width, height: items.length * rowHeight }}>
    {items.map((item) => {
      const y = interpolate(progress, [0, 1], [item.fromIndex * rowHeight, item.toIndex * rowHeight]);
      const moving = item.fromIndex !== item.toIndex;
      return (
        <div
          key={item.id}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width,
            height: rowHeight - 8,
            transform: `translate3d(0, ${y}px, 0) scale(${moving ? 1 + Math.sin(progress * Math.PI) * 0.025 : 1})`,
            borderRadius: 15,
            background: moving ? `${item.color ?? "#6EA8FF"}22` : "rgba(255,255,255,.06)",
            border: `1px solid ${moving ? `${item.color ?? "#6EA8FF"}66` : "rgba(255,255,255,.1)"}`,
            display: "flex",
            alignItems: "center",
            padding: "0 16px",
            color: "white",
            fontWeight: 750,
          }}
        >
          <span style={{ width: 28, color: item.color ?? "#9AA6B5" }}>{item.toIndex + 1}</span>
          {item.label}
        </div>
      );
    })}
  </div>
);

export const SpringSettle: React.FC<{
  children: React.ReactNode;
  progress: number;
  distance?: number;
  style?: React.CSSProperties;
}> = ({ children, progress, distance = 28, style }) => {
  const settled = springSettleProgress(progress);
  return (
    <div
      style={{
        opacity: Math.min(1, progress * 3),
        transform: `translate3d(0, ${(1 - settled) * distance}px, 0) scale(${0.94 + settled * 0.06})`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

export const Shimmer: React.FC<{ progress: number; borderRadius?: number; color?: string }> = ({
  progress,
  borderRadius = 18,
  color = "rgba(255,255,255,.34)",
}) => (
  <div style={{ position: "absolute", inset: 0, borderRadius, overflow: "hidden", pointerEvents: "none" }}>
    <div
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        left: `${interpolate(progress, [0, 1], [-45, 125])}%`,
        width: "34%",
        transform: "skewX(-18deg)",
        background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
      }}
    />
  </div>
);

export const OrbitAssemble: React.FC<{
  progress: number;
  nodes: Array<{ id: string; label: string; color?: string }>;
  size?: number;
}> = ({ progress, nodes, size = 330 }) => {
  const center = size / 2;
  const radius = size * 0.35;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      {nodes.map((node, index) => {
        const angle = -Math.PI / 2 + (index / nodes.length) * Math.PI * 2;
        const local = Math.max(0, Math.min(1, progress * 1.35 - index * 0.08));
        const startRadius = radius * 1.5;
        const currentRadius = interpolate(local, [0, 1], [startRadius, radius]);
        const x = center + Math.cos(angle - (1 - local) * 0.9) * currentRadius;
        const y = center + Math.sin(angle - (1 - local) * 0.9) * currentRadius;
        return (
          <div
            key={node.id}
            style={{
              position: "absolute",
              left: x - 42,
              top: y - 22,
              width: 84,
              height: 44,
              borderRadius: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: `${node.color ?? "#6EA8FF"}22`,
              border: `1px solid ${node.color ?? "#6EA8FF"}77`,
              color: "white",
              fontSize: 14,
              fontWeight: 750,
              opacity: local,
              transform: `scale(${0.72 + local * 0.28})`,
            }}
          >
            {node.label}
          </div>
        );
      })}
      <div
        style={{
          position: "absolute",
          left: center - 53,
          top: center - 53,
          width: 106,
          height: 106,
          borderRadius: 32,
          background: "rgba(9,12,18,.82)",
          border: "1px solid rgba(255,255,255,.2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontWeight: 850,
          fontSize: 20,
          transform: `scale(${0.82 + Math.min(1, progress * 1.5) * 0.18})`,
        }}
      >
        CORE
      </div>
    </div>
  );
};

export const CardFlip3D: React.FC<{
  progress: number;
  front: React.ReactNode;
  back: React.ReactNode;
  width?: number;
  height?: number;
}> = ({ progress, front, back, width = 320, height = 190 }) => {
  const rotation = progress * 180;
  const showBack = progress >= 0.5;
  return (
    <div style={{ width, height, perspective: 1000 }}>
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          transformStyle: "preserve-3d",
          transform: `rotateY(${rotation}deg)`,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backfaceVisibility: "hidden",
            visibility: showBack ? "hidden" : "visible",
          }}
        >
          {front}
        </div>
        <div
          style={{
            position: "absolute",
            inset: 0,
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            visibility: showBack ? "visible" : "hidden",
          }}
        >
          {back}
        </div>
      </div>
    </div>
  );
};
