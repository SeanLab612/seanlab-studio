type AuthoredVisualConstraint = {
  sectionId: string;
  mode: string;
  startCue: number;
  endCue: number;
};

type SemanticIntent = {
  startCue: number;
  endCue: number;
  confidence: number;
  items: readonly unknown[];
};

const overlaps = (constraint: AuthoredVisualConstraint, intent: SemanticIntent) =>
  constraint.startCue <= intent.endCue && constraint.endCue >= intent.startCue;

export const selectInformationConstraintOwners = <
  Constraint extends AuthoredVisualConstraint,
  Intent extends SemanticIntent,
>({
  constraints,
  intents,
  matchesRhetoric,
}: {
  constraints: readonly Constraint[];
  intents: readonly Intent[];
  matchesRhetoric: (constraint: Constraint, intent: Intent) => boolean;
}) =>
  new Map(
    constraints
      .filter((constraint) => constraint.mode === "information")
      .map((constraint) => {
        const candidates = intents
          .map((intent, index) => ({ intent, index }))
          .filter(({ intent }) => overlaps(constraint, intent))
          .sort((left, right) => {
            const leftMatch = Number(matchesRhetoric(constraint, left.intent));
            const rightMatch = Number(matchesRhetoric(constraint, right.intent));
            return (
              rightMatch - leftMatch ||
              right.intent.items.length - left.intent.items.length ||
              right.intent.confidence - left.intent.confidence ||
              left.index - right.index
            );
          });
        return [constraint.sectionId, candidates[0]?.index] as const;
      })
      .filter((entry): entry is readonly [string, number] => Number.isInteger(entry[1])),
  );

export const resolveAuthoredVisualConstraint = <
  Constraint extends AuthoredVisualConstraint,
  Intent extends SemanticIntent,
>({
  constraints,
  intent,
  semanticIndex,
  informationOwners,
  matchesRhetoric,
}: {
  constraints: readonly Constraint[];
  intent: Intent;
  semanticIndex: number;
  informationOwners: ReadonlyMap<string, number>;
  matchesRhetoric: (constraint: Constraint, intent: Intent) => boolean;
}) =>
  constraints
    .filter((constraint) => overlaps(constraint, intent))
    .filter(
      (constraint) =>
        constraint.mode !== "information" || informationOwners.get(constraint.sectionId) === semanticIndex,
    )
    .map((constraint) => {
      const overlap = Math.min(constraint.endCue, intent.endCue) - Math.max(constraint.startCue, intent.startCue) + 1;
      const constraintLength = constraint.endCue - constraint.startCue + 1;
      const semanticMatch = matchesRhetoric(constraint, intent);
      return { constraint, semanticMatch, overlapRatio: overlap / constraintLength, overlap };
    })
    .sort(
      (left, right) =>
        Number(right.semanticMatch) - Number(left.semanticMatch) ||
        right.overlapRatio - left.overlapRatio ||
        right.overlap - left.overlap,
    )[0]?.constraint;
