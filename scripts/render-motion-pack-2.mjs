import { execFile } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { promisify } from "node:util";

const run = promisify(execFile);
const outputDir = "out/motion-pack-2-reviews";
await mkdir(outputDir, { recursive: true });

const stills = [
  ["ReviewRealMotionStateMorph", "state-morph.png", "110"],
  ["ReviewRealMotionFlipReorder", "flip-reorder.png", "110"],
  ["ReviewRealMotionSpringSettle", "spring-settle.png", "110"],
  ["ReviewRealMotionShimmer", "shimmer.png", "48"],
  ["ReviewRealMotionOrbitAssemble", "orbit-assemble.png", "110"],
  ["ReviewRealMotionCardFlip3d", "card-flip-3d.png", "110"],
];

for (const [composition, filename, frame] of stills) {
  await run("npx", ["remotion", "still", "src/index.ts", composition, `${outputDir}/${filename}`, "--frame", frame], {
    maxBuffer: 20 * 1024 * 1024,
  });
  console.log(filename);
}

await run(
  "npx",
  [
    "remotion",
    "render",
    "src/index.ts",
    "ReviewRealMotionPack2Mvp",
    `${outputDir}/motion-pack-2-mvp.mp4`,
    "--codec",
    "h264",
    "--crf",
    "20",
  ],
  { maxBuffer: 30 * 1024 * 1024 },
);
console.log(`${outputDir}/motion-pack-2-mvp.mp4`);
