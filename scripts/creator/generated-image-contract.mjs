import { agentDefinition } from "../../src/agents/registry.ts";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, resolve } from "node:path";
import { promisify } from "node:util";
import { recordGeneratedAsset } from "./generated-assets.mjs";

const execFileAsync = promisify(execFile);
const configuredBrokerCommand = () => process.env.SEANLAB_IMAGE_BROKER ?? process.env.SEANLAB_CODEX_IMAGE_BROKER;

export const GENERATED_IMAGE_TEMPLATE_CONTRACTS = Object.freeze({
  "paper-editorial": Object.freeze({
    label: "纸张编辑部",
    promptPrefix:
      "editorial paper cutout illustration, tactile torn paper edges, warm ivory stock, ink outline, restrained red accents",
    negative: "photorealistic, glossy 3d render, gradients, readable text, logo, watermark, UI screenshot",
    background: "transparent",
  }),
  "stop-motion-machine": Object.freeze({
    label: "定格机械台",
    promptPrefix:
      "hand-built stop motion prop, miniature practical materials, painted wood and metal, frontal readable silhouette, studio craft lighting",
    negative: "photorealistic full scene, text, logo, watermark, UI screenshot, busy background",
    background: "transparent",
  }),
  "research-archive": Object.freeze({
    label: "研究档案馆",
    promptPrefix:
      "archival technical illustration, cream paper, graphite and ink, numbered specimen aesthetic, muted cyan annotations without text",
    negative: "photorealistic, neon cyberpunk, readable text, logo, watermark, UI screenshot",
    background: "transparent",
  }),
});

export const imageGenerationCapability = ({ agentId, brokerCommand = configuredBrokerCommand() }) => {
  const definition = agentDefinition(agentId);
  if (!definition.capabilities.imageGeneration && !definition.capabilities.imageProviderOrchestration)
    return {
      supported: false,
      configured: false,
      native: false,
      reason: `${definition.displayName} 无法调度生图服务`,
    };
  return {
    supported: true,
    configured: Boolean(brokerCommand),
    native: definition.capabilities.imageGeneration,
    reason: brokerCommand ? null : "Studio 生图服务尚未配置",
  };
};

export const buildGeneratedImageRequest = ({
  agentId,
  projectId,
  beatId,
  templateId,
  subject,
  context,
  references = [],
}) => {
  const capability = imageGenerationCapability({ agentId });
  if (!capability.supported) throw new Error(capability.reason);
  const contract = GENERATED_IMAGE_TEMPLATE_CONTRACTS[templateId];
  if (!contract) throw new Error(`Unsupported generated image template: ${templateId}`);
  if (!subject?.trim()) throw new Error("Generated image subject is required");
  return {
    schemaVersion: "1.0",
    projectId,
    beatId,
    agentId,
    templateId,
    subject: subject.trim(),
    prompt: `${contract.promptPrefix}. Isolated subject: ${subject.trim()}. Narrative context: ${String(context ?? "").trim()}.`,
    negativePrompt: contract.negative,
    background: contract.background,
    references,
  };
};

export const generateAndRecordProjectImage = async ({
  request,
  brokerCommand = configuredBrokerCommand(),
  timeoutMs = 300_000,
}) => {
  const capability = imageGenerationCapability({ agentId: request.agentId, brokerCommand });
  if (!capability.supported || !capability.configured) throw new Error(capability.reason);
  if (!isAbsolute(brokerCommand)) throw new Error("Studio image Broker must be an absolute executable path");
  const temporary = await mkdtemp(resolve(tmpdir(), "seanlab-image-broker-"));
  const requestPath = resolve(temporary, "request.json");
  const responsePath = resolve(temporary, "response.json");
  try {
    await writeFile(requestPath, `${JSON.stringify(request, null, 2)}\n`);
    await execFileAsync(brokerCommand, ["--request", requestPath, "--response", responsePath], {
      cwd: temporary,
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024,
    });
    const response = JSON.parse(await readFile(responsePath, "utf8"));
    if (response.schemaVersion !== "1.0" || typeof response.imagePath !== "string")
      throw new Error("Studio image Broker returned an invalid response");
    if (!isAbsolute(response.imagePath)) throw new Error("Studio image Broker returned an invalid image path");
    if (response.productionPath && !isAbsolute(response.productionPath))
      throw new Error("Studio image Broker returned an invalid production image path");
    const imagePath = resolve(response.imagePath);
    return recordGeneratedAsset({
      projectId: request.projectId,
      sourcePath: imagePath,
      productionPath: response.productionPath ? resolve(response.productionPath) : imagePath,
      subject: request.subject,
      beatId: request.beatId,
      templateId: request.templateId,
      prompt: request.prompt,
      negativePrompt: request.negativePrompt,
      agentId: request.agentId,
      model: response.model,
      references: request.references,
    });
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
};
