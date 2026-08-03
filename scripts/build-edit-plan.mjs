import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { materializeRecutPlan } from "../src/workflow/recut.ts";

const configPath = resolve(process.argv[2] ?? "config/workflow-test.json");
const config = JSON.parse(await readFile(configPath, "utf8"));
const transcript = JSON.parse(await readFile(resolve(config.transcript), "utf8"));
const version = config.editPolicy?.version ?? "1.0";

const writeJson = async (path, value) => {
  await mkdir(dirname(resolve(path)), { recursive: true });
  await writeFile(resolve(path), `${JSON.stringify(value, null, 2)}\n`);
};

if (version !== "2.0") {
  const words = transcript.words.filter((word) => word.type === "word");
  const first = words[0].start;
  const last = words.at(-1).end;
  const cutPoints = [];
  for (let index = 1; index < words.length; index++) {
    const gap = words[index].start - words[index - 1].end;
    if (gap >= config.minimumCompressedGapSeconds) {
      const half = config.keptGapSeconds / 2;
      cutPoints.push({
        start: words[index - 1].end + half,
        end: words[index].start - half,
        reason: `压缩${gap.toFixed(2)}秒停顿`,
      });
    }
  }
  const removals = [...cutPoints, ...config.manualRemovals].sort((a, b) => a.start - b.start);
  const merged = [];
  for (const removal of removals) {
    const previous = merged.at(-1);
    if (previous && removal.start <= previous.end) previous.end = Math.max(previous.end, removal.end);
    else merged.push({ ...removal });
  }
  const ranges = [];
  let cursor = Math.max(0, first - 0.05);
  for (const removal of merged) {
    if (removal.start > cursor + 0.1)
      ranges.push({ source: "main", start: cursor, end: removal.start, beat: "KEEP", reason: "保留有效口播" });
    cursor = Math.max(cursor, removal.end);
  }
  if (cursor < last + 0.08)
    ranges.push({ source: "main", start: cursor, end: last + 0.08, beat: "KEEP", reason: "保留有效口播" });
  let offset = 0;
  for (const range of ranges) {
    range.outputStart = offset;
    offset += range.end - range.start;
    range.outputEnd = offset;
  }
  const edl = {
    version: 1,
    sources: { main: resolve(config.source) },
    ranges,
    removals: merged,
    grade: "none",
    totalDurationS: offset,
  };
  const output = resolve(config.editDir, "edl.json");
  await writeJson(output, edl);
  console.log(`${output}: ${ranges.length} ranges, ${offset.toFixed(2)}s`);
  process.exit(0);
}

const providerPlan = JSON.parse(await readFile(resolve(config.recutProviderPlanFile), "utf8"));
let authoredScenePlan;
if (config.authoredScenePlanFile)
  authoredScenePlan = JSON.parse(await readFile(resolve(config.authoredScenePlanFile), "utf8"));
const result = materializeRecutPlan({
  transcript,
  providerPlan,
  policy: config.editPolicy,
  authoredScenePlan,
});
const proposedEdl = {
  version: 2,
  strategy: "conservative-intelligent-recut-2.0",
  sources: { main: resolve(config.source) },
  ranges: result.ranges,
  removals: result.removals,
  grade: "none",
  totalDurationS: result.summary.proposedDurationSeconds,
};
const candidateReview = {
  schemaVersion: "2.0",
  generatedAt: new Date().toISOString(),
  projectId: config.projectId,
  status: "proposed",
  policy: {
    minimumCompressedGapSeconds: config.editPolicy.minimumCompressedGapSeconds,
    keptGapSeconds: config.editPolicy.keptGapSeconds,
    minimumCandidateConfidence: config.editPolicy.minimumCandidateConfidence,
    minimumBoundarySilenceSeconds: config.editPolicy.minimumBoundarySilenceSeconds,
    maximumCandidateSeconds: config.editPolicy.maximumCandidateSeconds,
  },
  summary: result.summary,
  protectedRanges: result.protectedRanges,
  unresolvedProtectedAnchors: result.unresolvedProtectedAnchors,
  candidates: result.candidates,
  removals: result.removals,
};
await writeJson(config.proposedEdlFile, proposedEdl);
await writeJson(config.recutCandidatesFile, candidateReview);
const table = result.candidates.map(
  (candidate) =>
    `| ${candidate.id} | ${candidate.kind} | ${candidate.start.toFixed(2)}-${candidate.end.toFixed(2)}s | ${candidate.confidence.toFixed(2)} | ${candidate.disposition} | ${String(candidate.quote).replaceAll("|", "\\|")} |`,
);
await writeFile(
  resolve(config.recutReviewFile),
  [
    "# Conservative intelligent recut 2.0",
    "",
    `- Speech words: ${result.summary.speechWords}`,
    `- Candidates: ${result.summary.candidateCount}`,
    `- Proposed removals: ${result.summary.removalCount}`,
    `- Original speech window: ${result.summary.originalDurationSeconds.toFixed(2)}s`,
    `- Proposed duration: ${result.summary.proposedDurationSeconds.toFixed(2)}s`,
    `- Proposed savings: ${result.summary.proposedSavingsSeconds.toFixed(2)}s`,
    `- Protected anchors: ${result.protectedRanges.length}`,
    `- Unresolved protected anchors: ${result.unresolvedProtectedAnchors.length}`,
    "",
    "| Candidate | Kind | Source range | Confidence | Disposition | Evidence |",
    "| --- | --- | ---: | ---: | --- | --- |",
    ...table,
    "",
    "Only `recommended` candidates are present in the proposed EDL. Approval promotes the exact reviewed EDL; it does not rerun Codex.",
    "",
  ].join("\n"),
);
console.log(
  `${config.proposedEdlFile}: ${result.summary.removalCount} removals, ${result.summary.proposedDurationSeconds.toFixed(2)}s, save ${result.summary.proposedSavingsSeconds.toFixed(2)}s`,
);
