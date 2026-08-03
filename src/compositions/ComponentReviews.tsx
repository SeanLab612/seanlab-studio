import type React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import {
  DistributionBars,
  MarketCapLines,
  PersonEvidenceCard,
  ReviewStage,
  ScenarioBranches,
  SemanticVisual,
} from "../components/review";

export const DistributionBarsReview: React.FC<{ backgroundSrc?: string }> = ({ backgroundSrc }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <ReviewStage
      eyebrow="WHO SHARES THE GROWTH"
      title="增长红利，最终流向了谁？"
      subtitleZh="增长不应该只停留在少数人的账户里"
      subtitleEn="Growth should reach more than a privileged few."
      accent="#F3B545"
      backgroundSrc={backgroundSrc}
      textEmphasis={[
        { phrase: "资源越集中", color: "#FF626B" },
        { phrase: "每一个人", color: "#59D98E" },
      ]}
    >
      <DistributionBars frame={frame} fps={fps} />
    </ReviewStage>
  );
};

export const ScenarioBranchesReview: React.FC<{ backgroundSrc?: string }> = ({ backgroundSrc }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const showingUp = frame < 150;
  return (
    <ReviewStage
      eyebrow="THE TWO PATHS"
      title="决定市场方向的两种情况"
      subtitleZh={showingUp ? "只要盈利兑现，市场仍有继续上涨的空间" : "另一种情况，是增长开始低于预期"}
      subtitleEn={
        showingUp
          ? "If earnings deliver, the market still has room to rise."
          : "The other path begins when growth misses expectations."
      }
      accent="#F3B545"
      backgroundSrc={backgroundSrc}
      textEmphasis={[
        { phrase: "未来五年", color: "#6EA8FF" },
        { phrase: "继续涨", color: "#F3B545" },
      ]}
    >
      <ScenarioBranches frame={frame} fps={fps} activeBranch={showingUp ? 0 : 1} />
    </ReviewStage>
  );
};

export const MarketCapLinesReview: React.FC<{ backgroundSrc?: string }> = ({ backgroundSrc }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <ReviewStage
      eyebrow="MARKET CONCENTRATION"
      title="七家公司，撑起了多大的市场？"
      subtitleZh="它们的市值曲线，正在与整个指数绑定"
      subtitleEn="Their market-cap curves are becoming the index itself."
      accent="#FF626B"
      backgroundSrc={backgroundSrc}
      textEmphasis={[
        { phrase: "$21.9T", color: "#6EA8FF" },
        { phrase: "重塑整个指数", color: "#FF626B" },
      ]}
    >
      <MarketCapLines frame={frame} fps={fps} />
    </ReviewStage>
  );
};

export const PersonEvidenceCardReview: React.FC<{ backgroundSrc?: string }> = ({ backgroundSrc }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <ReviewStage
      eyebrow="WHO MOVED THE POLICY"
      title="关键人物与背后的证据链"
      subtitleZh="一个人的观点，如何真正进入公共政策"
      subtitleEn="How one person's argument moved into public policy."
      accent="#6EA8FF"
      backgroundSrc={backgroundSrc}
      textEmphasis={[
        { phrase: "政策变化", color: "#B59CFF" },
        { phrase: "持续进入公共讨论的证据", color: "#6EA8FF" },
      ]}
    >
      <PersonEvidenceCard frame={frame} fps={fps} />
    </ReviewStage>
  );
};

const memoryBars = [
  { label: "海力士", value: 100, displayValue: "100", emphasized: true },
  { label: "三星", value: 86, displayValue: "86" },
  { label: "美光", value: 64, displayValue: "64" },
  { label: "闪迪", value: 51, displayValue: "51" },
  { label: "中芯", value: 38, displayValue: "38" },
];

const memorySeries = [
  { name: "SK", valueLabel: "100", points: [28, 31, 38, 49, 72, 100], color: "#F3B545" },
  { name: "三星", valueLabel: "86", points: [35, 39, 43, 55, 70, 86], color: "#E4BD62" },
  { name: "美光", valueLabel: "64", points: [22, 28, 34, 42, 53, 64], color: "#CBA562" },
  { name: "闪迪", valueLabel: "51", points: [18, 21, 26, 34, 43, 51], color: "#A98A61" },
  { name: "中芯", valueLabel: "38", points: [14, 17, 21, 27, 33, 38], color: "#88705A" },
];

export const AdaptiveAShareScenarioReview: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const showingUp = frame < 150;
  return (
    <ReviewStage
      eyebrow="A-SHARE OUTLOOK"
      title="决定下一阶段行情的两种路径"
      subtitleZh={showingUp ? "政策与盈利形成共振，指数可能延续上行" : "如果增量资金减弱，市场可能重新进入震荡"}
      subtitleEn={
        showingUp
          ? "Policy and earnings could sustain the rally."
          : "Weaker inflows could return the market to consolidation."
      }
      accent="#F3B545"
    >
      <SemanticVisual
        frame={frame}
        fps={fps}
        analysis={{ rhetoric: "scenario", branchCount: 2 }}
        scenario={{
          kicker: "下一阶段",
          question: "A股还会继续上涨吗？",
          activeBranch: showingUp ? 0 : 1,
          branches: [
            { label: "延续上行", detail: "政策共振 · 盈利改善", color: "#59D98E" },
            { label: "震荡回落", detail: "资金减弱 · 预期降温", color: "#FF626B" },
          ],
        }}
      />
    </ReviewStage>
  );
};

export const AdaptiveMemoryComparisonReview: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <ReviewStage
      eyebrow="MEMORY MARKET VALUE"
      title="五家公司，同一时间截面的市值比较"
      subtitleZh="这里只有一个时间截面，所以系统选择柱状图"
      subtitleEn="A single point in time calls for bars, not trend lines."
      accent="#F3B545"
    >
      <SemanticVisual
        frame={frame}
        fps={fps}
        analysis={{ rhetoric: "comparison", entityCount: 5, hasTimeSeries: false, involvesPopulation: false }}
        distribution={{
          bars: memoryBars,
          annotation: "市值指数 · 示意数据",
          populationRow: null,
        }}
      />
    </ReviewStage>
  );
};

export const AdaptiveMemoryTrendReview: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <ReviewStage
      eyebrow="FIVE-YEAR MEMORY TREND"
      title="同样是五家公司，加入时间维度后改用曲线"
      subtitleZh="当数据跨越多个年份，五条曲线才具有真实含义"
      subtitleEn="With a time dimension, five distinct trend lines become meaningful."
      accent="#FF626B"
    >
      <SemanticVisual
        frame={frame}
        fps={fps}
        analysis={{ rhetoric: "comparison", entityCount: 5, hasTimeSeries: true }}
        lines={{
          series: memorySeries,
          groupLabel: "MEMORY 5",
          totalValue: "5Y",
          totalCaption: "市值指数 · 示意",
          takeaway: "五家公司，五条可独立配置的时间序列",
        }}
      />
    </ReviewStage>
  );
};

export const AdaptivePersonEvidenceReview: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <ReviewStage
      eyebrow="THE PERSON BEHIND THE SHIFT"
      title="人物、观点和证据模块可以独立组合"
      subtitleZh="人物照片可以替换，证据卡与时间线也可以按需增减"
      subtitleEn="Portrait, evidence cards and timeline are independently configurable."
      accent="#6EA8FF"
    >
      <SemanticVisual
        frame={frame}
        fps={fps}
        analysis={{ rhetoric: "person-evidence" }}
        person={{
          name: "HUANG JEN-HSUN",
          role: "FOUNDER & CEO",
          quote: "算力基础设施，正在成为下一轮技术周期的底座。",
          evidence: [
            { eyebrow: "SIGNAL 01", title: "需求进入加速区间", meta: "产业信号 · 示例", accent: "#6EA8FF" },
            { eyebrow: "IMPACT 02", title: "供应链重新定价", meta: "市场反馈 · 示例", accent: "#59D98E" },
          ],
          timeline: [
            { label: "2023", accent: "#6EA8FF" },
            { label: "2024", accent: "#6EA8FF" },
            { label: "2025", accent: "#59D98E" },
          ],
        }}
      />
    </ReviewStage>
  );
};
