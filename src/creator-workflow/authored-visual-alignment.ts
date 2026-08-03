type Caption = { zh: string };

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

export const resolveAuthoredVisualAnchor = (anchorText: string, captions: Caption[]) => {
  const needle = normalize(anchorText);
  if (!needle) return undefined;
  const matches: Array<{ startCue: number; endCue: number; score: number }> = [];
  for (let startCue = 0; startCue < captions.length; startCue += 1) {
    let combined = "";
    for (let endCue = startCue; endCue < Math.min(captions.length, startCue + 8); endCue += 1) {
      combined += normalize(captions[endCue].zh);
      matches.push({ startCue, endCue, score: similarity(needle, combined) });
      if (combined.length > needle.length * 2.2 + 12) break;
    }
  }
  matches.sort((a, b) => b.score - a.score || a.startCue - b.startCue || a.endCue - b.endCue);
  const best = matches[0];
  return best && best.score >= 0.56 ? best : undefined;
};

export const resolveAuthoredVisualRange = (
  constraint: { anchorText: string; endAnchorText?: string },
  captions: Caption[],
) => {
  const start = resolveAuthoredVisualAnchor(constraint.anchorText, captions);
  if (!start) return undefined;
  if (!constraint.endAnchorText?.trim()) return start;
  const end = resolveAuthoredVisualAnchor(constraint.endAnchorText, captions);
  if (!end || end.endCue < start.startCue) return undefined;
  return {
    startCue: start.startCue,
    endCue: end.endCue,
    score: Math.min(start.score, end.score),
  };
};
