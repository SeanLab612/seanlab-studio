import { execFile } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { promisify } from "node:util";

const run = promisify(execFile);
const output = "out/rough-annotation-review";
await mkdir(output, { recursive: true });

const stills = [
  ["negation-entry", "ReviewRoughAnnotationNegation", "1"],
  ["negation-mid", "ReviewRoughAnnotationNegation", "28"],
  ["negation-stable", "ReviewRoughAnnotationNegation", "90"],
  ["negation-exit-risk", "ReviewRoughAnnotationNegation", "146"],
  ["circle", "ReviewRoughAnnotationCircle", "90"],
  ["underline", "ReviewRoughAnnotationUnderline", "90"],
  ["highlight", "ReviewRoughAnnotationHighlight", "90"],
  ["box", "ReviewRoughAnnotationBox", "90"],
  ["crossed-off", "ReviewRoughAnnotationCrossedOff", "90"],
  ["strike-through", "ReviewRoughAnnotationStrikeThrough", "90"],
  ["bracket", "ReviewRoughAnnotationBracket", "90"],
];

for (const [index, [name, composition, frame]] of stills.entries()) {
  await run("npx", ["remotion", "still", "src/index.ts", composition, `${output}/${name}.png`, "--frame", frame], {
    maxBuffer: 20 * 1024 * 1024,
  });
  console.log(`rough-annotation still ${index + 1}/${stills.length}: ${name}`);
}
await run(
  "npx",
  [
    "remotion",
    "render",
    "src/index.ts",
    "ReviewRoughAnnotationSequence",
    `${output}/rough-annotation-sequence.mp4`,
    "--codec",
    "h264",
    "--crf",
    "20",
  ],
  { maxBuffer: 40 * 1024 * 1024 },
);
console.log(`rough-annotation review rendered to ${output}`);
