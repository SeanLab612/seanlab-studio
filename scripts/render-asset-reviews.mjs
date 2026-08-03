import { execFile } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { promisify } from "node:util";

const run = promisify(execFile);
const outputDir = "out/asset-library-reviews";
await mkdir(outputDir, { recursive: true });

const stills = [
  ["ReviewDesignTokenLibrary", "design-tokens.png", "180"],
  ["ReviewMotionPrimitiveLibrary", "motion-primitives.png", "270"],
  ["ReviewLayoutFixtureMatrix", "layout-fixture-matrix.png", "180"],
  ["ReviewLayoutSpeakerCenterLeft", "layout-speaker-center-left.png", "180"],
  ["ReviewLayoutSpeakerCenterRight", "layout-speaker-center-right.png", "180"],
  ["ReviewLayoutSpeakerLeftOverlayRight", "layout-speaker-left-overlay-right.png", "180"],
  ["ReviewLayoutSpeakerRightOverlayLeft", "layout-speaker-right-overlay-left.png", "180"],
  ["ReviewLayoutBilateralComparison", "layout-bilateral-comparison.png", "180"],
  ["ReviewLayoutMediaEvidence", "layout-media-evidence.png", "180"],
  ["ReviewMigratedDistributionBars", "migration-distribution-bars.png", "180"],
  ["ReviewMigratedProcessSteps", "migration-process-steps.png", "180"],
  ["ReviewMigratedHistoricalTimeline", "migration-historical-timeline.png", "180"],
];

let cursor = 0;
const worker = async () => {
  while (cursor < stills.length) {
    const index = cursor++;
    const [composition, filename, frame] = stills[index];
    await run("npx", ["remotion", "still", "src/index.ts", composition, `${outputDir}/${filename}`, "--frame", frame], {
      maxBuffer: 20 * 1024 * 1024,
    });
    console.log(`${index + 1}/${stills.length} ${filename}`);
  }
};

await Promise.all([worker(), worker(), worker()]);
await run(
  "npx",
  [
    "remotion",
    "render",
    "src/index.ts",
    "ReviewMotionPrimitiveLibrary",
    `${outputDir}/motion-primitives-mvp.mp4`,
    "--codec",
    "h264",
    "--crf",
    "20",
  ],
  { maxBuffer: 30 * 1024 * 1024 },
);
console.log(`${outputDir}/motion-primitives-mvp.mp4`);
