import type React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import {
  ChartRecipe,
  chartRecipeRegistry,
  componentChartBindings,
  type ChartModel,
  type ChartRecipeId,
  validateChartQa,
} from "../charts";
import { BilingualSubtitles, SectionTitle } from "../components/review/shared";
import { chartTokens, colorTokens, typographyTokens } from "../design-tokens";
import { LayoutSurface } from "../layout-templates";

export const chartReviewModels: Record<ChartRecipeId, ChartModel> = {
  "bar-comparison": {
    format: "percentage",
    unit: "%",
    data: [
      { id: "a", label: "抗体 A", value: 96.8 },
      { id: "b", label: "抗体 B", value: 98.7, color: colorTokens.mint },
      { id: "c", label: "抗体 C", value: 95.9 },
      { id: "d", label: "抗体 D", value: 97.4 },
      { id: "e", label: "抗体 E", value: 94.6 },
    ],
  },
  "line-trend": {
    unit: "指数",
    categories: ["Q1", "Q2", "Q3", "Q4", "Q5"],
    series: [
      { id: "hbm", label: "海力士", color: colorTokens.amber, values: [31, 38, 52, 67, 82] },
      { id: "micron", label: "美光", color: colorTokens.blue, values: [27, 34, 43, 55, 69] },
      { id: "samsung", label: "三星", color: colorTokens.mint, values: [44, 47, 54, 61, 73] },
    ],
  },
  "dot-plot": {
    format: "duration",
    unit: "秒",
    data: [
      { id: "a", label: "人工整理", value: 82 },
      { id: "b", label: "规则脚本", value: 41 },
      { id: "c", label: "AI 工作流", value: 16, color: colorTokens.mint },
    ],
  },
  "ring-ratio": {
    format: "percentage",
    data: [
      { id: "pass", label: "一次通过", value: 78, color: colorTokens.mint },
      { id: "review", label: "需要复核", value: 17, color: colorTokens.amber },
      { id: "fail", label: "需要返工", value: 5, color: colorTokens.red },
    ],
  },
  waterfall: {
    format: "currency",
    unit: "百万元",
    data: [
      { id: "revenue", label: "收入", value: 100 },
      { id: "material", label: "材料", value: -24 },
      { id: "labor", label: "人工", value: -16 },
      { id: "quality", label: "质控", value: -8 },
      { id: "profit", label: "利润", value: 52 },
    ],
  },
  scatter: {
    data: [
      { id: "a", label: "模型 A", value: 0, x: 24, y: 62 },
      { id: "b", label: "模型 B", value: 0, x: 43, y: 78 },
      { id: "c", label: "模型 C", value: 0, x: 67, y: 48 },
      { id: "d", label: "模型 D", value: 0, x: 82, y: 86 },
    ],
  },
  "interval-band": {
    format: "percentage",
    unit: "%",
    categories: ["B1", "B2", "B3", "B4", "B5", "B6"],
    series: [{ id: "purity", label: "主峰纯度", color: colorTokens.violet, values: [94, 95, 97, 96, 98, 97] }],
  },
  funnel: {
    format: "number",
    data: [
      { id: "screen", label: "初筛", value: 120 },
      { id: "confirm", label: "确认", value: 64 },
      { id: "stability", label: "稳定性", value: 31 },
      { id: "candidate", label: "最终候选", value: 8 },
    ],
  },
  "before-after": {
    data: [
      { id: "time", label: "报告时间", value: 58, secondaryValue: 18 },
      { id: "error", label: "录入错误", value: 14, secondaryValue: 4 },
      { id: "cost", label: "单批成本", value: 46, secondaryValue: 29 },
    ],
  },
  "risk-return-quadrant": {
    data: [
      { id: "cash", label: "现金", value: 0, x: 14, y: 18 },
      { id: "bond", label: "债券", value: 0, x: 31, y: 36 },
      { id: "index", label: "指数", value: 0, x: 58, y: 62 },
      { id: "growth", label: "成长股", value: 0, x: 81, y: 84 },
    ],
  },
};

const recipeCopy: Record<ChartRecipeId, { eyebrow: string; title: string; zh: string; en: string }> = {
  "bar-comparison": {
    eyebrow: "PURITY · SAME METHOD",
    title: "五种抗体主峰纯度对比",
    zh: "抗体 B 的主峰纯度最高。",
    en: "Antibody B has the highest main-peak purity.",
  },
  "line-trend": {
    eyebrow: "MEMORY STOCKS · FIVE QUARTERS",
    title: "三家内存公司的估值趋势",
    zh: "趋势变化比单点市值更能说明分化。",
    en: "The trend explains the divergence better than one snapshot.",
  },
  "dot-plot": {
    eyebrow: "REPORT TIME · PER BATCH",
    title: "自动化把整理时间压缩到十六秒",
    zh: "同一指标下，点图更适合强调差距。",
    en: "A dot plot makes the gap clear on one shared metric.",
  },
  "ring-ratio": {
    eyebrow: "QUALITY RESULT · SHARE",
    title: "大多数批次可以一次通过",
    zh: "一次通过率达到百分之七十八。",
    en: "The first-pass rate reaches seventy-eight percent.",
  },
  waterfall: {
    eyebrow: "PROFIT BRIDGE · THIS QUARTER",
    title: "利润从收入中逐项扣减形成",
    zh: "材料和人工是主要成本来源。",
    en: "Materials and labor are the main cost drivers.",
  },
  scatter: {
    eyebrow: "MODEL MAP · COST AND QUALITY",
    title: "价格和质量必须放在两个维度观察",
    zh: "单一排名会隐藏模型之间的定位差异。",
    en: "A single ranking hides positioning differences.",
  },
  "interval-band": {
    eyebrow: "PURITY RANGE · SIX BATCHES",
    title: "平均值之外，还要观察波动区间",
    zh: "区间带可以同时展示趋势和不确定性。",
    en: "The band shows both trend and uncertainty.",
  },
  funnel: {
    eyebrow: "ANTIBODY SCREENING · PIPELINE",
    title: "一百二十个样本最终留下八个候选",
    zh: "每一轮筛选都明显收窄候选范围。",
    en: "Each screening stage narrows the candidate pool.",
  },
  "before-after": {
    eyebrow: "WORKFLOW CHANGE · BEFORE / AFTER",
    title: "新流程同时降低时间、错误和成本",
    zh: "改造后的三个指标都出现改善。",
    en: "All three metrics improve after the workflow change.",
  },
  "risk-return-quadrant": {
    eyebrow: "PORTFOLIO · RISK / RETURN",
    title: "收益越高，通常也承担更高风险",
    zh: "不同资产应放在同一风险收益坐标中比较。",
    en: "Compare assets on the same risk-return plane.",
  },
};

export const ChartRecipeReview: React.FC<{ recipeId: ChartRecipeId; backgroundSrc?: string }> = ({
  recipeId,
  backgroundSrc = "review-assets/creator-placeholder.svg",
}) => {
  const frame = useCurrentFrame();
  const copy = recipeCopy[recipeId];
  const semanticIssues = validateChartQa({ recipeId, model: chartReviewModels[recipeId] });
  if (semanticIssues.length)
    throw new Error(`${recipeId} review model failed chart QA: ${JSON.stringify(semanticIssues)}`);
  return (
    <LayoutSurface templateId="speaker-right-overlay-left" backgroundSrc={backgroundSrc}>
      <div style={{ position: "absolute", left: 68, top: 58, width: 760, fontFamily: typographyTokens.family }}>
        <SectionTitle eyebrow={copy.eyebrow} title={copy.title} accent={colorTokens.blue} />
      </div>
      <div style={{ position: "absolute", left: 60, top: 190, width: 720, height: 500, zoom: 0.94 }}>
        <ChartRecipe recipeId={recipeId} model={chartReviewModels[recipeId]} frame={frame} />
      </div>
      <BilingualSubtitles zh={copy.zh} en={copy.en} />
    </LayoutSurface>
  );
};

export const ChartConnectionReview: React.FC = () => (
  <AbsoluteFill
    style={{
      background: colorTokens.canvas,
      color: colorTokens.paper,
      fontFamily: typographyTokens.family,
      padding: 70,
    }}
  >
    <SectionTitle
      eyebrow="SEMANTIC ROUTING · CONTROLLED CHARTS"
      title="口播理解、语义组件和图表配方的连接关系"
      accent={colorTokens.mint}
    />
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 64px 1fr 64px 1.3fr",
        alignItems: "center",
        gap: 14,
        marginTop: 110,
      }}
    >
      {[
        ["口播理解", "比较对象 · 指标 · 时间 · 关系"],
        ["→", ""],
        ["Chart Intent", "只描述数据关系，不指定样式"],
        ["→", ""],
        ["批准的语义组件", "组件通过 allowlist 使用候选图表配方"],
      ].map(([title, detail], index) =>
        index === 1 || index === 3 ? (
          <div key={index} style={{ textAlign: "center", fontSize: 44, color: colorTokens.amber }}>
            {title}
          </div>
        ) : (
          <div
            key={title}
            style={{
              padding: 26,
              borderRadius: 24,
              background: chartTokens.reviewSurface,
              border: `1px solid ${chartTokens.reviewBorder}`,
            }}
          >
            <div style={{ fontSize: 26, fontWeight: 850 }}>{title}</div>
            <div style={{ fontSize: 17, color: colorTokens.paperMuted, marginTop: 12, lineHeight: 1.45 }}>{detail}</div>
          </div>
        ),
      )}
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16, marginTop: 80 }}>
      {Object.entries(componentChartBindings).map(([component, recipes]) => (
        <div
          key={component}
          style={{
            padding: 20,
            borderRadius: 20,
            border: `1px solid ${chartTokens.blueBorder}`,
            background: chartTokens.blueSurface,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 800, color: colorTokens.blue }}>{component}</div>
          <div style={{ marginTop: 12, fontSize: 15, lineHeight: 1.5 }}>{recipes?.join(" · ")}</div>
        </div>
      ))}
    </div>
    <div style={{ marginTop: 48, fontSize: 16, color: colorTokens.paperMuted }}>
      10 个配方已通过人工审核并进入 APPROVED；雷达图继续保持 RESTRICTED。
    </div>
  </AbsoluteFill>
);

const mvpScenes: Array<{ recipeId: ChartRecipeId; copy: (typeof recipeCopy)[ChartRecipeId] }> = [
  { recipeId: "bar-comparison", copy: recipeCopy["bar-comparison"] },
  { recipeId: "line-trend", copy: recipeCopy["line-trend"] },
  { recipeId: "risk-return-quadrant", copy: recipeCopy["risk-return-quadrant"] },
];

export const ChartFoundationMvpReview: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sceneFrames = fps * 8;
  const index = Math.min(2, Math.floor(frame / sceneFrames));
  const localFrame = frame - index * sceneFrames;
  const scene = mvpScenes[index];
  return (
    <LayoutSurface templateId="speaker-right-overlay-left" backgroundSrc="review-assets/creator-placeholder.svg">
      <div style={{ position: "absolute", left: 68, top: 58, width: 760, fontFamily: typographyTokens.family }}>
        <SectionTitle
          eyebrow={scene.copy.eyebrow}
          title={scene.copy.title}
          accent={[colorTokens.mint, colorTokens.amber, colorTokens.blue][index]}
        />
      </div>
      <div style={{ position: "absolute", left: 60, top: 190, width: 720, height: 500, zoom: 0.94 }}>
        <ChartRecipe recipeId={scene.recipeId} model={chartReviewModels[scene.recipeId]} frame={localFrame} />
      </div>
      <BilingualSubtitles zh={scene.copy.zh} en={scene.copy.en} />
    </LayoutSurface>
  );
};

export const chartReviewDefinitions = Object.keys(chartRecipeRegistry).map((recipeId) => ({
  id: `ReviewChart${recipeId
    .split("-")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("")}`,
  recipeId: recipeId as ChartRecipeId,
}));
