import { parseMedia } from "@remotion/media-parser";
import { Composition, staticFile } from "remotion";
import { reviewCompositions } from "./compositions/review-registry";
import { coverAssetPackFixture, coverReviewFixture, generatedCoverReviewFixture, SeanLabCover } from "./cover/index.ts";
import { TalkingHeadOverlay } from "./compositions/TalkingHeadOverlay";
import { AnimationSystemReview, AnimationTemplatePreview } from "./animation-system/index.ts";
import { ProductionMobileComponentReview } from "./compositions/ProductionMobileComponentReview";

const REVIEW_FPS = 30;
const REVIEW_WIDTH = 1920;
const REVIEW_HEIGHT = 1080;

const productionCompositions = [
  {
    id: "TalkingHeadOverlay",
    defaultProps: {
      headline: "Creator video",
      chapter: "LOCAL WORKFLOW",
      speaker: "Creator",
      subtitle: "",
      timelineLabel: "",
      cards: [],
      keywords: [],
    },
  },
  {
    id: "GeneratedWorkflowReview",
    defaultProps: {
      headline: "Creator video",
      chapter: "LOCAL WORKFLOW",
      speaker: "Creator",
      subtitle: "",
      timelineLabel: "",
      cards: [],
      keywords: [],
    },
  },
];

const coverReviewCompositions = [
  { id: "CoverSignalLandscape", width: 1440, height: 1080, theme: "signal" },
  { id: "CoverPaperLandscape", width: 1440, height: 1080, theme: "paper" },
  { id: "CoverStudioLandscape", width: 1440, height: 1080, theme: "studio" },
  { id: "CoverSignalPortrait", width: 1080, height: 1440, theme: "signal" },
  { id: "CoverPaperPortrait", width: 1080, height: 1440, theme: "paper" },
  { id: "CoverStudioPortrait", width: 1080, height: 1440, theme: "studio" },
] as const;

export const RemotionRoot = () => (
  <>
    {productionCompositions.map(({ id, defaultProps }) => (
      <Composition
        key={id}
        id={id}
        component={TalkingHeadOverlay}
        durationInFrames={1}
        fps={REVIEW_FPS}
        width={REVIEW_WIDTH}
        height={REVIEW_HEIGHT}
        defaultProps={defaultProps}
        calculateMetadata={async ({ props }) => {
          if (!props.videoSrc) return {};
          const metadata = await parseMedia({
            src: staticFile(props.videoSrc),
            fields: { durationInSeconds: true, fps: true },
            acknowledgeRemotionLicense: true,
          });
          const fps = props.outputFps ?? (metadata.fps ? Math.round(metadata.fps * 1000) / 1000 : REVIEW_FPS);
          if (metadata.durationInSeconds === null) throw new Error(`Unable to read duration for ${props.videoSrc}`);
          return { durationInFrames: Math.ceil(metadata.durationInSeconds * fps), fps };
        }}
      />
    ))}
    {reviewCompositions.map(({ id, component, durationInFrames }) => (
      <Composition
        key={id}
        id={id}
        component={component}
        durationInFrames={durationInFrames}
        fps={REVIEW_FPS}
        width={REVIEW_WIDTH}
        height={REVIEW_HEIGHT}
      />
    ))}
    <Composition
      id="ProductionMobileComponentReview"
      component={ProductionMobileComponentReview}
      durationInFrames={300}
      fps={REVIEW_FPS}
      width={REVIEW_WIDTH}
      height={REVIEW_HEIGHT}
      defaultProps={{ componentId: "binary-versus" }}
    />
    <Composition
      id="AnimationSystemReview"
      component={AnimationSystemReview}
      durationInFrames={1080}
      fps={REVIEW_FPS}
      width={REVIEW_WIDTH}
      height={REVIEW_HEIGHT}
    />
    <Composition
      id="AnimationTemplatePreview"
      component={AnimationTemplatePreview}
      durationInFrames={300}
      fps={REVIEW_FPS}
      width={REVIEW_WIDTH}
      height={REVIEW_HEIGHT}
    />
    {coverReviewCompositions.map(({ id, width, height, theme }) => (
      <Composition
        key={id}
        id={id}
        component={SeanLabCover}
        durationInFrames={1}
        fps={REVIEW_FPS}
        width={width}
        height={height}
        defaultProps={coverReviewFixture(theme)}
      />
    ))}
    <Composition
      id="CoverGeneratedSignalLandscape"
      component={SeanLabCover}
      durationInFrames={1}
      fps={REVIEW_FPS}
      width={1440}
      height={1080}
      defaultProps={generatedCoverReviewFixture("landscape")}
    />
    <Composition
      id="CoverGeneratedSignalPortrait"
      component={SeanLabCover}
      durationInFrames={1}
      fps={REVIEW_FPS}
      width={1080}
      height={1440}
      defaultProps={generatedCoverReviewFixture("portrait")}
    />
    <Composition
      id="CoverAssetPackLandscape"
      component={SeanLabCover}
      durationInFrames={1}
      fps={REVIEW_FPS}
      width={1440}
      height={1080}
      defaultProps={coverAssetPackFixture({
        format: "landscape",
        personSrc: "review-assets/creator-placeholder.svg",
        theme: "signal",
        accents: ["#6EA8FF", "#FF626B"],
        titleLines: ["把写稿、素材", "制作与交付连起来"],
        iconIds: ["system.flow", "system.design"],
      })}
    />
    <Composition
      id="CoverAssetPackPortrait"
      component={SeanLabCover}
      durationInFrames={1}
      fps={REVIEW_FPS}
      width={1080}
      height={1440}
      defaultProps={coverAssetPackFixture({
        format: "portrait",
        personSrc: "review-assets/creator-placeholder.svg",
        theme: "signal",
        accents: ["#6EA8FF", "#FF626B"],
        titleLines: ["把写稿、素材", "制作与交付连起来"],
        iconIds: ["system.flow", "system.design"],
      })}
    />
  </>
);
