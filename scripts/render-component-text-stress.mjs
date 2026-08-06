import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { APPROVED_COMPONENT_IDS } from "../src/visual-brief/types.ts";

const run = promisify(execFile);
const componentIds = [...APPROVED_COMPONENT_IDS];

const root = resolve("out/component-text-stress");
const frames = resolve(root, "components");
await mkdir(frames, { recursive: true });

const render = async (componentId) => {
  const output = resolve(frames, `${componentId}.png`);
  await run(
    resolve("node_modules/.bin/remotion"),
    [
      "still",
      "src/index.ts",
      "ProductionMobileComponentReview",
      output,
      "--frame",
      "180",
      "--image-format",
      "png",
      "--props",
      JSON.stringify({ componentId, stress: true }),
      "--log",
      "error",
    ],
    { maxBuffer: 10 * 1024 * 1024, timeout: 60_000 },
  );
  return { componentId, output };
};

const pending = [...componentIds];
const rendered = [];
const worker = async () => {
  while (pending.length) {
    const componentId = pending.shift();
    rendered.push(await render(componentId));
  }
};

// Remotion's browser/bundler cache is shared inside one checkout. Serial
// renders are more reliable than racing several `still` processes against it.
await worker();
await run("python3", ["scripts/static_component_data_contact_sheet.py", root]);
await writeFile(
  resolve(root, "manifest.json"),
  `${JSON.stringify({ schemaVersion: "1.0", rendered }, null, 2)}\n`,
  "utf8",
);
console.log(`Rendered ${rendered.length} complete-text component fixtures to ${root}`);
