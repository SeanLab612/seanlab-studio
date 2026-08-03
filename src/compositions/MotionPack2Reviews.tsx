import type React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { LiquidGlass } from "../components/LiquidGlass.tsx";
import { BilingualSubtitles, SectionTitle } from "../components/review/shared.tsx";
import { colorTokens, typographyTokens } from "../design-tokens/index.ts";
import { LayoutSurface } from "../layout-templates/index.ts";
import {
  motionPack2PrimitiveRegistry,
  CardFlip3D,
  FlipReorder,
  linearMotionProgress,
  OrbitAssemble,
  Shimmer,
  SpringSettle,
  StateMorph,
} from "../motion-primitives/index.ts";
import type { CandidateMotionPrimitiveId } from "../motion-primitives/types.ts";
import { componentMotionProfiles, motionPack2RecipeRegistry } from "../motion-recipes/index.ts";

const glassFace: React.CSSProperties = {
  width: "100%",
  height: "100%",
  borderRadius: 24,
  background: "linear-gradient(145deg, rgba(19,24,34,.92), rgba(9,12,18,.78))",
  border: "1px solid rgba(255,255,255,.18)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "white",
  fontWeight: 820,
  fontSize: 24,
};

const Demo: React.FC<{ id: CandidateMotionPrimitiveId; progress: number }> = ({ id, progress }) => {
  if (id === "state-morph") return <StateMorph progress={progress} fromLabel="PENDING" toLabel="已完成" width={400} />;
  if (id === "flip-reorder")
    return (
      <FlipReorder
        progress={progress}
        width={460}
        rowHeight={72}
        items={[
          { id: "a", label: "方案 A", fromIndex: 0, toIndex: 2, color: colorTokens.blue },
          { id: "b", label: "方案 B", fromIndex: 1, toIndex: 0, color: colorTokens.mint },
          { id: "c", label: "方案 C", fromIndex: 2, toIndex: 1, color: colorTokens.amber },
        ]}
      />
    );
  if (id === "spring-settle")
    return (
      <SpringSettle progress={progress}>
        <div style={{ ...glassFace, width: 400, height: 160, color: colorTokens.mint }}>SELECTED · 92</div>
      </SpringSettle>
    );
  if (id === "shimmer")
    return (
      <div
        style={{
          ...glassFace,
          position: "relative",
          width: 480,
          height: 170,
          justifyContent: "flex-start",
          padding: 30,
        }}
      >
        <div style={{ opacity: 0.72 }}>正在读取实验数据</div>
        <Shimmer progress={progress} />
      </div>
    );
  if (id === "orbit-assemble")
    return (
      <OrbitAssemble
        progress={progress}
        size={460}
        nodes={[
          { id: "a", label: "数据", color: colorTokens.blue },
          { id: "b", label: "模型", color: colorTokens.violet },
          { id: "c", label: "工具", color: colorTokens.mint },
          { id: "d", label: "报告", color: colorTokens.amber },
        ]}
      />
    );
  return (
    <CardFlip3D
      progress={progress}
      width={470}
      height={250}
      front={<div style={{ ...glassFace, color: colorTokens.blue }}>问题是什么？</div>}
      back={<div style={{ ...glassFace, color: colorTokens.mint }}>答案与证据</div>}
    />
  );
};

const titleById: Record<CandidateMotionPrimitiveId, string> = {
  "state-morph": "状态连续变化",
  "flip-reorder": "保持身份的排序变化",
  "spring-settle": "一次克制的弹簧落点",
  shimmer: "有限时长的加载反馈",
  "orbit-assemble": "模块围绕核心完成组装",
  "card-flip-3d": "同一证据卡翻面揭示",
};

export const MotionPack2CandidateReview: React.FC<{ primitiveId?: CandidateMotionPrimitiveId }> = ({
  primitiveId = "state-morph",
}) => (
  <LayoutSurface templateId="speaker-left-overlay-right" backgroundSrc="review-assets/creator-placeholder.svg">
    <div style={{ position: "absolute", left: 1080, top: 58, fontFamily: typographyTokens.family }}>
      <SectionTitle eyebrow="MOTION PACK 02 · APPROVED" title={titleById[primitiveId]} accent={colorTokens.violet} />
    </div>
    <div
      style={{
        position: "absolute",
        left: 1080,
        top: 220,
        width: 770,
        height: 580,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: typographyTokens.family,
      }}
    >
      <Demo id={primitiveId} progress={primitiveId === "shimmer" ? 0.55 : 0.76} />
    </div>
    <BilingualSubtitles
      zh="只有表达信息变化时，才调用对应动效"
      en="Motion is used only when the information changes."
    />
  </LayoutSurface>
);

export const MotionPack2MvpReview: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const index = Math.min(5, Math.floor(frame / 60));
  const primitive = motionPack2PrimitiveRegistry[index];
  const localFrame = frame - index * 60;
  const progress = linearMotionProgress({ frame: localFrame, fps, delayFrames: 6, durationMs: 1250 });
  return (
    <LayoutSurface templateId="speaker-left-overlay-right" backgroundSrc="review-assets/creator-placeholder.svg">
      <div style={{ position: "absolute", left: 1080, top: 58, width: 760, fontFamily: typographyTokens.family }}>
        <SectionTitle
          eyebrow={`MOTION PACK 02 · 0${index + 1}`}
          title={titleById[primitive.id as CandidateMotionPrimitiveId]}
          accent={colorTokens.violet}
        />
      </div>
      <div
        style={{
          position: "absolute",
          left: 1080,
          top: 205,
          width: 770,
          height: 610,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: typographyTokens.family,
        }}
      >
        <Demo id={primitive.id as CandidateMotionPrimitiveId} progress={progress} />
      </div>
      <BilingualSubtitles
        zh="动效配方受组件约束，不由模型自由发挥"
        en="Component profiles constrain every motion recipe."
      />
    </LayoutSurface>
  );
};

export const MotionRecipeConnectionReview: React.FC = () => (
  <AbsoluteFill
    style={{
      background: "linear-gradient(145deg,#080b11,#101522)",
      padding: "58px 68px 90px",
      color: "white",
      fontFamily: typographyTokens.family,
    }}
  >
    <SectionTitle eyebrow="CONTROLLED MOTION LAYER" title="组件限定配方，语义只选择意图" accent={colorTokens.blue} />
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 18, marginTop: 55 }}>
      {[
        ["语义组件", `${componentMotionProfiles.length} 个配置档案`, colorTokens.blue],
        ["新增配方", `${motionPack2RecipeRegistry.length} 个受控组合`, colorTokens.violet],
        ["新增原语", `${motionPack2PrimitiveRegistry.length} 个运动能力`, colorTokens.mint],
      ].map(([label, value, color]) => (
        <LiquidGlass key={label} padding="24px" radius={24} accent={`${color}55`}>
          <div style={{ ...typographyTokens.label, color }}>{label}</div>
          <div style={{ fontSize: 30, fontWeight: 820, marginTop: 14 }}>{value}</div>
        </LiquidGlass>
      ))}
    </div>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20, marginTop: 55 }}>
      {["口播理解", "组件 ID", "Motion Intent", "允许的 Recipe", "原语组合"].map((label, index) => (
        <div key={label} style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              padding: "18px 22px",
              borderRadius: 18,
              background: "rgba(255,255,255,.07)",
              border: "1px solid rgba(255,255,255,.14)",
              fontSize: 20,
              fontWeight: 760,
            }}
          >
            {label}
          </div>
          {index < 4 ? <div style={{ color: colorTokens.paperMuted, fontSize: 25 }}>→</div> : null}
        </div>
      ))}
    </div>
  </AbsoluteFill>
);

export const motionPack2ReviewDefinitions = motionPack2PrimitiveRegistry.map((primitive) => ({
  id: `ReviewMotionPack2${primitive.id
    .split("-")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("")}`,
  primitiveId: primitive.id as CandidateMotionPrimitiveId,
}));
