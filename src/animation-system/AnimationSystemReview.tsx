import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { ResolvedAnimationCue } from "../visual-production/timeline.ts";
import { PaperEditorialAnimation } from "./PaperEditorialAnimation.tsx";
import { StopMotionMachineAnimation } from "./StopMotionMachineAnimation.tsx";

const sceneFrames = 180;
const cue = (
  id: string,
  prototypeId: ResolvedAnimationCue["animationIntent"]["prototypeId"],
  takeaway: string,
  stages: ResolvedAnimationCue["animationIntent"]["stages"],
): ResolvedAnimationCue => ({
  id,
  sectionId: "review",
  start: 0,
  end: 6,
  startCue: 0,
  endCue: stages.length - 1,
  primaryVisualType: "animation",
  takeover: "full",
  speakerPresence: "circle-pip",
  styleProfileId: "paper-editorial",
  animationIntent: { prototypeId, styleProfileId: "paper-editorial", takeaway, stages },
});
const reviewCues = [
  cue("review-process", "process-flow", "语义先定结构，再由本地运动积木执行", [
    { id: "stage-1", spokenQuote: "识别口播关系", action: "归纳", label: "语义意图" },
    { id: "stage-2", spokenQuote: "确认精确锚点", action: "锁定", label: "人工确认" },
    { id: "stage-3", spokenQuote: "选择动画原型", action: "编排", label: "结构映射" },
    { id: "stage-4", spokenQuote: "本地稳定渲染", action: "呈现", label: "确定输出" },
  ]),
  cue("review-state", "state-transition", "从候选到批准，每一步都有清晰状态", [
    { id: "stage-1", spokenQuote: "刚生成的动作", action: "创建", label: "候选" },
    { id: "stage-2", spokenQuote: "经过静态和连续审核", action: "检查", label: "审核中" },
    { id: "stage-3", spokenQuote: "人工明确认可后", action: "晋级", label: "已批准" },
  ]),
  cue("review-gate", "evidence-gate", "证据和人工确认同时满足，才能通过", [
    { id: "stage-1", spokenQuote: "口播原句必须匹配", action: "核验", label: "语义证据" },
    { id: "stage-2", spokenQuote: "锚点需要人工确认", action: "确认", label: "创作者决定" },
    { id: "stage-3", spokenQuote: "两个条件都满足", action: "放行", label: "进入制作" },
  ]),
  cue("review-causal", "causal-chain", "明确因果关系，动画才有解释价值", [
    { id: "stage-1", spokenQuote: "只依赖段落级选择", action: "起因", label: "粒度太粗" },
    { id: "stage-2", spokenQuote: "组件出现位置不准", action: "导致", label: "语义错位" },
    { id: "stage-3", spokenQuote: "加入逐句锚点", action: "修正", label: "精确规划" },
    { id: "stage-4", spokenQuote: "画面和话语对齐", action: "结果", label: "表达自然" },
  ]),
  cue("review-before-after", "before-after", "从整段单一画面，变成逐句视觉节奏", [
    { id: "stage-1", spokenQuote: "一整段只选一种画面", action: "之前", label: "段落级" },
    { id: "stage-2", spokenQuote: "一句一句确认主视觉", action: "之后", label: "Visual Beat" },
  ]),
  cue("review-layered", "layered-system", "语义、仲裁、渲染和审核各守一层", [
    { id: "stage-1", spokenQuote: "Agent 给出语义意图", action: "理解", label: "语义层" },
    { id: "stage-2", spokenQuote: "本地规则解决冲突", action: "仲裁", label: "计划层" },
    { id: "stage-3", spokenQuote: "Remotion 确定性制作", action: "执行", label: "渲染层" },
    { id: "stage-4", spokenQuote: "人工审核最终效果", action: "把关", label: "审核层" },
  ]),
];

export const AnimationSystemReview = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sceneIndex = Math.min(reviewCues.length - 1, Math.floor(frame / sceneFrames));
  const sceneFrame = frame - sceneIndex * sceneFrames;
  const reviewCue = reviewCues[sceneIndex];
  return (
    <AbsoluteFill>
      <PaperEditorialAnimation cue={reviewCue} frame={sceneFrame} fps={fps} />
      <div
        data-animation-review-pip="top-right-circle"
        style={{
          position: "absolute",
          top: 54,
          right: 54,
          width: 270,
          height: 270,
          overflow: "hidden",
          borderRadius: "50%",
          border: "8px solid rgba(255,253,246,.95)",
          boxShadow: "0 16px 40px rgba(46,39,27,.24)",
          background: "#d9d2c0",
        }}
      >
        <Img
          src={staticFile("review-assets/creator-placeholder.svg")}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>
      <div
        style={{
          position: "absolute",
          right: 78,
          bottom: 48,
          padding: "7px 12px",
          border: "1px solid rgba(64,57,43,.22)",
          borderRadius: 999,
          background: "rgba(255,253,246,.86)",
          color: "rgba(41,39,34,.62)",
          fontFamily: '"PingFang SC", sans-serif',
          fontSize: 16,
          fontWeight: 700,
        }}
      >
        已批准动画结构 · 可用于正式交付
      </div>
      <div
        style={{
          position: "absolute",
          left: 76,
          bottom: 48,
          color: "rgba(41,39,34,.58)",
          fontFamily: '"PingFang SC", sans-serif',
          fontSize: 16,
          fontWeight: 800,
          letterSpacing: 1,
        }}
      >
        {String(sceneIndex + 1).padStart(2, "0")} / {String(reviewCues.length).padStart(2, "0")} ·{" "}
        {reviewCue.animationIntent.prototypeId}
      </div>
    </AbsoluteFill>
  );
};

export const StopMotionSystemReview = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sceneIndex = Math.min(reviewCues.length - 1, Math.floor(frame / sceneFrames));
  const sceneFrame = frame - sceneIndex * sceneFrames;
  const sourceCue = reviewCues[sceneIndex];
  const reviewCue: ResolvedAnimationCue = {
    ...sourceCue,
    styleProfileId: "stop-motion-machine",
    animationIntent: {
      ...sourceCue.animationIntent,
      styleProfileId: "stop-motion-machine",
    },
  };
  return (
    <AbsoluteFill>
      <StopMotionMachineAnimation cue={reviewCue} frame={sceneFrame} fps={fps} />
      <div
        style={{
          position: "absolute",
          right: 78,
          bottom: 48,
          padding: "7px 12px",
          border: "1px solid rgba(240,223,192,.3)",
          borderRadius: 999,
          background: "rgba(41,34,28,.82)",
          color: "rgba(240,223,192,.74)",
          fontFamily: '"PingFang SC", sans-serif',
          fontSize: 16,
          fontWeight: 700,
        }}
      >
        定格机械模板 · {String(sceneIndex + 1).padStart(2, "0")} / {String(reviewCues.length).padStart(2, "0")}
      </div>
    </AbsoluteFill>
  );
};
