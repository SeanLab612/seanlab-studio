import { createHash } from "node:crypto";

export type RawTranscriptWord = {
  text: string;
  start: number;
  end: number;
  type?: string;
};

export type SpeechWord = RawTranscriptWord & {
  speechIndex: number;
  sourceIndex: number;
  normalized: string;
};

export type RecutProviderCandidate = {
  kind: "filler" | "false-start" | "duplicate-retake";
  startWord: number;
  endWord: number;
  confidence: number;
  reason: string;
};

export type RecutPolicy = {
  minimumCompressedGapSeconds: number;
  keptGapSeconds: number;
  manualRemovals?: Array<{ start: number; end: number; reason: string }>;
  minimumCandidateConfidence?: number;
  minimumBoundarySilenceSeconds?: number;
  maximumCandidateSeconds?: number;
  rejectedCandidateIds?: string[];
  protectedAnchors?: Array<{
    id: string;
    text: string;
    occurrence?: number;
    paddingBeforeSeconds?: number;
    paddingAfterSeconds?: number;
  }>;
};

type ProtectedRange = {
  id: string;
  start: number;
  end: number;
  reason: string;
  matchedText: string;
  source: "spoken-anchor" | "audio-event";
};

const punctuationOnly = /^[\s\p{P}\p{S}]+$/u;

export const normalizeSpeech = (value: string) =>
  value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]/gu, "");

export const speechWordsFromTranscript = (transcript: { words?: RawTranscriptWord[] }) => {
  const words: SpeechWord[] = [];
  for (const [sourceIndex, word] of (transcript.words ?? []).entries()) {
    if (word.type && word.type !== "word") continue;
    if (!Number.isFinite(word.start) || !Number.isFinite(word.end) || word.end < word.start) continue;
    const normalized = normalizeSpeech(word.text ?? "");
    if (!normalized || punctuationOnly.test(word.text ?? "")) continue;
    words.push({ ...word, sourceIndex, speechIndex: words.length, normalized });
  }
  return words;
};

export const packTranscriptForRecut = (transcript: { words?: RawTranscriptWord[] }) => {
  const words = speechWordsFromTranscript(transcript);
  const phrases: Array<{ startWord: number; endWord: number; start: number; end: number; text: string }> = [];
  let start = 0;
  const flush = (end: number) => {
    if (end < start) return;
    const selected = words.slice(start, end + 1);
    const final = selected.at(-1);
    if (!selected[0] || !final) return;
    phrases.push({
      startWord: selected[0].speechIndex,
      endWord: final.speechIndex,
      start: selected[0].start,
      end: final.end,
      text: selected.map((word) => word.text).join(""),
    });
    start = end + 1;
  };
  for (let index = 0; index < words.length; index += 1) {
    const current = words[index];
    const next = words[index + 1];
    if (!next || next.start - current.end >= 0.5 || /[.!?。！？]$/u.test(current.text)) flush(index);
  }
  return {
    words,
    phrases,
    markdown: phrases
      .map(
        (phrase) =>
          `[w${phrase.startWord}-w${phrase.endWord} ${phrase.start.toFixed(2)}-${phrase.end.toFixed(2)}] ${phrase.text}`,
      )
      .join("\n"),
  };
};

const anchorRange = (
  words: SpeechWord[],
  anchor: { text: string; occurrence?: number },
): { startWord: number; endWord: number } | undefined => {
  const needle = normalizeSpeech(anchor.text);
  if (!needle) return undefined;
  const haystack = words.map((word) => word.normalized).join("");
  let from = 0;
  let position = -1;
  for (let count = 0; count < Math.max(1, anchor.occurrence ?? 1); count += 1) {
    position = haystack.indexOf(needle, from);
    if (position < 0) return undefined;
    from = position + 1;
  }
  let cursor = 0;
  let startWord = 0;
  let endWord = words.length - 1;
  for (const word of words) {
    const next = cursor + word.normalized.length;
    if (position >= cursor && position < next) startWord = word.speechIndex;
    if (position + needle.length > cursor && position + needle.length <= next) {
      endWord = word.speechIndex;
      break;
    }
    cursor = next;
  }
  return { startWord, endWord };
};

export const resolveProtectedRecutRanges = ({
  words,
  policy,
  authoredScenePlan,
}: {
  words: SpeechWord[];
  policy: RecutPolicy;
  authoredScenePlan?: {
    scenes?: Array<{
      id: string;
      startAnchor: { text: string; occurrence?: number };
      endAnchor: { text: string; occurrence?: number };
    }>;
  };
}) => {
  const definitions = [
    ...(policy.protectedAnchors ?? []).map((anchor) => ({
      id: anchor.id,
      anchor,
      before: anchor.paddingBeforeSeconds ?? 0.2,
      after: anchor.paddingAfterSeconds ?? 0.35,
      reason: `Protected edit anchor ${anchor.id}`,
    })),
    ...((authoredScenePlan?.scenes ?? []).flatMap((scene) => [
      {
        id: `scene-${scene.id}-start`,
        anchor: scene.startAnchor,
        before: 0.2,
        after: 0.2,
        reason: `Authored scene ${scene.id} start anchor`,
      },
      {
        id: `scene-${scene.id}-end`,
        anchor: scene.endAnchor,
        before: 0.2,
        after: 0.2,
        reason: `Authored scene ${scene.id} end anchor`,
      },
    ]) ?? []),
  ];
  const ranges: ProtectedRange[] = [];
  const unresolved: Array<{ id: string; reason: string }> = [];
  for (const definition of definitions) {
    const matched = anchorRange(words, definition.anchor);
    if (!matched) {
      unresolved.push({ id: definition.id, reason: "Spoken-text anchor was not found in the raw transcript" });
      continue;
    }
    const selected = words.slice(matched.startWord, matched.endWord + 1);
    const final = selected.at(-1);
    if (!selected[0] || !final) {
      unresolved.push({ id: definition.id, reason: "Spoken-text anchor resolved to an empty word range" });
      continue;
    }
    ranges.push({
      id: definition.id,
      start: Math.max(0, selected[0].start - definition.before),
      end: final.end + definition.after,
      reason: definition.reason,
      matchedText: selected.map((word) => word.text).join(""),
      source: "spoken-anchor",
    });
  }
  return { ranges, unresolved };
};

const overlaps = (left: { start: number; end: number }, right: { start: number; end: number }) =>
  left.start < right.end && left.end > right.start;

const stableCandidateId = (kind: string, startWord: number, endWord: number, quote: string) =>
  `${kind}-${createHash("sha256")
    .update(`${kind}:${startWord}:${endWord}:${normalizeSpeech(quote)}`)
    .digest("hex")
    .slice(0, 12)}`;

export const materializeRecutPlan = ({
  transcript,
  providerPlan,
  policy,
  authoredScenePlan,
}: {
  transcript: { words?: RawTranscriptWord[] };
  providerPlan?: { candidates?: RecutProviderCandidate[] };
  policy: RecutPolicy;
  authoredScenePlan?: Parameters<typeof resolveProtectedRecutRanges>[0]["authoredScenePlan"];
}) => {
  const words = speechWordsFromTranscript(transcript);
  if (!words.length) throw new Error("recut requires at least one valid word-level transcript token");
  const confidenceFloor = policy.minimumCandidateConfidence ?? 0.84;
  const boundaryFloor = policy.minimumBoundarySilenceSeconds ?? 0.12;
  const maximumCandidateSeconds = policy.maximumCandidateSeconds ?? 12;
  const rejected = new Set(policy.rejectedCandidateIds ?? []);
  const protection = resolveProtectedRecutRanges({ words, policy, authoredScenePlan });
  for (const [sourceIndex, event] of (transcript.words ?? []).entries()) {
    if (!event.type || ["word", "spacing"].includes(event.type)) continue;
    if (!Number.isFinite(event.start) || !Number.isFinite(event.end)) continue;
    protection.ranges.push({
      id: `audio-event-${sourceIndex}`,
      start: Math.max(0, event.start - 0.2),
      end: event.end + 0.2,
      reason: `Preserve transcript audio event ${event.type}`,
      matchedText: event.text,
      source: "audio-event",
    });
  }
  const candidates: Array<Record<string, unknown> & { start: number; end: number; disposition: string }> = [];

  for (let index = 1; index < words.length; index += 1) {
    const previous = words[index - 1];
    const current = words[index];
    const gap = current.start - previous.end;
    if (gap < policy.minimumCompressedGapSeconds) continue;
    const half = Math.min(gap / 2, policy.keptGapSeconds / 2);
    const removal = { start: previous.end + half, end: current.start - half };
    const id = stableCandidateId(
      "long-pause",
      previous.speechIndex,
      current.speechIndex,
      `${previous.text}${current.text}`,
    );
    const protectedBy = protection.ranges.find((range) => overlaps(removal, range));
    const disposition = protectedBy ? "protected" : rejected.has(id) ? "rejected" : "recommended";
    candidates.push({
      id,
      kind: "long-pause",
      startWord: previous.speechIndex,
      endWord: current.speechIndex,
      start: removal.start,
      end: removal.end,
      sourceDurationSeconds: gap,
      removedDurationSeconds: Math.max(0, removal.end - removal.start),
      confidence: 1,
      reason: `Compress ${gap.toFixed(2)} second silence to ${policy.keptGapSeconds.toFixed(2)} seconds`,
      quote: `${previous.text} … ${current.text}`,
      disposition,
      protectedBy: protectedBy?.id,
      boundary: { beforeSeconds: gap, afterSeconds: gap, safe: true },
    });
  }

  const providerCandidates = providerPlan?.candidates ?? [];
  for (const [proposalIndex, proposal] of providerCandidates.entries()) {
    if (!Number.isInteger(proposal.startWord) || !Number.isInteger(proposal.endWord))
      throw new Error(`recut provider candidate ${proposalIndex} must use integer word indexes`);
    if (proposal.startWord < 0 || proposal.endWord < proposal.startWord || proposal.endWord >= words.length)
      throw new Error(`recut provider candidate ${proposalIndex} uses an invalid word range`);
    if (!new Set(["filler", "false-start", "duplicate-retake"]).has(proposal.kind))
      throw new Error(`recut provider candidate ${proposalIndex} uses an unsupported kind`);
    if (!(proposal.confidence >= 0 && proposal.confidence <= 1))
      throw new Error(`recut provider candidate ${proposalIndex} has invalid confidence`);
    const selected = words.slice(proposal.startWord, proposal.endWord + 1);
    const first = selected[0];
    const last = selected.at(-1);
    if (!first || !last) throw new Error(`recut provider candidate ${proposalIndex} resolved to no words`);
    const previous = words[proposal.startWord - 1];
    const next = words[proposal.endWord + 1];
    const beforeGap = previous ? Math.max(0, first.start - previous.end) : Number.POSITIVE_INFINITY;
    const afterGap = next ? Math.max(0, next.start - last.end) : Number.POSITIVE_INFINITY;
    const edgePadding = 0.03;
    const start = previous ? previous.end + Math.min(0.08, beforeGap / 2) : Math.max(0, first.start - 0.08);
    const end = next ? next.start - Math.min(0.08, afterGap / 2) : last.end + 0.08;
    const quote = selected.map((word) => word.text).join("");
    const id = stableCandidateId(proposal.kind, proposal.startWord, proposal.endWord, quote);
    const duration = end - start;
    const safeBoundary =
      (!previous || beforeGap >= Math.max(boundaryFloor, edgePadding * 2)) &&
      (!next || afterGap >= Math.max(boundaryFloor, edgePadding * 2));
    const protectedBy = protection.ranges.find((range) => overlaps({ start, end }, range));
    let disposition = "recommended";
    if (rejected.has(id)) disposition = "rejected";
    else if (protectedBy) disposition = "protected";
    else if (duration > maximumCandidateSeconds) disposition = "too-long";
    else if (!safeBoundary) disposition = "unsafe-boundary";
    else if (proposal.confidence < confidenceFloor) disposition = "low-confidence";
    candidates.push({
      id,
      kind: proposal.kind,
      startWord: proposal.startWord,
      endWord: proposal.endWord,
      start,
      end,
      sourceDurationSeconds: last.end - first.start,
      removedDurationSeconds: Math.max(0, duration),
      confidence: proposal.confidence,
      reason: proposal.reason,
      quote,
      disposition,
      protectedBy: protectedBy?.id,
      boundary: {
        beforeSeconds: Number.isFinite(beforeGap) ? beforeGap : null,
        afterSeconds: Number.isFinite(afterGap) ? afterGap : null,
        safe: safeBoundary,
      },
    });
  }

  candidates.sort((left, right) => left.start - right.start || left.end - right.end);
  const accepted: Array<{ start: number; end: number; reason: string; candidateIds: string[]; source: string }> = [];
  for (const candidate of candidates) {
    if (candidate.disposition !== "recommended") continue;
    if (accepted.some((removal) => overlaps(removal, candidate))) {
      candidate.disposition = "overlap-suppressed";
      continue;
    }
    accepted.push({
      start: candidate.start,
      end: candidate.end,
      reason: String(candidate.reason),
      candidateIds: [String(candidate.id)],
      source: "recut-candidate",
    });
  }

  for (const [index, removal] of (policy.manualRemovals ?? []).entries()) {
    if (!(Number.isFinite(removal.start) && removal.start >= 0 && removal.end > removal.start))
      throw new Error(`manual removal ${index} is invalid`);
    const protectedBy = protection.ranges.find((range) => range.source === "spoken-anchor" && overlaps(removal, range));
    if (protectedBy)
      throw new Error(`manual removal ${index} overlaps protected range ${protectedBy.id}; update the anchor first`);
    accepted.push({ ...removal, candidateIds: [], source: "manual" });
  }

  accepted.sort((left, right) => left.start - right.start || left.end - right.end);
  const removals: typeof accepted = [];
  for (const removal of accepted) {
    const previous = removals.at(-1);
    if (previous && removal.start <= previous.end) {
      previous.end = Math.max(previous.end, removal.end);
      previous.candidateIds.push(...removal.candidateIds);
      previous.reason = `${previous.reason}; ${removal.reason}`;
      previous.source = previous.source === removal.source ? previous.source : "mixed";
    } else removals.push(structuredClone(removal));
  }

  const first = words[0].start;
  const finalWord = words.at(-1);
  if (!finalWord) throw new Error("recut requires a final transcript word");
  const last = finalWord.end;
  const ranges: Array<{
    source: "main";
    start: number;
    end: number;
    outputStart: number;
    outputEnd: number;
    beat: "KEEP";
    reason: string;
  }> = [];
  let cursor = Math.max(0, first - 0.05);
  let offset = 0;
  for (const removal of removals) {
    if (removal.start > cursor + 0.01) {
      const duration = removal.start - cursor;
      ranges.push({
        source: "main",
        start: cursor,
        end: removal.start,
        outputStart: offset,
        outputEnd: offset + duration,
        beat: "KEEP",
        reason: "Keep reviewed speech",
      });
      offset += duration;
    }
    cursor = Math.max(cursor, removal.end);
  }
  if (cursor < last + 0.08) {
    const duration = last + 0.08 - cursor;
    ranges.push({
      source: "main",
      start: cursor,
      end: last + 0.08,
      outputStart: offset,
      outputEnd: offset + duration,
      beat: "KEEP",
      reason: "Keep reviewed speech",
    });
    offset += duration;
  }
  const originalDuration = last + 0.08 - Math.max(0, first - 0.05);
  return {
    candidates,
    protectedRanges: protection.ranges,
    unresolvedProtectedAnchors: protection.unresolved,
    removals,
    ranges,
    summary: {
      speechWords: words.length,
      candidateCount: candidates.length,
      recommendedCount: candidates.filter((candidate) => candidate.disposition === "recommended").length,
      blockedCount: candidates.filter((candidate) => candidate.disposition !== "recommended").length,
      removalCount: removals.length,
      originalDurationSeconds: originalDuration,
      proposedDurationSeconds: offset,
      proposedSavingsSeconds: Math.max(0, originalDuration - offset),
    },
  };
};
