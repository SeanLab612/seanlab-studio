import { OperationalError } from "./errors.mjs";

const visualKinds = ["screenScenes", "overlayCues", "titleCues", "annotationCues", "imageCues", "animationCues"];

const cueIdentity = (kind, cue, index) => ({
  kind,
  id: typeof cue?.id === "string" && cue.id ? cue.id : `${kind}-${index + 1}`,
  start: Number(cue?.start),
  end: Number(cue?.end),
});

export const visualInventory = (props = {}) =>
  visualKinds.flatMap((kind) => (props[kind] ?? []).map((cue, index) => cueIdentity(kind, cue, index)));

const sameTiming = (left, right) =>
  Number.isFinite(left.start) &&
  Number.isFinite(left.end) &&
  Number.isFinite(right.start) &&
  Number.isFinite(right.end) &&
  Math.abs(left.start - right.start) < 0.001 &&
  Math.abs(left.end - right.end) < 0.001;

const fallbackCovers = (fallback, missing, deliveryInventory) => {
  if (
    fallback?.reviewKind !== missing.kind ||
    fallback?.reviewCueId !== missing.id ||
    typeof fallback?.reason !== "string" ||
    !fallback.reason.trim()
  )
    return false;
  if (fallback.replacementKind === "speaker") return true;
  return deliveryInventory.some(
    (item) => item.kind === fallback.replacementKind && item.id === fallback.replacementCueId,
  );
};

export const compareDeliveryVisualParity = (reviewProps, deliveryProps) => {
  const review = visualInventory(reviewProps);
  const delivery = visualInventory(deliveryProps);
  const fallbacks = deliveryProps?.visualDeliveryFallbacks ?? [];
  const omitted = [];
  const timingChanged = [];
  for (const expected of review) {
    const actual = delivery.find((item) => item.kind === expected.kind && item.id === expected.id);
    if (!actual) {
      if (!fallbacks.some((fallback) => fallbackCovers(fallback, expected, delivery))) omitted.push(expected);
      continue;
    }
    if (!sameTiming(expected, actual)) timingChanged.push({ expected, actual });
  }
  return {
    schemaVersion: "1.0",
    status: omitted.length || timingChanged.length ? "failed" : "passed",
    reviewCount: review.length,
    deliveryCount: delivery.length,
    omitted,
    timingChanged,
  };
};

export const assertDeliveryVisualParity = (reviewProps, deliveryProps) => {
  const report = compareDeliveryVisualParity(reviewProps, deliveryProps);
  if (report.status === "passed") return report;
  const labels = [
    ...report.omitted.map((item) => `${item.kind}:${item.id}`),
    ...report.timingChanged.map(({ expected }) => `${expected.kind}:${expected.id} (timing changed)`),
  ];
  throw new OperationalError(
    "DELIVERY_VISUAL_PARITY_FAILED",
    `Delivery props omit or change reviewed visuals: ${labels.join(", ")}`,
    { details: report },
  );
};
