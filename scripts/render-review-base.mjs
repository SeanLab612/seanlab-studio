import { execFileSync } from "node:child_process";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  emptySegmentCache,
  parseSegmentCache,
  segmentCacheKey,
  segmentCacheProfile,
} from "./workflow/segment-cache.mjs";
import { fileExists, hashFile } from "./workflow/state.mjs";

const config = JSON.parse(await readFile(resolve(process.argv[2] ?? "config/workflow-test.json"), "utf8"));
const edl = JSON.parse(await readFile(resolve(config.editDir, "edl.json"), "utf8"));
const mediaManifest = JSON.parse(await readFile(resolve(config.editDir, "media-manifest.json"), "utf8"));
const finalMode = process.argv.includes("--final");
const width = finalMode ? mediaManifest.width : config.reviewWidth;
const height = finalMode ? mediaManifest.height : config.reviewHeight;
const fps = mediaManifest.fps;
const clipsDir = resolve(config.editDir, finalMode ? "clips_final_4k" : "clips_review");
await mkdir(clipsDir, { recursive: true });
const cacheDir = resolve(clipsDir, "cache");
const cacheManifestPath = resolve(clipsDir, "segment-cache.json");
await mkdir(cacheDir, { recursive: true });
const cache = await readFile(cacheManifestPath, "utf8")
  .then((value) => parseSegmentCache(JSON.parse(value)))
  .catch(() => emptySegmentCache());
const profile = segmentCacheProfile({ width, height, fps, finalMode });
const sourceHashes = new Map();
for (const source of new Set(edl.ranges.map((range) => edl.sources[range.source]))) {
  sourceHashes.set(source, await hashFile(source));
}
const saveCache = async () => {
  const temporary = `${cacheManifestPath}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(cache, null, 2)}\n`);
  await rename(temporary, cacheManifestPath);
};
const reusableSegment = async ({ key, output }) => {
  const entry = cache.entries[key];
  if (!entry || !(await fileExists(output))) return false;
  const info = await stat(output);
  return info.size === entry.bytes && (await hashFile(output)) === entry.sha256;
};
const clips = [];
for (const [index, range] of edl.ranges.entries()) {
  const source = edl.sources[range.source];
  const key = segmentCacheKey({ range, sourceSha256: sourceHashes.get(source), profile });
  const output = resolve(cacheDir, `${key}.mp4`);
  const duration = range.end - range.start;
  if (await reusableSegment({ key, output })) console.log(`segment-cache reused ${index + 1}/${edl.ranges.length}`);
  else {
    const temporary = resolve(cacheDir, `${key}.${process.pid}.tmp.mp4`);
    execFileSync(
      "ffmpeg",
      [
        "-y",
        "-ss",
        range.start.toFixed(3),
        "-i",
        source,
        "-t",
        duration.toFixed(3),
        "-vf",
        `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,format=yuv420p`,
        "-af",
        `afade=t=in:st=0:d=0.03,afade=t=out:st=${Math.max(0, duration - 0.03).toFixed(3)}:d=0.03`,
        "-c:v",
        profile.video.codec,
        "-preset",
        profile.video.preset,
        "-crf",
        String(profile.video.crf),
        "-r",
        String(fps),
        "-c:a",
        profile.audio.codec,
        "-b:a",
        profile.audio.bitrate,
        "-ar",
        String(profile.audio.sampleRate),
        temporary,
      ],
      { stdio: "ignore" },
    );
    await rename(temporary, output);
    const info = await stat(output);
    cache.entries[key] = {
      key,
      sourceSha256: sourceHashes.get(source),
      range: { start: range.start, end: range.end },
      profile,
      bytes: info.size,
      sha256: await hashFile(output),
      updatedAt: new Date().toISOString(),
    };
    await saveCache();
    console.log(`segment-cache rendered ${index + 1}/${edl.ranges.length}`);
  }
  clips.push(output);
  console.log(`segment ${index + 1}/${edl.ranges.length}`);
}
const listPath = resolve(clipsDir, "concat.txt");
await writeFile(listPath, clips.map((clip) => `file '${clip.replaceAll("'", "'\\''")}'`).join("\n"));
const concatOutput = resolve(clipsDir, "concat-raw.mp4");
execFileSync("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", concatOutput], {
  stdio: "inherit",
});
const output = resolve(
  finalMode
    ? (config.publicDeliveryFile ?? "public/test/final-cut-4k.mp4")
    : (config.publicReviewFile ?? "public/test/review-cut-1080p.mp4"),
);
await mkdir(resolve(output, ".."), { recursive: true });
execFileSync(
  "ffmpeg",
  [
    "-y",
    "-i",
    concatOutput,
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-b:a",
    "160k",
    "-af",
    "aresample=async=1:first_pts=0",
    "-movflags",
    "+faststart",
    output,
  ],
  { stdio: "inherit" },
);
console.log(output);
