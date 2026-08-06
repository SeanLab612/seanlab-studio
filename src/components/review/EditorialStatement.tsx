import type React from "react";
import { interpolate } from "remotion";
import { colorTokens } from "../../design-tokens";
import { useTypographyDecision } from "../../typography-policy";
import { enter, palette, rise } from "./shared";

export type EditorialStatementProps = {
  frame: number;
  fps: number;
  emphasis: string;
  leadIn?: string;
  denied?: string;
  prefix?: string;
  support?: string;
  reducedMotion?: boolean;
  compact?: boolean;
  zone?: { left: number; top: number; width: number; minHeight: number };
};

const staged = (frame: number, fps: number, delay: number, reducedMotion: boolean) =>
  reducedMotion ? 1 : enter(frame, fps, delay);

export const EditorialStatement: React.FC<EditorialStatementProps> = ({
  frame,
  fps,
  emphasis,
  leadIn,
  denied,
  prefix = denied ? "而是" : undefined,
  support,
  reducedMotion = false,
  compact = false,
  zone = { left: 74, top: 224, width: 780, minHeight: 500 },
}) => {
  const leadProgress = staged(frame, fps, 5, reducedMotion);
  const deniedProgress = staged(frame, fps, 14, reducedMotion);
  const statementProgress = staged(frame, fps, denied ? 28 : 16, reducedMotion);
  const supportProgress = staged(frame, fps, denied ? 42 : 30, reducedMotion);
  const strikeProgress = reducedMotion
    ? 1
    : interpolate(frame, [18, 18 + Math.round(fps * 0.52)], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
  const emphasisTypography = useTypographyDecision({
    text: emphasis,
    role: "annotation",
    componentId: "editorial-statement",
  });
  const statementSize = compact ? 50 : [...emphasis].length <= 10 ? 82 : [...emphasis].length <= 14 ? 72 : 64;

  return (
    <div
      style={{
        position: "absolute",
        left: zone.left,
        top: zone.top,
        width: zone.width,
        minHeight: zone.minHeight,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        boxSizing: "border-box",
      }}
    >
      {leadIn ? (
        <div
          style={{
            ...rise(leadProgress, 12),
            color: palette.paper,
            fontSize: compact ? 30 : 38,
            fontWeight: 760,
            lineHeight: 1.25,
            marginBottom: denied ? 20 : 30,
          }}
        >
          {leadIn}
        </div>
      ) : null}
      {denied ? (
        <div
          style={{
            ...rise(deniedProgress, 10),
            position: "relative",
            alignSelf: "flex-start",
            color: "rgba(247,247,242,0.62)",
            fontSize: compact ? 42 : [...denied].length <= 12 ? 64 : 56,
            fontWeight: 800,
            lineHeight: 1.15,
            marginBottom: compact ? 24 : 34,
          }}
        >
          {denied}
          <span
            style={{
              position: "absolute",
              left: 0,
              top: "52%",
              width: `${strikeProgress * 100}%`,
              height: 5,
              borderRadius: 3,
              background: palette.red,
              transform: "rotate(-1.4deg)",
              transformOrigin: "left center",
            }}
          />
        </div>
      ) : null}
      <div
        style={{
          ...rise(statementProgress, 16),
          display: "flex",
          alignItems: "baseline",
          gap: compact ? 14 : 20,
          flexWrap: "wrap",
          color: palette.paper,
          fontSize: statementSize,
          fontWeight: 900,
          lineHeight: 1.1,
          letterSpacing: -1.2,
        }}
      >
        {prefix ? <span>{prefix}</span> : null}
        <span
          style={{
            position: "relative",
            display: "inline-block",
            padding: 0,
            color: colorTokens.tiffany,
            fontFamily: emphasisTypography.family,
            fontWeight: emphasisTypography.fontWeight,
          }}
        >
          {emphasis}
        </span>
      </div>
      {support ? (
        <div
          style={{
            ...rise(supportProgress, 12),
            color: palette.muted,
            fontSize: compact ? 24 : 30,
            fontWeight: 650,
            lineHeight: 1.42,
            marginTop: compact ? 26 : 38,
            maxWidth: 720,
          }}
        >
          {support}
        </div>
      ) : null}
    </div>
  );
};
