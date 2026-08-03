import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  deliveryBaseSignatureInputs,
  parseSegmentCache,
  segmentCacheKey,
  segmentCacheProfile,
} from "../scripts/workflow/segment-cache.mjs";

const profile = segmentCacheProfile({ width: 3840, height: 2160, fps: 60, finalMode: true });

test("segment cache keys change only with source, range, or encoding profile", () => {
  const base = { range: { start: 10, end: 20 }, sourceSha256: "a".repeat(64), profile };
  assert.equal(segmentCacheKey(base), segmentCacheKey(structuredClone(base)));
  assert.notEqual(segmentCacheKey(base), segmentCacheKey({ ...base, range: { start: 10, end: 21 } }));
  assert.notEqual(segmentCacheKey(base), segmentCacheKey({ ...base, sourceSha256: "b".repeat(64) }));
  assert.notEqual(segmentCacheKey(base), segmentCacheKey({ ...base, profile: { ...profile, fps: 30 } }));
});

test("segment cache rounds source boundaries to the renderer precision", () => {
  const sourceSha256 = "a".repeat(64);
  assert.equal(
    segmentCacheKey({ range: { start: 1.2344, end: 2.3454 }, sourceSha256, profile }),
    segmentCacheKey({ range: { start: 1.23449, end: 2.34549 }, sourceSha256, profile }),
  );
});

test("invalid cache documents fail closed to an empty current cache", () => {
  assert.deepEqual(parseSegmentCache({ schemaVersion: "legacy", entries: { unsafe: true } }), {
    schemaVersion: "1.0",
    entries: {},
  });
});

test("delivery base signatures exclude visual props and approval data", () => {
  assert.deepEqual(
    deliveryBaseSignatureInputs({
      source: "/source.mov",
      mediaManifestPath: "/workspace/media-manifest.json",
      edlPath: "/workspace/edl.json",
      profile,
    }),
    ["delivery-base-v2", "/source.mov", "/workspace/media-manifest.json", "/workspace/edl.json", profile],
  );
});

test("review segments reuse unchanged ranges and rerender only a changed range", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "segment-cache-integration-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const workspace = join(root, "workspace");
  const source = join(root, "source.mp4");
  const configPath = join(root, "config.json");
  const output = join(root, "public", "review.mp4");
  const renderScript = join(process.cwd(), "scripts", "render-review-base.mjs");
  await mkdir(workspace, { recursive: true });

  execFileSync(
    "ffmpeg",
    [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "testsrc2=size=320x180:rate=30:duration=4",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=1000:sample_rate=48000:duration=4",
      "-shortest",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      source,
    ],
    { stdio: "ignore" },
  );
  await writeFile(
    join(workspace, "media-manifest.json"),
    `${JSON.stringify({ width: 320, height: 180, fps: 30, durationSeconds: 4 }, null, 2)}\n`,
  );
  const writeEdl = (secondStart) =>
    writeFile(
      join(workspace, "edl.json"),
      `${JSON.stringify(
        {
          sources: { main: source },
          ranges: [
            { source: "main", start: 0, end: 1.2 },
            { source: "main", start: secondStart, end: 3.2 },
          ],
        },
        null,
        2,
      )}\n`,
    );
  await writeEdl(2);
  await writeFile(
    configPath,
    `${JSON.stringify({ editDir: workspace, reviewWidth: 320, reviewHeight: 180, publicReviewFile: output }, null, 2)}\n`,
  );
  const render = () => execFileSync(process.execPath, [renderScript, configPath], { encoding: "utf8" });

  const first = render();
  assert.equal((first.match(/segment-cache rendered/g) ?? []).length, 2);
  const second = render();
  assert.equal((second.match(/segment-cache reused/g) ?? []).length, 2);

  await writeEdl(2.1);
  const third = render();
  assert.equal((third.match(/segment-cache reused/g) ?? []).length, 1);
  assert.equal((third.match(/segment-cache rendered/g) ?? []).length, 1);

  const cache = JSON.parse(await readFile(join(workspace, "clips_review", "segment-cache.json"), "utf8"));
  assert.equal(Object.keys(cache.entries).length, 3);
  const probe = JSON.parse(
    execFileSync(
      "ffprobe",
      ["-v", "error", "-show_entries", "format=duration", "-show_entries", "stream=codec_type", "-of", "json", output],
      { encoding: "utf8" },
    ),
  );
  assert.deepEqual(
    probe.streams.map((stream) => stream.codec_type).sort(),
    ["audio", "video"],
  );
  assert.ok(Math.abs(Number(probe.format.duration) - 2.3) < 0.15);
});
