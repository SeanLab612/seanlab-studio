import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createStructuredAgentJsonAdapter, isStructuredAgentProvider } from "./workflow/agent-json-adapter.mjs";

const config = JSON.parse(await readFile(resolve(process.argv[2]), "utf8"));
const agentConfig = config.productionReview ?? config.semanticPlanning;
if (!isStructuredAgentProvider(agentConfig?.provider))
  throw new Error("production Agent review requires codex-cli or claude-code");

const [authoredPlan, directionPlan, reviewEvidence, qaReport, regressionReport] = await Promise.all([
  readJson(config.authoredVisualPlanFile),
  readJson(config.visualDirectionPlanFile),
  readJson(config.reviewEvidenceFile),
  readJson(resolve(config.editDir, "visual-qa/qa-report.json")),
  readJson(config.regression.reportFile),
]);
const allowedBeats = (authoredPlan.beats ?? [])
  .filter((beat) => beat.primaryVisualType === "component")
  .map((beat) => ({
    id: beat.id,
    sectionId: beat.sectionId,
    exactSpokenQuote: beat.exactSpokenQuote,
    componentId: beat.componentId ?? null,
  }));
const adapter = createStructuredAgentJsonAdapter({
  config: { ...agentConfig, maxRetries: 0 },
  schemaPath: resolve("schemas/production-agent-review.schema.json"),
});
const prompt = {
  system: [
    "You are the independent final self-review pass for an open-source video production Agent.",
    "Review only the supplied rendered contact sheet and frozen evidence. Do not invent defects from absent information.",
    "The first sheet covers every stable visual type; the second is the dedicated title continuity sheet. Inspect both.",
    "Duplicated titles, overlapping text layers, cropped titles, text outside the safe area, or title/subtitle collisions are blocking QA failures and must never be passed.",
    "Return passed when the rendered result is coherent, readable, source-grounded, and has no obvious broken or misleading confirmed component.",
    "Return revise only for one blocking confirmed component that should safely fall back to the speaker shot.",
    "targetBeatId must be one id from allowedComponentBeats. Never request changes to narration, captions, source footage, user decisions, approvals, or repository configuration.",
    "Aesthetic preference and optional polish are not blocking defects. Return concise Simplified Chinese matching the schema.",
  ].join("\n"),
  user: [
    "请独立复核这份已经通过确定性 QA 的制作结果。普通用户之后只负责审核成片，不负责排查技术错误。",
    JSON.stringify(
      {
        allowedComponentBeats: allowedBeats,
        visualDirection: directionPlan,
        reviewSummary: reviewEvidence.summary,
        qa: { status: reviewEvidence.qaStatus, summary: qaReport.summary, findings: qaReport.findings ?? [] },
        regression: { status: regressionReport.status, summary: regressionReport.summary ?? null },
      },
      null,
      2,
    ),
    "若没有一个明确且阻断审核的组件问题，status 必须为 passed、targetBeatId 必须为 null、action 必须为 none。",
  ].join("\n\n"),
  imagePaths: [
    resolve(config.editDir, "visual-qa/contact-sheet.png"),
    resolve(config.editDir, "visual-qa/title-continuity-contact-sheet.png"),
  ],
};
const response = await adapter.completeJson(prompt);
if (response.status === "passed") {
  if (response.targetBeatId !== null || response.action !== "none")
    throw new Error("Production Agent review returned an invalid passed decision");
} else {
  if (response.action !== "speaker-fallback" || !allowedBeats.some(({ id }) => id === response.targetBeatId))
    throw new Error("Production Agent review selected a visual outside the safe fallback allowlist");
}

const report = {
  schemaVersion: "1.0",
  kind: "production-agent-review",
  createdAt: new Date().toISOString(),
  status: response.status,
  decision: response,
  reviewedInputsSha256: sha256({ authoredPlan, directionPlan, reviewEvidence, qaReport, regressionReport }),
  provider: adapter.getLastRunMetadata(),
};
await mkdir(dirname(resolve(config.productionAgentReviewFile)), { recursive: true });
await writeFile(resolve(config.productionAgentReviewFile), `${JSON.stringify(report, null, 2)}\n`);
if (response.status === "revise") {
  console.error(
    `Production Agent self-review requested speaker fallback for confirmed component beat: ${response.targetBeatId}`,
  );
  process.exitCode = 1;
} else {
  console.log("Production Agent self-review passed");
}

async function readJson(path) {
  return JSON.parse(await readFile(resolve(path), "utf8"));
}

function sha256(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
