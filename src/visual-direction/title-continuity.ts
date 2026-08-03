import type { VideoIdentity } from "../semantic-planning/types.ts";
import type { ResolvedScreenScene } from "../supplemental-media/types.ts";
import {
  TITLE_CONTINUITY_REPETITION_WINDOW_SECONDS,
  type VisualDirectionDecision,
  type WholeVideoTitleCue,
} from "./types.ts";

const overlaps = (start: number, end: number, otherStart: number, otherEnd: number) =>
  start < otherEnd && end > otherStart;

const mergeSpeakerOnlyGaps = (decisions: VisualDirectionDecision[]) => {
  const gaps: Array<{ start: number; end: number; candidateIds: string[] }> = [];
  for (const decision of [...decisions].sort((a, b) => a.sourceStart - b.sourceStart)) {
    const previous = gaps.at(-1);
    if (previous && decision.sourceStart - previous.end <= 1.25) {
      previous.end = Math.max(previous.end, decision.sourceEnd);
      previous.candidateIds.push(decision.candidateId);
    } else {
      gaps.push({
        start: decision.sourceStart,
        end: decision.sourceEnd,
        candidateIds: [decision.candidateId],
      });
    }
  }
  return gaps;
};

export const planWholeVideoTitleCues = ({
  identity,
  decisions,
  screenScenes,
  durationSeconds,
}: {
  identity: VideoIdentity;
  decisions: VisualDirectionDecision[];
  screenScenes: ResolvedScreenScene[];
  durationSeconds: number;
}): WholeVideoTitleCue[] => {
  const titleCues: WholeVideoTitleCue[] = [];
  const eligible = decisions.filter(
    (decision) =>
      decision.action === "skip" &&
      !screenScenes.some((scene) => overlaps(decision.sourceStart, decision.sourceEnd, scene.start, scene.end)),
  );
  for (const gap of mergeSpeakerOnlyGaps(eligible)) {
    if (gap.end - gap.start < 6) continue;
    const start = Math.max(gap.start + 1.1, 5.5);
    const end = Math.min(gap.end - 0.7, start + 7.5, durationSeconds - 4);
    if (end - start < 4.8) continue;
    const previousTitle = titleCues.at(-1);
    if (previousTitle && start - previousTitle.end < TITLE_CONTINUITY_REPETITION_WINDOW_SECONDS) continue;
    titleCues.push({
      id: `title-continuity-${titleCues.length + 1}`,
      start: Number(start.toFixed(3)),
      end: Number(end.toFixed(3)),
      eyebrow: identity.eyebrow,
      title: identity.title,
      accent: "#59D98E",
      sourceStartCue: identity.startCue,
      sourceEndCue: identity.endCue,
      confidence: identity.confidence,
      placementReason: `Eligible continuous speaker-only gap from ${gap.candidateIds.join(", ")}; whole-video identity reused without new claims.`,
    });
  }
  return titleCues;
};
