import { createHash } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createRecutPlanningPrompt, parseRecutProviderPlan } from "../src/recut-planning/index.ts";
import { createStructuredAgentJsonAdapter, isStructuredAgentProvider } from "./workflow/agent-json-adapter.mjs";

const config = JSON.parse(await readFile(resolve(process.argv[2]), "utf8"));
const transcript = JSON.parse(await readFile(resolve(config.transcript), "utf8"));
const providerConfig = config.recutPlanning;
if (!providerConfig || (!isStructuredAgentProvider(providerConfig.provider) && providerConfig.provider !== "fixture"))
  throw new Error("recut planning requires recutPlanning.provider=codex-cli, claude-code, or fixture");
const reviewFeedback = process.env.REMOTION_MD_RECUT_REVIEW_FEEDBACK?.trim() ?? "";
const prompt = createRecutPlanningPrompt(transcript, { reviewFeedback });
let rawPlan;
let metadata;
if (providerConfig.provider === "fixture") {
  if (!providerConfig.fixtureFile) throw new Error("fixture recut planning requires fixtureFile");
  rawPlan = JSON.parse(await readFile(resolve(providerConfig.fixtureFile), "utf8"));
  metadata = { provider: "fixture", fixtureFile: resolve(providerConfig.fixtureFile) };
} else {
  const adapter = createStructuredAgentJsonAdapter({
    config: providerConfig,
    schemaPath: resolve("schemas/recut-provider-plan.schema.json"),
  });
  rawPlan = await adapter.completeJson(prompt);
  metadata = adapter.getLastRunMetadata();
}
const plan = parseRecutProviderPlan(rawPlan, transcript);
const hash = (value) =>
  createHash("sha256")
    .update(typeof value === "string" ? value : JSON.stringify(value))
    .digest("hex");
const schema = await readFile(resolve("schemas/recut-provider-plan.schema.json"), "utf8");
const report = {
  schemaVersion: "1.0",
  generatedAt: new Date().toISOString(),
  contractVersion: "conservative-recut-2.0",
  schemaVersionHash: hash(schema),
  promptHash: hash(prompt),
  inputHash: hash(transcript),
  outputHash: hash(plan),
  runtimeVersion: process.version,
  generation: {
    timeoutSeconds: providerConfig.timeoutSeconds ?? 300,
    maxRetries: providerConfig.maxRetries ?? 1,
    model: providerConfig.model ?? "unknown",
    deterministicSeed: null,
  },
  ...metadata,
  reviewFeedbackApplied: Boolean(reviewFeedback),
  reviewFeedbackHash: reviewFeedback ? hash(reviewFeedback) : null,
  candidateCount: plan.candidates.length,
};
const planPath = resolve(config.recutProviderPlanFile);
const reportPath = resolve(config.recutProviderReportFile);
const suffix = `.tmp-${process.pid}`;
await writeFile(`${planPath}${suffix}`, `${JSON.stringify(plan, null, 2)}\n`);
await writeFile(`${reportPath}${suffix}`, `${JSON.stringify(report, null, 2)}\n`);
await rename(`${planPath}${suffix}`, planPath);
await rename(`${reportPath}${suffix}`, reportPath);
console.log(`${planPath}: ${plan.candidates.length} conservative recut candidates`);
