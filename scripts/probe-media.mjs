import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const configPath = resolve(process.argv[2] ?? "config/workflow-test.json");
const config = JSON.parse(await readFile(configPath, "utf8"));
const source = resolve(config.source);
const raw = execFileSync(
  "ffprobe",
  [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height,r_frame_rate,avg_frame_rate,codec_name:format=duration",
    "-of",
    "json",
    source,
  ],
  { encoding: "utf8" },
);
const probe = JSON.parse(raw);
const stream = probe.streams[0];
const [numerator, denominator] = stream.avg_frame_rate.split("/").map(Number);
const manifest = {
  source,
  width: stream.width,
  height: stream.height,
  fps: numerator / denominator,
  durationSeconds: Number(probe.format.duration),
  codec: stream.codec_name,
  review: { width: config.reviewWidth, height: config.reviewHeight },
};
const output = resolve(config.editDir, "media-manifest.json");
await mkdir(dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(output);
