import { spawn } from "node:child_process";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { VISUAL_PACING_REVIEW_SCALE } from "./workflow/render-dimensions.mjs";

const config = JSON.parse(await readFile(resolve(process.argv[2]), "utf8"));
const output = resolve(config.visualPacingReviewFile);
const temporary = `${output}.${process.pid}.${Date.now()}.tmp.mp4`;
const temporaryProps = `${output}.${process.pid}.${Date.now()}.props.json`;
const render = (args) =>
  new Promise((done, reject) => {
    const child = spawn("npx", ["remotion", "render", "src/index.ts", ...args], {
      stdio: ["ignore", "inherit", "inherit"],
    });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) done();
      else reject(new Error(`Remotion pacing review exited with ${code ?? signal}`));
    });
  });

await mkdir(dirname(output), { recursive: true });
try {
  const reviewProps = JSON.parse(await readFile(resolve(config.reviewPropsFile), "utf8"));
  reviewProps.outputFps = Math.min(30, reviewProps.outputFps ?? 30);
  await writeFile(temporaryProps, `${JSON.stringify(reviewProps)}\n`);
  await render([
    "GeneratedWorkflowReview",
    temporary,
    `--props=${temporaryProps}`,
    `--scale=${VISUAL_PACING_REVIEW_SCALE}`,
    "--codec=h264",
    "--crf=25",
    "--pixel-format=yuv420p",
  ]);
  await rename(temporary, output);
} finally {
  await Promise.all([rm(temporary, { force: true }), rm(temporaryProps, { force: true })]);
}
console.log(`${output}: continuous 720p 30fps visual pacing review`);
