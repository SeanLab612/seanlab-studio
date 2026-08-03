import type { CSSProperties, ReactNode } from "react";

export const PaperTape = ({ color = "#F3A31B", style }: { color?: string; style?: CSSProperties }) => (
  <div
    style={{
      position: "absolute",
      width: 86,
      height: 24,
      background: color,
      opacity: 0.76,
      clipPath: "polygon(3% 8%, 97% 0, 100% 90%, 1% 100%)",
      ...style,
    }}
  />
);

export const PaperNote = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div
    style={{
      position: "absolute",
      background: "rgba(255,253,246,.96)",
      border: "2px solid rgba(55,50,40,.64)",
      boxShadow: "0 9px 18px rgba(61,50,34,.15), 0 2px 4px rgba(61,50,34,.10)",
      boxSizing: "border-box",
      ...style,
    }}
  >
    {children}
  </div>
);

export const DrawnArrow = ({ d, progress, color = "#292722" }: { d: string; progress: number; color?: string }) => {
  const markerId = `paper-arrow-${color.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <>
      <defs>
        <marker
          id={markerId}
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 1 L 9 5 L 0 9 z" fill={color} opacity={progress > 0.92 ? 0.9 : 0} />
        </marker>
      </defs>
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength="1"
        strokeDasharray="1"
        strokeDashoffset={1 - progress}
        markerEnd={`url(#${markerId})`}
      />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
        pathLength="1"
        strokeDasharray="1"
        strokeDashoffset={1 - progress}
        transform="translate(2 -2)"
        opacity=".34"
      />
    </>
  );
};

export const MarkerUnderline = ({ progress, color = "#F05E4F" }: { progress: number; color?: string }) => (
  <svg width="100%" height="18" viewBox="0 0 320 18" preserveAspectRatio="none">
    <path
      d="M4 10 C82 3, 180 16, 316 7"
      fill="none"
      stroke={color}
      strokeWidth="7"
      strokeLinecap="round"
      pathLength="1"
      strokeDasharray="1"
      strokeDashoffset={1 - progress}
      opacity=".82"
    />
  </svg>
);
