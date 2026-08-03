import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildCaptionChannels } from "../src/workflow/captions.ts";
import { conformEnglishTermsToLockedScript } from "../src/workflow/transcript-conformance.ts";

const config = JSON.parse(await readFile(resolve(process.argv[2] ?? "config/workflow-test.json"), "utf8"));
const transcript = JSON.parse(await readFile(resolve(config.transcript), "utf8"));
let lockedScript;
if (config.referenceScript) {
  try {
    lockedScript = await readFile(resolve(config.referenceScript), "utf8");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}
const captionTranscript = conformEnglishTermsToLockedScript(transcript.words, lockedScript);
const edl = JSON.parse(await readFile(resolve(config.editDir, "edl.json"), "utf8"));
const terminologyProfile = config.terminologyProfileFile
  ? JSON.parse(await readFile(resolve(config.terminologyProfileFile), "utf8"))
  : undefined;
const brandTimeline = config.brandEnabled
  ? JSON.parse(await readFile(resolve(config.brandTimelineFile), "utf8"))
  : undefined;
const insertions =
  brandTimeline?.status === "resolved"
    ? [{ at: brandTimeline.speechTimeSeconds, duration: brandTimeline.durationSeconds }]
    : [];
const { semantic, display } = buildCaptionChannels(
  captionTranscript.words,
  edl.ranges,
  terminologyProfile,
  {
    ...config.captionSegmentation,
    displayPunctuation: config.captionDisplayPunctuation ?? "none",
  },
  insertions,
);
if (captionTranscript.changes.length)
  console.log(`Caption English-name conformance: ${captionTranscript.changes.length} correction(s).`);
const timestamp = (seconds) => {
  const ms = Math.round(seconds * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const tail = ms % 1000;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(tail).padStart(3, "0")}`;
};
const srt = display
  .map((cue, index) => `${index + 1}\n${timestamp(cue.start)} --> ${timestamp(cue.end)}\n${cue.zh}\n`)
  .join("\n");
await writeFile(
  resolve(config.captionSourceFile ?? `${config.editDir}/captions-verbatim.json`),
  `${JSON.stringify(display, null, 2)}\n`,
);
await writeFile(
  resolve(config.semanticCaptionSourceFile ?? `${config.editDir}/captions-semantic.source.json`),
  `${JSON.stringify(semantic, null, 2)}\n`,
);
await writeFile(resolve(config.captionSrtFile ?? `${config.editDir}/captions-verbatim.srt`), srt);
console.log(`${display.length} display cues and ${semantic.length} punctuation-preserving semantic cues`);
