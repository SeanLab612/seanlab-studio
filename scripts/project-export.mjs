import { resolve } from "node:path";
import { exportPortableBundle, verifyPortableBundle } from "./operations/portable-bundle.mjs";
import { readManifest } from "./workflow/manifest.mjs";

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const project = option("--project");
if (!project)
  throw new Error("Usage: npm run project:export -- --project <project.json> [--output <dir>] [--include-review]");
const context = await readManifest(project);
const output = resolve(option("--output") ?? `out/project-bundles/${context.manifest.project.id}.vrbundle`);
await exportPortableBundle({
  context,
  outputPath: output,
  includeReview: args.includes("--include-review"),
});
const verification = await verifyPortableBundle(output);
console.log(JSON.stringify({ event: "project.bundle.exported", output, verification }));
if (verification.status !== "passed") process.exitCode = 2;
