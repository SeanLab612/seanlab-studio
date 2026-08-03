import {
  correctionPairs,
  correctTerminology,
  defaultTerminologyProfile,
  type ResolvedTerminologyProfile,
} from "../terminology/index.ts";

export type TranscriptWord = { text: string; start: number; end: number; type: string };
export type EditRange = { start: number; end: number; outputStart: number };
export type TimelineInsertion = { at: number; duration: number };
export type VerbatimCaption = { start: number; end: number; zh: string; en?: string; role: "caption" };
export type CaptionSegmentationPolicy = {
  maximumDurationSeconds: number;
  maximumCharacters: number;
  pauseBreakSeconds: number;
  softPunctuationMinimumCharacters: number;
  orphanMaximumCharacters: number;
  displayPunctuation?: "source" | "none";
};

export const defaultCaptionSegmentationPolicy: CaptionSegmentationPolicy = {
  maximumDurationSeconds: 4.5,
  maximumCharacters: 22,
  pauseBreakSeconds: 0.35,
  softPunctuationMinimumCharacters: 10,
  orphanMaximumCharacters: 3,
  displayPunctuation: "none",
};
export { correctTerminology } from "../terminology/index.ts";

const sentencePunctuation = new Set(["，", "。", "！", "？", "；", "：", "、", ",", ".", "!", "?", ";", ":"]);
const digit = /\d/;

export const stripDisplayPunctuation = (text: string) =>
  [...text]
    .filter((character, index, characters) => {
      if (!sentencePunctuation.has(character)) return true;
      if (![".", ",", ":"].includes(character)) return false;
      if (character === ".")
        return /[A-Za-z0-9]/u.test(characters[index - 1] ?? "") && /[A-Za-z0-9]/u.test(characters[index + 1] ?? "");
      return digit.test(characters[index - 1] ?? "") && digit.test(characters[index + 1] ?? "");
    })
    .join("");

export const mapKeptWords = (words: TranscriptWord[], ranges: EditRange[], insertions: TimelineInsertion[] = []) =>
  ranges.flatMap((range) =>
    words
      .filter((word) => word.type === "word" && word.start >= range.start && word.end <= range.end)
      .map((word) => {
        const start = word.start - range.start + range.outputStart;
        const end = word.end - range.start + range.outputStart;
        const insertionShift = insertions
          .filter((insertion) => start >= insertion.at && end > insertion.at)
          .reduce((sum, insertion) => sum + insertion.duration, 0);
        return {
          ...word,
          start: start + insertionShift,
          end: end + insertionShift,
        };
      }),
  );

const correctWordSequence = <T extends TranscriptWord>(
  words: T[],
  profile: ResolvedTerminologyProfile = defaultTerminologyProfile,
): T[] => {
  const result = words.map((word) => ({ ...word }));
  for (const [pattern, replacement] of correctionPairs(profile)) {
    let searchFrom = 0;
    while (searchFrom < result.reduce((sum, word) => sum + word.text.length, 0)) {
      const sourceTexts = result.map((word) => word.text);
      const joined = sourceTexts.join("");
      const match = new RegExp(pattern.source, pattern.flags.replace(/[gy]/g, "")).exec(joined.slice(searchFrom));
      if (!match || match.index === undefined) break;
      const matchStart = searchFrom + match.index;
      const matchEnd = matchStart + match[0].length;
      let cursor = 0;
      let inserted = false;
      for (const [index, word] of result.entries()) {
        const sourceText = sourceTexts[index];
        const wordStart = cursor;
        const wordEnd = cursor + sourceText.length;
        if (wordEnd > matchStart && wordStart < matchEnd) {
          const prefix = wordStart <= matchStart ? sourceText.slice(0, matchStart - wordStart) : "";
          const suffix = wordEnd >= matchEnd ? sourceText.slice(matchEnd - wordStart) : "";
          if (!inserted) {
            word.text = `${prefix}${replacement}${suffix}`;
            inserted = true;
          } else {
            word.text = suffix;
          }
        }
        cursor = wordEnd;
      }
      searchFrom = matchStart + Math.max(1, replacement.length);
    }
  }
  return result.filter((word) => word.text.length > 0);
};

export const buildVerbatimCaptions = (
  words: TranscriptWord[],
  ranges: EditRange[],
  profile: ResolvedTerminologyProfile = defaultTerminologyProfile,
  segmentation: CaptionSegmentationPolicy = defaultCaptionSegmentationPolicy,
  insertions: TimelineInsertion[] = [],
): VerbatimCaption[] => {
  const kept = correctWordSequence(mapKeptWords(words, ranges, insertions), profile);
  const result: VerbatimCaption[] = [];
  let buffer: typeof kept = [];
  const flush = () => {
    if (!buffer.length) return;
    const last = buffer[buffer.length - 1];
    const sourceText = buffer.map((word) => word.text).join("");
    result.push({
      start: buffer[0].start,
      end: last.end,
      zh: segmentation.displayPunctuation === "source" ? sourceText : stripDisplayPunctuation(sourceText),
      role: "caption",
    });
    buffer = [];
  };
  for (const word of kept) {
    const previous = buffer.at(-1);
    const textLength = buffer.reduce((sum, item) => sum + item.text.length, 0);
    if (
      previous &&
      (word.start - previous.end > segmentation.pauseBreakSeconds ||
        word.end - buffer[0].start > segmentation.maximumDurationSeconds ||
        textLength + word.text.length > segmentation.maximumCharacters)
    )
      flush();
    buffer.push(word);
    if (
      /[。！？?!]$/.test(word.text) ||
      (/[，,；;：:]$/.test(word.text) &&
        buffer.reduce((sum, item) => sum + item.text.length, 0) >= segmentation.softPunctuationMinimumCharacters)
    )
      flush();
  }
  flush();
  const merged = result.reduce<VerbatimCaption[]>((captions, cue) => {
    const previous = captions.at(-1);
    if (
      previous &&
      cue.zh.length <= segmentation.orphanMaximumCharacters &&
      cue.start - previous.end <= 0.25 &&
      cue.end - previous.start <= segmentation.maximumDurationSeconds + 2 &&
      previous.zh.length + cue.zh.length <= segmentation.maximumCharacters + segmentation.orphanMaximumCharacters + 3
    ) {
      previous.zh += cue.zh;
      previous.end = cue.end;
      return captions;
    }
    captions.push(cue);
    return captions;
  }, []);
  const joined = merged.map((cue) => cue.zh).join("");
  if (correctTerminology(joined, profile) !== joined)
    throw new Error("Terminology correction left a residual source variant in captions.");
  return merged;
};

export type CaptionChannels = {
  semantic: VerbatimCaption[];
  display: VerbatimCaption[];
};

/**
 * Builds one punctuation-preserving source of truth for language understanding,
 * then derives the viewer-facing caption channel without changing cue timing.
 */
export const buildCaptionChannels = (
  words: TranscriptWord[],
  ranges: EditRange[],
  profile: ResolvedTerminologyProfile = defaultTerminologyProfile,
  segmentation: CaptionSegmentationPolicy = defaultCaptionSegmentationPolicy,
  insertions: TimelineInsertion[] = [],
): CaptionChannels => {
  const semantic = buildVerbatimCaptions(
    words,
    ranges,
    profile,
    {
      ...segmentation,
      displayPunctuation: "source",
    },
    insertions,
  );
  const displayPunctuation = segmentation.displayPunctuation ?? "none";
  const display = semantic.map((cue) => ({
    ...cue,
    zh: displayPunctuation === "source" ? cue.zh : stripDisplayPunctuation(cue.zh),
  }));
  return { semantic, display };
};
