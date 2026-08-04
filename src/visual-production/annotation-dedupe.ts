import type { ResolvedTextAnnotation } from "./types.ts";

type RoughAnnotationItem = { id?: unknown; text?: unknown; effect?: unknown } & Record<string, unknown>;

type OverlayCueLike = {
  start: number;
  end: number;
  generatedVisual?: {
    component?: { id?: string };
    props?: Record<string, unknown>;
  };
} & Record<string, unknown>;

const normalizeAnnotationText = (value: unknown) =>
  String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]/gu, "");

const sameAnnotationTarget = (left: unknown, right: unknown) => {
  const a = normalizeAnnotationText(left);
  const b = normalizeAnnotationText(right);
  return Boolean(a && b && (a === b || a.includes(b) || b.includes(a)));
};

const overlaps = (left: { start: number; end: number }, right: { start: number; end: number }) =>
  left.start < right.end && left.end > right.start;

export const dedupeAgentRoughAnnotations = <Cue extends OverlayCueLike>({
  overlayCues,
  userAnnotations,
}: {
  overlayCues: Cue[];
  userAnnotations: ResolvedTextAnnotation[];
}) => {
  let removedItemCount = 0;
  let removedCueCount = 0;
  const cues = overlayCues.flatMap((cue): Cue[] => {
    if (cue.generatedVisual?.component?.id !== "rough-annotation") return [cue];
    const props = cue.generatedVisual.props ?? {};
    const items = Array.isArray(props.items) ? (props.items as RoughAnnotationItem[]) : [];
    if (!items.length) return [cue];
    const conflictingAnnotations = userAnnotations.filter((annotation) => overlaps(cue, annotation));
    if (!conflictingAnnotations.length) return [cue];
    const retained = items.filter((item) => {
      const duplicate = conflictingAnnotations.some((annotation) =>
        sameAnnotationTarget(item.text, annotation.exactSpokenQuote),
      );
      if (duplicate) removedItemCount += 1;
      return !duplicate;
    });
    if (!retained.length) {
      removedCueCount += 1;
      return [];
    }
    const retainedIds = new Set(retained.map((item) => item.id));
    const oldIndexToNew = new Map<number, number>();
    items.forEach((item, index) => {
      const newIndex = retained.findIndex((candidate) => candidate.id === item.id);
      if (retainedIds.has(item.id) && newIndex >= 0) oldIndexToNew.set(index, newIndex);
    });
    const timeline = Array.isArray(props.activeIndexTimeline)
      ? (props.activeIndexTimeline as Array<Record<string, unknown>>).flatMap((point) => {
          const index = typeof point.index === "number" ? oldIndexToNew.get(point.index) : undefined;
          return index === undefined ? [] : [{ ...point, index }];
        })
      : undefined;
    return [
      {
        ...cue,
        generatedVisual: {
          ...cue.generatedVisual,
          props: {
            ...props,
            items: retained,
            activeIndex: Math.min(Number(props.activeIndex ?? 0), retained.length - 1),
            ...(timeline ? { activeIndexTimeline: timeline } : {}),
          },
        },
      } as Cue,
    ];
  });
  return { overlayCues: cues, removedItemCount, removedCueCount };
};
