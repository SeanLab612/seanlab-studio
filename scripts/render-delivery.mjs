import { execFileSync } from "node:child_process";
import { readFile, rm, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { hashFile, signatureFor } from "./workflow/state.mjs";
import { resolveDeliveryProfile } from "./creator/delivery-profile.mjs";
import { reusableDeliveryReport } from "./operations/delivery-provenance.mjs";
import { assertDeliveryVisualParity } from "./operations/delivery-visual-parity.mjs";
import { deliveryBaseSignatureInputs, segmentCacheProfile } from "./workflow/segment-cache.mjs";

const configPath = resolve(process.argv[2]);
const config = JSON.parse(await readFile(configPath, "utf8"));
const mediaManifest = JSON.parse(await readFile(resolve(config.editDir, "media-manifest.json"), "utf8"));
const edl = JSON.parse(await readFile(resolve(config.editDir, "edl.json"), "utf8"));
const deliveryProfile = resolveDeliveryProfile({ profile: config.delivery, source: mediaManifest });
const scale = deliveryProfile.width / config.reviewWidth;
const baseReportPath = resolve(config.editDir, "delivery-base-report.json");
const renderReportPath = resolve(config.editDir, "delivery-render-report.json");
const statePath = resolve(config.editDir, "run-state.json");
const reviewPropsPath = config.reviewPropsFile ?? resolve(config.editDir, "review-props.json");
const sourcePropsPath = config.finalPropsFile ?? resolve(config.editDir, "final-4k-props.json");
const mediaManifestPath = resolve(config.editDir, "media-manifest.json");
const edlPath = resolve(config.editDir, "edl.json");
const reviewProps = JSON.parse(await readFile(reviewPropsPath, "utf8"));
const sourceDeliveryProps = JSON.parse(await readFile(sourcePropsPath, "utf8"));
assertDeliveryVisualParity(reviewProps, sourceDeliveryProps);
const deliveryBaseInputSignature = await signatureFor(
  deliveryBaseSignatureInputs({
    source: config.source,
    mediaManifestPath,
    edlPath,
    profile: segmentCacheProfile({
      width: mediaManifest.width,
      height: mediaManifest.height,
      fps: mediaManifest.fps,
      finalMode: true,
    }),
  }),
);

const currentInputSignature = async () => {
  const state = JSON.parse(await readFile(statePath, "utf8"));
  const signature = state.stages?.["delivery-render"]?.inputSignature;
  if (!signature) throw new Error("delivery-render input signature is unavailable");
  return signature;
};

const currentProvenance = async () => {
  const state = JSON.parse(await readFile(statePath, "utf8"));
  const approval = state.stages?.["human-approval"];
  if (approval?.status !== "approved" || !approval.snapshot?.sha256)
    throw new Error("delivery render requires a current approval snapshot");
  return {
    inputSignature: await currentInputSignature(),
    approvalSnapshotSha256: approval.snapshot.sha256,
    deliveryPropsSha256: await hashFile(sourcePropsPath),
    sourceSha256: await hashFile(config.source),
    projectManifestSha256: await hashFile(state.manifestPath),
  };
};

const recordDelivery = async () => {
  const info = await stat(config.deliveryOutputFile);
  const report = {
    schemaVersion: "1.0",
    kind: "delivery-render-report",
    generatedAt: new Date().toISOString(),
    projectId: config.projectId,
    provenance: await currentProvenance(),
    output: {
      path: resolve(config.deliveryOutputFile),
      bytes: info.size,
      sha256: await hashFile(config.deliveryOutputFile),
    },
  };
  await writeFile(renderReportPath, `${JSON.stringify(report, null, 2)}\n`);
  return report;
};

const reusableDelivery = async () => {
  try {
    if (
      !(await reusableDeliveryReport({
        reportPath: renderReportPath,
        outputPath: config.deliveryOutputFile,
        provenance: await currentProvenance(),
      }))
    )
      return false;
    execFileSync("node", ["scripts/validate-delivery.mjs", configPath], { stdio: "inherit" });
    return true;
  } catch {
    return false;
  }
};

const probeBase = (path) => {
  const probe = JSON.parse(
    execFileSync(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-show_entries",
        "stream=codec_type,width,height",
        "-of",
        "json",
        path,
      ],
      { encoding: "utf8" },
    ),
  );
  const video = probe.streams?.find((stream) => stream.codec_type === "video");
  const audio = probe.streams?.find((stream) => stream.codec_type === "audio");
  const durationSeconds = Number(probe.format?.duration);
  if (video?.width !== mediaManifest.width || video?.height !== mediaManifest.height)
    throw new Error("Existing delivery base resolution does not match the current source");
  if (!audio) throw new Error("Existing delivery base has no audio stream");
  if (!Number.isFinite(durationSeconds) || Math.abs(durationSeconds - edl.totalDurationS) > 0.75)
    throw new Error("Existing delivery base duration does not match the current edit");
  return { width: video.width, height: video.height, durationSeconds, hasAudio: true };
};

const recordBase = async () => {
  const path = resolve(config.publicDeliveryFile);
  const media = probeBase(path);
  const info = await stat(path);
  const report = {
    schemaVersion: "1.0",
    kind: "delivery-base-report",
    generatedAt: new Date().toISOString(),
    inputSignature: deliveryBaseInputSignature,
    output: { path, bytes: info.size, sha256: await hashFile(path) },
    media,
  };
  await writeFile(baseReportPath, `${JSON.stringify(report, null, 2)}\n`);
  return report;
};

const reusableBase = async () => {
  try {
    const report = JSON.parse(await readFile(baseReportPath, "utf8"));
    if (report.inputSignature !== deliveryBaseInputSignature) return false;
    const info = await stat(config.publicDeliveryFile);
    if (info.size !== report.output?.bytes || (await hashFile(config.publicDeliveryFile)) !== report.output?.sha256)
      return false;
    probeBase(config.publicDeliveryFile);
    return true;
  } catch {
    return false;
  }
};

if (process.argv.includes("--record-existing-base")) {
  const report = await recordBase();
  console.log(`${report.output.path}: recorded reusable delivery base`);
  process.exit(0);
}

if (await reusableDelivery()) {
  console.log(`${config.deliveryOutputFile}: reusing provenance-bound existing delivery`);
  process.exit(0);
}

if (await reusableBase()) console.log(`${config.publicDeliveryFile}: reusing input-bound delivery base`);
else {
  execFileSync("node", ["scripts/render-review-base.mjs", configPath, "--final"], { stdio: "inherit" });
  await recordBase();
}
const deliveryPropsPath = resolve(config.editDir, ".delivery-render-props.json");
const deliveryProps = structuredClone(sourceDeliveryProps);
deliveryProps.outputFps = deliveryProfile.fps;
await writeFile(deliveryPropsPath, `${JSON.stringify(deliveryProps, null, 2)}\n`);
try {
  execFileSync(
    "npx",
    [
      "remotion",
      "render",
      "src/index.ts",
      "GeneratedWorkflowReview",
      config.deliveryOutputFile,
      "--props",
      deliveryPropsPath,
      "--scale",
      String(scale),
      "--codec",
      config.delivery?.codec ?? "h264",
      "--crf",
      String(config.delivery?.crf ?? 18),
    ],
    { stdio: "inherit" },
  );
} finally {
  await rm(deliveryPropsPath, { force: true });
}
await recordDelivery();
