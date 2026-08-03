import type React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { ImageEvidenceInset, ReviewStage } from "../components/review";
import { SoundEventLayer } from "../sound-design";

const EvidenceReview: React.FC<{
  orientation: "landscape" | "portrait" | "square" | "long-portrait";
  imageSrc: string;
  fit?: "contain" | "cover";
  backgroundSrc?: string;
}> = ({ orientation, imageSrc, fit = "contain", backgroundSrc }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <ReviewStage
      eyebrow="PROJECT IMAGE EVIDENCE"
      title="项目图片成为可追溯的画面证据"
      subtitleZh="素材经过登记和清晰度检查后，才会进入最终画面"
      subtitleEn="Only registered and verified project images can enter the final frame."
      accent="#59D98E"
      backgroundSrc={backgroundSrc}
      textEmphasis={[
        { phrase: "确定性引用", color: "#59D98E" },
        { phrase: "不由模型编造", color: "#FF626B" },
      ]}
    >
      <ImageEvidenceInset
        frame={frame}
        fps={fps}
        assetId={`review-${orientation}`}
        imageSrc={imageSrc}
        orientation={orientation}
        fit={fit}
        caption="从项目素材库确定性引用，不由模型编造路径"
        sourceLabel="SeanLab Studio"
      />
    </ReviewStage>
  );
};

export const ImageEvidenceLandscapeReview: React.FC<{ backgroundSrc?: string }> = ({ backgroundSrc }) => (
  <EvidenceReview orientation="landscape" imageSrc="review-assets/interface-codex.svg" backgroundSrc={backgroundSrc} />
);
export const ImageEvidencePortraitReview = () => (
  <EvidenceReview orientation="portrait" imageSrc="review-assets/image-evidence-portrait.svg" />
);
export const ImageEvidenceSquareReview = () => (
  <EvidenceReview orientation="square" imageSrc="review-assets/image-evidence-square.svg" />
);
export const ImageEvidenceLongPortraitReview = () => (
  <EvidenceReview orientation="long-portrait" imageSrc="review-assets/image-evidence-portrait.svg" />
);

export const ImageEvidenceTransitionReview = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const exitProgress = interpolate(frame, [64, 78], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 1 - exitProgress,
          transform: `translateY(${-18 * exitProgress}px) scale(${1 - 0.018 * exitProgress})`,
        }}
      >
        <EvidenceReview orientation="landscape" imageSrc="review-assets/interface-codex.svg" />
      </div>
      <SoundEventLayer
        events={[
          {
            id: "review-image-entry",
            at: 0.2,
            assetId: "seanlab-soft-whoosh-v1",
            role: "scene-transition",
            gainDb: -16,
            priority: 70,
            reason: "Registered image evidence enters",
          },
          {
            id: "review-image-exit",
            at: 64 / fps,
            assetId: "seanlab-component-exit-v1",
            role: "component-exit",
            gainDb: -22,
            priority: 55,
            reason: "Registered image evidence exits",
          },
        ]}
      />
    </AbsoluteFill>
  );
};
