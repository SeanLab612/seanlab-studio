export const DELIVERY_RESOLUTIONS = ["720p", "1080p", "2k", "4k", "source"];
export const DELIVERY_FRAME_RATES = [30, 60, "source"];
const dimensions = {
  "720p": { width: 1280, height: 720 },
  "1080p": { width: 1920, height: 1080 },
  "2k": { width: 2560, height: 1440 },
  "4k": { width: 3840, height: 2160 },
};
const baseline = {
  width: 3840,
  height: 2160,
  fps: 60,
  durationSeconds: 140.992,
  renderMinutes: 82,
  outputBytes: 2372685654,
  intermediateMultiplier: 2.5,
};

export const normalizeDeliveryProfile = (input = {}) => {
  const resolution = input.resolution ?? "source";
  const frameRate = input.frameRate ?? "source";
  if (!DELIVERY_RESOLUTIONS.includes(resolution)) throw new Error("不支持的成片分辨率");
  if (!DELIVERY_FRAME_RATES.includes(frameRate)) throw new Error("不支持的成片帧率");
  return { schemaVersion: "1.0", resolution, frameRate, format: "mp4", codec: "h264" };
};

export const resolveDeliveryProfile = ({ profile: input, source }) => {
  const profile = normalizeDeliveryProfile(input);
  const requested =
    profile.resolution === "source" ? { width: source.width, height: source.height } : dimensions[profile.resolution];
  const sourcePixels = source.width * source.height;
  const warnings = [];
  const output =
    requested.width * requested.height > sourcePixels ? { width: source.width, height: source.height } : requested;
  if (requested.width * requested.height > sourcePixels)
    warnings.push("所选分辨率高于原片，已自动保持原始分辨率，避免无意义放大。");
  const sourceFps = Number(source.fps) || 30;
  const requestedFps = profile.frameRate === "source" ? sourceFps : profile.frameRate;
  const fps = requestedFps > sourceFps ? sourceFps : requestedFps;
  if (requestedFps > sourceFps) warnings.push("所选帧率高于原片，已自动保持原始帧率，避免重复补帧。");
  return { ...profile, width: output.width, height: output.height, fps, warnings };
};

export const estimateDelivery = ({ profile, source, durationSeconds }) => {
  const effective = resolveDeliveryProfile({ profile, source });
  const workRatio =
    ((effective.width * effective.height * effective.fps) / (baseline.width * baseline.height * baseline.fps)) *
    (durationSeconds / baseline.durationSeconds);
  const centerMinutes = baseline.renderMinutes * workRatio;
  const centerBytes = baseline.outputBytes * workRatio;
  return {
    basis: "html 4K60 historical delivery",
    effective,
    renderMinutes: {
      low: Math.max(1, Math.round(centerMinutes * 0.75)),
      high: Math.max(1, Math.round(centerMinutes * 1.3)),
    },
    finalBytes: { low: Math.round(centerBytes * 0.65), high: Math.round(centerBytes * 1.35) },
    intermediateBytes: Math.round(centerBytes * baseline.intermediateMultiplier),
  };
};
