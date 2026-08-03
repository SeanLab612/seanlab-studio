import type React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { QuoteSourceCard, RoughAnnotation } from "../components/review";
import { BilingualSubtitles, SectionTitle, palette } from "../components/review/shared";
import {
  SYSTEM_BLACK_FAMILY,
  TypographyPolicyProvider,
  resolveTypography,
  typographyRoleRegistry,
} from "../typography-policy";

const cases = [
  { label: "全片标题", role: "display-title", componentId: "whole-video-title", text: "把复杂内容讲清楚" },
  { label: "人物引用", role: "quote", componentId: "quote-source-card", text: "不是越多越好，而是每一处都有依据。" },
  { label: "手写批注", role: "annotation", componentId: "rough-annotation", text: "重点看证据" },
  { label: "技术标题", role: "display-title", componentId: "whole-video-title", text: "Agent API v2.5 / 96% PASS" },
  { label: "数据指标", role: "metric", componentId: "key-stat-summary", text: "4,000 STARS" },
  {
    label: "超长引用",
    role: "quote",
    componentId: "quote-source-card",
    text: "这是一段明显超过引用容量的长文字，需要优先保证排版安全和稳定阅读，不因为字体风格而挤压画面的安全区域。",
  },
] as const;

const PolicyFrame: React.FC<{ children: React.ReactNode; title: string; eyebrow: string }> = ({
  children,
  title,
  eyebrow,
}) => (
  <AbsoluteFill
    style={{
      background:
        "radial-gradient(circle at 75% 15%, rgba(89,217,142,.12), transparent 28%), linear-gradient(135deg,#101714,#17211d)",
      color: palette.paper,
      padding: "58px 68px",
      fontFamily: '"SF Pro Display","PingFang SC",sans-serif',
    }}
  >
    <div style={{ color: palette.mint, fontSize: 18, fontWeight: 850, letterSpacing: 4 }}>{eyebrow}</div>
    <div style={{ marginTop: 10, fontSize: 42, fontWeight: 820 }}>{title}</div>
    {children}
  </AbsoluteFill>
);

export const TypographyPolicyDecisionReview: React.FC = () => (
  <TypographyPolicyProvider mode="auto">
    <PolicyFrame eyebrow="TYPOGRAPHY POLICY 2.0" title="文字角色 → 本地确定性字体">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 16, marginTop: 34 }}>
        {cases.map((item, index) => {
          const decision = resolveTypography({
            mode: "auto",
            role: item.role,
            componentId: item.componentId,
            text: item.text,
          });
          return (
            <div
              key={item.label}
              style={{
                minHeight: 286,
                padding: "22px 24px",
                borderRadius: 20,
                border: `1px solid ${decision.profileId === "wenkai-narrative" ? "rgba(89,217,142,.45)" : "rgba(245,242,234,.14)"}`,
                background:
                  decision.profileId === "wenkai-narrative" ? "rgba(89,217,142,.06)" : "rgba(245,242,234,.035)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, color: palette.muted }}>
                <span style={{ fontSize: 14, fontWeight: 780 }}>
                  {String(index + 1).padStart(2, "0")} · {item.label}
                </span>
                <span style={{ fontSize: 12 }}>{typographyRoleRegistry[item.role].label}</span>
              </div>
              <div
                style={{
                  marginTop: 28,
                  minHeight: 94,
                  fontFamily: decision.family,
                  fontSize: item.role === "metric" ? 34 : 31,
                  fontWeight: decision.fontWeight,
                  lineHeight: 1.35,
                }}
              >
                {item.text}
              </div>
              <div
                style={{
                  marginTop: 20,
                  color: decision.profileId === "wenkai-narrative" ? palette.mint : palette.amber,
                  fontSize: 13,
                  fontWeight: 820,
                }}
              >
                {decision.profileId === "wenkai-narrative" ? "霞鹜文楷" : "系统黑体"} · {decision.reasonCode}
              </div>
              <div style={{ marginTop: 7, color: palette.muted, fontSize: 12, lineHeight: 1.5 }}>{decision.reason}</div>
            </div>
          );
        })}
      </div>
    </PolicyFrame>
  </TypographyPolicyProvider>
);

export const TypographyPolicyRealSceneReview: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <TypographyPolicyProvider mode="auto">
      <AbsoluteFill
        style={{ background: palette.ink, color: palette.paper, overflow: "hidden", fontFamily: SYSTEM_BLACK_FAMILY }}
      >
        <Img
          src={staticFile("review-assets/creator-placeholder.svg")}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
        <AbsoluteFill
          style={{
            background:
              "linear-gradient(90deg,rgba(7,11,10,.98) 0%,rgba(7,11,10,.92) 38%,rgba(7,11,10,.35) 63%,rgba(7,11,10,.05) 100%)",
          }}
        />
        <div style={{ position: "absolute", left: 72, top: 58 }}>
          <SectionTitle
            eyebrow="EVIDENCE-BOUND QUOTE"
            title="先看证据，再谈结论"
            componentId="whole-video-title"
            textRole="display-title"
            accent={palette.mint}
          />
        </div>
        <QuoteSourceCard
          frame={frame}
          fps={fps}
          quote="不是越多越好，而是每一处都应该服务于口播证据。"
          sourceName="SeanLab 视觉规范"
          sourceRole="TYPOGRAPHY POLICY 2.0"
          sourceKind="report"
          citation="本地确定性选择"
          accent={palette.mint}
        />
        <BilingualSubtitles
          zh="字幕、数字和正文始终优先保证稳定阅读"
          en="Captions, metrics and body copy remain optimized for stable reading."
        />
      </AbsoluteFill>
    </TypographyPolicyProvider>
  );
};

export const TypographyPolicyAnnotationSceneReview: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <TypographyPolicyProvider mode="wenkai-emphasis">
      <AbsoluteFill
        style={{ background: palette.ink, color: palette.paper, overflow: "hidden", fontFamily: SYSTEM_BLACK_FAMILY }}
      >
        <Img
          src={staticFile("review-assets/creator-placeholder.svg")}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
        <AbsoluteFill
          style={{
            background:
              "linear-gradient(270deg,rgba(7,11,10,.98) 0%,rgba(7,11,10,.91) 39%,rgba(7,11,10,.28) 65%,rgba(7,11,10,.04) 100%)",
          }}
        />
        <div style={{ position: "absolute", right: 78, top: 62, width: 720 }}>
          <SectionTitle
            eyebrow="WENKAI EMPHASIS"
            title="强调判断，不牺牲阅读"
            componentId="whole-video-title"
            textRole="display-title"
            accent={palette.amber}
          />
        </div>
        <AbsoluteFill style={{ transform: "translateX(930px)" }}>
          <RoughAnnotation
            frame={frame}
            fps={fps}
            headline="否定表达 → 本地标注"
            items={[
              { id: "more", text: "越多越好", effect: "crossed-off" },
              { id: "higher", text: "越高越好", effect: "crossed-off" },
            ]}
          />
        </AbsoluteFill>
        <BilingualSubtitles
          zh="Agent 只提供否定意图，字体和动效由本地规则决定"
          en="The Agent provides intent; local rules resolve typography and motion."
        />
      </AbsoluteFill>
    </TypographyPolicyProvider>
  );
};
