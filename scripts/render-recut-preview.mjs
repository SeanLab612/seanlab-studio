import { execFileSync } from "node:child_process";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const configPath = resolve(process.argv[2]);
const config = JSON.parse(await readFile(configPath, "utf8"));
const previewConfigPath = resolve(config.editDir, "recut-preview-runtime.json");
const previewPublic = resolve("public", "projects", config.projectId, "recut-preview-720p.mp4");
const previewConfig = {
  ...config,
  editDir: config.recutProposalDir,
  reviewWidth: 1280,
  reviewHeight: 720,
  publicReviewFile: previewPublic,
};
await mkdir(resolve(config.recutProposalDir), { recursive: true });
await copyFile(resolve(config.proposedEdlFile), resolve(config.recutProposalDir, "edl.json"));
await copyFile(resolve(config.editDir, "media-manifest.json"), resolve(config.recutProposalDir, "media-manifest.json"));
await writeFile(previewConfigPath, `${JSON.stringify(previewConfig, null, 2)}\n`);
execFileSync("node", ["scripts/render-review-base.mjs", previewConfigPath], { stdio: "inherit" });
await mkdir(dirname(resolve(config.recutPreviewFile)), { recursive: true });
await copyFile(previewPublic, resolve(config.recutPreviewFile));
console.log(`${config.recutPreviewFile}: continuous 720p recut review`);
