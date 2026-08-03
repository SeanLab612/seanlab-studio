export const evaluateDeliveryProbe = ({ probe, expected, decodePassed }) => {
  const findings = [];
  const streams = probe.streams ?? [];
  const video = streams.find((stream) => stream.codec_type === "video");
  const audio = streams.find((stream) => stream.codec_type === "audio");
  if (!video) findings.push({ severity: "error", rule: "delivery.video.missing" });
  if (!audio) findings.push({ severity: "error", rule: "delivery.audio.missing" });
  if (video && (video.width !== expected.width || video.height !== expected.height))
    findings.push({
      severity: "error",
      rule: "delivery.dimensions",
      expected: `${expected.width}x${expected.height}`,
      actual: `${video.width}x${video.height}`,
    });
  if (video && expected.codec && video.codec_name !== expected.codec)
    findings.push({ severity: "error", rule: "delivery.codec", expected: expected.codec, actual: video.codec_name });
  const [fpsNumerator, fpsDenominator = "1"] = String(video?.r_frame_rate ?? "0/1")
    .split("/")
    .map(Number);
  const actualFps = fpsDenominator ? fpsNumerator / fpsDenominator : 0;
  if (video && expected.fps && Math.abs(actualFps - expected.fps) > 0.05)
    findings.push({ severity: "error", rule: "delivery.fps", expected: expected.fps, actual: actualFps });
  const duration = Number(probe.format?.duration);
  if (!Number.isFinite(duration) || Math.abs(duration - expected.durationSeconds) > expected.durationToleranceSeconds)
    findings.push({
      severity: "error",
      rule: "delivery.duration",
      expected: expected.durationSeconds,
      tolerance: expected.durationToleranceSeconds,
      actual: duration,
    });
  if (!decodePassed) findings.push({ severity: "error", rule: "delivery.decode" });
  return {
    status: findings.some((finding) => finding.severity === "error") ? "failed" : "passed",
    findings,
    media: { video, audio, durationSeconds: duration },
  };
};
