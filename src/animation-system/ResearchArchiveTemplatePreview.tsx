import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { ResolvedAnimationCue } from "../visual-production/timeline.ts";
import { ResearchArchiveAnimation } from "./ResearchArchiveAnimation.tsx";

const previewCue: ResolvedAnimationCue = {
  id: "research-archive-template-preview",
  sectionId: "template-preview",
  start: 0,
  end: 10,
  startCue: 0,
  endCue: 3,
  primaryVisualType: "animation",
  takeover: "full",
  speakerPresence: "circle-pip",
  styleProfileId: "research-archive",
  animationIntent: {
    prototypeId: "converge-diffuse",
    styleProfileId: "research-archive",
    takeaway: "多条线索汇成清晰结论",
    stages: [
      {
        id: "stage-1",
        spokenQuote: "产品收入持续增长",
        action: "收入线索",
        label: "产品增长",
        iconId: "system.document",
      },
      { id: "stage-2", spokenQuote: "服务收入同步提高", action: "服务线索", label: "服务提升" },
      { id: "stage-3", spokenQuote: "海外市场贡献扩大", action: "市场线索", label: "海外扩张" },
      { id: "stage-4", spokenQuote: "成本效率继续改善", action: "效率线索", label: "效率改善" },
    ],
  },
};

export const ResearchArchiveTemplatePreview = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <ResearchArchiveAnimation cue={previewCue} frame={frame} fps={fps} />
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
          border: "8px solid rgba(244,238,227,.94)",
          background: "#26384B",
          boxShadow: "0 16px 40px rgba(61,48,35,.34)",
        }}
      >
        <strong style={{ color: "#E9E2D4", fontSize: 26, letterSpacing: 3 }}>YOUR LOGO</strong>
      </div>
    </AbsoluteFill>
  );
};
