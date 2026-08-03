import { execFile } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { promisify } from "node:util";

const run = promisify(execFile);
const output = "out/cover-art-direction-0.2.22";
await mkdir(output, { recursive: true });

const stills = [
  ["signal-landscape", "CoverSignalLandscape"],
  ["paper-landscape", "CoverPaperLandscape"],
  ["studio-landscape", "CoverStudioLandscape"],
  ["signal-portrait", "CoverSignalPortrait"],
  ["paper-portrait", "CoverPaperPortrait"],
  ["studio-portrait", "CoverStudioPortrait"],
  ["generated-signal-landscape", "CoverGeneratedSignalLandscape"],
  ["generated-signal-portrait", "CoverGeneratedSignalPortrait"],
];

for (const [index, [name, composition]] of stills.entries()) {
  await run("npx", ["remotion", "still", "src/index.ts", composition, `${output}/${name}.png`, "--frame", "0"], {
    maxBuffer: 24 * 1024 * 1024,
  });
  console.log(`cover still ${index + 1}/${stills.length}: ${name}`);
}

console.log(`cover review rendered to ${output}`);
