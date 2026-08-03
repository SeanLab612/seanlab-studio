import type React from "react";
import { Img, staticFile } from "remotion";
import { IdentityMark } from "../../media-assets";
import { Icon } from "../../icons/Icon";
import type { IconId } from "../../icons/registry";
import { enter, palette, rise } from "./shared";
import { EmphasisText } from "./TextEmphasis";
import { PERSON_EVIDENCE_DENSITY } from "./person-evidence-density";

export type EvidenceItem = {
  eyebrow: string;
  title: string;
  meta: string;
  accent?: string;
};

export type TimelinePoint = {
  label: string;
  accent?: string;
};

export const PersonEvidenceCard: React.FC<{
  frame: number;
  fps: number;
  portraitSrc?: string;
  personId?: string;
  allowCandidatePortrait?: boolean;
  brandIconId?: IconId | string;
  brandLabel?: string;
  name?: string;
  role?: string;
  quote?: string;
  evidence?: EvidenceItem[];
  timeline?: TimelinePoint[];
  mobilePriority?: boolean;
}> = ({
  frame,
  fps,
  portraitSrc,
  personId,
  allowCandidatePortrait = false,
  brandIconId,
  brandLabel,
  name = "ELENA MORRIS",
  role = "TECH POLICY RESEARCHER",
  quote = "真正推动政策变化的，是持续进入公共讨论的证据。",
  evidence = [
    { eyebrow: "EVIDENCE 01", title: "研究报告进入听证会", meta: "政策引用 · 2024", accent: palette.blue },
    { eyebrow: "RESULT 02", title: "监管框架正式落地", meta: "条款生效 · 2025", accent: palette.mint },
  ],
  timeline = [
    { label: "2023", accent: palette.blue },
    { label: "2024", accent: palette.blue },
    { label: "2025", accent: palette.mint },
  ],
  mobilePriority = false,
}) => {
  const p = enter(frame, fps, 8);
  const evidenceProgress = enter(frame, fps, 26);
  const density = mobilePriority ? PERSON_EVIDENCE_DENSITY.mobile : PERSON_EVIDENCE_DENSITY.standard;
  return (
    <div
      data-person-evidence-density={mobilePriority ? "mobile-priority" : "standard"}
      style={{ position: "absolute", left: 70, top: density.top, width: density.width, ...rise(p) }}
    >
      <div style={{ display: "flex", gap: density.identityGap, alignItems: "center" }}>
        <div
          style={{
            position: "relative",
            width: density.portraitSize,
            height: density.portraitSize,
            borderRadius: "50%",
            border: `2px solid ${palette.blue}`,
            padding: 7,
            boxShadow: `0 0 34px ${palette.blue}33`,
            flexShrink: 0,
          }}
        >
          <div style={{ width: "100%", height: "100%", borderRadius: "50%", overflow: "hidden" }}>
            {portraitSrc ? (
              <Img
                src={staticFile(portraitSrc)}
                style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
              />
            ) : personId ? (
              <IdentityMark
                entityId={personId}
                kind="person"
                label={name}
                size={density.identityMarkSize}
                variant="circle"
                allowCandidate={allowCandidatePortrait}
                color={palette.blue}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: palette.blue,
                }}
              >
                <Icon id="system.person" fallbackLabel={name} size={density.fallbackIconSize} color={palette.blue} />
              </div>
            )}
          </div>
          {brandIconId ? (
            <Icon
              id={brandIconId}
              fallbackLabel={brandLabel}
              size={density.brandIconSize}
              variant="light"
              style={{
                position: "absolute",
                right: -8,
                bottom: -8,
              }}
            />
          ) : null}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: density.nameFontSize, fontWeight: 880, letterSpacing: 1.2 }}>
            <EmphasisText text={name} />
          </div>
          <div
            style={{
              fontSize: density.roleFontSize,
              fontWeight: 800,
              color: palette.blue,
              letterSpacing: density.roleLetterSpacing,
              marginTop: 8,
            }}
          >
            <EmphasisText text={role} />
          </div>
          <div
            style={{
              fontSize: density.quoteFontSize,
              fontWeight: 650,
              lineHeight: 1.4,
              marginTop: mobilePriority ? 18 : 16,
              maxWidth: density.quoteMaxWidth,
            }}
          >
            “<EmphasisText text={quote} />”
          </div>
        </div>
      </div>

      {evidence.length > 0 ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${Math.min(2, evidence.length)}, 1fr)`,
            gap: 28,
            marginTop: 30,
            ...rise(evidenceProgress, 12),
          }}
        >
          {evidence.slice(0, 2).map((item, index) => {
            const accent = item.accent ?? palette.blue;
            const itemProgress = enter(frame, fps, 26 + index * 5);
            return (
              <div
                key={item.eyebrow}
                style={{
                  minHeight: 118,
                  padding: "4px 10px 4px 0",
                  ...rise(itemProgress, 10),
                }}
              >
                <div
                  style={{
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "flex-start",
                    textShadow: "0 2px 8px rgba(0,0,0,0.52)",
                  }}
                >
                  <div
                    style={{
                      fontSize: density.evidenceEyebrowFontSize,
                      fontWeight: 800,
                      color: accent,
                      letterSpacing: 1.8,
                    }}
                  >
                    {item.eyebrow}
                  </div>
                  <div style={{ fontSize: density.evidenceTitleFontSize, fontWeight: 850, marginTop: 12 }}>
                    <EmphasisText text={item.title} />
                  </div>
                  <div
                    style={{
                      fontSize: density.evidenceMetaFontSize,
                      fontWeight: 650,
                      opacity: 0.8,
                      marginTop: 8,
                    }}
                  >
                    {item.meta}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
      {timeline.length > 1 ? (
        <div style={{ display: "flex", justifyContent: "space-between", width: 710, marginTop: 26 }}>
          {timeline.map((point, index) => {
            const accent = point.accent ?? palette.blue;
            return (
              <div key={`${point.label}-${index}`} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    background: accent,
                    boxShadow: `0 0 14px ${accent}`,
                  }}
                />
                <div style={{ fontSize: density.timelineFontSize, fontWeight: 820 }}>{point.label}</div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};
