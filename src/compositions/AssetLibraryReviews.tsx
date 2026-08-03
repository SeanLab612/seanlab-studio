import type React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { LiquidGlass } from "../components/LiquidGlass";
import { DistributionBars, HistoricalTimeline, ProcessSteps } from "../components/review";
import { BilingualSubtitles, SectionTitle } from "../components/review/shared";
import {
  accentByRole,
  colorTokens,
  designTokenRegistry,
  radiusTokens,
  spacingTokens,
  typographyTokens,
} from "../design-tokens";
import {
  getLayoutTemplate,
  getPrimaryContentStyle,
  layoutFixtureRegistry,
  layoutTemplateRegistry,
  LayoutSurface,
  type LayoutTemplateId,
} from "../layout-templates";
import {
  AnimatedNumber,
  DrawLine,
  FocusDim,
  GrowBar,
  HighlightSweep,
  motionPrimitiveRegistry,
  motionProgress,
  MotionReveal,
  staggerDelay,
  TraversePath,
} from "../motion-primitives";

const font = typographyTokens.family;

const TokenLabel: React.FC<{ name: string; value: string }> = ({ name, value }) => (
  <div
    style={{ display: "flex", justifyContent: "space-between", gap: 18, fontSize: 17, color: colorTokens.paperMuted }}
  >
    <span>{name}</span>
    <span style={{ color: colorTokens.paper, fontWeight: 750 }}>{value}</span>
  </div>
);

export const DesignTokenLibraryReview: React.FC = () => (
  <LayoutSurface templateId="speaker-right-overlay-left" backgroundSrc="review-assets/creator-placeholder.svg">
    <div style={{ position: "absolute", left: 68, top: 58, fontFamily: font }}>
      <SectionTitle
        eyebrow="VISUAL FOUNDATION"
        title="统一视觉令牌，而不是每个组件各写一套"
        accent={colorTokens.blue}
      />
    </div>
    <div
      style={{
        position: "absolute",
        left: 68,
        top: 205,
        width: 760,
        display: "grid",
        gridTemplateColumns: "1.05fr .95fr",
        gap: 18,
        fontFamily: font,
      }}
    >
      <LiquidGlass padding="22px" radius={radiusTokens.card}>
        <div style={{ ...typographyTokens.label, color: colorTokens.blue, marginBottom: 18 }}>COLOR / TYPE</div>
        <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
          {Object.entries(accentByRole).map(([name, color]) => (
            <div
              key={name}
              style={{
                width: 54,
                height: 54,
                borderRadius: 17,
                background: color,
                boxShadow: `0 12px 28px ${color}28`,
              }}
            />
          ))}
        </div>
        <div style={{ ...typographyTokens.headline, color: colorTokens.paper }}>高级来自秩序</div>
        <div style={{ ...typographyTokens.body, color: colorTokens.paperMuted, marginTop: 13 }}>
          不是更多发光，而是更准确的层级、材质与留白。
        </div>
      </LiquidGlass>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <LiquidGlass padding="20px" radius={radiusTokens.card} variant="compact">
          <div style={{ ...typographyTokens.label, color: colorTokens.amber, marginBottom: 15 }}>GLASS</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
            <TokenLabel name="Blur" value="22–26 px" />
            <TokenLabel name="Radius" value="16 / 24 / 30" />
            <TokenLabel name="Border" value="18% white" />
          </div>
        </LiquidGlass>
        <LiquidGlass padding="20px" radius={radiusTokens.card} variant="brightFootage">
          <div style={{ ...typographyTokens.label, color: colorTokens.mint, marginBottom: 12 }}>SAFE AREA</div>
          <TokenLabel name="Edge" value={`${spacingTokens.edge}px`} />
          <div style={{ marginTop: 10 }}>
            <TokenLabel name="Subtitle" value={`${spacingTokens.subtitleBottom}px`} />
          </div>
        </LiquidGlass>
      </div>
    </div>
    <div style={{ position: "absolute", left: 68, bottom: 176, display: "flex", gap: 11, fontFamily: font }}>
      {designTokenRegistry.map((group) => (
        <div
          key={group.id}
          style={{
            padding: "8px 13px",
            borderRadius: 999,
            background: "rgba(9,11,15,.5)",
            border: "1px solid rgba(255,255,255,.14)",
            color: colorTokens.paperMuted,
            fontSize: 14,
            textTransform: "uppercase",
            letterSpacing: 1.3,
          }}
        >
          {group.id}
        </div>
      ))}
    </div>
    <BilingualSubtitles zh="所有组件共享同一套视觉基础" en="Every component now shares one visual foundation." />
  </LayoutSurface>
);

export const MotionPrimitiveLibraryReview: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const measure = motionProgress({ frame, fps, delayFrames: 88, durationMs: 900 });
  const pathProgress = motionProgress({ frame, fps, delayFrames: 170, durationMs: 1100 });
  const sweepProgress = motionProgress({ frame, fps, delayFrames: 242, durationMs: 720 });
  const activeIndex = Math.min(2, Math.floor(frame / 105));
  return (
    <LayoutSurface templateId="speaker-right-overlay-left" backgroundSrc="review-assets/creator-placeholder.svg">
      <div style={{ position: "absolute", left: 68, top: 58, fontFamily: font }}>
        <SectionTitle eyebrow="MOTION PRIMITIVES" title="克制的动效，也可以有明确的质感" accent={colorTokens.violet} />
      </div>
      <div style={{ position: "absolute", left: 68, top: 210, width: 770, fontFamily: font }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
          {["信息进入", "数值落点", "结论强调"].map((label, index) => (
            <MotionReveal key={label} delayFrames={staggerDelay(index, fps, 110)} distance={18} scaleFrom={0.965}>
              <FocusDim active={activeIndex === index}>
                <LiquidGlass
                  padding="18px"
                  radius={20}
                  accent={`${[colorTokens.blue, colorTokens.mint, colorTokens.amber][index]}44`}
                >
                  <div
                    style={{
                      ...typographyTokens.label,
                      color: [colorTokens.blue, colorTokens.mint, colorTokens.amber][index],
                    }}
                  >
                    0{index + 1}
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 780, marginTop: 10 }}>{label}</div>
                </LiquidGlass>
              </FocusDim>
            </MotionReveal>
          ))}
        </div>
        <MotionReveal delayFrames={82} durationMs={420} style={{ marginTop: 18 }}>
          <LiquidGlass padding="22px" radius={24} style={{ position: "relative" }}>
            <div style={{ display: "grid", gridTemplateColumns: "190px 1fr", gap: 22, alignItems: "center" }}>
              <div>
                <div style={{ color: colorTokens.paperMuted, fontSize: 16 }}>MODEL SCORE</div>
                <div style={{ fontSize: 52, fontWeight: 820, color: colorTokens.mint, marginTop: 4 }}>
                  <AnimatedNumber to={92} delayFrames={88} suffix="" />
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                <GrowBar progress={measure} width={450} color={colorTokens.mint} />
                <DrawLine progress={measure} width={450} color={colorTokens.blue} />
                <TraversePath progress={pathProgress} width={450} color={colorTokens.amber} />
              </div>
            </div>
            <HighlightSweep progress={sweepProgress} />
          </LiquidGlass>
        </MotionReveal>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 9, marginTop: 16 }}>
          {motionPrimitiveRegistry.map((primitive, index) => (
            <MotionReveal
              key={primitive.id}
              delayFrames={170 + staggerDelay(index, fps, 45)}
              distance={8}
              scaleFrom={0.99}
            >
              <div
                style={{
                  padding: "7px 11px",
                  borderRadius: 999,
                  border: "1px solid rgba(255,255,255,.13)",
                  background: "rgba(7,9,13,.46)",
                  fontSize: 13,
                  color: colorTokens.paperMuted,
                  letterSpacing: 1,
                }}
              >
                {primitive.id}
              </div>
            </MotionReveal>
          ))}
        </div>
      </div>
      <BilingualSubtitles zh="动效只在信息发生变化时出现" en="Motion appears only when the information changes." />
    </LayoutSurface>
  );
};

const fixtureForTemplate = (templateId: LayoutTemplateId) => {
  if (templateId === "speaker-left-overlay-right") return layoutFixtureRegistry.find((item) => item.id === "left-dark");
  if (templateId === "speaker-right-overlay-left")
    return layoutFixtureRegistry.find((item) => item.id === "right-dark");
  if (templateId === "speaker-center-right") return layoutFixtureRegistry.find((item) => item.id === "center-bright");
  if (templateId === "bilateral-comparison") return layoutFixtureRegistry.find((item) => item.id === "center-bright");
  if (templateId === "media-evidence") return layoutFixtureRegistry.find((item) => item.id === "left-dark");
  return layoutFixtureRegistry.find((item) => item.id === "center-dark");
};

const layoutReviewTitle: Record<LayoutTemplateId, string> = {
  "speaker-center-left": "人物居中，信息放在左侧",
  "speaker-center-right": "人物居中，信息放在右侧",
  "speaker-left-overlay-right": "人物偏左，使用右侧空间",
  "speaker-right-overlay-left": "人物偏右，使用左侧空间",
  "bilateral-comparison": "双侧信息围绕人物展开",
  "media-evidence": "截图与引用使用独立证据区",
};

export const LayoutTemplateReview: React.FC<{ templateId?: LayoutTemplateId }> = ({
  templateId = "speaker-center-left",
}) => {
  const template = getLayoutTemplate(templateId);
  const fixture = fixtureForTemplate(templateId) ?? layoutFixtureRegistry[0];
  const primary = getPrimaryContentStyle(templateId);
  return (
    <LayoutSurface templateId={templateId} backgroundSrc={fixture.src} showGuides>
      <div
        style={{
          position: "absolute",
          left: template.titleZone.x,
          top: template.titleZone.y,
          width: template.titleZone.width,
          height: template.titleZone.height,
          fontFamily: font,
        }}
      >
        <SectionTitle eyebrow="LAYOUT TEMPLATE" title={layoutReviewTitle[templateId]} accent={colorTokens.blue} />
      </div>
      <div style={{ ...primary, fontFamily: font, display: "flex", alignItems: "center" }}>
        <LiquidGlass padding="22px" radius={24} variant={fixture.luminance === "bright" ? "brightFootage" : "card"}>
          <div style={{ ...typographyTokens.label, color: colorTokens.mint }}>{template.id}</div>
          <div style={{ fontSize: 30, fontWeight: 800, marginTop: 12 }}>组件只占用低信息区域</div>
          <div style={{ ...typographyTokens.body, color: colorTokens.paperMuted, marginTop: 10 }}>
            人物、字幕与标题分别拥有稳定的安全区。
          </div>
        </LiquidGlass>
      </div>
      <BilingualSubtitles
        zh="布局先保护人物，再决定组件放在哪里"
        en="Protect the speaker before placing the overlay."
      />
    </LayoutSurface>
  );
};

export const LayoutFixtureMatrixReview: React.FC = () => (
  <AbsoluteFill
    style={{
      background: colorTokens.canvas,
      padding: 28,
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gridTemplateRows: "1fr 1fr",
      gap: 18,
      fontFamily: font,
    }}
  >
    {layoutFixtureRegistry.map((fixture) => (
      <div
        key={fixture.id}
        style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: 24,
          border: "1px solid rgba(255,255,255,.14)",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: 1920,
            height: 1080,
            transform: "scale(.48)",
            transformOrigin: "top left",
          }}
        >
          <LayoutSurface templateId={fixture.recommendedTemplate} backgroundSrc={fixture.src} showGuides />
        </div>
        <div
          style={{
            position: "absolute",
            left: 18,
            top: 16,
            padding: "7px 11px",
            borderRadius: 999,
            background: "rgba(5,7,10,.72)",
            color: colorTokens.paper,
            fontSize: 14,
            letterSpacing: 1.2,
          }}
        >
          {fixture.id.toUpperCase()}
        </div>
      </div>
    ))}
  </AbsoluteFill>
);

const LegacyStage: React.FC<{ children: React.ReactNode; title: string; subtitle: string }> = ({
  children,
  title,
  subtitle,
}) => (
  <LayoutSurface templateId="speaker-right-overlay-left" backgroundSrc="review-assets/creator-placeholder.svg">
    <div style={{ position: "absolute", left: 68, top: 58, fontFamily: font }}>
      <SectionTitle eyebrow="LEGACY MIGRATION" title={title} accent={colorTokens.mint} />
    </div>
    {children}
    <BilingualSubtitles zh={subtitle} en="Existing components now consume the shared asset foundation." />
  </LayoutSurface>
);

export const MigratedDistributionBarsReview: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <LegacyStage title="柱状图迁移验证" subtitle="柱状图结构不变，但颜色、玻璃与进入节奏已经统一">
      <DistributionBars
        frame={frame}
        fps={fps}
        populationRow={null}
        bars={[
          { label: "A", value: 32 },
          { label: "B", value: 48 },
          { label: "C", value: 67, emphasized: true },
          { label: "D", value: 84, emphasized: true },
        ]}
      />
    </LegacyStage>
  );
};

export const MigratedProcessStepsReview: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <LegacyStage title="流程组件迁移验证" subtitle="当前步骤保持突出，已讲内容自动降权">
      <ProcessSteps
        frame={frame}
        fps={fps}
        activeIndex={2}
        takeaway="顺序正确，才能稳定复现结果"
        items={[
          { id: "a", title: "准备样品", detail: "核对编号" },
          { id: "b", title: "加载方法", detail: "确认参数" },
          { id: "c", title: "系统平衡", detail: "等待基线" },
          { id: "d", title: "开始进样", detail: "采集数据" },
        ]}
      />
    </LegacyStage>
  );
};

export const MigratedHistoricalTimelineReview: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <LegacyStage title="时间轴迁移验证" subtitle="路径、节点与结论沿用同一套动效和颜色语义">
      <HistoricalTimeline
        frame={frame}
        fps={fps}
        activeIndex={3}
        takeaway="复用基础资产后，旧组件仍保持原有语义"
        items={[
          { id: "a", year: "2023", title: "原型", detail: "建立基础组件" },
          { id: "b", year: "2024", title: "复用", detail: "形成注册表" },
          { id: "c", year: "2025", title: "自动化", detail: "接入语义规划" },
          { id: "d", year: "2026", title: "产品化", detail: "固定工作流" },
        ]}
      />
    </LegacyStage>
  );
};

export const layoutReviewDefinitions = layoutTemplateRegistry.map((template) => ({
  id: `ReviewLayout${template.id.replace(/(^|-)([a-z])/g, (_, __, char) => char.toUpperCase())}`,
  templateId: template.id,
}));
