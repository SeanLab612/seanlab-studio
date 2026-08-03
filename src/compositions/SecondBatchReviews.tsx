import type React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { LiquidGlass } from "../components/LiquidGlass";
import {
  FactorSequence,
  type FactorSequenceItem,
  type RankedMetricItem,
  RankedMetricList,
  ReviewStage,
} from "../components/review";
import { Icon, type IconId } from "../icons";

const threeFactors: FactorSequenceItem[] = [
  { id: "proposal", iconId: "system.document", title: "写方案", detail: "结构与论点", accent: "#6EA8FF" },
  { id: "deck", iconId: "system.presentation", title: "做演示", detail: "表达与节奏", accent: "#59D98E" },
  { id: "design", iconId: "system.design", title: "做设计", detail: "视觉与层级", accent: "#B59CFF" },
];

const fourFactors: FactorSequenceItem[] = [
  { id: "research", iconId: "system.globe", title: "查资料", detail: "找到可信来源", accent: "#6EA8FF" },
  { id: "proposal", iconId: "system.document", title: "写方案", detail: "整理核心论点", accent: "#59D98E" },
  { id: "deck", iconId: "system.presentation", title: "做演示", detail: "建立叙事节奏", accent: "#F3B545" },
  { id: "design", iconId: "system.design", title: "做设计", detail: "统一视觉语言", accent: "#B59CFF" },
];

const fiveFactors: FactorSequenceItem[] = [
  { id: "market", iconId: "system.globe", title: "市场", detail: "需求是否真实", accent: "#6EA8FF" },
  { id: "product", iconId: "system.chip", title: "产品", detail: "能力是否匹配", accent: "#59D98E" },
  { id: "team", iconId: "system.team", title: "团队", detail: "执行是否稳定", accent: "#B59CFF" },
  { id: "growth", iconId: "system.ranking", title: "增长", detail: "效率是否改善", accent: "#F3B545" },
  { id: "result", iconId: "system.trophy", title: "结果", detail: "价值是否兑现", accent: "#FF626B" },
];

const priceItems: RankedMetricItem[] = [
  { id: "openai", iconId: "brand.openai", label: "GPT", sublabel: "OPENAI", value: 30, displayValue: "$30" },
  {
    id: "anthropic",
    iconId: "brand.anthropic",
    label: "Claude",
    sublabel: "ANTHROPIC",
    value: 25,
    displayValue: "$25",
  },
  {
    id: "qwen",
    iconId: "brand.qwen",
    label: "Qwen",
    sublabel: "ALIBABA",
    value: 4.4,
    displayValue: "$4.4",
    badges: ["国产"],
  },
  {
    id: "deepseek",
    iconId: "brand.deepseek",
    label: "DeepSeek",
    sublabel: "DEEPSEEK",
    value: 0.28,
    displayValue: "$0.28",
    badges: ["最低价"],
    accent: "#59D98E",
  },
];

const scoreItems: RankedMetricItem[] = [
  { id: "openai", iconId: "brand.openai", label: "GPT", sublabel: "OPENAI", value: 92 },
  { id: "anthropic", iconId: "brand.anthropic", label: "Claude", sublabel: "ANTHROPIC", value: 90 },
  {
    id: "qwen",
    iconId: "brand.qwen",
    label: "Qwen",
    sublabel: "ALIBABA",
    value: 88,
    badges: ["开源第一"],
    accent: "#F3B545",
  },
  { id: "kimi", iconId: "brand.kimi", label: "Kimi", sublabel: "MOONSHOT", value: 81 },
  { id: "minimax", iconId: "brand.minimax", label: "MiniMax", sublabel: "MINIMAX", value: 79 },
  { id: "deepseek", iconId: "brand.deepseek", label: "DeepSeek", sublabel: "DEEPSEEK", value: 77 },
];

const FactorReview: React.FC<{
  items: FactorSequenceItem[];
  activeIndex: number;
  headline: string;
  highlightedText: string;
  subtitle: string;
  backgroundSrc?: string;
}> = ({ items, activeIndex, headline, highlightedText, subtitle, backgroundSrc }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <ReviewStage
      eyebrow="FACTOR BY FACTOR"
      title="多个方面，随着口播逐项推进"
      subtitleZh={subtitle}
      subtitleEn="Each factor takes focus while completed points recede."
      accent="#59D98E"
      backgroundSrc={backgroundSrc}
      textEmphasis={[
        { phrase: highlightedText, color: "#59D98E" },
        { phrase: items[activeIndex]?.title ?? "", color: "#F3B545" },
      ]}
    >
      <FactorSequence
        frame={frame}
        fps={fps}
        items={items}
        activeIndex={activeIndex}
        headline={headline}
        highlightedText={highlightedText}
        summary="当前内容保持清晰，讲完后自动降权"
      />
    </ReviewStage>
  );
};

export const FactorSequenceThreeReview: React.FC = () => (
  <FactorReview
    items={threeFactors}
    activeIndex={0}
    headline="一个人，也能组织"
    highlightedText="专业小团队"
    subtitle="先从第一个任务开始，后面的能力等待展开"
  />
);
export const FactorSequenceFourReview: React.FC<{ backgroundSrc?: string }> = ({ backgroundSrc }) => (
  <FactorReview
    items={fourFactors}
    activeIndex={2}
    headline="从研究到表达"
    highlightedText="四种能力协同"
    subtitle="前两项已经讲完，现在重点解释演示表达"
    backgroundSrc={backgroundSrc}
  />
);
export const FactorSequenceFiveReview: React.FC = () => (
  <FactorReview
    items={fiveFactors}
    activeIndex={4}
    headline="判断一项机会"
    highlightedText="需要五个维度"
    subtitle="前面的因素已经完成，最后检查价值是否兑现"
  />
);

export const FactorSequenceMvpReview: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const activeIndex = Math.min(fourFactors.length - 1, Math.floor(frame / 90));
  const subtitles = [
    "先查资料，建立可靠的信息基础",
    "然后把资料整理成清晰方案",
    "接下来把方案转化成演示叙事",
    "最后统一整套内容的视觉语言",
  ];
  return (
    <ReviewStage
      eyebrow="FACTOR SEQUENCE"
      title="四种能力，按口播顺序逐项接力"
      subtitleZh={subtitles[activeIndex]}
      subtitleEn="One capability takes focus at a time."
      accent="#59D98E"
    >
      <FactorSequence
        frame={frame}
        fps={fps}
        items={fourFactors}
        activeIndex={activeIndex}
        headline="从研究到表达"
        highlightedText="四种能力协同"
        summary="每项约停留三秒，完成项自动变暗"
      />
    </ReviewStage>
  );
};

export const RankedMetricPriceReview: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <ReviewStage
      eyebrow="MODEL COST COMPARISON"
      title="同一指标下，模型价格差异有多大？"
      subtitleZh="价格模式默认把更低的成本排在前面"
      subtitleEn="Price mode ranks lower cost first."
      accent="#59D98E"
    >
      <RankedMetricList
        frame={frame}
        fps={fps}
        items={priceItems}
        mode="price"
        metricLabel="OUTPUT PRICE · ILLUSTRATIVE"
        takeaway="相同工作量，不同模型的成本可能相差百倍"
        callout={{ label: "最低价差", value: "107×", detail: "$30 ÷ $0.28", accent: "#F3B545" }}
      />
    </ReviewStage>
  );
};

export const RankedMetricScoreReview: React.FC<{ backgroundSrc?: string }> = ({ backgroundSrc }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <ReviewStage
      eyebrow="MODEL BENCHMARK"
      title="六个模型，在同一评分标准下比较"
      subtitleZh="评分模式自动从高到低排列，并可突出指定选项"
      subtitleEn="Score mode ranks high to low and can spotlight any option."
      accent="#6EA8FF"
      backgroundSrc={backgroundSrc}
      textEmphasis={[
        { phrase: "Qwen", color: "#F3B545" },
        { phrase: "开源", color: "#59D98E" },
      ]}
    >
      <RankedMetricList
        frame={frame}
        fps={fps}
        items={scoreItems}
        mode="score"
        highlightId="qwen"
        metricLabel="CODE BENCHMARK · ILLUSTRATIVE"
        takeaway="总分不是唯一结论，也可以突出开源或成本优势"
      />
    </ReviewStage>
  );
};

export const RankedMetricMvpReview: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <ReviewStage
      eyebrow="RANKED METRIC LIST"
      title="六个模型，在同一指标下完整比较"
      subtitleZh="全部选项一次呈现，结论项可以保持重点突出"
      subtitleEn="All options remain visible while the conclusion can stay highlighted."
      accent="#6EA8FF"
    >
      <RankedMetricList
        frame={frame}
        fps={fps}
        items={scoreItems}
        mode="score"
        highlightId="qwen"
        metricLabel="CODE BENCHMARK · ILLUSTRATIVE"
        takeaway="排行顺序由数值决定，所有选项保持完整可读"
      />
    </ReviewStage>
  );
};

const iconExamples: Array<{ id: IconId | string; label: string }> = [
  { id: "brand.openai", label: "OpenAI" },
  { id: "brand.anthropic", label: "Claude" },
  { id: "brand.deepseek", label: "DeepSeek" },
  { id: "brand.qwen", label: "Qwen" },
  { id: "brand.kimi", label: "Kimi" },
  { id: "brand.minimax", label: "MiniMax" },
  { id: "system.gift", label: "免费" },
  { id: "system.document", label: "文档" },
  { id: "system.presentation", label: "演示" },
  { id: "system.design", label: "设计" },
  { id: "system.team", label: "团队" },
  { id: "system.trophy", label: "冠军" },
  { id: "system.chip", label: "模型" },
  { id: "system.globe", label: "全球" },
  { id: "system.quote", label: "引用" },
  { id: "system.ranking", label: "排行" },
  { id: "brand.unknown", label: "Fallback" },
];

export const IconLibraryReview: React.FC = () => (
  <ReviewStage
    eyebrow="ICON FOUNDATION"
    title="品牌图标、通用图标与稳定回退"
    subtitleZh="组件只引用 iconId，缺少品牌资产时自动显示字母缩写"
    subtitleEn="Components request iconId and fall back safely when an asset is missing."
    accent="#B59CFF"
  >
    <div
      style={{
        position: "absolute",
        left: 70,
        top: 205,
        width: 740,
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 12,
      }}
    >
      {iconExamples.map((item) => (
        <LiquidGlass key={item.id} accent="rgba(200,135,255,0.25)" padding="12px" radius={18} style={{ height: 58 }}>
          <div style={{ height: "100%", display: "flex", alignItems: "center", gap: 11 }}>
            <Icon id={item.id} fallbackLabel={item.label} size={42} color="#B59CFF" variant="dark" />
            <div
              style={{
                fontSize: 16,
                fontWeight: 780,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {item.label}
            </div>
          </div>
        </LiquidGlass>
      ))}
    </div>
  </ReviewStage>
);
