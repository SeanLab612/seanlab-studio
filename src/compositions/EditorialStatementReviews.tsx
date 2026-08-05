import type React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { EditorialStatement } from "../components/review/EditorialStatement";
import { BilingualSubtitles, palette, SectionTitle } from "../components/review/shared";

export const EditorialStatementReview: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: palette.ink, color: palette.paper, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 72, top: 58 }}>
        <SectionTitle
          eyebrow="PLAIN LANGUAGE"
          title="一张图能变成可用模型吗"
          accent={palette.mint}
          componentId="editorial-statement"
        />
      </div>
      <EditorialStatement
        frame={frame}
        fps={fps}
        leadIn="它不是从图片里"
        denied="提取现成网格"
        prefix="而是"
        emphasis="用代码重新搭建"
        support="模型仍然可以继续编辑、交互和动画"
      />
      <BilingualSubtitles
        zh="它不是从图片里提取现成网格，而是用代码重新搭建。"
        en="It rebuilds the model in code instead of extracting a ready-made mesh."
      />
    </AbsoluteFill>
  );
};
