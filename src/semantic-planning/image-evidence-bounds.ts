import type { SemanticNarrativeSegment } from "./types.ts";

export type ImageEvidenceCaption = {
  start: number;
  end: number;
  zh: string;
  en?: string;
};

export type ImageEvidenceAnchor = {
  id: string;
  anchorText?: string;
  description?: string;
};

type BoundedSegment = {
  id: string;
  start: number;
  end: number;
  text: string;
  subtitleEn?: string;
};

export type ImageEvidenceBounds =
  | {
      status: "unchanged" | "bounded";
      intent: SemanticNarrativeSegment;
      segment: BoundedSegment;
    }
  | {
      status: "blocked";
      reason: string;
    };

const normalized = (value: string) => value.toLocaleLowerCase().replace(/[^a-z0-9㐀-鿿]+/g, "");

const bigrams = (value: string) => {
  const values: string[] = [];
  for (let index = 0; index < value.length - 1; index += 1) values.push(value.slice(index, index + 2));
  return values;
};

const anchorRecall = (anchor: string, candidate: string) => {
  const anchorBigrams = bigrams(anchor);
  if (!anchorBigrams.length) return candidate.includes(anchor) ? 1 : 0;
  const candidateBigrams = new Set(bigrams(candidate));
  return anchorBigrams.filter((value) => candidateBigrams.has(value)).length / anchorBigrams.length;
};

const segmentFor = (
  id: string,
  captions: readonly ImageEvidenceCaption[],
  startCue: number,
  endCue: number,
): BoundedSegment => {
  const selected = captions.slice(startCue, endCue + 1);
  return {
    id,
    start: selected[0].start,
    end: selected.at(-1)?.end ?? selected[0].end,
    text: selected.map((cue) => cue.zh).join(""),
    subtitleEn: selected
      .map((cue) => cue.en)
      .filter((value): value is string => Boolean(value))
      .join(" "),
  };
};

const shortestAnchorRange = ({
  anchor,
  captions,
  startCue,
  endCue,
}: {
  anchor: string;
  captions: readonly ImageEvidenceCaption[];
  startCue: number;
  endCue: number;
}) => {
  let best: { startCue: number; endCue: number } | undefined;
  for (let start = startCue; start <= endCue; start += 1) {
    let combined = "";
    for (let end = start; end <= endCue; end += 1) {
      combined += captions[end]?.zh ?? "";
      if (!normalized(combined).includes(anchor)) continue;
      if (!best || end - start < best.endCue - best.startCue) best = { startCue: start, endCue: end };
      break;
    }
  }
  return best;
};

const fuzzyAnchorRange = ({
  anchors,
  captions,
  startCue,
  endCue,
}: {
  anchors: readonly string[];
  captions: readonly ImageEvidenceCaption[];
  startCue: number;
  endCue: number;
}) => {
  let best: { startCue: number; endCue: number; score: number } | undefined;
  for (let start = startCue; start <= endCue; start += 1) {
    let combined = "";
    for (let end = start; end <= endCue; end += 1) {
      combined += captions[end]?.zh ?? "";
      const score = Math.max(...anchors.map((anchor) => anchorRecall(anchor, normalized(combined))));
      if (score < 0.35) continue;
      if (
        !best ||
        score > best.score + 0.0001 ||
        (Math.abs(score - best.score) <= 0.0001 && end - start < best.endCue - best.startCue)
      )
        best = { startCue: start, endCue: end, score };
    }
  }
  return best;
};

const globalAnchorRange = ({
  anchors,
  captions,
}: {
  anchors: readonly string[];
  captions: readonly ImageEvidenceCaption[];
}) => {
  const exact = anchors.flatMap((anchor) => {
    const ranges: Array<{ startCue: number; endCue: number; score: number; exact: true }> = [];
    for (let startCue = 0; startCue < captions.length; startCue += 1) {
      let combined = "";
      for (let endCue = startCue; endCue < captions.length; endCue += 1) {
        combined += captions[endCue]?.zh ?? "";
        if (normalized(combined).includes(anchor)) {
          ranges.push({ startCue, endCue, score: 1, exact: true });
          break;
        }
        if (normalized(combined).length > anchor.length * 2.2 + 12) break;
      }
    }
    return ranges;
  });
  exact.sort(
    (left, right) => left.endCue - left.startCue - (right.endCue - right.startCue) || left.startCue - right.startCue,
  );
  const bestExact = exact[0];
  if (bestExact) {
    const distinctExact = exact.find(
      (candidate) => candidate.endCue < bestExact.startCue || candidate.startCue > bestExact.endCue,
    );
    return distinctExact ? undefined : bestExact;
  }

  const fuzzy: Array<{ startCue: number; endCue: number; score: number; exact: false }> = [];
  for (let startCue = 0; startCue < captions.length; startCue += 1) {
    let combined = "";
    for (let endCue = startCue; endCue < captions.length; endCue += 1) {
      combined += captions[endCue]?.zh ?? "";
      const score = Math.max(...anchors.map((anchor) => anchorRecall(anchor, normalized(combined))));
      fuzzy.push({ startCue, endCue, score, exact: false });
      if (normalized(combined).length > Math.max(...anchors.map((anchor) => anchor.length)) * 2.2 + 12) break;
    }
  }
  fuzzy.sort(
    (left, right) => right.score - left.score || left.endCue - left.startCue - (right.endCue - right.startCue),
  );
  const best = fuzzy[0];
  if (!best || best.score < 0.56) return undefined;
  const distinctRunnerUp = fuzzy.find(
    (candidate) => candidate.endCue < best.startCue || candidate.startCue > best.endCue,
  );
  if (distinctRunnerUp && best.score - distinctRunnerUp.score < 0.08) return undefined;
  return best;
};

const expandForReadability = ({
  captions,
  bounds,
  minimumReadableSeconds,
  minimumStartCue,
  maximumEndCue,
}: {
  captions: readonly ImageEvidenceCaption[];
  bounds: { startCue: number; endCue: number };
  minimumReadableSeconds: number;
  minimumStartCue: number;
  maximumEndCue: number;
}) => {
  const expanded = { ...bounds };
  const duration = () => (captions[expanded.endCue]?.end ?? 0) - (captions[expanded.startCue]?.start ?? 0);
  while (duration() < minimumReadableSeconds) {
    const canExpandLeft = expanded.startCue > minimumStartCue;
    const canExpandRight = expanded.endCue < maximumEndCue;
    if (!canExpandLeft && !canExpandRight) break;
    if (!canExpandLeft) expanded.endCue += 1;
    else if (!canExpandRight) expanded.startCue -= 1;
    else {
      const leftDuration = (captions[expanded.endCue]?.end ?? 0) - (captions[expanded.startCue - 1]?.start ?? 0);
      const rightDuration = (captions[expanded.endCue + 1]?.end ?? 0) - (captions[expanded.startCue]?.start ?? 0);
      if (Math.abs(minimumReadableSeconds - leftDuration) <= Math.abs(minimumReadableSeconds - rightDuration))
        expanded.startCue -= 1;
      else expanded.endCue += 1;
    }
  }
  return expanded;
};

export const boundImageEvidenceIntentToCaptions = (
  sourceIntent: SemanticNarrativeSegment,
  captions: readonly ImageEvidenceCaption[],
  imageEvidenceInventory: readonly ImageEvidenceAnchor[],
  segmentId = "image-evidence",
  minimumReadableSeconds = 5,
): ImageEvidenceBounds => {
  const originalSegment = segmentFor(segmentId, captions, sourceIntent.startCue, sourceIntent.endCue);
  if (sourceIntent.rhetoric !== "image-evidence" || !sourceIntent.imageEvidence)
    return { status: "unchanged", intent: sourceIntent, segment: originalSegment };
  const asset = imageEvidenceInventory.find((item) => item.id === sourceIntent.imageEvidence?.assetId);
  if (!asset)
    return { status: "blocked", reason: `Unknown image evidence asset: ${sourceIntent.imageEvidence.assetId}` };
  const anchor = normalized(asset.anchorText ?? "");
  if (!anchor) return { status: "unchanged", intent: sourceIntent, segment: originalSegment };
  const exactBounds = shortestAnchorRange({
    anchor,
    captions,
    startCue: sourceIntent.startCue,
    endCue: sourceIntent.endCue,
  });
  const fuzzyBounds = exactBounds
    ? undefined
    : fuzzyAnchorRange({
        anchors: [anchor, normalized(asset.description ?? "")].filter((value) => value.length >= 4),
        captions,
        startCue: sourceIntent.startCue,
        endCue: sourceIntent.endCue,
      });
  const globalBounds =
    exactBounds || fuzzyBounds
      ? undefined
      : globalAnchorRange({
          anchors: [anchor, normalized(asset.description ?? "")].filter((value) => value.length >= 4),
          captions,
        });
  if (!exactBounds && !fuzzyBounds && !globalBounds)
    return {
      status: "blocked",
      reason: `Registered image evidence anchor could not be resolved: ${asset.anchorText}`,
    };
  const matchedBounds = exactBounds ?? fuzzyBounds ?? (globalBounds as { startCue: number; endCue: number });
  const globalMatch = Boolean(globalBounds);
  const bounds = expandForReadability({
    captions,
    bounds: matchedBounds,
    minimumReadableSeconds,
    minimumStartCue: globalMatch ? 0 : sourceIntent.startCue,
    maximumEndCue: globalMatch ? captions.length - 1 : sourceIntent.endCue,
  });
  const evidenceSegment = segmentFor(segmentId, captions, matchedBounds.startCue, matchedBounds.endCue);
  const displaySegment = segmentFor(segmentId, captions, bounds.startCue, bounds.endCue);
  const boundedSegment = { ...evidenceSegment, start: displaySegment.start, end: displaySegment.end };
  const title = asset.anchorText?.trim() || evidenceSegment.text.trim();
  const boundReasons = [
    ...(fuzzyBounds
      ? [`Local image evidence fuzzy anchor match: ${matchedBounds.startCue}-${matchedBounds.endCue}.`]
      : []),
    ...(globalBounds
      ? [
          `${globalBounds.exact ? "Exact" : "Fuzzy"} image evidence anchor recovered outside the proposed segment: ${matchedBounds.startCue}-${matchedBounds.endCue}.`,
        ]
      : []),
    ...(bounds.startCue !== matchedBounds.startCue || bounds.endCue !== matchedBounds.endCue
      ? [`Local image evidence readable bounds: ${bounds.startCue}-${bounds.endCue}.`]
      : []),
  ];
  return {
    status:
      matchedBounds.startCue === sourceIntent.startCue &&
      matchedBounds.endCue === sourceIntent.endCue &&
      bounds.startCue === matchedBounds.startCue &&
      bounds.endCue === matchedBounds.endCue
        ? "unchanged"
        : "bounded",
    segment: boundedSegment,
    intent: {
      ...sourceIntent,
      startCue: matchedBounds.startCue,
      endCue: matchedBounds.endCue,
      reason:
        matchedBounds.startCue === sourceIntent.startCue && matchedBounds.endCue === sourceIntent.endCue
          ? [sourceIntent.reason, ...boundReasons].join(" ")
          : [
              sourceIntent.reason,
              `Local image evidence bounds: ${bounds.startCue}-${bounds.endCue}.`,
              ...boundReasons,
            ].join(" "),
      narrative: {
        ...sourceIntent.narrative,
        title,
        subtitleZh: evidenceSegment.text,
        subtitleEn: evidenceSegment.subtitleEn ?? "",
        takeaway: evidenceSegment.text,
      },
      items: [],
      timeSeries: [],
      matrix: { rows: [], columns: [], values: [], xLabel: "", yLabel: "" },
      quote: { text: "", sourceName: "", sourceRole: "" },
      mediaIntents: [],
      imageEvidence: {
        ...sourceIntent.imageEvidence,
        caption: evidenceSegment.text,
      },
    },
  };
};
