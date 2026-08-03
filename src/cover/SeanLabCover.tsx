import type React from "react";
import { AbsoluteFill, Img, staticFile, useVideoConfig } from "remotion";
import { colorTokens, typographyTokens } from "../design-tokens/tokens.ts";
import { Icon } from "../icons/Icon.tsx";
import type { CoverContract } from "./types.ts";
import { validateCoverContract } from "./types.ts";

const themeTokens = {
  signal: {
    background: "#070A11",
    foreground: "#F7F5EF",
    muted: "rgba(247,245,239,0.7)",
    photoFilter: "saturate(0.92) contrast(1.08) brightness(0.84)",
    wash: "linear-gradient(90deg, rgba(7,10,17,0.99) 0%, rgba(7,10,17,0.94) 43%, rgba(7,10,17,0.24) 70%, rgba(7,10,17,0.08) 100%)",
  },
  paper: {
    background: "#F5F2EA",
    foreground: "#090B0F",
    muted: "rgba(9,11,15,0.62)",
    photoFilter: "saturate(0.86) contrast(1.04) brightness(0.94)",
    wash: "linear-gradient(90deg, rgba(245,242,234,1) 0%, rgba(245,242,234,0.96) 43%, rgba(245,242,234,0.3) 70%, rgba(245,242,234,0.04) 100%)",
  },
  studio: {
    background: "#101317",
    foreground: "#F7F5EF",
    muted: "rgba(247,245,239,0.68)",
    photoFilter: "saturate(0.92) contrast(1.08) brightness(0.9)",
    wash: "linear-gradient(90deg, rgba(16,19,23,1) 0%, rgba(16,19,23,0.95) 43%, rgba(16,19,23,0.28) 70%, rgba(16,19,23,0.06) 100%)",
  },
} as const;

const MiniWorkflow: React.FC<{ accent: string; secondary: string; portrait: boolean }> = ({
  accent,
  secondary,
  portrait,
}) => (
  <div
    style={{
      position: "absolute",
      right: portrait ? undefined : 74,
      left: portrait ? 56 : undefined,
      top: portrait ? 840 : 110,
      width: portrait ? 394 : 430,
      height: portrait ? 218 : 238,
      borderRadius: 28,
      border: "2px solid rgba(255,255,255,0.23)",
      background: "rgba(8,11,16,0.58)",
      boxShadow: "0 24px 70px rgba(0,0,0,0.35)",
      padding: "24px 26px",
      color: "#F7F5EF",
      transform: portrait ? "rotate(1.5deg)" : "rotate(2.5deg)",
      overflow: "hidden",
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 16, fontWeight: 800, letterSpacing: 2 }}>
      <span style={{ width: 10, height: 10, borderRadius: "50%", background: accent }} />
      VIDEO WORKFLOW
    </div>
    {[0, 1, 2].map((index) => (
      <div key={index} style={{ display: "grid", gridTemplateColumns: "30px 1fr 74px", gap: 12, marginTop: 18 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 9,
            display: "grid",
            placeItems: "center",
            background: index === 1 ? secondary : "rgba(255,255,255,0.1)",
            color: index === 1 ? "#090B0F" : "#F7F5EF",
            fontSize: 13,
            fontWeight: 900,
          }}
        >
          {index + 1}
        </div>
        <div style={{ alignSelf: "center", height: 8, borderRadius: 999, background: "rgba(255,255,255,0.17)" }} />
        <div
          style={{
            alignSelf: "center",
            height: 8,
            borderRadius: 999,
            background: index === 1 ? accent : "rgba(255,255,255,0.1)",
          }}
        />
      </div>
    ))}
  </div>
);

const CoverIconTray: React.FC<{ iconIds: CoverContract["iconIds"]; portrait: boolean }> = ({
  iconIds = [],
  portrait,
}) => {
  if (!iconIds.length) return null;
  const groups = portrait ? [iconIds] : [iconIds.slice(0, 2), iconIds.slice(2, 4)].filter((group) => group.length);
  return (
    <>
      {groups.map((group, groupIndex) => (
        <div
          key={`cover-icon-group-${groupIndex}`}
          style={{
            position: "absolute",
            top: portrait ? 96 : groupIndex === 0 ? 105 : 650,
            right: portrait ? 72 : undefined,
            left: portrait ? undefined : groupIndex === 0 ? 790 : 330,
            width: portrait ? 230 : undefined,
            display: "grid",
            gridTemplateColumns: portrait ? "repeat(2, 96px)" : `repeat(${group.length}, 112px)`,
            justifyContent: portrait ? "end" : "start",
            gap: portrait ? 16 : 18,
            zIndex: 4,
          }}
        >
          {group.map((iconId) => (
            <Icon key={iconId} id={iconId} size={portrait ? 96 : 112} color="#151A1D" variant="light" />
          ))}
        </div>
      ))}
    </>
  );
};

export const SeanLabCover: React.FC<CoverContract> = (rawCover) => {
  const cover = validateCoverContract(rawCover);
  const { width, height } = useVideoConfig();
  const portrait = height > width;
  const integratedPortrait = cover.portraitTreatment === "integrated-background";
  const transparentCutout = cover.portraitTreatment === "transparent-cutout";
  const photoCrop = cover.portraitTreatment === "photo-crop";
  const portraitCrop = cover.portraitCrop ?? { x: 64, y: 42, zoom: 1 };
  const theme = themeTokens[cover.theme];
  const [accent, secondary] = cover.accents;
  const edge = portrait ? 72 : 92;
  const headlineSize = portrait ? (integratedPortrait ? 94 : 102) : 96;
  const contentWidth = portrait ? width - edge * 2 : 820;
  const iconIds = cover.iconIds ?? (cover.iconId ? [cover.iconId] : []);
  return (
    <AbsoluteFill
      style={{
        background: theme.background,
        color: theme.foreground,
        fontFamily: typographyTokens.family,
        overflow: "hidden",
      }}
    >
      {cover.generatedBackgroundSrc ? (
        <Img
          src={staticFile(cover.generatedBackgroundSrc)}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : null}
      {integratedPortrait ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: portrait
              ? "linear-gradient(180deg, rgba(7,10,17,0.34) 0%, rgba(7,10,17,0.03) 58%)"
              : "linear-gradient(90deg, rgba(7,10,17,0.66) 0%, rgba(7,10,17,0.24) 48%, transparent 72%)",
          }}
        />
      ) : transparentCutout ? (
        <>
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: portrait
                ? `${theme.wash}, linear-gradient(0deg, transparent 42%, ${theme.background} 92%)`
                : theme.wash,
            }}
          />
          <Img
            src={staticFile(cover.portraitSrc)}
            style={{
              position: "absolute",
              right: portrait ? -120 : -55,
              bottom: portrait ? -28 : -70,
              width: portrait ? 880 : 790,
              height: portrait ? 940 : 790,
              objectFit: "contain",
              objectPosition: "right bottom",
              filter: "drop-shadow(-18px 20px 36px rgba(0,0,0,0.34))",
              zIndex: 2,
            }}
          />
        </>
      ) : (
        <>
          <div
            style={{
              position: "absolute",
              inset: 0,
              opacity: 0.44,
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.055) 1px, transparent 1px)",
              backgroundSize: portrait ? "64px 64px" : "72px 72px",
              maskImage: "linear-gradient(90deg, black 0%, black 58%, transparent 86%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              width: portrait ? 770 : 900,
              height: portrait ? 770 : 900,
              borderRadius: "50%",
              right: portrait ? -300 : -130,
              top: portrait ? 470 : -260,
              border: `42px solid ${accent}`,
              opacity: 0.32,
              filter: "blur(1px)",
            }}
          />
          <div
            style={{
              position: "absolute",
              width: portrait ? 560 : 680,
              height: portrait ? 560 : 680,
              borderRadius: "50%",
              right: portrait ? -250 : 20,
              bottom: portrait ? -250 : -350,
              background: secondary,
              opacity: 0.16,
              filter: "blur(18px)",
            }}
          />
          <Img
            src={staticFile(cover.portraitSrc)}
            style={{
              position: "absolute",
              right: portrait ? -40 : -90,
              bottom: portrait ? -40 : -80,
              width: portrait ? 1430 : 1280,
              height: portrait ? 1070 : 960,
              objectFit: "cover",
              objectPosition: `${portraitCrop.x}% ${portraitCrop.y}%`,
              transform: photoCrop ? `scale(${portraitCrop.zoom})` : undefined,
              filter: theme.photoFilter,
              borderRadius: portrait ? "46% 0 0 0" : "48% 0 0 48%",
              boxShadow: "-26px 0 80px rgba(0,0,0,0.28)",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: portrait
                ? `${theme.wash}, linear-gradient(0deg, transparent 40%, ${theme.background} 78%)`
                : theme.wash,
            }}
          />
        </>
      )}

      {cover.brandName?.trim() ? (
        <div
          style={{
            position: "absolute",
            left: edge,
            top: portrait ? 76 : 64,
            display: "flex",
            alignItems: "center",
            gap: 18,
          }}
        >
          <div
            style={{
              width: portrait ? 68 : 62,
              height: portrait ? 68 : 62,
              display: "grid",
              placeItems: "center",
              borderRadius: 18,
              background: theme.foreground,
            }}
          >
            <strong style={{ color: theme.background, fontSize: 24 }}>
              {cover.brandName.slice(0, 2).toUpperCase()}
            </strong>
          </div>
          <div>
            <div style={{ fontSize: portrait ? 24 : 23, fontWeight: 900, letterSpacing: 4 }}>{cover.brandName}</div>
            <div
              style={{
                marginTop: 3,
                color: theme.muted,
                fontSize: portrait ? 16 : 15,
                fontWeight: 760,
                letterSpacing: 2,
              }}
            >
              CREATOR VIDEO
            </div>
          </div>
        </div>
      ) : null}

      <div style={{ position: "absolute", left: edge, top: portrait ? 238 : 214, width: contentWidth }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 12,
            padding: portrait ? "14px 22px" : "12px 20px",
            borderRadius: 999,
            color: cover.theme === "paper" ? colorTokens.ink : colorTokens.paper,
            background: accent,
            fontSize: portrait ? 23 : 21,
            fontWeight: 900,
            letterSpacing: 1,
          }}
        >
          <span style={{ width: 9, height: 9, borderRadius: "50%", background: "currentColor" }} />
          {cover.badge}
        </div>
        <div style={{ marginTop: portrait ? 42 : 34 }}>
          {cover.titleLines.map((line, index) => (
            <div
              key={line}
              style={{
                width: "fit-content",
                maxWidth: "100%",
                fontSize: headlineSize,
                lineHeight: 0.98,
                letterSpacing: portrait ? -4 : -5,
                fontWeight: 950,
                whiteSpace: "nowrap",
                color: index === cover.titleLines.length - 1 ? accent : theme.foreground,
                textShadow: cover.theme === "paper" ? "none" : "0 7px 28px rgba(0,0,0,0.42)",
              }}
            >
              {line}
            </div>
          ))}
        </div>
        <div
          style={{
            marginTop: portrait ? 34 : 28,
            width: portrait ? 430 : 540,
            height: portrait ? 16 : 14,
            borderRadius: 999,
            background: secondary,
            transform: "rotate(-1.5deg)",
            boxShadow: `150px 0 0 ${accent}`,
          }}
        />
        <div
          style={{
            marginTop: portrait ? 34 : 28,
            color: theme.muted,
            fontSize: portrait ? 25 : 23,
            fontWeight: 850,
            letterSpacing: 4,
          }}
        >
          {cover.kicker}
        </div>
      </div>

      {integratedPortrait ? null : <MiniWorkflow accent={accent} secondary={secondary} portrait={portrait} />}
      <CoverIconTray iconIds={iconIds} portrait={portrait} />

      <div
        style={{
          position: "absolute",
          left: edge,
          bottom: portrait ? 62 : 70,
          display: "flex",
          flexDirection: portrait ? "column" : "row",
          gap: portrait ? 12 : 14,
        }}
      >
        {cover.supportingFacts.map((fact, index) => (
          <div
            key={fact}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 11,
              minWidth: portrait ? 230 : 190,
              padding: portrait ? "14px 18px" : "13px 16px",
              borderRadius: 17,
              color: theme.foreground,
              background: cover.theme === "paper" ? "rgba(255,255,255,0.72)" : "rgba(10,13,18,0.62)",
              border: `2px solid ${index === 1 ? accent : "rgba(255,255,255,0.2)"}`,
              boxShadow: "0 16px 34px rgba(0,0,0,0.18)",
              fontSize: portrait ? 22 : 19,
              fontWeight: 850,
            }}
          >
            <span style={{ color: index === 1 ? accent : secondary, fontWeight: 950 }}>0{index + 1}</span>
            {fact}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
