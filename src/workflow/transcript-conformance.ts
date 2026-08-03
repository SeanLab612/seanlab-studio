import type { TranscriptWord } from "./captions.ts";

type TranscriptDocument = {
  text?: string;
  words: Array<TranscriptWord & Record<string, unknown>>;
  [key: string]: unknown;
};

export type TranscriptConformanceChange = {
  before: string;
  after: string;
  start: number;
  end: number;
  confidence: number;
  reason: "script-term";
  leftContext: string;
  rightContext: string;
};

export type TranscriptConformanceReport = {
  schemaVersion: "1.0";
  status: "corrected" | "unchanged" | "skipped";
  referenceCoverage: number;
  rawCharacters: number;
  referenceCharacters: number;
  changes: TranscriptConformanceChange[];
  note: string;
};

const punctuationAliases: Record<string, string> = {
  "，": ",",
  "。": ".",
  "！": "!",
  "？": "?",
  "：": ":",
  "；": ";",
  "‘": "'",
  "’": "'",
  "“": '"',
  "”": '"',
};

const comparable = (character: string) => (punctuationAliases[character] ?? character).toLocaleLowerCase();
const meaningful = (text: string) => /[\p{L}\p{N}]/u.test(text);
const comparableCharacters = (text: string) => [...text].filter((character) => meaningful(character));
const englishTermPattern = /[A-Za-z0-9]+(?:[._-][A-Za-z0-9]+)*/gu;

type EnglishTerm = {
  text: string;
  wordIndex?: number;
  offset?: number;
};

const englishTerms = (text: string): EnglishTerm[] =>
  [...text.matchAll(englishTermPattern)]
    .filter((match) => /[A-Za-z]/u.test(match[0]))
    .map((match) => ({ text: match[0] }));

const transcriptEnglishTerms = (words: TranscriptDocument["words"]): EnglishTerm[] =>
  words.flatMap((word, wordIndex) =>
    [...word.text.matchAll(englishTermPattern)]
      .filter((match) => /[A-Za-z]/u.test(match[0]) && match[0].length >= 2)
      .map((match) => ({
        text: match[0],
        wordIndex,
        offset: match.index ?? 0,
      })),
  );

const shouldUseLockedTermSpelling = (source: string, target: string) =>
  source !== target &&
  (source.toLocaleLowerCase() !== target.toLocaleLowerCase() ||
    /[._-]/u.test(source + target) ||
    (/[A-Z]/u.test(target) && !/[A-Z]/u.test(source)));

const applyLockedEnglishTermCorrections = (
  words: TranscriptDocument["words"],
  lockedScriptMarkdown: string,
  changes: TranscriptConformanceChange[],
) => {
  const sourceTerms = transcriptEnglishTerms(words);
  const targetTerms = englishTerms(extractLockedScriptText(lockedScriptMarkdown));
  const termOperations = align(
    sourceTerms.map((term) => term.text),
    targetTerms.map((term) => term.text),
  );
  for (const operation of termOperations) {
    if (operation.sourceIndex === undefined || operation.targetIndex === undefined) continue;
    const sourceTerm = sourceTerms[operation.sourceIndex];
    const targetTerm = targetTerms[operation.targetIndex];
    const sourceWord = sourceTerm.wordIndex === undefined ? undefined : words[sourceTerm.wordIndex];
    if (
      sourceTerm.wordIndex === undefined ||
      sourceTerm.offset === undefined ||
      !sourceWord ||
      changes.some((change) => change.start < sourceWord.end && change.end > sourceWord.start) ||
      !/[A-Za-z]/u.test(sourceTerm.text) ||
      !/[A-Za-z]/u.test(targetTerm.text) ||
      !shouldUseLockedTermSpelling(sourceTerm.text, targetTerm.text)
    )
      continue;
    sourceWord.text =
      sourceWord.text.slice(0, sourceTerm.offset) +
      targetTerm.text +
      sourceWord.text.slice(sourceTerm.offset + sourceTerm.text.length);
    changes.push({
      before: sourceTerm.text,
      after: targetTerm.text,
      start: sourceWord.start,
      end: sourceWord.end,
      confidence: 0.99,
      reason: "script-term",
      leftContext: "",
      rightContext: "",
    });
  }
};

export const conformEnglishTermsToLockedScript = (
  words: TranscriptDocument["words"],
  lockedScriptMarkdown?: string,
) => {
  const corrected = structuredClone(words);
  const changes: TranscriptConformanceChange[] = [];
  if (lockedScriptMarkdown?.trim()) applyLockedEnglishTermCorrections(corrected, lockedScriptMarkdown, changes);
  return { words: corrected, changes };
};

export const extractLockedScriptText = (markdown: string) =>
  markdown
    .replace(/^\uFEFF/u, "")
    .split(/\r?\n/u)
    .filter((line, index) => !(index === 0 && /^#\s+/u.test(line)))
    .join("\n")
    .trim();

type AlignmentOperation = {
  kind: "match" | "replace" | "delete" | "insert";
  sourceIndex?: number;
  targetIndex?: number;
};

const align = (source: string[], target: string[]): AlignmentOperation[] => {
  const width = target.length + 1;
  const directions = new Uint8Array((source.length + 1) * width);
  let previous = new Uint32Array(width);
  let current = new Uint32Array(width);
  for (let column = 1; column < width; column += 1) {
    previous[column] = column;
    directions[column] = 2;
  }
  for (let row = 1; row <= source.length; row += 1) {
    current[0] = row;
    directions[row * width] = 1;
    for (let column = 1; column <= target.length; column += 1) {
      const equal = comparable(source[row - 1]) === comparable(target[column - 1]);
      const diagonal = previous[column - 1] + (equal ? 0 : 1);
      const up = previous[column] + 1;
      const left = current[column - 1] + 1;
      const best = Math.min(diagonal, up, left);
      current[column] = best;
      directions[row * width + column] = best === diagonal ? 0 : best === up ? 1 : 2;
    }
    [previous, current] = [current, previous];
  }

  const reversed: AlignmentOperation[] = [];
  let row = source.length;
  let column = target.length;
  while (row > 0 || column > 0) {
    const direction = directions[row * width + column];
    if (row > 0 && column > 0 && direction === 0) {
      reversed.push({
        kind: comparable(source[row - 1]) === comparable(target[column - 1]) ? "match" : "replace",
        sourceIndex: row - 1,
        targetIndex: column - 1,
      });
      row -= 1;
      column -= 1;
    } else if (row > 0 && (column === 0 || direction === 1)) {
      reversed.push({ kind: "delete", sourceIndex: row - 1 });
      row -= 1;
    } else {
      reversed.push({ kind: "insert", targetIndex: column - 1 });
      column -= 1;
    }
  }
  return reversed.reverse();
};

const exactContext = (operations: AlignmentOperation[], index: number, direction: -1 | 1) => {
  let count = 0;
  for (let cursor = index; cursor >= 0 && cursor < operations.length; cursor += direction) {
    if (operations[cursor].kind !== "match") break;
    count += 1;
  }
  return count;
};

export const conformTranscriptToLockedScript = (
  input: TranscriptDocument,
  lockedScriptMarkdown?: string,
): { transcript: TranscriptDocument; report: TranscriptConformanceReport } => {
  const transcript = structuredClone(input);
  if (!lockedScriptMarkdown?.trim()) {
    return {
      transcript,
      report: {
        schemaVersion: "1.0",
        status: "skipped",
        referenceCoverage: 0,
        rawCharacters: transcript.words.map((word) => word.text).join("").length,
        referenceCharacters: 0,
        changes: [],
        note: "No locked narration reference was supplied; raw ASR was preserved.",
      },
    };
  }

  const sourceCharacters: string[] = [];
  const characterOwners: Array<{ wordIndex: number; offset: number }> = [];
  transcript.words.forEach((word, wordIndex) => {
    [...word.text].forEach((character, offset) => {
      if (!meaningful(character)) return;
      sourceCharacters.push(character);
      characterOwners.push({ wordIndex, offset });
    });
  });
  const targetCharacters = comparableCharacters(extractLockedScriptText(lockedScriptMarkdown));
  const operations = align(sourceCharacters, targetCharacters);
  const matches = operations.filter((operation) => operation.kind === "match").length;
  const referenceCoverage = matches / Math.max(sourceCharacters.length, targetCharacters.length, 1);
  const replacements = sourceCharacters.map((character) => character);
  const changes: TranscriptConformanceChange[] = [];

  if (referenceCoverage >= 0.72) {
    let cursor = 0;
    while (cursor < operations.length) {
      if (operations[cursor].kind === "match") {
        cursor += 1;
        continue;
      }
      const startOperation = cursor;
      while (cursor < operations.length && operations[cursor].kind !== "match") cursor += 1;
      const endOperation = cursor;
      const group = operations.slice(startOperation, endOperation);
      const sourceIndices = group.flatMap((operation) =>
        operation.sourceIndex === undefined ? [] : [operation.sourceIndex],
      );
      const targetIndices = group.flatMap((operation) =>
        operation.targetIndex === undefined ? [] : [operation.targetIndex],
      );
      if (!sourceIndices.length || !targetIndices.length) continue;
      const sourceText = sourceIndices.map((index) => sourceCharacters[index]).join("");
      const targetText = targetIndices.map((index) => targetCharacters[index]).join("");
      if (!meaningful(sourceText) || !meaningful(targetText)) continue;
      if (sourceText.length > 12 || targetText.length > 16) continue;
      const leftContextCount = exactContext(operations, startOperation - 1, -1);
      const rightContextCount = exactContext(operations, endOperation, 1);
      const atLeftBoundary = startOperation === 0;
      const atRightBoundary = endOperation === operations.length;
      if ((!atLeftBoundary && leftContextCount < 6) || (!atRightBoundary && rightContextCount < 6)) continue;
      const targetIsScriptTerm = /[A-Za-z]/u.test(targetText);
      if (!targetIsScriptTerm) continue;

      const firstSourceIndex = sourceIndices[0];
      replacements[firstSourceIndex] = targetText;
      for (const sourceIndex of sourceIndices.slice(1)) replacements[sourceIndex] = "";
      if (targetIsScriptTerm) {
        for (let neighbor = startOperation - 1; neighbor >= 0; neighbor -= 1) {
          const operation = operations[neighbor];
          if (operation.kind !== "match" || operation.sourceIndex === undefined || operation.targetIndex === undefined)
            break;
          const targetCharacter = targetCharacters[operation.targetIndex];
          if (!/[A-Za-z0-9]/u.test(targetCharacter)) break;
          replacements[operation.sourceIndex] = targetCharacter;
        }
        for (let neighbor = endOperation; neighbor < operations.length; neighbor += 1) {
          const operation = operations[neighbor];
          if (operation.kind !== "match" || operation.sourceIndex === undefined || operation.targetIndex === undefined)
            break;
          const targetCharacter = targetCharacters[operation.targetIndex];
          if (!/[A-Za-z0-9]/u.test(targetCharacter)) break;
          replacements[operation.sourceIndex] = targetCharacter;
        }
      }
      const owners = sourceIndices.map((index) => characterOwners[index]);
      const firstWord = transcript.words[owners[0].wordIndex];
      const lastWord = transcript.words[owners.at(-1)?.wordIndex ?? owners[0].wordIndex];
      const leftContext = operations
        .slice(Math.max(0, startOperation - 8), startOperation)
        .flatMap((operation) => (operation.sourceIndex === undefined ? [] : [sourceCharacters[operation.sourceIndex]]))
        .join("");
      const rightContext = operations
        .slice(endOperation, Math.min(operations.length, endOperation + 8))
        .flatMap((operation) => (operation.sourceIndex === undefined ? [] : [sourceCharacters[operation.sourceIndex]]))
        .join("");
      changes.push({
        before: sourceText,
        after: targetText,
        start: firstWord.start,
        end: lastWord.end,
        confidence: Number(Math.min(0.99, 0.9 + (leftContextCount + rightContextCount) / 200).toFixed(3)),
        reason: "script-term",
        leftContext,
        rightContext,
      });
    }
  }

  const perWord = transcript.words.map((word) => [...word.text]);
  characterOwners.forEach(({ wordIndex, offset }, characterIndex) => {
    perWord[wordIndex][offset] = replacements[characterIndex];
  });
  transcript.words = transcript.words
    .map((word, index) => ({ ...word, text: perWord[index].join("") }))
    .filter((word) => word.text.length > 0);

  applyLockedEnglishTermCorrections(transcript.words, lockedScriptMarkdown, changes);
  transcript.text = transcript.words.map((word) => word.text).join("");
  return {
    transcript,
    report: {
      schemaVersion: "1.0",
      status: changes.length ? "corrected" : "unchanged",
      referenceCoverage: Number(referenceCoverage.toFixed(4)),
      rawCharacters: sourceCharacters.length,
      referenceCharacters: targetCharacters.length,
      changes,
      note: changes.length
        ? "Only context-bound English names and technical terms were corrected; Chinese wording, timing, and unaligned speech were preserved."
        : "No English-name or technical-term corrections were found; raw ASR timing and wording were preserved.",
    },
  };
};
