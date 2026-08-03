import type React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { BilingualSubtitles, SectionTitle } from "../components/review/shared.tsx";
import {
  CorePositioningNode,
  DecisionMatrix,
  MediaComparison,
  ProcessSteps,
  QuoteSourceCard,
  RankedMetricList,
} from "../components/review/index.ts";
import { colorTokens, typographyTokens } from "../design-tokens/index.ts";
import { LayoutSurface } from "../layout-templates/index.ts";
import { CardFlip3D, linearMotionProgress, StateMorph } from "../motion-primitives/index.ts";
import type { CandidateMotionPrimitiveId } from "../motion-primitives/types.ts";

const sceneOrder: CandidateMotionPrimitiveId[] = [
  "state-morph",
  "flip-reorder",
  "spring-settle",
  "shimmer",
  "orbit-assemble",
  "card-flip-3d",
];

const sceneCopy: Record<
  CandidateMotionPrimitiveId,
  { eyebrow: string; title: string; subtitle: string; subtitleEn: string; accent: string }
> = {
  "state-morph": {
    eyebrow: "MOBILE PHASE · SYSTEM READY",
    title: "更换流动相，先让基线重新稳定",
    subtitle: "确认压力和基线稳定后，再开始第一针样品",
    subtitleEn: "Begin the first injection only after pressure and baseline are stable.",
    accent: colorTokens.mint,
  },
  "flip-reorder": {
    eyebrow: "PURITY COMPARISON · FIVE ANTIBODIES",
    title: "同一方法下，五种抗体的主峰纯度重新排序",
    subtitle: "复测以后，抗体 B 的主峰纯度升到了第一位",
    subtitleEn: "After the repeat run, Antibody B moved into first place.",
    accent: colorTokens.amber,
  },
  "spring-settle": {
    eyebrow: "CAPEX PRIORITY · NEXT QUARTER",
    title: "有限预算，优先解决影响最大的瓶颈",
    subtitle: "液相系统同时具备高影响和高紧迫性，应当优先投入",
    subtitleEn: "The HPLC system combines high impact with high urgency.",
    accent: colorTokens.blue,
  },
  shimmer: {
    eyebrow: "REPORT PARSING · STRUCTURED DATA",
    title: "上传原始报告，关键结果自动归入记录",
    subtitle: "系统正在提取批号、主峰纯度和异常备注",
    subtitleEn: "The system extracts batch, main-peak purity, and exception notes.",
    accent: colorTokens.violet,
  },
  "orbit-assemble": {
    eyebrow: "LAB DATA HUB · ONE SOURCE OF TRUTH",
    title: "样品、仪器、方法和报告汇入同一个数据中枢",
    subtitle: "四类信息归位后，每一次实验都能被完整追溯",
    subtitleEn: "Once all four sources connect, every experiment becomes traceable.",
    accent: colorTokens.amber,
  },
  "card-flip-3d": {
    eyebrow: "QUALITY EVIDENCE · TRACEABLE DECISION",
    title: "结论背后，必须保留可以追溯的原始证据",
    subtitle: "先看到结论，再翻到证据和来源",
    subtitleEn: "See the conclusion first, then reveal its evidence and source.",
    accent: colorTokens.mint,
  },
};

const SceneFrame: React.FC<{ id: CandidateMotionPrimitiveId; frame: number; fps: number }> = ({ id, frame, fps }) => {
  const copy = sceneCopy[id];
  const progress = linearMotionProgress({ frame, fps, delayFrames: 12, durationMs: 2100 });
  const stableFrame = Math.max(0, frame);
  return (
    <LayoutSurface templateId="speaker-right-overlay-left" backgroundSrc="review-assets/creator-placeholder.svg">
      <div style={{ position: "absolute", left: 68, top: 58, width: 780, fontFamily: typographyTokens.family }}>
        <SectionTitle eyebrow={copy.eyebrow} title={copy.title} accent={copy.accent} />
      </div>

      {id === "state-morph" ? (
        <>
          <ProcessSteps
            frame={stableFrame}
            fps={fps}
            activeIndex={progress < 0.3 ? 0 : progress < 0.58 ? 1 : progress < 0.84 ? 2 : 3}
            takeaway="系统适用性通过后，方法状态才真正可用"
            items={[
              { id: "a", title: "置换旧流动相", detail: "排空原有溶剂", iconId: "system.flow" },
              { id: "b", title: "切换新比例", detail: "核对 A/B 相组成", iconId: "system.laboratory" },
              { id: "c", title: "平衡色谱柱", detail: "至少 10 个柱体积", iconId: "system.clock" },
              { id: "d", title: "确认基线稳定", detail: "压力与漂移进入限度", iconId: "system.check" },
            ]}
          />
          <div style={{ position: "absolute", left: 500, top: 742, fontFamily: typographyTokens.family }}>
            <StateMorph progress={progress} fromLabel="正在平衡" toLabel="基线稳定" width={300} />
          </div>
        </>
      ) : null}

      {id === "flip-reorder" ? (
        <RankedMetricList
          frame={stableFrame}
          fps={fps}
          mode="percentage"
          metricLabel="MAIN PEAK PURITY"
          takeaway="复测结果改变了最终排序"
          highlightId="b"
          previousOrderIds={["a", "c", "d", "b", "e"]}
          reorderProgress={progress}
          items={[
            {
              id: "b",
              label: "抗体 B",
              sublabel: "LOT B-072",
              value: 98.7,
              iconId: "system.laboratory",
              accent: colorTokens.mint,
            },
            { id: "a", label: "抗体 A", sublabel: "LOT A-116", value: 97.9, iconId: "system.laboratory" },
            { id: "c", label: "抗体 C", sublabel: "LOT C-208", value: 96.8, iconId: "system.laboratory" },
            { id: "d", label: "抗体 D", sublabel: "LOT D-041", value: 95.6, iconId: "system.laboratory" },
            { id: "e", label: "抗体 E", sublabel: "LOT E-133", value: 94.9, iconId: "system.laboratory" },
          ]}
        />
      ) : null}

      {id === "spring-settle" ? (
        <DecisionMatrix
          frame={stableFrame}
          fps={fps}
          xLabel="影响范围"
          yLabel="处理紧迫性"
          accent={copy.accent}
          highlightIds={["hplc"]}
          selectionProgress={progress}
          points={[
            { id: "hplc", label: "液相系统", x: 82, y: 86, color: colorTokens.mint },
            { id: "ms", label: "质谱软件", x: 70, y: 54, color: colorTokens.blue },
            { id: "water", label: "纯水机", x: 42, y: 67, color: colorTokens.amber },
            { id: "archive", label: "归档服务器", x: 36, y: 28, color: colorTokens.violet },
          ]}
        />
      ) : null}

      {id === "shimmer" ? (
        <MediaComparison
          frame={stableFrame}
          fps={fps}
          relation="→"
          shimmerProgress={progress}
          takeaway="关键信息进入同一份结构化实验记录"
          items={[
            {
              id: "raw",
              label: "原始检测报告",
              source: "PDF / 18 PAGES",
              caption: "包含批号、图谱与积分结果",
              iconId: "system.document",
              accent: colorTokens.blue,
            },
            {
              id: "data",
              label: "结构化结果",
              source: "LAB RECORD",
              caption: "主峰纯度 98.7%，异常项 0",
              iconId: "system.database",
              accent: colorTokens.mint,
            },
          ]}
        />
      ) : null}

      {id === "orbit-assemble" ? (
        <CorePositioningNode
          frame={stableFrame}
          fps={fps}
          centerLabel="实验室数据中枢"
          centerValue="ONE HUB"
          centerIcon="system.database"
          accent={copy.accent}
          assemblyProgress={progress}
          nodes={[
            {
              id: "sample",
              label: "样品",
              detail: "批号与状态",
              iconId: "system.laboratory",
              accent: colorTokens.blue,
            },
            {
              id: "instrument",
              label: "仪器",
              detail: "运行与维护",
              iconId: "system.chip",
              accent: colorTokens.violet,
            },
            { id: "method", label: "方法", detail: "参数与版本", iconId: "system.flow", accent: colorTokens.mint },
            { id: "report", label: "报告", detail: "结果与结论", iconId: "system.document", accent: colorTokens.amber },
          ]}
        />
      ) : null}

      {id === "card-flip-3d" ? (
        <div style={{ position: "absolute", left: 0, top: 0 }}>
          <CardFlip3D
            progress={progress}
            width={880}
            height={820}
            front={
              <QuoteSourceCard
                frame={stableFrame}
                fps={fps}
                quote="本批次主峰纯度达到 98.7%，符合放行标准。"
                sourceName="质量评估结论"
                sourceRole="BATCH RELEASE SUMMARY"
                sourceKind="report"
                date="2026-07-12"
                citation="QA-2026-0712"
                accent={colorTokens.mint}
              />
            }
            back={
              <QuoteSourceCard
                frame={stableFrame}
                fps={fps}
                quote="结论来自原始图谱、积分结果和系统适用性记录，三项证据均已归档。"
                sourceName="原始检测证据"
                sourceRole="CHROMATOGRAM / INTEGRATION / SST"
                sourceKind="report"
                date="2026-07-12"
                citation="RAW-DATA-8841"
                accent={colorTokens.blue}
              />
            }
          />
        </div>
      ) : null}

      <BilingualSubtitles zh={copy.subtitle} en={copy.subtitleEn} />
    </LayoutSurface>
  );
};

export const RealMotionSceneReview: React.FC<{ sceneId?: CandidateMotionPrimitiveId }> = ({
  sceneId = "state-morph",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return <SceneFrame id={sceneId} frame={frame} fps={fps} />;
};

export const RealMotionPack2MvpReview: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sceneDuration = fps * 4;
  const sceneIndex = Math.min(sceneOrder.length - 1, Math.floor(frame / sceneDuration));
  return <SceneFrame id={sceneOrder[sceneIndex]} frame={frame - sceneIndex * sceneDuration} fps={fps} />;
};

export const realMotionPack2ReviewDefinitions = sceneOrder.map((sceneId) => ({
  id: `ReviewRealMotion${sceneId
    .split("-")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("")}`,
  sceneId,
}));
