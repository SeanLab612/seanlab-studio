import type { RecutProviderCandidate } from "../workflow/recut.ts";
import { packTranscriptForRecut, speechWordsFromTranscript } from "../workflow/recut.ts";

export type RecutProviderPlan = {
  schemaVersion: "1.0";
  candidates: RecutProviderCandidate[];
};

export const createRecutPlanningPrompt = (
  transcript: { words?: Array<{ text: string; start: number; end: number; type?: string }> },
  { reviewFeedback = "" }: { reviewFeedback?: string } = {},
) => {
  const packed = packTranscriptForRecut(transcript);
  return {
    system: [
      "You are a conservative talking-head dialogue editor.",
      "Identify only spoken material that is clearly a filler utterance, an abandoned false start, or the earlier duplicate of a clean retake.",
      "Do not rewrite speech, remove valid claims, shorten for style, or propose silence compression.",
      "Prefer no candidate when meaning or delivery intent is ambiguous.",
      "Every boundary must use the supplied speech-word indexes and should be surrounded by a visible pause in the timestamps.",
      "For a duplicate retake, remove only the inferior/abandoned attempt and preserve the complete clean take.",
      "Return JSON matching the schema exactly.",
    ].join(" "),
    user: [
      `Speech words: ${packed.words.length}.`,
      "Kinds: filler | false-start | duplicate-retake.",
      "Confidence must express editorial certainty, not transcription confidence.",
      ...(reviewFeedback.trim()
        ? [
            "The creator rejected the previous proposal and supplied this review feedback. Apply it only when it remains conservative and supported by the transcript:",
            reviewFeedback.trim(),
          ]
        : []),
      "Packed word-level transcript:",
      packed.markdown,
    ].join("\n"),
  };
};

export const parseRecutProviderPlan = (
  input: unknown,
  transcript: { words?: Array<{ text: string; start: number; end: number; type?: string }> },
): RecutProviderPlan => {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("recut plan must be an object");
  const plan = input as Partial<RecutProviderPlan>;
  if (plan.schemaVersion !== "1.0" || !Array.isArray(plan.candidates))
    throw new Error("recut plan must use schemaVersion 1.0 and a candidates array");
  const wordCount = speechWordsFromTranscript(transcript).length;
  const candidates = plan.candidates.map((candidate, index) => {
    if (!candidate || typeof candidate !== "object") throw new Error(`recut candidate ${index} must be an object`);
    if (!new Set(["filler", "false-start", "duplicate-retake"]).has(candidate.kind))
      throw new Error(`recut candidate ${index} kind is invalid`);
    if (
      !Number.isInteger(candidate.startWord) ||
      !Number.isInteger(candidate.endWord) ||
      candidate.startWord < 0 ||
      candidate.endWord < candidate.startWord ||
      candidate.endWord >= wordCount
    )
      throw new Error(`recut candidate ${index} word range is invalid`);
    if (!(candidate.confidence >= 0 && candidate.confidence <= 1))
      throw new Error(`recut candidate ${index} confidence is invalid`);
    if (typeof candidate.reason !== "string" || !candidate.reason.trim() || candidate.reason.length > 300)
      throw new Error(`recut candidate ${index} reason is invalid`);
    return { ...candidate, reason: candidate.reason.trim() };
  });
  if (candidates.length > 48) throw new Error("recut provider returned too many candidates");
  return { schemaVersion: "1.0", candidates };
};
