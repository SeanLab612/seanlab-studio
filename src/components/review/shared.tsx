import type React from "react";
import { AbsoluteFill, Img, interpolate, staticFile } from "remotion";
import {
  colorTokens,
  getScrimRecipe,
  resolveComponentAccent,
  safeAreaTokens,
  spacingTokens,
  typographyTokens,
} from "../../design-tokens";
import { motionProgress } from "../../motion-primitives";
import { useTypographyDecision, type TypographyComponentId, type TypographyTextRole } from "../../typography-policy";
import { TextEmphasisProvider, type TextEmphasisSpec } from "./TextEmphasis";

export const palette = {
  ink: colorTokens.ink,
  paper: colorTokens.paper,
  muted: colorTokens.paperMuted,
  faint: colorTokens.paperFaint,
  amber: colorTokens.amber,
  mint: colorTokens.mint,
  red: colorTokens.red,
  blue: colorTokens.blue,
  violet: colorTokens.violet,
};

export const chartAccentPair = (preferred?: string, candidates: Array<string | undefined> = []) => {
  const selected: string[] = [];
  for (const color of [preferred, ...candidates, palette.blue, palette.mint]) {
    const normalized = resolveComponentAccent(color);
    if (normalized && !selected.includes(normalized)) selected.push(normalized);
    if (selected.length === 2) break;
  }
  return [selected[0] ?? palette.blue, selected[1] ?? palette.mint] as const;
};

export const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export const enter = (frame: number, fps: number, delay = 0) =>
  motionProgress({ frame, fps, delayFrames: delay, durationMs: 380 });

export const rise = (progress: number, distance = 18): React.CSSProperties => {
  if (progress >= 0.999) {
    return { opacity: 1, transform: "none" };
  }
  return {
    opacity: progress,
    transform: `translateY(${interpolate(progress, [0, 1], [distance, 0])}px)`,
  };
};

export const SectionTitle: React.FC<{
  eyebrow: string;
  title: string;
  accent?: string;
  componentId?: TypographyComponentId;
  textRole?: TypographyTextRole;
  maxWidth?: number;
}> = ({
  eyebrow,
  title,
  accent = palette.amber,
  componentId,
  textRole = "component-title",
  maxWidth = safeAreaTokens.titleZone.width,
}) => {
  const approvedAccent = resolveComponentAccent(accent, palette.amber);
  const typography = useTypographyDecision({ text: title, role: textRole, componentId });
  const normalized = (value: string) => value.toLocaleLowerCase().replace(/[^a-z0-9㐀-鿿]+/g, "");
  const showEyebrow = normalized(eyebrow) !== normalized(title);
  const titleFontSize = normalized(title).length > 17 ? 40 : 44;
  return (
    <div
      style={{ position: "relative", width: maxWidth, maxWidth, boxSizing: "border-box", padding: "5px 0 14px 22px" }}
    >
      <div style={{ position: "absolute", left: 0, top: 0, width: 78, height: 1, background: approvedAccent }} />
      <div style={{ position: "absolute", left: 0, top: 0, width: 1, height: 88, background: approvedAccent }} />
      {showEyebrow ? (
        <div
          style={{
            color: approvedAccent,
            fontSize: 19,
            fontWeight: 850,
            letterSpacing: 3.2,
            lineHeight: 1.1,
          }}
        >
          [ {eyebrow} ]
        </div>
      ) : null}
      <div
        style={{
          color: palette.paper,
          fontFamily: typography.family,
          fontSize: titleFontSize,
          fontWeight: typography.profileId === "wenkai-narrative" ? typography.fontWeight : 800,
          lineHeight: 1.15,
          marginTop: showEyebrow ? 11 : 4,
          overflowWrap: "break-word",
        }}
      >
        {title}
      </div>
    </div>
  );
};

export const BilingualSubtitles: React.FC<{ zh: string; en: string }> = ({ zh, en }) => (
  <div
    style={{
      position: "absolute",
      left: spacingTokens.subtitleHorizontal,
      right: spacingTokens.subtitleHorizontal,
      bottom: spacingTokens.subtitleBottom,
      color: "white",
      textAlign: "center",
      textShadow: "0 3px 12px rgba(0,0,0,0.98), 0 1px 3px rgba(0,0,0,1)",
    }}
  >
    <div style={typographyTokens.subtitleZh}>{zh}</div>
    <div style={{ ...typographyTokens.subtitleEn, marginTop: 7, opacity: 0.94 }}>{en}</div>
  </div>
);

export const ReviewStage: React.FC<{
  children: React.ReactNode;
  eyebrow: string;
  title: string;
  subtitleZh: string;
  subtitleEn: string;
  accent?: string;
  backgroundSrc?: string;
  scrim?: boolean;
  textEmphasis?: readonly TextEmphasisSpec[];
}> = ({
  children,
  eyebrow,
  title,
  subtitleZh,
  subtitleEn,
  accent,
  backgroundSrc = "review-assets/creator-placeholder.svg",
  scrim = true,
  textEmphasis = [],
}) => (
  <AbsoluteFill
    style={{
      background: palette.ink,
      color: palette.paper,
      fontFamily: typographyTokens.family,
      overflow: "hidden",
    }}
  >
    <AbsoluteFill>
      <Img src={staticFile(backgroundSrc)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    </AbsoluteFill>
    {scrim ? (
      <AbsoluteFill
        style={{
          ...getScrimRecipe("left").style,
        }}
      />
    ) : null}
    <TextEmphasisProvider specs={textEmphasis}>
      <div style={{ position: "absolute", left: spacingTokens.edge, top: spacingTokens.safeTop }}>
        <SectionTitle eyebrow={eyebrow} title={title} accent={accent} />
      </div>
      {children}
    </TextEmphasisProvider>
    <BilingualSubtitles zh={subtitleZh} en={subtitleEn} />
  </AbsoluteFill>
);

export const TinyPerson: React.FC<{ active?: boolean; color?: string }> = ({
  active = true,
  color = palette.paper,
}) => (
  <svg width="25" height="31" viewBox="0 0 25 31" fill="none" style={{ opacity: active ? 0.95 : 0.22 }}>
    <circle cx="12.5" cy="7" r="5" stroke={color} strokeWidth="2.2" />
    <path d="M3 29v-4.3c0-5 4.2-9 9.5-9s9.5 4 9.5 9V29" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);
