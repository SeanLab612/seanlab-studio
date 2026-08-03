import type React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { PaperEditorialAnimation } from "../animation-system/PaperEditorialAnimation.tsx";
import type { ResolvedAnimationCue } from "../visual-production/timeline.ts";

const ReviewSpeakerPip: React.FC = () => (
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
);

const ReviewBadge: React.FC<{ children: React.ReactNode; light?: boolean }> = ({ children, light = false }) => (
  <div
    style={{
      position: "absolute",
      right: 78,
      bottom: 48,
      padding: "8px 14px",
      border: `1px solid ${light ? "rgba(64,57,43,.22)" : "rgba(255,255,255,.2)"}`,
      borderRadius: 999,
      background: light ? "rgba(255,253,246,.9)" : "rgba(11,17,26,.76)",
      color: light ? "rgba(41,39,34,.68)" : "rgba(255,255,255,.82)",
      fontFamily: '"PingFang SC", sans-serif',
      fontSize: 17,
      fontWeight: 750,
    }}
  >
    {children}
  </div>
);

const animationCue = (
  id: string,
  prototypeId: ResolvedAnimationCue["animationIntent"]["prototypeId"],
  takeaway: string,
  durationSeconds: number,
  stages: ResolvedAnimationCue["animationIntent"]["stages"],
): ResolvedAnimationCue => ({
  id,
  sectionId: "test2-review",
  start: 0,
  end: durationSeconds,
  startCue: 0,
  endCue: stages.length - 1,
  primaryVisualType: "animation",
  takeover: "full",
  speakerPresence: "circle-pip",
  styleProfileId: "paper-editorial",
  animationIntent: { prototypeId, styleProfileId: "paper-editorial", takeaway, stages },
});

const processCue = animationCue("production-process", "process-flow", "完整制作流程按口播逐步推进", 8, [
  { id: "create", spokenQuote: "创建一个新项目", action: "写入起点", label: "创建项目" },
  { id: "script", spokenQuote: "先完成口播稿", action: "向前推进", label: "写稿" },
  { id: "shoot", spokenQuote: "按照锁定稿件完成拍摄", action: "向前推进", label: "拍摄" },
  { id: "produce", spokenQuote: "进入确定性的视频制作", action: "向前推进", label: "视频制作" },
  { id: "review", spokenQuote: "先看静态画面和连续预览", action: "盖章确认", label: "静态审核" },
  { id: "deliver", spokenQuote: "审核通过后再交付成片", action: "到达终点", label: "交付成片" },
]);

const evidenceGateCue = animationCue("human-review-gate", "evidence-gate", "自动制作必须经过人工审核才能通过", 6, [
  { id: "automatic", spokenQuote: "系统完成自动制作", action: "送达审核门前", label: "自动制作" },
  { id: "preview", spokenQuote: "检查连续的 720P 预览", action: "检查连续预览", label: "720P 预览" },
  { id: "human-gate", spokenQuote: "由创作者亲自判断是否通过", action: "人工判断后放行", label: "人工审核" },
]);

const AnimationBeatReview: React.FC<{ cue: ResolvedAnimationCue; label: string }> = ({ cue, label }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <PaperEditorialAnimation cue={cue} frame={frame} fps={fps} />
      <ReviewSpeakerPip />
      <ReviewBadge light>{label} · Test2 自动主视觉审核小样</ReviewBadge>
    </AbsoluteFill>
  );
};

export const ProductionProcessBeatReview: React.FC = () => <AnimationBeatReview cue={processCue} label="流程动画" />;

export const HumanReviewGateBeatReview: React.FC = () => (
  <AnimationBeatReview cue={evidenceGateCue} label="审核门动画" />
);
