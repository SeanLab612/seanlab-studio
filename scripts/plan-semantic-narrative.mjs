import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createStructuredAgentJsonAdapter, isStructuredAgentProvider } from "./workflow/agent-json-adapter.mjs";
import {
  createSemanticNarrativePrompt,
  isSemanticPlanValidationError,
  normalizeSemanticItemOrder,
  parseSemanticNarrativePlan,
  semanticValidationRepairInstruction,
} from "../src/semantic-planning/index.ts";

const config = JSON.parse(await readFile(resolve(process.argv[2]), "utf8"));
const semanticConfig = config.semanticPlanning;
if (!isStructuredAgentProvider(semanticConfig?.provider))
  throw new Error("plan-semantic-narrative requires semanticPlanning.provider=codex-cli or claude-code");
const semanticCaptions = JSON.parse(await readFile(resolve(config.semanticCaptionsFile), "utf8"));
const terminologyProfile = config.terminologyProfileFile
  ? JSON.parse(await readFile(resolve(config.terminologyProfileFile), "utf8"))
  : undefined;
const imageEvidence = config.imageEvidenceManifestFile
  ? (JSON.parse(await readFile(resolve(config.imageEvidenceManifestFile), "utf8")).assets ?? []).filter(
      (asset) => !asset.sourceLabel?.startsWith("动画素材库 · "),
    )
  : [];
const supplementalMedia = config.supplementalMediaManifestFile
  ? (JSON.parse(await readFile(resolve(config.supplementalMediaManifestFile), "utf8")).assets ?? [])
  : [];
const authoredVisualPlan = config.authoredVisualPlanFile
  ? JSON.parse(await readFile(resolve(config.authoredVisualPlanFile), "utf8"))
  : { beats: [] };
const referenceVisualBeats = (authoredVisualPlan.beats ?? [])
  .filter((beat) => beat.status === "confirmed" && beat.executionPolicy === "reference")
  .map((beat) => ({
    id: beat.id,
    sectionId: beat.sectionId,
    exactSpokenQuote: beat.exactSpokenQuote,
    primaryVisualType: beat.primaryVisualType,
    ...(beat.materialAssetIds?.length
      ? { materialAssetIds: beat.materialAssetIds }
      : beat.materialAssetId
        ? { materialAssetIds: [beat.materialAssetId] }
        : {}),
    ...(beat.animationIntent
      ? {
          animationPrototypeId: beat.animationIntent.prototypeId,
          animationStyleProfileId: beat.animationIntent.styleProfileId,
        }
      : {}),
  }));
const adapter = createStructuredAgentJsonAdapter({
  config: semanticConfig,
  schemaPath: resolve("schemas/semantic-narrative-plan.schema.json"),
});
const supplementalMediaInventory = supplementalMedia.map((asset) => ({
  id: asset.id,
  role: asset.role,
  ...(Number.isFinite(asset.durationSeconds) ? { durationSeconds: asset.durationSeconds } : {}),
}));
const prompt = createSemanticNarrativePrompt(
  semanticCaptions,
  terminologyProfile,
  imageEvidence,
  referenceVisualBeats,
  supplementalMediaInventory,
);
const availableMaterialIds = new Set([
  ...imageEvidence.map((asset) => asset.id),
  ...supplementalMediaInventory.map((asset) => asset.id),
]);
let narrativePlan;
let validationError;
let validationRepair = "";
const maximumSegmentSeconds = Number(semanticConfig.maximumSegmentSeconds ?? 24);
for (let attempt = 0; attempt < 3; attempt += 1) {
  const repairPrompt =
    attempt === 0
      ? prompt
      : {
          ...prompt,
          system: `${prompt.system}\nYour previous schema-valid plan failed the workflow semantic validation: ${validationError}. Return a corrected complete plan. Every segment must contain at most 10 cues and span at most ${maximumSegmentSeconds} seconds. ${validationRepair || "Correct the reported validation issue at complete caption boundaries."} Do not keep the invalid range, merely shorten it, overlap replacements, or reuse one generic narrative across the replacement segments.`,
        };
  const rawPlan = await adapter.completeJson(repairPrompt);
  const normalizedPlan = normalizeSemanticItemOrder(rawPlan);
  try {
    narrativePlan = parseSemanticNarrativePlan(
      normalizedPlan,
      semanticCaptions,
      maximumSegmentSeconds,
      referenceVisualBeats,
      Number(config.visualDirection?.minimumVisualCoverageRatio ?? 0),
      availableMaterialIds,
    );
    break;
  } catch (error) {
    validationError = error instanceof Error ? error.message : String(error);
    const validationIssue = isSemanticPlanValidationError(error) ? error.issue : undefined;
    validationRepair = semanticValidationRepairInstruction(
      normalizedPlan,
      semanticCaptions,
      maximumSegmentSeconds,
      validationIssue,
    );
    console.error(
      JSON.stringify({
        event: "semantic-plan.validation-failed",
        attempt: attempt + 1,
        issue: validationIssue ?? { kind: "unclassified", message: validationError },
        repairInstruction: validationRepair || null,
      }),
    );
  }
}
if (!narrativePlan) throw new Error(`Agent semantic plan remained invalid after repair: ${validationError}`);
const hash = (value) =>
  createHash("sha256")
    .update(typeof value === "string" ? value : JSON.stringify(value))
    .digest("hex");
const schema = await readFile(resolve("schemas/semantic-narrative-plan.schema.json"), "utf8");
await writeFile(config.semanticNarrativePlanFile, `${JSON.stringify(narrativePlan, null, 2)}\n`);
await writeFile(
  config.semanticProviderReportFile,
  `${JSON.stringify(
    {
      schemaVersion: "1.0",
      generatedAt: new Date().toISOString(),
      agentId: semanticConfig.provider,
      contractVersion: "semantic-narrative-1.1",
      schemaVersionHash: hash(schema),
      promptHash: hash(prompt),
      inputHash: hash({
        semanticCaptions,
        terminologyProfile,
        imageEvidence,
        referenceVisualBeats,
        supplementalMediaInventory,
      }),
      outputHash: hash(narrativePlan),
      runtimeVersion: process.version,
      generation: {
        timeoutSeconds: semanticConfig.timeoutSeconds ?? 300,
        maxRetries: semanticConfig.maxRetries ?? 1,
        model: semanticConfig.model ?? "unknown",
        profile: semanticConfig.profile ?? null,
        deterministicSeed: null,
      },
      ...adapter.getLastRunMetadata(),
      captionCount: semanticCaptions.length,
      plannedSegmentCount: narrativePlan.segments.length,
    },
    null,
    2,
  )}\n`,
);
console.log(`${narrativePlan.segments.length} full-transcript semantic intents`);
