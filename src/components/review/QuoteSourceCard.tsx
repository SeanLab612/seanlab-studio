import type React from "react";
import { Img, staticFile } from "remotion";
import { Icon, type IconId } from "../../icons";
import { IdentityMark } from "../../media-assets";
import type { MediaEntityKind } from "../../media-assets";
import { enter, palette, rise } from "./shared";
import { useTypographyDecision } from "../../typography-policy";
import { EmphasisText } from "./TextEmphasis";

export type QuoteSourceCardProps = {
  frame: number;
  fps: number;
  quote: string;
  sourceName: string;
  sourceRole?: string;
  sourceKind?: "person" | "institution" | "publication" | "report";
  date?: string;
  citation?: string;
  iconId?: IconId | string;
  imageSrc?: string;
  sourceEntityId?: string;
  sourceEntityKind?: MediaEntityKind;
  allowCandidateSource?: boolean;
  accent?: string;
};

export const QuoteSourceCard: React.FC<QuoteSourceCardProps> = ({
  frame,
  fps,
  quote,
  sourceName,
  sourceRole,
  sourceKind = "report",
  date,
  citation,
  iconId = "system.quote",
  imageSrc,
  sourceEntityId,
  sourceEntityKind,
  allowCandidateSource = false,
  accent = palette.blue,
}) => {
  const intro = enter(frame, fps, 7);
  const evidence = enter(frame, fps, 28);
  const quoteTypography = useTypographyDecision({
    text: quote,
    role: "quote",
    componentId: "quote-source-card",
  });
  return (
    <div style={{ position: "absolute", left: 70, top: 210, width: 760, ...rise(intro) }}>
      <div
        style={{ display: "grid", gridTemplateColumns: imageSrc ? "1fr 220px" : "1fr", gap: 32, alignItems: "start" }}
      >
        <div>
          <div style={{ fontSize: 74, lineHeight: 0.65, fontFamily: "Georgia, serif", color: accent, opacity: 0.9 }}>
            “
          </div>
          <div
            style={{
              fontSize: imageSrc ? 30 : 38,
              fontFamily: quoteTypography.family,
              lineHeight: 1.42,
              fontWeight: quoteTypography.profileId === "wenkai-narrative" ? quoteTypography.fontWeight : 760,
              maxWidth: imageSrc ? 500 : 680,
              marginTop: 10,
            }}
          >
            <EmphasisText text={quote} />
          </div>
          <div
            style={{
              height: 3,
              width: 150,
              borderRadius: 99,
              background: `linear-gradient(90deg, ${accent}, transparent)`,
              marginTop: 20,
            }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 18 }}>
            {sourceEntityId && sourceEntityKind ? (
              <IdentityMark
                entityId={sourceEntityId}
                kind={sourceEntityKind}
                label={sourceName}
                size={42}
                color={accent}
                allowCandidate={allowCandidateSource}
              />
            ) : (
              <Icon id={iconId} fallbackLabel={sourceName} size={42} color={accent} variant="dark" />
            )}
            <div>
              <div style={{ fontSize: 22, fontWeight: 860 }}>
                <EmphasisText text={sourceName} />
              </div>
              {sourceRole ? (
                <div style={{ fontSize: 22, fontWeight: 760, color: accent, letterSpacing: 1.1, marginTop: 4 }}>
                  {sourceRole}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {imageSrc ? (
          <div style={{ ...rise(evidence, 16), paddingTop: 18 }}>
            <div
              style={{
                height: 250,
                borderRadius: 12,
                overflow: "hidden",
                background: "rgba(255,255,255,0.94)",
                outline: `1px solid ${accent}55`,
                boxShadow: "0 16px 34px rgba(0,0,0,0.24)",
              }}
            >
              <Img src={staticFile(imageSrc)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
          </div>
        ) : null}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginTop: 22,
          fontSize: 22,
          fontWeight: 760,
          letterSpacing: 1,
          opacity: 0.76,
          ...rise(enter(frame, fps, 42), 8),
        }}
      >
        <span style={{ color: accent, fontWeight: 820 }}>{sourceKind.toUpperCase()}</span>
        {date ? (
          <>
            <span style={{ opacity: 0.45 }}>·</span>
            <span>{date}</span>
          </>
        ) : null}
        {citation ? (
          <>
            <span style={{ opacity: 0.45 }}>·</span>
            <span>{citation}</span>
          </>
        ) : null}
      </div>
    </div>
  );
};
