import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { approvedComponentRegistry } from "../src/components/library/registry.ts";
import { workflowTestOverlayCues, workflowTestProps, workflowTestSubtitles } from "../src/data/workflow-test-props.ts";
import { isIconId } from "../src/icons/registry.ts";
import { validateComponentProps } from "../src/visual-brief/generator.ts";

const duration = 422.333333;
const outDir = resolve("素材/20260711-test/edit/output");
await mkdir(outDir, { recursive: true });
const errors = [];
const warnings = [];

const ordered = (items) => items.every((x, i) => i === 0 || x.start >= items[i - 1].end);
if (!ordered(workflowTestOverlayCues)) errors.push("Overlay cues overlap or are out of order.");
if (!ordered(workflowTestSubtitles)) errors.push("Subtitle cues overlap or are out of order.");
for (const cue of workflowTestOverlayCues) {
  const visual = cue.generatedVisual;
  if (!visual) {
    errors.push(`${cue.title}: missing generatedVisual`);
    continue;
  }
  if (!(visual.component.id in approvedComponentRegistry))
    errors.push(`${cue.title}: unregistered component ${visual.component.id}`);
  if (cue.start < 0 || cue.end > duration || cue.end <= cue.start) errors.push(`${cue.title}: invalid time window`);
  try {
    validateComponentProps(visual.component.id, visual.props);
  } catch (error) {
    errors.push(`${cue.title}: ${error instanceof Error ? error.message : String(error)}`);
  }
  const visit = (value, path = "props") => {
    if (Array.isArray(value)) {
      value.forEach((v, i) => {
        visit(v, `${path}[${i}]`);
      });
      return;
    }
    if (value && typeof value === "object")
      for (const [key, v] of Object.entries(value)) {
        if (key === "iconId" && typeof v === "string" && !isIconId(v))
          errors.push(`${cue.title}: invalid icon ${v} at ${path}`);
        visit(v, `${path}.${key}`);
      }
  };
  visit(visual.props);
}
for (const cue of workflowTestSubtitles) {
  if (cue.start < 0 || cue.end > duration || cue.end <= cue.start)
    errors.push(`Invalid subtitle window ${cue.start}-${cue.end}`);
  if (cue.zh.length > 38) warnings.push(`Long Chinese subtitle at ${cue.start.toFixed(2)}s (${cue.zh.length} chars)`);
  if (cue.en.length > 90) warnings.push(`Long English subtitle at ${cue.start.toFixed(2)}s (${cue.en.length} chars)`);
}
if (workflowTestProps.overlayScale > 0.8)
  warnings.push("Centered speaker requires overlayScale <= 0.80 for this source framing.");

const knownIssues = [
  "The cached ASR misheard LIMS as Limits, 流动相 as 流动向/流动项, 基线稳定 as 机械稳定, and Gemini as Gemlight.",
  "The first test render incorrectly used hand-authored semantic summaries as captions; production captions must be generated verbatim from kept transcript words after rough cutting.",
  "The first draft test-pipeline mapped approved components back to four legacy metaphors and referenced invalid icon ids.",
  "The speaker is centered, so the default 740px component width would overlap the face; this test uses a 0.78 overlay scale.",
  "The recording ends after the tradeoff section, so 11 of 18 semantic components are exercised in this run.",
  "English captions are human-authored concise translations rather than generated from a production translation service.",
  "The first full render exposed a fallback-state bug: the intro title reappeared in gaps between cues and after the final cue. The runtime now limits fallback content to the pre-overlay intro.",
];
const componentCounts = Object.fromEntries(
  workflowTestOverlayCues.map((cue) => [
    cue.generatedVisual.component.id,
    workflowTestOverlayCues.filter((x) => x.generatedVisual.component.id === cue.generatedVisual.component.id).length,
  ]),
);
const report = `# Workflow Test Report — 2026-07-11\n\n## Input\n\n- Source duration: ${duration.toFixed(2)}s\n- Source: 3840×2160 @ 30fps, AAC stereo\n- Proxy: 1920×1080 @ 30fps\n- Transcript: cached ElevenLabs Scribe word-level JSON, source hash verified\n\n## Planned coverage\n\n- Overlay cues: ${workflowTestOverlayCues.length}\n- Subtitle cues: ${workflowTestSubtitles.length}\n- Unique semantic components: ${Object.keys(componentCounts).length}\n- Components: ${Object.keys(componentCounts).join(", ")}\n\n## Known issues captured before render\n\n${knownIssues.map((x, i) => `${i + 1}. ${x}`).join("\n")}\n\n## Automated validation\n\n- Errors: ${errors.length}\n- Warnings: ${warnings.length}\n${errors.map((x) => `- ERROR: ${x}`).join("\n")}\n${warnings.map((x) => `- WARNING: ${x}`).join("\n")}\n\n## Render QA\n\nPending static frame and full-render inspection.\n`;
await writeFile(
  resolve(outDir, "visual-briefs-v2.json"),
  JSON.stringify(
    workflowTestOverlayCues.map((cue) => cue.generatedVisual),
    null,
    2,
  ),
);
await writeFile(
  resolve(outDir, "workflow-test-props-summary.json"),
  JSON.stringify(
    {
      videoSrc: workflowTestProps.videoSrc,
      overlayScale: workflowTestProps.overlayScale,
      overlayCues: workflowTestOverlayCues,
      subtitleCues: workflowTestSubtitles,
    },
    null,
    2,
  ),
);
await writeFile(resolve("素材/20260711-test/edit/workflow-test-report.md"), report);
if (errors.length) throw new Error(errors.join("\n"));
console.log(
  `workflow test plan -> ${workflowTestOverlayCues.length} overlays / ${workflowTestSubtitles.length} subtitle cues`,
);
console.log(`workflow test plan -> ${Object.keys(componentCounts).length} unique approved components`);
console.log(`workflow test validation -> ${errors.length} errors / ${warnings.length} warnings`);
