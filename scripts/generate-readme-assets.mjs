import { execFile } from "node:child_process";
import { copyFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const remotion = resolve("node_modules/.bin/remotion");
const reviewDir = resolve("out/component-data-borderless-review");
const animationDir = resolve(reviewDir, "animations");
const docsDir = resolve("docs/assets");

await mkdir(animationDir, { recursive: true });
await mkdir(docsDir, { recursive: true });

await run(
  process.execPath,
  ["scripts/render-component-data-static-review.mjs", "--background", "review-assets/readme-blank-background.svg"],
  { maxBuffer: 24 * 1024 * 1024 },
);

const animationCases = [
  ["paper-editorial", "AnimationTemplatePreview", 165],
  ["stop-motion-machine", "StopMotionTemplatePreview", 165],
  ["research-archive", "ResearchArchiveTemplatePreview", 165],
];

for (const [id, composition, frame] of animationCases) {
  await run(
    remotion,
    [
      "still",
      "src/index.ts",
      composition,
      resolve(animationDir, `${id}.png`),
      "--frame",
      String(frame),
      "--image-format",
      "png",
      "--log",
      "error",
    ],
    { maxBuffer: 16 * 1024 * 1024 },
  );
}

await run("python3", ["scripts/static_component_data_contact_sheet.py", reviewDir], {
  maxBuffer: 8 * 1024 * 1024,
});

await Promise.all([
  copyFile(resolve(reviewDir, "components-contact-sheet.jpg"), resolve(docsDir, "components-overview.jpg")),
  copyFile(resolve(reviewDir, "data-effects-contact-sheet.jpg"), resolve(docsDir, "data-visualizations-overview.jpg")),
  copyFile(
    resolve(reviewDir, "animation-templates-contact-sheet.jpg"),
    resolve(docsDir, "animation-templates-overview.jpg"),
  ),
]);

console.log(`README component, data, and animation galleries written to ${docsDir}`);
