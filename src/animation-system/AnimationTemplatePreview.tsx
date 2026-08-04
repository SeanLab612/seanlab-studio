import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { ResolvedAnimationCue } from "../visual-production/timeline.ts";
import { PaperEditorialAnimation } from "./PaperEditorialAnimation.tsx";

const previewCue: ResolvedAnimationCue = {
  id: "paper-editorial-template-preview",
  sectionId: "template-preview",
  start: 0,
  end: 10,
  startCue: 0,
  endCue: 3,
  primaryVisualType: "animation",
  takeover: "full",
  speakerPresence: "circle-pip",
  styleProfileId: "paper-editorial",
  animationIntent: {
    prototypeId: "process-flow",
    styleProfileId: "paper-editorial",
    takeaway: "从口播语义，到确定性画面",
    stages: [
      {
        id: "stage-1",
        spokenQuote: "理解口播中的关系",
        action: "理解",
        label: "语义意图",
        iconId: "system.search",
      },
      { id: "stage-2", spokenQuote: "选择适合的动画结构", action: "规划", label: "画面结构" },
      { id: "stage-3", spokenQuote: "使用本地运动积木制作", action: "执行", label: "手绘动画" },
      { id: "stage-4", spokenQuote: "最后由人工审核效果", action: "确认", label: "稳定输出" },
    ],
  },
};

export const AnimationTemplatePreview = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <PaperEditorialAnimation cue={previewCue} frame={frame} fps={fps} />
      <div
        style={{
          position: "absolute",
          top: 54,
          right: 54,
          width: 248,
          height: 248,
          display: "grid",
          placeItems: "center",
          borderRadius: "50%",
          border: "8px solid rgba(255,253,246,.95)",
          background: "#292722",
          boxShadow: "0 16px 40px rgba(46,39,27,.24)",
        }}
      >
        <strong style={{ color: "#F2EEDF", fontSize: 28, letterSpacing: 3 }}>YOUR LOGO</strong>
      </div>
    </AbsoluteFill>
  );
};
