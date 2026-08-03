import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, extname, resolve } from "node:path";

const config = JSON.parse(await readFile(resolve(process.argv[2]), "utf8"));
const assets = config.supplementalMedia ?? [];
const outputFile = resolve(config.supplementalMediaManifestFile);
const publicDir = resolve("public", "projects", config.projectId, "supplemental");
await mkdir(publicDir, { recursive: true });
const probed = [];

const orientationFor = (width, height) => {
  if (Math.abs(width / height - 1) < 0.08) return "square";
  return width > height ? "landscape" : "portrait";
};

for (const asset of assets) {
  const source = resolve(asset.path);
  let raw;
  try {
    raw = execFileSync(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "stream=index,codec_type,codec_name,width,height,avg_frame_rate:format=duration",
        "-of",
        "json",
        source,
      ],
      { encoding: "utf8" },
    );
  } catch (error) {
    if (asset.required)
      throw new Error(`Required supplemental media ${asset.id} is missing or undecodable: ${error.message}`);
    continue;
  }
  const probe = JSON.parse(raw);
  const video = probe.streams.find((stream) => stream.codec_type === "video");
  if (!video) throw new Error(`Supplemental media ${asset.id} has no video stream`);
  const [numerator, denominator] = String(video.avg_frame_rate ?? "0/1")
    .split("/")
    .map(Number);
  const fps = denominator ? numerator / denominator : 0;
  const durationSeconds = Number(probe.format.duration);
  if (!(fps > 0) || !(durationSeconds > 0))
    throw new Error(`Supplemental media ${asset.id} has invalid timing metadata`);
  const actualOrientation = orientationFor(video.width, video.height);
  if (asset.orientation !== "any" && asset.orientation !== actualOrientation)
    throw new Error(`Supplemental media ${asset.id} expected ${asset.orientation} but is ${actualOrientation}`);
  const clip = asset.clip ?? { in: 0, out: durationSeconds };
  if (!(clip.in >= 0 && clip.out > clip.in && clip.out <= durationSeconds + 0.001))
    throw new Error(`Supplemental media ${asset.id} has an invalid clip range`);
  const extension = extname(source).toLowerCase() || ".mp4";
  const publicName = `${asset.id}${extension}`;
  const publicFile = resolve(publicDir, publicName);
  await copyFile(source, publicFile);
  const bytes = await readFile(source);
  probed.push({
    id: asset.id,
    role: asset.role,
    sourcePath: source,
    sourceName: basename(source),
    publicSrc: `projects/${config.projectId}/supplemental/${publicName}`,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    width: video.width,
    height: video.height,
    fps,
    durationSeconds,
    codec: video.codec_name,
    hasAudio: probe.streams.some((stream) => stream.codec_type === "audio"),
    audioPolicy: "mute",
    required: asset.required,
    clip,
  });
}

const manifest = { schemaVersion: "1.0", assets: probed };
await mkdir(dirname(outputFile), { recursive: true });
await writeFile(outputFile, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`${outputFile}: ${probed.length} supplemental assets probed`);
