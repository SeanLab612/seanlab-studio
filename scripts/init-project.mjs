import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { createManifest, writeManifest } from "./workflow/manifest.mjs";

const args = new Map();
for (let index = 2; index < process.argv.length; index += 2) args.set(process.argv[index], process.argv[index + 1]);
const id = args.get("--id");
const source = args.get("--source");
const transcript = args.get("--transcript");
if (!id || !source)
  throw new Error("Usage: npm run project:init -- --id <id> --source <video> [--transcript <json>] [--title <title>]");
await access(resolve(source));
if (transcript) await access(resolve(transcript));
const outputPath = resolve(args.get("--output") ?? `projects/${id}/project.json`);
const manifest = createManifest({ id, title: args.get("--title") ?? id, source, transcript, outputPath });
await writeManifest(manifest, outputPath);
console.log(JSON.stringify({ event: "project.initialized", projectId: id, manifestPath: outputPath }));
