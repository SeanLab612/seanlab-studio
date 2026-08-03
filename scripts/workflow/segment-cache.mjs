import { createHash } from "node:crypto";

const sha256Json = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export const SEGMENT_CACHE_SCHEMA_VERSION = "1.0";

export const segmentCacheKey = ({ range, sourceSha256, profile }) =>
  sha256Json({
    schemaVersion: SEGMENT_CACHE_SCHEMA_VERSION,
    sourceSha256,
    range: {
      start: Number(range.start.toFixed(3)),
      end: Number(range.end.toFixed(3)),
    },
    profile,
  });

export const emptySegmentCache = () => ({
  schemaVersion: SEGMENT_CACHE_SCHEMA_VERSION,
  entries: {},
});

export const parseSegmentCache = (value) =>
  value?.schemaVersion === SEGMENT_CACHE_SCHEMA_VERSION && value.entries && typeof value.entries === "object"
    ? value
    : emptySegmentCache();

export const segmentCacheProfile = ({ width, height, fps, finalMode }) => ({
  implementationVersion: "1.0",
  width,
  height,
  fps,
  video: {
    codec: "libx264",
    preset: finalMode ? "fast" : "veryfast",
    crf: finalMode ? 18 : 21,
    pixelFormat: "yuv420p",
  },
  audio: {
    codec: "aac",
    bitrate: "160k",
    sampleRate: 48000,
    fadeSeconds: 0.03,
  },
});

export const deliveryBaseSignatureInputs = ({ source, mediaManifestPath, edlPath, profile }) => [
  "delivery-base-v2",
  source,
  mediaManifestPath,
  edlPath,
  profile,
];
