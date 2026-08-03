import type React from "react";
import { createContext, useContext, useMemo } from "react";
import { resolveComponentAccent, viewerTextEmphasisPolicy } from "../../design-tokens";

export type TextEmphasisSpec = {
  phrase: string;
  color?: string;
};

const TextEmphasisContext = createContext<readonly Required<TextEmphasisSpec>[]>([]);

const normalizeSpecs = (specs: readonly TextEmphasisSpec[]) => {
  const colors: string[] = [];
  const phrases = new Set<string>();
  const normalized: Required<TextEmphasisSpec>[] = [];

  for (const spec of specs) {
    const phrase = spec.phrase.trim();
    if (!phrase || phrases.has(phrase) || normalized.length >= viewerTextEmphasisPolicy.maxAccentRunsPerComponent) {
      continue;
    }
    const color = resolveComponentAccent(spec.color, viewerTextEmphasisPolicy.accentColors[0]);
    if (!colors.includes(color)) {
      if (colors.length >= viewerTextEmphasisPolicy.maxAccentColorsPerComponent) continue;
      colors.push(color);
    }
    phrases.add(phrase);
    normalized.push({ phrase, color });
  }

  return normalized;
};

export const TextEmphasisProvider: React.FC<{
  specs?: readonly TextEmphasisSpec[];
  children: React.ReactNode;
}> = ({ specs = [], children }) => {
  const value = useMemo(() => normalizeSpecs(specs), [specs]);
  return <TextEmphasisContext.Provider value={value}>{children}</TextEmphasisContext.Provider>;
};

export const EmphasisText: React.FC<{ text: string }> = ({ text }) => {
  const specs = useContext(TextEmphasisContext);
  if (specs.length === 0) return <>{text}</>;

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    const match = specs
      .map((spec) => ({ spec, index: text.indexOf(spec.phrase, cursor) }))
      .filter((candidate) => candidate.index >= 0)
      .sort((a, b) => a.index - b.index || b.spec.phrase.length - a.spec.phrase.length)[0];

    if (!match) {
      parts.push(text.slice(cursor));
      break;
    }
    if (match.index > cursor) parts.push(text.slice(cursor, match.index));
    parts.push(
      <span key={`${match.spec.phrase}-${match.index}`} style={{ color: match.spec.color, fontWeight: 900 }}>
        {match.spec.phrase}
      </span>,
    );
    cursor = match.index + match.spec.phrase.length;
  }

  return <span style={{ color: viewerTextEmphasisPolicy.baseColor }}>{parts}</span>;
};
