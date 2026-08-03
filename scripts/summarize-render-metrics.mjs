import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const input = resolve(process.argv[2] ?? "素材/20260711-test/edit/render-metrics-v2.txt");
const output = resolve(process.argv[3] ?? "素材/20260711-test/edit/render-performance.json");
const text = await readFile(input, "utf8");
const real = Number(text.match(/([\d.]+) real/)?.[1] ?? 0);
const rssBytes = Number(text.match(/(\d+)\s+maximum resident set size/)?.[1] ?? 0);
const metrics = {
  renderSeconds: real,
  peakRssBytes: rssBytes,
  peakRssMiB: Number((rssBytes / 1024 / 1024).toFixed(1)),
};
await writeFile(output, `${JSON.stringify(metrics, null, 2)}\n`);
console.log(metrics);
