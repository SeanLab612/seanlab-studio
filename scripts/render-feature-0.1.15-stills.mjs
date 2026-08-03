import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const outputDir = resolve("out/feature-0.1.15/static-review");
const propsPath = resolve("projects/workflow-test/workspace/review-props.json");
const remotion = resolve("node_modules/.bin/remotion");
const fps = 30;

const reviews = [
  {
    id: "01-identity-ollama",
    seconds: 283.2,
    concern: "Generic local-model identity resolves to approved Ollama mark",
  },
  { id: "02-clarity-ranking", seconds: 276.8, concern: "Native compact ranking layout and effective type size" },
  {
    id: "03-clarity-tradeoff",
    seconds: 383.6,
    concern: "Native compact tradeoff layout and readable secondary labels",
  },
  {
    id: "04-caption-no-punctuation",
    seconds: 11.8,
    concern: "Pause-based bilingual captions without sentence punctuation",
  },
  { id: "05-glass-ranking", seconds: 288.4, concern: "Token-owned glass rows on bright footage" },
  { id: "06-glass-tradeoff", seconds: 372.8, concern: "Token-owned glass without whole-card opacity fading" },
  { id: "07-glass-binary", seconds: 230.4, concern: "Two-card glass comparison with token-owned borders and shadows" },
  {
    id: "08-glass-classification",
    seconds: 310.2,
    concern: "Multi-card glass hierarchy without surface opacity fading",
  },
].map((review) => ({ ...review, frame: Math.round(review.seconds * fps), file: `${review.id}.png` }));

await mkdir(outputDir, { recursive: true });

const render = async (review) => {
  const output = resolve(outputDir, review.file);
  await execFileAsync(
    remotion,
    [
      "still",
      "src/index.ts",
      "GeneratedWorkflowReview",
      output,
      "--props",
      propsPath,
      "--frame",
      String(review.frame),
      "--image-format",
      "png",
      "--log",
      "error",
    ],
    { maxBuffer: 8 * 1024 * 1024 },
  );
  return { ...review, output };
};

const rendered = [];
for (let index = 0; index < reviews.length; index += 2) {
  rendered.push(...(await Promise.all(reviews.slice(index, index + 2).map(render))));
}

const contactSheet = resolve(outputDir, "contact-sheet.png");
await execFileAsync("ffmpeg", [
  "-y",
  "-pattern_type",
  "glob",
  "-i",
  resolve(outputDir, "[0-9][0-9]-*.png"),
  "-vf",
  "scale=960:540,tile=2x4",
  "-frames:v",
  "1",
  "-update",
  "1",
  contactSheet,
]);

const manifest = {
  schemaVersion: "1.0",
  projectId: "workflow-test",
  canvas: { width: 1920, height: 1080, fps },
  sourceProps: propsPath,
  fullVideoRendered: false,
  contactSheet,
  frames: rendered,
};
await writeFile(resolve(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
await writeFile(
  resolve(outputDir, "review.md"),
  `# feature-0.1.15 static revision review\n\nNo full video was rendered. Inspect every PNG at 100% size.\n\n${rendered
    .map((item) => `- ${item.file} — ${item.concern} — ${item.seconds.toFixed(1)}s / frame ${item.frame}`)
    .join("\n")}\n`,
);
console.log(`${rendered.length} static review frames -> ${outputDir}`);
