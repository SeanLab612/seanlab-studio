import type React from "react";
import { clamp01, enter, palette, rise } from "./shared";
import { EmphasisText } from "./TextEmphasis";

export type ScenarioBranch = {
  label: string;
  detail: string;
  color?: string;
};

export const ScenarioBranches: React.FC<{
  frame: number;
  fps: number;
  kicker?: string;
  question?: string;
  branches?: [ScenarioBranch, ScenarioBranch];
  activeBranch?: 0 | 1 | null;
}> = ({
  frame,
  fps,
  kicker = "未来五年",
  question = "美股还会继续涨吗？",
  branches = [
    { label: "持续上涨", detail: "盈利兑现 · 估值被消化", color: palette.mint },
    { label: "估值回落", detail: "增长不及预期 · 资金撤离", color: palette.red },
  ],
  activeBranch = 1,
}) => {
  const p = enter(frame, fps, 8);
  const upOpacity = activeBranch === null ? 1 : activeBranch === 0 ? 1 : 0.2;
  const downOpacity = activeBranch === null ? 1 : activeBranch === 1 ? 1 : 0.2;
  const draw = clamp01((frame - 25) / 55);
  return (
    <div style={{ position: "absolute", left: 66, top: 208, width: 830, ...rise(p) }}>
      <div style={{ fontSize: 66, fontWeight: 850, lineHeight: 1 }}>
        <EmphasisText text={kicker} />
      </div>
      <div style={{ fontSize: 43, fontWeight: 850, color: palette.amber, marginTop: 10 }}>
        <EmphasisText text={question} />
      </div>
      <svg width="820" height="400" viewBox="0 0 820 400" style={{ marginTop: 20, overflow: "visible" }}>
        <path d="M60 190 H320" fill="none" stroke="rgba(245,242,234,0.65)" strokeWidth="6" strokeLinecap="round" />
        <circle cx="320" cy="190" r="10" fill={palette.paper} />
        <path
          d="M320 190 C420 175 505 75 720 50"
          fill="none"
          stroke={branches[0].color ?? palette.mint}
          strokeWidth="8"
          strokeLinecap="round"
          pathLength="1"
          strokeDasharray="1"
          strokeDashoffset={1 - draw}
          opacity={upOpacity}
        />
        <path
          d="M320 190 C430 200 520 300 720 342"
          fill="none"
          stroke={branches[1].color ?? palette.red}
          strokeWidth="9"
          strokeLinecap="round"
          pathLength="1"
          strokeDasharray="1"
          strokeDashoffset={1 - draw}
          opacity={downOpacity}
        />
        <g opacity={upOpacity}>
          <text x="505" y="65" fill={branches[0].color ?? palette.mint} fontSize="30" fontWeight="800">
            {branches[0].label}
          </text>
          <text x="505" y="101" fill={palette.paper} fontSize="22" fontWeight="680">
            {branches[0].detail}
          </text>
        </g>
        <g opacity={downOpacity}>
          <text x="490" y="294" fill={branches[1].color ?? palette.red} fontSize="30" fontWeight="800">
            {branches[1].label}
          </text>
          <text x="490" y="331" fill={palette.paper} fontSize="22" fontWeight="680">
            {branches[1].detail}
          </text>
        </g>
        <circle cx="720" cy="50" r="8" fill={branches[0].color ?? palette.mint} opacity={upOpacity} />
        <circle cx="720" cy="342" r="9" fill={branches[1].color ?? palette.red} opacity={downOpacity} />
      </svg>
    </div>
  );
};
