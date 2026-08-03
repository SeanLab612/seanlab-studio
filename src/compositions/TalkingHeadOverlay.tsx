import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  OffthreadVideo,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  PaperEditorialAnimation,
  ResearchArchiveAnimation,
  StopMotionMachineAnimation,
  resolveAnimationProductionSurface,
} from "../animation-system";
import { LiquidGlass } from "../components/LiquidGlass";
import { RoughAnnotation } from "../components/review/RoughAnnotation";
import { SectionTitle } from "../components/review/shared";
import { VisualBriefPanel } from "../components/visual-brief";
import type { OverlayProps } from "../data/sample-props";
import { colorTokens, getScrimRecipe, resolveComponentAccent, typographyTokens } from "../design-tokens";
import { getLayoutTemplate } from "../layout-templates";
import { resolveProductionComponentScale, resolveProductionScrimSide } from "../layout-templates/component-stage";
import { SoundEventLayer } from "../sound-design/SoundEventLayer";
import { PIP_BOTTOM_SAFE_OFFSET } from "../supplemental-media/types";
import { TypographyPolicyProvider } from "../typography-policy";
import { GeneratedVisual } from "../visual-brief/GeneratedVisual";
import {
  PAPER_EDITORIAL_STYLE,
  RESEARCH_ARCHIVE_STYLE,
  STOP_MOTION_MACHINE_STYLE,
} from "../visual-production/animation-registry.ts";

const panelText: React.CSSProperties = {
  fontFamily: typographyTokens.family,
  color: "white",
};

const fadeUp = (frame: number, fps: number, delay = 0) => {
  const progress = spring({
    frame: Math.max(0, frame - delay),
    fps,
    config: {
      damping: 16,
      stiffness: 140,
      mass: 0.7,
    },
  });

  return {
    opacity: progress,
    transform: `translateY(${interpolate(progress, [0, 1], [18, 0])}px) scale(${interpolate(
      progress,
      [0, 1],
      [0.96, 1],
    )})`,
  };
};

const SpeakerTimelineVideo: React.FC<{
  src: string;
  muted?: boolean;
  style?: React.CSSProperties;
}> = ({ src, muted, style }) => <OffthreadVideo src={staticFile(src)} muted={muted} style={style} />;

const TalkingHeadOverlayContent: React.FC<OverlayProps> = ({
  headline,
  chapter,
  speaker,
  subtitle,
  subtitleEn,
  timelineLabel,
  cards,
  keywords,
  videoSrc,
  overlayCues,
  subtitleCues,
  screenScenes,
  titleCues,
  soundEvents,
  animationCues,
  annotationCues,
  imageCues,
  overlayScale = 1,
  overlaySide = "left",
  layoutTemplateId,
}) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const seconds = frame / fps;
  const activeScreenScene = screenScenes?.find((scene) => seconds >= scene.start && seconds <= scene.end);
  const activeAnimationCue = activeScreenScene
    ? undefined
    : animationCues?.find((cue) => seconds >= cue.start && seconds <= cue.end);
  const activeAnimationStyle =
    activeAnimationCue?.styleProfileId === "stop-motion-machine"
      ? STOP_MOTION_MACHINE_STYLE
      : activeAnimationCue?.styleProfileId === "research-archive"
        ? RESEARCH_ARCHIVE_STYLE
        : PAPER_EDITORIAL_STYLE;
  const activeImageCue =
    activeScreenScene || activeAnimationCue
      ? undefined
      : imageCues?.find((cue) => seconds >= cue.start && seconds <= cue.end);
  const activeCue =
    activeScreenScene || activeAnimationCue || activeImageCue
      ? undefined
      : overlayCues?.find((cue) => seconds >= cue.start && seconds <= cue.end);
  const activeAnnotationCue = annotationCues?.find((cue) => seconds >= cue.start && seconds <= cue.end);
  const activeTitleCue =
    activeScreenScene || activeAnimationCue || activeImageCue || activeCue
      ? undefined
      : titleCues?.find((cue) => seconds >= cue.start && seconds <= cue.end);
  const visibleCards = activeCue ? [activeCue] : cards;
  const visibleKeywords = activeCue?.keywords ?? keywords;
  const hasVisualBrief = Boolean(activeCue?.visualBrief || activeCue?.generatedVisual);
  const showFallback = !hasVisualBrief && !overlayCues?.length;
  const activeSubtitle = subtitleCues?.find((cue) => seconds >= cue.start && seconds <= cue.end);
  const subtitleText = activeSubtitle?.zh ?? activeCue?.subtitle ?? subtitle;
  const subtitleEnglish = activeSubtitle?.en ?? activeCue?.subtitleEn ?? subtitleEn;
  const subtitleTiming = activeSubtitle ?? activeCue;
  const subtitleDurationFrames = subtitleTiming ? (subtitleTiming.end - subtitleTiming.start) * fps : 0;
  const subtitleFadeFrames = Math.min(4, Math.max(0.1, subtitleDurationFrames / 3));
  const subtitleOpacity = subtitleTiming
    ? interpolate(
        frame,
        [
          subtitleTiming.start * fps,
          subtitleTiming.start * fps + subtitleFadeFrames,
          subtitleTiming.end * fps - subtitleFadeFrames,
          subtitleTiming.end * fps,
        ],
        [0, 1, 1, 0],
        {
          easing: Easing.out(Easing.cubic),
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        },
      )
    : interpolate(frame, [210, 225, 320, 340], [0, 1, 1, 0], {
        easing: Easing.out(Easing.cubic),
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
  const subtitleBlur = subtitleTiming
    ? interpolate(frame, [subtitleTiming.end * fps - subtitleFadeFrames, subtitleTiming.end * fps], [0, 8], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : interpolate(frame, [320, 340], [0, 8], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
  const activeLayoutTemplateId = activeCue?.layoutTemplateId ?? layoutTemplateId;
  const layoutTemplate = activeLayoutTemplateId ? getLayoutTemplate(activeLayoutTemplateId) : undefined;
  const effectiveOverlaySide =
    layoutTemplate?.overlaySide === "both" ? overlaySide : (layoutTemplate?.overlaySide ?? overlaySide);
  const layoutScrimSide = layoutTemplate?.scrimSide ?? effectiveOverlaySide;
  const scrimSide = resolveProductionScrimSide({
    hasComponentCue: Boolean(activeCue),
    layoutScrimSide,
  });
  const titleLeft = layoutTemplate?.titleZone.x ?? (effectiveOverlaySide === "left" ? 68 : 1050);
  const contentTranslateX = layoutTemplate
    ? layoutTemplate.contentZones[0].x - 68
    : effectiveOverlaySide === "left"
      ? 0
      : 1000;
  const requestedContentScale = activeCue?.contentScale ?? overlayScale;
  const activeContentScale = resolveProductionComponentScale({
    hasComponentCue: Boolean(activeCue),
    requestedScale: requestedContentScale,
  });
  const nativeCompactLayout =
    activeContentScale < 0.9 &&
    ["binary-versus", "ranked-metric-list", "model-classification-map", "tradeoff-scale"].includes(
      activeCue?.generatedVisual?.component.id ?? "",
    );

  return (
    <AbsoluteFill
      style={{
        background: videoSrc
          ? "linear-gradient(180deg, rgba(5,7,12,0.05), rgba(5,7,12,0.18))"
          : "radial-gradient(circle at top right, rgba(255,85,102,0.18), transparent 26%), linear-gradient(180deg, rgba(5,7,12,0.3), rgba(5,7,12,0.74))",
        fontFamily: typographyTokens.family,
      }}
    >
      {videoSrc ? (
        <AbsoluteFill>
          <SpeakerTimelineVideo src={videoSrc} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </AbsoluteFill>
      ) : null}

      <SoundEventLayer events={soundEvents} />

      {screenScenes?.map((scene) => {
        const startFrame = Math.round(scene.start * fps);
        const endFrame = Math.round(scene.end * fps);
        const transitionFrames = Math.max(4, Math.round(fps * 0.28));
        const visibility = Math.min(
          interpolate(frame, [startFrame, startFrame + transitionFrames], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          interpolate(frame, [endFrame - transitionFrames, endFrame], [1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        );
        const active = frame >= startFrame && frame <= endFrame;
        if (!active) return null;
        const size = scene.speakerPip.size ?? (scene.speakerPip.shape === "circle" ? 340 : 380);
        const isLeft = scene.speakerPip.preferredPosition.endsWith("left");
        const isTop = scene.speakerPip.preferredPosition.startsWith("top");
        const pipStyle: React.CSSProperties = {
          position: "absolute",
          zIndex: 5,
          width: size,
          height: scene.speakerPip.shape === "circle" ? size : Math.round(size * 0.78),
          left: isLeft ? 56 : undefined,
          right: isLeft ? undefined : 56,
          top: isTop ? 52 : undefined,
          bottom: isTop ? undefined : PIP_BOTTOM_SAFE_OFFSET,
          borderRadius: scene.speakerPip.shape === "circle" ? "50%" : 34,
          overflow: "hidden",
          border: "2px solid rgba(255,255,255,0.64)",
          boxShadow: "0 18px 46px rgba(0,0,0,0.48), 0 0 0 8px rgba(12,18,28,0.2)",
          opacity: visibility,
          transform: `scale(${interpolate(visibility, [0, 1], [0.9, 1])})`,
        };
        return (
          <React.Fragment key={scene.id}>
            <Sequence from={startFrame} durationInFrames={Math.max(1, endFrame - startFrame + 1)}>
              <AbsoluteFill
                style={{
                  zIndex: 3,
                  background: "#080b10",
                  opacity: visibility,
                  transform: `translateY(${interpolate(visibility, [0, 1], [12, 0])}px) scale(${interpolate(
                    visibility,
                    [0, 1],
                    [1.018, 1],
                  )})`,
                }}
              >
                <OffthreadVideo
                  src={staticFile(scene.videoSrc)}
                  startFrom={Math.round(scene.sourceStart * fps)}
                  playbackRate={scene.playbackRate ?? 1}
                  muted
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                />
              </AbsoluteFill>
            </Sequence>
            {videoSrc ? (
              <div style={pipStyle}>
                <SpeakerTimelineVideo
                  src={videoSrc}
                  muted
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    objectPosition: scene.speakerPip.objectPosition ?? "50% 35%",
                  }}
                />
              </div>
            ) : null}
          </React.Fragment>
        );
      })}

      {activeAnimationCue ? (
        <>
          <div
            data-animation-cue-id={activeAnimationCue.id}
            data-animation-prototype={activeAnimationCue.animationIntent.prototypeId}
            data-animation-style={activeAnimationCue.styleProfileId}
            data-animation-surface="opaque"
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 3,
              ...resolveAnimationProductionSurface(activeAnimationCue.styleProfileId),
            }}
          >
            {activeAnimationCue.styleProfileId === "stop-motion-machine" ? (
              <StopMotionMachineAnimation
                cue={activeAnimationCue}
                frame={Math.max(0, frame - Math.round(activeAnimationCue.start * fps))}
                fps={fps}
              />
            ) : activeAnimationCue.styleProfileId === "research-archive" ? (
              <ResearchArchiveAnimation
                cue={activeAnimationCue}
                frame={Math.max(0, frame - Math.round(activeAnimationCue.start * fps))}
                fps={fps}
              />
            ) : (
              <PaperEditorialAnimation
                cue={activeAnimationCue}
                frame={Math.max(0, frame - Math.round(activeAnimationCue.start * fps))}
                fps={fps}
              />
            )}
          </div>
          {videoSrc ? (
            <div
              data-speaker-presence="circle-pip"
              style={{
                position: "absolute",
                zIndex: 6,
                width: Math.round(width * activeAnimationStyle.speakerPip.diameterRatio),
                height: Math.round(width * activeAnimationStyle.speakerPip.diameterRatio),
                right: Math.round(width * activeAnimationStyle.speakerPip.edgeRatio),
                top: Math.round(width * activeAnimationStyle.speakerPip.edgeRatio),
                borderRadius: "50%",
                overflow: "hidden",
                border: "5px solid rgba(255,253,246,.96)",
                outline: "2px solid rgba(41,39,34,.72)",
                boxShadow: "0 10px 24px rgba(61,50,34,.24)",
                transform: "rotate(1deg)",
              }}
            >
              <SpeakerTimelineVideo
                src={videoSrc}
                muted
                style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 35%" }}
              />
            </div>
          ) : null}
        </>
      ) : null}

      {activeImageCue ? (
        <>
          <AbsoluteFill
            data-image-cue-id={activeImageCue.id}
            style={{
              zIndex: 3,
              background: "#191815",
              display: "grid",
              gridTemplateColumns:
                (activeImageCue.sources?.length ?? 1) === 1
                  ? "1fr"
                  : `repeat(${activeImageCue.sources?.length ?? 1}, minmax(0, 1fr))`,
              gap: (activeImageCue.sources?.length ?? 1) > 1 ? 18 : 0,
              padding: (activeImageCue.sources?.length ?? 1) > 1 ? "120px 80px" : 0,
            }}
          >
            {(activeImageCue.sources?.length ? activeImageCue.sources : [activeImageCue]).map((source) => (
              <div
                key={source.assetId}
                style={{
                  minWidth: 0,
                  overflow: "hidden",
                  borderRadius: activeImageCue.sources?.length ? 24 : 0,
                  background: "#0d0d0c",
                  boxShadow: activeImageCue.sources?.length ? "0 20px 50px rgba(0,0,0,.32)" : "none",
                }}
              >
                <Img src={staticFile(source.src)} style={{ width: "100%", height: "100%", objectFit: source.fit }} />
              </div>
            ))}
          </AbsoluteFill>
          {videoSrc && activeImageCue.speakerPresence === "circle-pip" ? (
            <div
              data-speaker-presence="circle-pip"
              style={{
                position: "absolute",
                zIndex: 6,
                width: Math.round(width * PAPER_EDITORIAL_STYLE.speakerPip.diameterRatio),
                height: Math.round(width * PAPER_EDITORIAL_STYLE.speakerPip.diameterRatio),
                right: Math.round(width * PAPER_EDITORIAL_STYLE.speakerPip.edgeRatio),
                top: Math.round(width * PAPER_EDITORIAL_STYLE.speakerPip.edgeRatio),
                borderRadius: "50%",
                overflow: "hidden",
                border: "5px solid rgba(255,253,246,.96)",
                boxShadow: "0 10px 24px rgba(0,0,0,.28)",
              }}
            >
              <SpeakerTimelineVideo
                src={videoSrc}
                muted
                style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "50% 35%" }}
              />
            </div>
          ) : null}
        </>
      ) : null}

      {!activeScreenScene && !activeAnimationCue && !activeImageCue ? (
        <AbsoluteFill style={{ ...getScrimRecipe(scrimSide).style }} />
      ) : null}

      {activeTitleCue ? (
        <div
          style={{
            position: "absolute",
            zIndex: 4,
            left: titleLeft,
            top: layoutTemplate?.titleZone.y ?? 58,
            opacity: Math.min(
              interpolate(seconds, [activeTitleCue.start, activeTitleCue.start + 0.45], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              interpolate(seconds, [activeTitleCue.end - 0.35, activeTitleCue.end], [1, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            ),
            transform: `translateY(${interpolate(
              seconds,
              [activeTitleCue.start, activeTitleCue.start + 0.45],
              [12, 0],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
            )}px)`,
          }}
        >
          <SectionTitle
            eyebrow={activeTitleCue.eyebrow}
            title={activeTitleCue.title}
            accent={activeTitleCue.accent}
            componentId="whole-video-title"
            textRole="display-title"
            maxWidth={layoutTemplate?.titleZone.width}
          />
        </div>
      ) : null}

      {activeCue?.generatedVisual && !activeScreenScene && !activeAnimationCue ? (
        <>
          <div style={{ position: "absolute", left: titleLeft, top: layoutTemplate?.titleZone.y ?? 58 }}>
            <SectionTitle
              eyebrow={activeCue.eyebrow}
              title={activeCue.title}
              accent={activeCue.accent}
              componentId={
                activeCue.generatedVisual.component.id === "core-positioning-node"
                  ? undefined
                  : activeCue.generatedVisual.component.id
              }
              maxWidth={layoutTemplate?.titleZone.width}
            />
          </div>
          <div
            style={{
              position: "absolute",
              inset: 0,
              opacity:
                activeCue.generatedVisual.component.id === "image-evidence-inset"
                  ? Math.min(
                      interpolate(seconds, [activeCue.start, activeCue.start + 0.28], [0, 1], {
                        extrapolateLeft: "clamp",
                        extrapolateRight: "clamp",
                      }),
                      interpolate(seconds, [activeCue.end - 0.28, activeCue.end], [1, 0], {
                        extrapolateLeft: "clamp",
                        extrapolateRight: "clamp",
                      }),
                    )
                  : 1,
              transform: `translateX(${contentTranslateX}px) scale(${
                activeCue.generatedVisual.component.id === "image-evidence-inset"
                  ? interpolate(Math.min(seconds - activeCue.start, activeCue.end - seconds), [0, 0.28], [0.985, 1], {
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp",
                    })
                  : 1
              })`,
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                zoom: nativeCompactLayout ? 1 : activeContentScale,
                color: "#F5F2EA",
                fontFamily: typographyTokens.family,
              }}
            >
              <GeneratedVisual
                brief={activeCue.generatedVisual}
                frame={Math.max(0, frame - Math.round(activeCue.start * fps))}
                fps={fps}
                compact={nativeCompactLayout}
              />
            </div>
          </div>
        </>
      ) : null}

      {activeAnnotationCue ? (
        <div
          data-text-annotation-id={activeAnnotationCue.id}
          style={{ position: "absolute", inset: 0, zIndex: 8, pointerEvents: "none" }}
        >
          <RoughAnnotation
            frame={Math.max(0, frame - Math.round(activeAnnotationCue.start * fps))}
            fps={fps}
            compact={Boolean(activeCue || activeScreenScene || activeImageCue || activeAnimationCue)}
            textColor={activeAnimationCue ? "#292722" : "#F5F2EA"}
            zone={
              activeCue
                ? {
                    left: Math.max(74, 74 + contentTranslateX),
                    top: 610,
                    width: 760,
                    minHeight: 112,
                  }
                : activeScreenScene || activeImageCue || activeAnimationCue
                  ? { left: 76, top: 650, width: 760, minHeight: 112 }
                  : { left: 74, top: 250, width: 780, minHeight: 390 }
            }
            items={[
              {
                id: activeAnnotationCue.id,
                text: activeAnnotationCue.exactSpokenQuote,
                effect: activeAnnotationCue.effect,
              },
            ]}
          />
        </div>
      ) : null}

      {!activeScreenScene && !activeAnimationCue && !activeImageCue ? (
        <div
          style={{
            position: "absolute",
            top: 64,
            left: 64,
            right: 64,
            bottom: 64,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          {showFallback ? (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                <div style={{ ...panelText, ...fadeUp(frame, fps), fontSize: 22, letterSpacing: 6, opacity: 0.78 }}>
                  {chapter}
                </div>
                <div
                  style={{ ...panelText, ...fadeUp(frame, fps, 3), fontSize: 62, fontWeight: 700, letterSpacing: 0 }}
                >
                  {headline}
                </div>
              </div>

              {speaker ? (
                <div style={{ ...fadeUp(frame, fps, 10) }}>
                  <LiquidGlass accent={`${colorTokens.blue}61`} padding="14px 18px" radius={22}>
                    <div style={{ ...panelText, fontSize: 28, fontWeight: 600 }}>{speaker}</div>
                  </LiquidGlass>
                </div>
              ) : null}
            </div>
          ) : null}

          {activeCue?.visualBrief ? (
            <div style={{ position: "absolute", left: -64, top: 78 }}>
              <VisualBriefPanel cue={activeCue} frame={frame} fps={fps} />
            </div>
          ) : null}

          {showFallback ? (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
              <div style={{ width: hasVisualBrief ? 660 : 520, display: "flex", flexDirection: "column", gap: 16 }}>
                {visibleCards.map((card, index) => {
                  return (
                    <div key={card.title} style={fadeUp(frame, fps, index * 8)}>
                      <LiquidGlass accent={`${resolveComponentAccent(card.accent)}61`} padding="16px 20px" radius={24}>
                        <div style={{ ...panelText, fontSize: 17, letterSpacing: 3, opacity: 0.72 }}>
                          {card.eyebrow}
                        </div>
                        <div style={{ ...panelText, fontSize: 38, fontWeight: 700, marginTop: 8 }}>{card.title}</div>
                        {card.subtitle ? (
                          <div style={{ ...panelText, fontSize: 21, marginTop: 8, opacity: 0.82 }}>{card.subtitle}</div>
                        ) : null}
                      </LiquidGlass>
                    </div>
                  );
                })}

                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: hasVisualBrief ? 0 : 10 }}>
                  {visibleKeywords.map((word, index) => (
                    <div key={word} style={fadeUp(frame, fps, 24 + index * 4)}>
                      <LiquidGlass accent={`${colorTokens.neutral}38`} padding="10px 16px" radius={20}>
                        <div style={{ ...panelText, fontSize: 22, fontWeight: 600 }}>{word}</div>
                      </LiquidGlass>
                    </div>
                  ))}
                </div>
              </div>

              {timelineLabel ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 18 }}>
                  <div
                    style={{ ...panelText, ...fadeUp(frame, fps, 18), fontSize: 20, letterSpacing: 5, opacity: 0.76 }}
                  >
                    {timelineLabel}
                  </div>
                  <div
                    style={{
                      width: 420,
                      height: 4,
                      borderRadius: 999,
                      background: "rgba(255,255,255,0.14)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${interpolate(frame, [20, 120], [0, 100], {
                          extrapolateLeft: "clamp",
                          extrapolateRight: "clamp",
                        })}%`,
                        height: "100%",
                        background: "linear-gradient(90deg, #5f8dff, #7cf7ff)",
                      }}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <div
        style={{
          position: "absolute",
          zIndex: 10,
          left: 320,
          right: 320,
          bottom: 38,
          opacity: subtitleOpacity,
          filter: `blur(${subtitleBlur}px)`,
          color: "white",
          textAlign: "center",
          textShadow: "0 3px 12px rgba(0,0,0,0.98), 0 1px 3px rgba(0,0,0,1)",
        }}
      >
        <div style={{ ...panelText, fontSize: 38, fontWeight: 750, lineHeight: 1.12 }}>{subtitleText}</div>
        {subtitleEnglish ? (
          <div style={{ ...panelText, fontSize: 23, fontWeight: 600, marginTop: 7, opacity: 0.94 }}>
            {subtitleEnglish}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

export const TalkingHeadOverlay: React.FC<OverlayProps> = (props) => (
  <TypographyPolicyProvider mode={props.typography?.mode ?? "system-only"}>
    <TalkingHeadOverlayContent {...props} />
  </TypographyPolicyProvider>
);
