import { execFile } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { promisify } from "node:util";

const run = promisify(execFile);
const output = "out/typography-policy-review";
await mkdir(output, { recursive: true });

const stills = [
  ["ReviewTypographyPolicyDecision", `${output}/decision-matrix.png`, "90"],
  ["ReviewTypographyPolicyRealScene", `${output}/real-quote-scene.png`, "120"],
  ["ReviewTypographyPolicyAnnotationScene", `${output}/real-annotation-scene.png`, "120"],
];

for (const [composition, file, frame] of stills) {
  await run("npx", ["remotion", "still", "src/index.ts", composition, file, "--frame", frame], {
    maxBuffer: 30 * 1024 * 1024,
  });
  console.log(`${composition} -> ${file}`);
}
