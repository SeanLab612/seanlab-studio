import { execFile } from "node:child_process";
import { copyFile, mkdir, readFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { promisify } from "node:util";
import { fileExists, hashFile, signatureFor } from "../workflow/state.mjs";
import { readManifest } from "../workflow/manifest.mjs";
import { loadCreatorProject, projectDir, writeJsonAtomic } from "./project-store.mjs";

const execFileAsync = promisify(execFile);
const baselinePath = (projectId) => resolve(projectDir(projectId), "review", "production-baseline.json");
const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

const baselineContext = async (projectId) => {
  const creator = await loadCreatorProject(projectId);
  if (!creator.video?.manifest) throw new Error("请先生成视频工作流交接包");
  return readManifest(creator.video.manifest);
};

const baselineInputs = ({ paths }) => [
  paths.source,
  resolve(paths.workspace, "media-manifest.json"),
  resolve(paths.workspace, "edl.json"),
];

const inputSha256 = ({ paths }) => signatureFor(baselineInputs({ paths }));

export const loadProductionBaseline = async (projectId) => {
  let baseline;
  try {
    baseline = await readJson(baselinePath(projectId));
  } catch {
    return undefined;
  }
  const context = await baselineContext(projectId);
  const { paths } = context;
  const inputsCurrent = baseline.inputSha256 === (await inputSha256({ paths }).catch(() => undefined));
  const reviewInfo = await stat(baseline.review.path).catch(() => undefined);
  const reviewCurrent = Boolean(
    inputsCurrent &&
      reviewInfo &&
      reviewInfo.size === baseline.review.bytes &&
      (await hashFile(baseline.review.path)) === baseline.review.sha256,
  );
  if (!reviewCurrent) return undefined;
  if (baseline.status === "delivered") {
    const deliveryInfo = await stat(baseline.delivery?.path ?? "").catch(() => undefined);
    const deliveryCurrent = Boolean(
      deliveryInfo &&
        deliveryInfo.size === baseline.delivery.bytes &&
        (await hashFile(baseline.delivery.path)) === baseline.delivery.sha256,
    );
    if (!deliveryCurrent) return undefined;
  }
  return {
    ...baseline,
    reviewUrl: `/api/projects/${encodeURIComponent(projectId)}/workflow/production-baseline/video`,
    deliveryUrl:
      baseline.status === "delivered"
        ? `/api/projects/${encodeURIComponent(projectId)}/workflow/production-baseline/delivery-video`
        : undefined,
  };
};

export const createProductionBaseline = async ({
  projectId,
  failure,
  execute = ({ command, args, cwd, timeout }) => execFileAsync(command, args, { cwd, timeout }),
}) => {
  const context = await baselineContext(projectId);
  const { paths } = context;
  const required = baselineInputs({ paths });
  if (!(await Promise.all(required.map(fileExists))).every(Boolean))
    return { kind: "production-baseline", success: false, reason: "baseline-inputs-unavailable" };
  await execute({
    command: process.execPath,
    args: ["scripts/render-review-base.mjs", paths.runtimeConfig],
    cwd: process.cwd(),
    timeout: 6 * 60 * 60 * 1000,
  });
  const runtimeConfig = await readJson(paths.runtimeConfig);
  const reviewPath = resolve(runtimeConfig.publicReviewFile);
  const info = await stat(reviewPath);
  const record = {
    schemaVersion: "1.0",
    kind: "production-baseline",
    projectId,
    videoProjectId: context.manifest.project.id,
    status: "review-ready",
    generatedAt: new Date().toISOString(),
    inputSha256: await inputSha256({ paths }),
    fallbackReason: {
      stage: failure?.stage ?? null,
      code: failure?.code ?? "AUTOMATIC_RECOVERY_EXHAUSTED",
    },
    review: {
      path: reviewPath,
      bytes: info.size,
      sha256: await hashFile(reviewPath),
    },
  };
  await writeJsonAtomic(baselinePath(projectId), record);
  return { kind: "production-baseline", success: true, record };
};

export const approveProductionBaseline = async ({ projectId, confirmation, inputSha256: expectedInputSha256 }) => {
  if (confirmation !== "human-production-baseline-approved") throw new Error("基础审核版本需要明确批准");
  const baseline = await loadProductionBaseline(projectId);
  if (baseline?.status !== "review-ready") throw new Error("当前没有可批准的基础审核版本");
  if (!expectedInputSha256 || baseline.inputSha256 !== expectedInputSha256)
    throw new Error("基础审核版本已经变化，请重新播放后再批准");
  const approved = {
    ...baseline,
    status: "approved",
    approvedAt: new Date().toISOString(),
  };
  delete approved.reviewUrl;
  await writeJsonAtomic(baselinePath(projectId), approved);
  return approved;
};

export const deliverProductionBaseline = async ({ projectId, confirmation, inputSha256: expectedInputSha256 }) => {
  if (confirmation !== "human-production-baseline-delivery") throw new Error("生成基础版本成片需要明确确认");
  const baseline = await loadProductionBaseline(projectId);
  if (!baseline || !["approved", "delivered"].includes(baseline.status)) throw new Error("请先审核并通过基础版本");
  if (!expectedInputSha256 || baseline.inputSha256 !== expectedInputSha256)
    throw new Error("基础版本已经变化，请重新审核后再生成成片");
  if (baseline.status === "delivered") return baseline;
  const context = await baselineContext(projectId);
  const runtime = await readJson(context.paths.runtimeConfig);
  const deliveryPath = resolve(runtime.publicDeliveryFile);
  await mkdir(dirname(deliveryPath), { recursive: true });
  await copyFile(baseline.review.path, deliveryPath);
  const info = await stat(deliveryPath);
  const delivered = {
    ...baseline,
    status: "delivered",
    deliveredAt: new Date().toISOString(),
    delivery: {
      path: deliveryPath,
      bytes: info.size,
      sha256: await hashFile(deliveryPath),
    },
  };
  delete delivered.reviewUrl;
  await writeJsonAtomic(baselinePath(projectId), delivered);
  return delivered;
};
