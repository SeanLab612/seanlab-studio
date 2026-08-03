import { createHash } from "node:crypto";
import { rename, writeFile } from "node:fs/promises";

export const QA_FRAME_CACHE_SCHEMA_VERSION = "1.0";

const cueArrays = [
  "overlayCues",
  "screenScenes",
  "imageCues",
  "animationCues",
  "annotationCues",
  "titleCues",
  "subtitleCues",
];

const activeAt = (cue, timeSeconds) =>
  Number.isFinite(cue?.start) && Number.isFinite(cue?.end) && timeSeconds >= cue.start && timeSeconds <= cue.end;

const relevantDocument = (document, timeSeconds) => {
  if (!document || typeof document !== "object") return document;
  const result = Object.fromEntries(Object.entries(document).filter(([key]) => !cueArrays.includes(key)));
  for (const key of cueArrays) {
    if (!Array.isArray(document[key])) continue;
    result[key] = document[key].filter((cue) => activeAt(cue, timeSeconds));
  }
  return result;
};

export const qaFrameCacheKey = ({ frame, plan, reviewProps, rendererSha256, baseVideoSha256 }) =>
  createHash("sha256")
    .update(
      JSON.stringify({
        schemaVersion: QA_FRAME_CACHE_SCHEMA_VERSION,
        rendererSha256,
        baseVideoSha256,
        frame: {
          cueId: frame.cueId,
          componentId: frame.componentId,
          layoutId: frame.layoutId,
          phase: frame.phase,
          frame: frame.frame,
          timeSeconds: frame.timeSeconds,
        },
        plan: relevantDocument(plan, frame.timeSeconds),
        reviewProps: relevantDocument(reviewProps, frame.timeSeconds),
      }),
    )
    .digest("hex");

export const parseQaFrameCache = (value) =>
  value?.schemaVersion === QA_FRAME_CACHE_SCHEMA_VERSION && value.entries && typeof value.entries === "object"
    ? value
    : { schemaVersion: QA_FRAME_CACHE_SCHEMA_VERSION, entries: {} };

export const createQaFrameCacheWriter = (path) => {
  let pending = Promise.resolve();
  return {
    save(value) {
      const snapshot = `${JSON.stringify(value, null, 2)}\n`;
      pending = pending.then(async () => {
        const temporary = `${path}.${process.pid}.tmp`;
        await writeFile(temporary, snapshot);
        await rename(temporary, path);
      });
      return pending;
    },
    flush() {
      return pending;
    },
  };
};
