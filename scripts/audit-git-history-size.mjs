import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { resolve } from "node:path";
import { formatBytes } from "./repository-health.mjs";

export const largestHistoricalBlobs = async ({ root = process.cwd(), limit = 25 } = {}) => {
  const revisions = spawn("git", ["rev-list", "--objects", "--all"], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
  const objects = spawn("git", ["cat-file", "--batch-check=%(objectname) %(objecttype) %(objectsize) %(rest)"], {
    cwd: root,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const revisionDone = new Promise((done) => revisions.once("close", done));
  const objectDone = new Promise((done) => objects.once("close", done));
  revisions.stdout.pipe(objects.stdin);
  const largest = [];
  for await (const line of createInterface({ input: objects.stdout })) {
    const match = line.match(/^([a-f0-9]+) blob (\d+)(?: (.*))?$/u);
    if (!match) continue;
    largest.push({ object: match[1], bytes: Number(match[2]), path: match[3] || "(unmapped blob)" });
    largest.sort((left, right) => right.bytes - left.bytes);
    if (largest.length > limit) largest.length = limit;
  }
  const [revisionExit, objectExit] = await Promise.all([revisionDone, objectDone]);
  if (revisionExit !== 0 || objectExit !== 0) throw new Error("Unable to inspect Git history objects");
  return largest;
};

if (resolve(process.argv[1] ?? "") === resolve(import.meta.filename)) {
  const limitArg = process.argv.indexOf("--limit");
  const limit = limitArg >= 0 ? Number(process.argv[limitArg + 1]) : 25;
  const blobs = await largestHistoricalBlobs({ limit: Number.isInteger(limit) && limit > 0 ? limit : 25 });
  console.log("Largest blobs retained in Git history (read-only)");
  for (const blob of blobs) console.log(`- ${formatBytes(blob.bytes)}  ${blob.object.slice(0, 12)}  ${blob.path}`);
  console.log("No history or files were changed.");
}
