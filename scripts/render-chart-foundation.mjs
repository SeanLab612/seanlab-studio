import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { CHART_RECIPE_IDS } from "../src/charts/types.ts";

const run = promisify(execFile);
const outputDir = "out/chart-foundation-reviews";
const framesDir = `${outputDir}/risk-frames`;
await mkdir(framesDir, { recursive: true });
const phases = [
  { phase: "entry", frame: 8 },
  { phase: "transition", frame: 30 },
  { phase: "stable", frame: 120 },
  { phase: "exit-risk", frame: 225 },
];
const compositionId = (recipeId) =>
  `ReviewChart${recipeId
    .split("-")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("")}`;
const jobs = CHART_RECIPE_IDS.flatMap((recipeId) =>
  phases.map(({ phase, frame }) => ({
    id: compositionId(recipeId),
    recipeId,
    phase,
    frame,
    file: `${framesDir}/${recipeId}-${phase}.png`,
  })),
);
let cursor = 0;
const worker = async () => {
  while (cursor < jobs.length) {
    const index = cursor++;
    const job = jobs[index];
    await run("npx", ["remotion", "still", "src/index.ts", job.id, job.file, "--frame", String(job.frame)], {
      maxBuffer: 20 * 1024 * 1024,
    });
    console.log(`${index + 1}/${jobs.length} ${job.recipeId} ${job.phase}`);
  }
};
await Promise.all([worker(), worker(), worker()]);
await run(
  "npx",
  ["remotion", "still", "src/index.ts", "ReviewChartConnection", `${outputDir}/chart-connection.png`, "--frame", "180"],
  { maxBuffer: 20 * 1024 * 1024 },
);
await writeFile(
  `${outputDir}/risk-frame-manifest.json`,
  `${JSON.stringify({ schemaVersion: "1.0", canvas: { width: 1920, height: 1080 }, frames: jobs }, null, 2)}\n`,
);
await run("python3", ["scripts/chart_review_qa.py", outputDir], { maxBuffer: 20 * 1024 * 1024 });
await run(
  "npx",
  [
    "remotion",
    "render",
    "src/index.ts",
    "ReviewChartFoundationMvp",
    `${outputDir}/chart-foundation-mvp.mp4`,
    "--codec",
    "h264",
    "--crf",
    "18",
  ],
  { maxBuffer: 30 * 1024 * 1024 },
);
console.log(`${outputDir}/chart-foundation-mvp.mp4`);
