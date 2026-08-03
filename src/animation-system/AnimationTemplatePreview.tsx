import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { ResolvedAnimationCue } from "../visual-production/timeline.ts";
import { PaperEditorialAnimation } from "./PaperEditorialAnimation.tsx";
import { StopMotionMachineAnimation } from "./StopMotionMachineAnimation.tsx";

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

const stopMotionPreviewCue: ResolvedAnimationCue = {
  ...previewCue,
  id: "stop-motion-machine-template-preview",
  styleProfileId: "stop-motion-machine",
  animationIntent: {
    ...previewCue.animationIntent,
    styleProfileId: "stop-motion-machine",
    takeaway: "从口播语义，到机械化画面",
    stages: [
      {
        id: "stage-1",
        spokenQuote: "理解口播中的关系",
        action: "识别输入",
        label: "理解语义",
        iconId: "system.search",
      },
      {
        id: "stage-2",
        spokenQuote: "提取画面中的阶段",
        action: "整理内容",
        label: "提取阶段",
        iconId: "system.document",
      },
      {
        id: "stage-3",
        spokenQuote: "匹配对应的功能图标",
        action: "匹配视觉",
        label: "选择图标",
        iconId: "system.design",
      },
      {
        id: "stage-4",
        spokenQuote: "最后完成确定性渲染",
        action: "确认输出",
        label: "稳定交付",
        iconId: "system.check",
      },
    ],
  },
};

export const StopMotionTemplatePreview = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <StopMotionMachineAnimation cue={stopMotionPreviewCue} frame={frame} fps={fps} />
      <div
        style={{
          position: "absolute",
          top: 54,
          right: 54,
          width: 220,
          height: 220,
          display: "grid",
          placeItems: "center",
          borderRadius: "50%",
          border: "8px solid rgba(240,223,192,.94)",
          background: "#29221C",
          boxShadow: "0 16px 40px rgba(0,0,0,.4)",
        }}
      >
        <strong style={{ color: "#F0DFC0", fontSize: 26, letterSpacing: 3 }}>YOUR LOGO</strong>
      </div>
    </AbsoluteFill>
  );
};
