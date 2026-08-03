import type React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import {
  CausalChain,
  type CausalChainNode,
  type ProcessStepItem,
  ProcessSteps,
  QuoteSourceCard,
  ReviewStage,
} from "../components/review";

const hplcSteps: ProcessStepItem[] = [
  {
    id: "stop",
    title: "停止输液泵",
    detail: "确认系统压力已经稳定",
    iconId: "system.chip",
    duration: "STEP 01",
    accent: "#6EA8FF",
  },
  {
    id: "replace",
    title: "更换流动相",
    detail: "核对配方、批号与有效期",
    iconId: "system.document",
    duration: "STEP 02",
    accent: "#6EA8FF",
  },
  {
    id: "purge",
    title: "管路排气",
    detail: "逐通道排出气泡与旧溶剂",
    iconId: "system.ranking",
    duration: "STEP 03",
    warning: "避免气泡",
    accent: "#F3B545",
  },
  {
    id: "equilibrate",
    title: "平衡色谱柱",
    detail: "基线稳定后再开始进样",
    iconId: "system.trophy",
    duration: "STEP 04",
    accent: "#59D98E",
  },
];

const sixSteps: ProcessStepItem[] = [
  { id: "sample", title: "样品确认", detail: "编号与浓度", iconId: "system.document" },
  { id: "method", title: "方法加载", detail: "波长与流速", iconId: "system.chip" },
  { id: "mobile", title: "流动相检查", detail: "配方与液位", iconId: "system.globe" },
  { id: "purge", title: "系统排气", detail: "清除管路气泡", iconId: "system.ranking" },
  { id: "blank", title: "空白运行", detail: "确认无残留", iconId: "system.presentation" },
  { id: "inject", title: "正式进样", detail: "开始采集数据", iconId: "system.trophy", accent: "#59D98E" },
];

const liquidityChain: CausalChainNode[] = [
  { id: "cut", label: "利率下降", detail: "融资成本回落", iconId: "system.ranking", tone: "neutral" },
  { id: "liquidity", label: "流动性增加", detail: "资金供给改善", iconId: "system.globe", tone: "positive" },
  { id: "risk", label: "风险偏好上升", detail: "资金寻找收益", iconId: "system.team", tone: "positive" },
  { id: "market", label: "估值抬升", detail: "权益资产受益", iconId: "system.trophy", tone: "positive" },
];

const pressureChain: CausalChainNode[] = [
  { id: "cost", label: "原料涨价", detail: "采购成本上升", iconId: "system.globe", tone: "negative" },
  { id: "margin", label: "毛利承压", detail: "单位利润下降", iconId: "system.ranking", tone: "negative" },
  { id: "cash", label: "现金流收紧", detail: "扩产能力减弱", iconId: "system.chip", tone: "negative" },
  { id: "capex", label: "资本开支下降", detail: "项目延期", iconId: "system.document", tone: "negative" },
  { id: "growth", label: "增长放缓", detail: "预期下修", iconId: "system.trophy", tone: "negative" },
];

export const ProcessStepsReview: React.FC<{ backgroundSrc?: string }> = ({ backgroundSrc }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <ReviewStage
      eyebrow="MOBILE PHASE CHANGE"
      title="更换流动相必须按顺序完成"
      subtitleZh="管路排气完成后，下一步是让色谱柱充分平衡"
      subtitleEn="After purging the lines, fully equilibrate the column before injection."
      accent="#59D98E"
      backgroundSrc={backgroundSrc}
      textEmphasis={[
        { phrase: "平衡色谱柱", color: "#6EA8FF" },
        { phrase: "基线稳定", color: "#59D98E" },
      ]}
    >
      <ProcessSteps frame={frame} fps={fps} items={hplcSteps} activeIndex={3} takeaway="基线稳定以后，再开始正式进样" />
    </ReviewStage>
  );
};

export const ProcessStepsSixReview: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <ReviewStage
      eyebrow="HPLC PREPARATION"
      title="正式进样前的六项检查"
      subtitleZh="空白运行没有发现残留，就可以进入正式进样"
      subtitleEn="Once the blank run is clean, the system is ready for injection."
      accent="#6EA8FF"
    >
      <ProcessSteps
        frame={frame}
        fps={fps}
        items={sixSteps}
        activeIndex={5}
        takeaway="任何一步异常，都应先停止并排查"
      />
    </ReviewStage>
  );
};

export const ProcessStepsMvpReview: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const activeIndex = Math.min(hplcSteps.length - 1, Math.floor(frame / 90));
  const subtitles = [
    "第一步先停止输液泵，并确认系统压力稳定",
    "然后核对配方和批号，更换新的流动相",
    "接下来逐通道排气，避免气泡进入色谱柱",
    "最后等待基线稳定，再开始正式进样",
  ];
  const subtitlesEn = [
    "Stop the pump and confirm that system pressure is stable.",
    "Verify the formula and batch before replacing the mobile phase.",
    "Purge each line so no bubbles enter the column.",
    "Wait for a stable baseline before starting the injection.",
  ];
  return (
    <ReviewStage
      eyebrow="MOBILE PHASE CHANGE"
      title="四个步骤，一个都不能跳过"
      subtitleZh={subtitles[activeIndex]}
      subtitleEn={subtitlesEn[activeIndex]}
      accent="#59D98E"
    >
      <ProcessSteps
        frame={frame}
        fps={fps}
        items={hplcSteps}
        activeIndex={activeIndex}
        takeaway="顺序正确，才能避免系统重新污染"
      />
    </ReviewStage>
  );
};

export const CausalChainReview: React.FC<{ backgroundSrc?: string }> = ({ backgroundSrc }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <ReviewStage
      eyebrow="LIQUIDITY TRANSMISSION"
      title="降息如何传导到权益市场？"
      subtitleZh="资金供给改善以后，风险偏好开始上升"
      subtitleEn="As liquidity improves, investors become more willing to take risk."
      accent="#59D98E"
      backgroundSrc={backgroundSrc}
      textEmphasis={[
        { phrase: "风险偏好上升", color: "#F3B545" },
        { phrase: "盈利决定", color: "#59D98E" },
      ]}
    >
      <CausalChain
        frame={frame}
        fps={fps}
        nodes={liquidityChain}
        activeIndex={2}
        takeaway="流动性是起点，盈利决定上涨能走多远"
      />
    </ReviewStage>
  );
};

export const CausalChainFiveReview: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <ReviewStage
      eyebrow="COST PRESSURE"
      title="原料涨价如何拖慢企业增长？"
      subtitleZh="现金流收紧以后，企业会首先削减资本开支"
      subtitleEn="When cash flow tightens, companies often cut capital spending first."
      accent="#FF626B"
    >
      <CausalChain
        frame={frame}
        fps={fps}
        nodes={pressureChain}
        activeIndex={3}
        takeaway="成本冲击最终会反映到增长预期"
      />
    </ReviewStage>
  );
};

export const CausalChainMvpReview: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const activeIndex = Math.min(liquidityChain.length - 1, Math.floor(frame / 90));
  const subtitles = [
    "首先是利率下降，企业和居民的融资成本开始回落",
    "随后市场中的资金供给增加，流动性得到改善",
    "资金开始寻找更高收益，风险偏好随之上升",
    "最后资金进入权益市场，推动估值水平抬升",
  ];
  return (
    <ReviewStage
      eyebrow="LIQUIDITY TRANSMISSION"
      title="从降息到估值抬升的四层传导"
      subtitleZh={subtitles[activeIndex]}
      subtitleEn="Each link transmits the effect to the next part of the market."
      accent="#59D98E"
    >
      <CausalChain
        frame={frame}
        fps={fps}
        nodes={liquidityChain}
        activeIndex={activeIndex}
        takeaway="每一层都成立，传导链才会完整"
      />
    </ReviewStage>
  );
};

export const QuoteSourceReportReview: React.FC<{ backgroundSrc?: string }> = ({ backgroundSrc }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <ReviewStage
      eyebrow="RESEARCH VIEW"
      title="流动性并不能替代盈利增长"
      subtitleZh="报告提醒我们，估值上涨最终仍需要盈利兑现"
      subtitleEn="The report argues that valuation gains still need earnings support."
      accent="#6EA8FF"
      backgroundSrc={backgroundSrc}
      textEmphasis={[
        { phrase: "盈利没有同步改善", color: "#FF626B" },
        { phrase: "很难长期持续", color: "#F3B545" },
      ]}
    >
      <QuoteSourceCard
        frame={frame}
        fps={fps}
        quote="如果盈利没有同步改善，流动性带来的上涨很难长期持续。"
        sourceName="宏观策略月报"
        sourceRole="市场研究团队"
        sourceKind="report"
        date="2026年1月"
        citation="第12页"
        iconId="system.document"
        imageSrc="review-assets/source-report.svg"
      />
    </ReviewStage>
  );
};

export const QuoteSourcePersonReview: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <ReviewStage
      eyebrow="EXPERT VIEW"
      title="方法稳定性比单次高结果更重要"
      subtitleZh="真正可靠的方法，需要在不同批次中重复得到相同结论"
      subtitleEn="A reliable method should reproduce the same conclusion across batches."
      accent="#B59CFF"
    >
      <QuoteSourceCard
        frame={frame}
        fps={fps}
        quote="单次结果再高，也不能替代跨批次的重复性验证。"
        sourceName="林博士"
        sourceRole="分析方法负责人"
        sourceKind="person"
        date="2026年3月"
        citation="方法评审会"
        iconId="system.quote"
        accent="#B59CFF"
      />
    </ReviewStage>
  );
};

export const QuoteSourceMvpReview: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <ReviewStage
      eyebrow="RESEARCH VIEW"
      title="上涨能否持续，仍要看盈利"
      subtitleZh="这份报告的核心判断，是流动性只能提供起点"
      subtitleEn="The report says liquidity can start a rally, but earnings must sustain it."
      accent="#6EA8FF"
    >
      <QuoteSourceCard
        frame={frame}
        fps={fps}
        quote="如果盈利没有同步改善，流动性带来的上涨很难长期持续。"
        sourceName="宏观策略月报"
        sourceRole="市场研究团队"
        sourceKind="report"
        date="2026年1月"
        citation="第12页"
        iconId="system.document"
        imageSrc="review-assets/source-report.svg"
      />
    </ReviewStage>
  );
};
