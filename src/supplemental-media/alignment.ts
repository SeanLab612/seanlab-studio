import type { AuthoredScenePlan, ResolvedSceneTimeline, SupplementalMediaProbe, TextAnchor } from "./types";

type Caption = { start: number; end: number; zh: string };

const normalize = (value: string) =>
  value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]/gu, "");

const bigrams = (value: string) => {
  const output = new Map<string, number>();
  for (let index = 0; index < Math.max(1, value.length - 1); index += 1) {
    const token = value.slice(index, index + 2);
    output.set(token, (output.get(token) ?? 0) + 1);
  }
  return output;
};

const similarity = (left: string, right: string) => {
  if (!left || !right) return 0;
  if (left.includes(right) || right.includes(left))
    return Math.min(left.length, right.length) / Math.max(left.length, right.length);
  const a = bigrams(left);
  const b = bigrams(right);
  let overlap = 0;
  for (const [token, count] of a) overlap += Math.min(count, b.get(token) ?? 0);
  const total =
    [...a.values()].reduce((sum, count) => sum + count, 0) + [...b.values()].reduce((sum, count) => sum + count, 0);
  return total ? (2 * overlap) / total : 0;
};

const matchAnchor = (anchor: TextAnchor, captions: Caption[], minimumCue = 0) => {
  const needle = normalize(anchor.text);
  const matches: Array<{ startCue: number; endCue: number; score: number }> = [];
  for (let startCue = minimumCue; startCue < captions.length; startCue += 1) {
    let combined = "";
    for (let endCue = startCue; endCue < Math.min(captions.length, startCue + 5); endCue += 1) {
      combined += normalize(captions[endCue].zh);
      matches.push({ startCue, endCue, score: similarity(needle, combined) });
      if (combined.length > needle.length * 2.2 + 12) break;
    }
  }
  matches.sort((a, b) => b.score - a.score || a.startCue - b.startCue);
  const occurrence = Math.max(1, anchor.occurrence ?? 1);
  return matches.filter((item) => item.score >= 0.56)[occurrence - 1];
};

const centeredPipObjectPosition = (faceCenterX: number | undefined, shape: "circle" | "rounded-rectangle") => {
  if (!Number.isFinite(faceCenterX)) return "50% 35%";
  const sourceAspect = 16 / 9;
  const targetAspect = shape === "circle" ? 1 : 1 / 0.78;
  const renderedWidthRatio = sourceAspect / targetAspect;
  if (renderedWidthRatio <= 1) return `${Math.round((faceCenterX ?? 0.5) * 100)}% 35%`;
  const position = ((faceCenterX ?? 0.5) * renderedWidthRatio - 0.5) / (renderedWidthRatio - 1);
  return `${Math.round(Math.min(1, Math.max(0, position)) * 100)}% 35%`;
};

export const resolveAuthoredScenes = ({
  plan,
  captions,
  assets,
  speakerFaceCenterX,
}: {
  plan: AuthoredScenePlan;
  captions: Caption[];
  assets: SupplementalMediaProbe[];
  speakerFaceCenterX?: number;
}): ResolvedSceneTimeline => {
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  const scenes: ResolvedSceneTimeline["scenes"] = [];
  const unresolved: ResolvedSceneTimeline["unresolved"] = [];
  let previousEndCue = -1;

  for (const scene of plan.scenes) {
    const asset = assetById.get(scene.assetId);
    if (!asset) {
      unresolved.push({ sceneId: scene.id, required: scene.required, reason: `Unknown assetId: ${scene.assetId}` });
      continue;
    }
    const start = matchAnchor(scene.startAnchor, captions, previousEndCue + 1);
    const end = start ? matchAnchor(scene.endAnchor, captions, start.startCue) : undefined;
    if (!start || !end || end.endCue < start.startCue) {
      unresolved.push({
        sceneId: scene.id,
        required: scene.required,
        reason: "Spoken-text anchors did not match in order",
      });
      continue;
    }
    const timelineStart = captions[start.startCue].start;
    const timelineEnd = captions[end.endCue].end;
    const available = asset.clip.out - asset.clip.in;
    const narrationDuration = timelineEnd - timelineStart;
    const playbackRate = narrationDuration > available ? available / narrationDuration : 1;
    if (playbackRate < 0.8) {
      unresolved.push({
        sceneId: scene.id,
        required: scene.required,
        reason: `Resolved narration (${narrationDuration.toFixed(2)}s) would require playback rate ${playbackRate.toFixed(3)}, below the 0.8 safety limit`,
      });
      continue;
    }
    scenes.push({
      id: scene.id,
      type: scene.type,
      assetId: scene.assetId,
      videoSrc: asset.publicSrc,
      start: timelineStart,
      end: timelineEnd,
      sourceStart: asset.clip.in,
      sourceEnd: Math.min(asset.clip.out, asset.clip.in + narrationDuration),
      playbackRate,
      sourceFps: asset.fps,
      width: asset.width,
      height: asset.height,
      required: scene.required,
      confidence: Math.min(start.score, end.score),
      startCue: start.startCue,
      endCue: end.endCue,
      speakerPip: {
        ...scene.speakerPip,
        objectPosition:
          scene.speakerPip.objectPosition ?? centeredPipObjectPosition(speakerFaceCenterX, scene.speakerPip.shape),
      },
    });
    previousEndCue = end.endCue;
  }

  const requiredUnresolved = unresolved.filter((item) => item.required).length;
  return {
    schemaVersion: "1.0",
    status: requiredUnresolved ? "blocked" : scenes.length ? "resolved" : "empty",
    scenes,
    unresolved,
    summary: { authored: plan.scenes.length, resolved: scenes.length, requiredUnresolved },
  };
};

export const suppressCandidatesForAuthoredScenes = <
  T extends { start: number; end: number; materializationStatus: string; materializationReason?: string },
>(
  candidates: T[],
  scenes: Array<{ id: string; start: number; end: number }>,
) =>
  candidates.map((candidate) => {
    const scene = scenes.find((item) => candidate.start < item.end && candidate.end > item.start);
    return scene
      ? {
          ...candidate,
          materializationStatus: "skipped" as const,
          materializationReason: `Suppressed by authored recording scene ${scene.id}.`,
        }
      : candidate;
  });
