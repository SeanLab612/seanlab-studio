import type { SemanticNarrativePlan, VideoIdentity } from "./types.ts";

type CaptionLike = { zh?: string };

const ignored = new Set(["html", "css", "javascript", "github", "video", "ai"]);

export const deriveVideoIdentity = (plan: SemanticNarrativePlan, captions: CaptionLike[]): VideoIdentity => {
  if (plan.videoIdentity) return plan.videoIdentity;
  const text = captions.map((caption) => caption.zh ?? "").join(" ");
  const tokens = text.match(/[A-Za-z][A-Za-z0-9]*(?:-[A-Za-z0-9]+)+/g) ?? [];
  const counts = new Map<string, number>();
  for (const token of tokens) counts.set(token.toLowerCase(), (counts.get(token.toLowerCase()) ?? 0) + 1);
  const subject = [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0];
  if (subject)
    return {
      eyebrow: "PROJECT OVERVIEW",
      title: `${subject} 项目介绍`,
      subject,
      startCue: 0,
      endCue: Math.max(0, captions.length - 1),
      confidence: 0.78,
    };
  const wordCandidates = text.match(/[A-Za-z][A-Za-z0-9]{2,}/g) ?? [];
  const named = wordCandidates.find((word) => !ignored.has(word.toLowerCase()));
  const fallbackTitle = plan.segments.find((segment) => segment.visualPriority === "high")?.narrative.title;
  return {
    eyebrow: named ? "TOPIC OVERVIEW" : "VIDEO OVERVIEW",
    title: named ? `${named} 内容介绍` : fallbackTitle || "本期内容概览",
    subject: named ?? fallbackTitle ?? "本期内容",
    startCue: 0,
    endCue: Math.max(0, captions.length - 1),
    confidence: named ? 0.66 : 0.58,
  };
};
