import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { readManifest } from "./workflow/manifest.mjs";

const execFileAsync = promisify(execFile);
const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const project = option("--project");
if (!project) throw new Error("Usage: npm run direction:stills -- --project projects/<id>/project.json");
const context = await readManifest(project);
const media = JSON.parse(await readFile(resolve(context.paths.workspace, "media-manifest.json"), "utf8"));
const direction = JSON.parse(await readFile(context.paths.visualDirectionPlan, "utf8"));
const fps = media.fps;
if (!(fps > 0)) throw new Error("media-manifest.json must contain a positive source fps");
const outputDir = resolve(context.paths.workspace, "direction-review/stills");
const remotion = resolve("node_modules/.bin/remotion");
await mkdir(outputDir, { recursive: true });

const reviews = direction.decisions.map((decision, index) => {
  const start = decision.action === "show" ? decision.displayStart : decision.sourceStart;
  const end = decision.action === "show" ? decision.displayEnd : decision.sourceEnd;
  const seconds =
    decision.action === "show" ? Math.min(end - 0.4, start + Math.min(6, (end - start) * 0.55)) : (start + end) / 2;
  return {
    id: decision.candidateId,
    action: decision.action,
    importance: decision.importance,
    componentId: decision.componentId,
    seconds,
    frame: Math.max(0, Math.round(seconds * fps)),
    file: `${String(index + 1).padStart(2, "0")}-${decision.action}-${decision.candidateId}.png`,
    reason: decision.reasons.at(-1),
  };
});

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
      context.paths.reviewProps,
      "--frame",
      String(review.frame),
      "--image-format",
      "png",
      "--log",
      "error",
    ],
    { maxBuffer: 12 * 1024 * 1024 },
  );
  return { ...review, output };
};

const rendered = [];
for (let index = 0; index < reviews.length; index += 2)
  rendered.push(...(await Promise.all(reviews.slice(index, index + 2).map(render))));

const columns = 4;
const rows = Math.ceil(rendered.length / columns);
const contactSheet = resolve(context.paths.workspace, "direction-review/contact-sheet.png");
await execFileAsync("ffmpeg", [
  "-y",
  "-pattern_type",
  "glob",
  "-i",
  resolve(outputDir, "[0-9][0-9]-*.png"),
  "-vf",
  `scale=640:360,tile=${columns}x${rows}`,
  "-frames:v",
  "1",
  "-update",
  "1",
  contactSheet,
]);
const manifest = {
  schemaVersion: "1.0",
  projectId: context.manifest.project.id,
  canvas: { width: 1920, height: 1080, fps },
  sourceProps: context.paths.reviewProps,
  directionPlan: context.paths.visualDirectionPlan,
  fullVideoRendered: false,
  contactSheet,
  frames: rendered,
};
await writeFile(
  resolve(context.paths.workspace, "direction-review/manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
await writeFile(
  resolve(context.paths.workspace, "direction-review/review.md"),
  `# Whole-video direction static review\n\nNo full video was rendered. Show decisions display a stable component state; skip decisions verify speaker-only breathing.\n\n${rendered
    .map(
      (item) =>
        `- ${item.file} — ${item.action}/${item.importance} — ${item.componentId ?? "speaker-only"} — ${item.seconds.toFixed(1)}s / frame ${item.frame} — ${item.reason ?? ""}`,
    )
    .join("\n")}\n`,
);
console.log(`${rendered.length} visual-direction frames -> ${contactSheet}`);
