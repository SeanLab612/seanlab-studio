import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { buildReviewEvidence } from "./operations/review-evidence.mjs";
import { validateArtifactSchema } from "./operations/artifact-schema.mjs";

const config = JSON.parse(await readFile(resolve(process.argv[2]), "utf8"));
const evidence = await buildReviewEvidence({ config });
await validateArtifactSchema({
  schemaPath: "schemas/review-evidence.schema.json",
  artifact: evidence,
  label: "Review evidence",
});
const summary = [
  "# Static review evidence",
  "",
  `- Mode: ${evidence.reviewMode}`,
  `- Semantic components: ${evidence.summary.semanticComponents}`,
  `- Authored screen scenes: ${evidence.summary.authoredScreenScenes ?? 0}`,
  `- Title continuity cues: ${evidence.summary.titleContinuityCues ?? 0}`,
  `- Total visual groups: ${evidence.summary.visualGroups ?? 0}`,
  `- Risk frames: ${evidence.summary.riskFrames}`,
  `- Speaker-only frames: ${evidence.summary.speakerOnlyFrames}`,
  `- QA: ${evidence.qaStatus} (${evidence.summary.qaErrors} errors, ${evidence.summary.qaWarnings} warnings)`,
  `- Full review video included: ${evidence.summary.fullReviewVideoIncluded ? "yes" : "no"}`,
  `- Continuous 720p visual pacing review included: ${evidence.summary.visualPacingReviewIncluded ? "yes" : "no"}`,
  `- Conditional motion-risk excerpt included: ${evidence.summary.motionRiskReviewIncluded ? "yes" : "no"}`,
  `- Intelligent recut: ${evidence.summary.recutEnabled ? "enabled" : "legacy"}`,
  `- Recut candidates/removals: ${evidence.summary.recutCandidates ?? 0}/${evidence.summary.recutRemovals ?? 0}`,
  `- Recut time saved: ${Number(evidence.summary.recutSavingsSeconds ?? 0).toFixed(2)}s`,
  `- Continuous recut preview included: ${evidence.summary.recutPreviewIncluded ? "yes" : "no"}`,
  `- Legacy project bumper: ${evidence.summary.brandEnabled ? "enabled" : "disabled"}`,
  `- Audio-bearing bumper/transition previews: ${evidence.summary.brandTransitionPreviewIncluded ? "included" : "not included"}`,
  `- Approval binding: ${evidence.approvalBindingSha256}`,
  "",
  "Human approval binds every listed frame, the contact sheet, render props, direction plan, and QA report.",
  "",
].join("\n");
await mkdir(dirname(resolve(config.reviewEvidenceFile)), { recursive: true });
await writeFile(resolve(config.reviewEvidenceFile), `${JSON.stringify(evidence, null, 2)}\n`);
await writeFile(resolve(config.reviewEvidenceSummaryFile), summary);
console.log(`${config.reviewEvidenceFile}: ${evidence.reviewMode}, ${evidence.summary.riskFrames} frames`);
