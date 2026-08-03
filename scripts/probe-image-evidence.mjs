import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, extname, resolve } from "node:path";

const config = JSON.parse(await readFile(resolve(process.argv[2]), "utf8"));
const assets = config.imageEvidence ?? [];
const outputFile = resolve(config.imageEvidenceManifestFile);
const publicDir = resolve("public", "projects", config.projectId, "image-evidence");
const frozenDir = resolve(dirname(outputFile), "image-evidence-assets");
await mkdir(publicDir, { recursive: true });
await mkdir(frozenDir, { recursive: true });

const orientationFor = (width, height) => {
  const ratio = width / height;
  if (Math.abs(ratio - 1) < 0.08) return "square";
  if (ratio < 0.62) return "long-portrait";
  return width > height ? "landscape" : "portrait";
};

const supportedExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
const probed = [];
for (const asset of assets) {
  const source = resolve(asset.path);
  const extension = extname(source).toLowerCase();
  if (!supportedExtensions.has(extension)) {
    if (asset.required) throw new Error(`Required image evidence ${asset.id} uses unsupported format: ${extension}`);
    continue;
  }
  let probe;
  try {
    probe = JSON.parse(
      execFileSync(
        "ffprobe",
        [
          "-v",
          "error",
          "-select_streams",
          "v:0",
          "-show_entries",
          "stream=codec_name,width,height",
          "-of",
          "json",
          source,
        ],
        { encoding: "utf8" },
      ),
    );
  } catch (error) {
    if (asset.required)
      throw new Error(`Required image evidence ${asset.id} is missing or undecodable: ${error.message}`);
    continue;
  }
  const image = probe.streams?.[0];
  if (!(image?.width > 0 && image?.height > 0)) {
    if (asset.required) throw new Error(`Required image evidence ${asset.id} has invalid dimensions`);
    continue;
  }
  if (asset.required && Math.max(image.width, image.height) < 720)
    throw new Error(`Required image evidence ${asset.id} is below the 720px minimum edge`);
  const publicName = `${asset.id}${extension}`;
  const frozenFile = resolve(frozenDir, publicName);
  await copyFile(source, frozenFile);
  await copyFile(frozenFile, resolve(publicDir, publicName));
  const bytes = await readFile(source);
  probed.push({
    id: asset.id,
    role: asset.role,
    description: asset.description,
    sourceLabel: asset.sourceLabel ?? "",
    anchorText: asset.anchorText ?? "",
    sourcePath: source,
    sourceName: basename(source),
    publicSrc: `projects/${config.projectId}/image-evidence/${publicName}`,
    frozenPath: `image-evidence-assets/${publicName}`,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    width: image.width,
    height: image.height,
    orientation: orientationFor(image.width, image.height),
    codec: image.codec_name,
    fit: asset.fit,
    focalPoint: asset.focalPoint,
    required: asset.required,
  });
}

await mkdir(dirname(outputFile), { recursive: true });
await writeFile(outputFile, `${JSON.stringify({ schemaVersion: "1.0", assets: probed }, null, 2)}\n`);
console.log(`${outputFile}: ${probed.length} image evidence assets probed`);
