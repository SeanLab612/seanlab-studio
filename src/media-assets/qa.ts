import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { MediaAssetDefinition } from "./types.ts";

export type MediaAssetFinding = {
  severity: "error" | "warning";
  assetId: string;
  code: string;
  message: string;
};

const isAllowedSourceUrl = (asset: MediaAssetDefinition, value: string | undefined) =>
  !value ||
  value.startsWith("https://") ||
  (asset.source?.license === "user-provided-private" && value.startsWith("local://"));

export const validateMediaAssets = (assets: readonly MediaAssetDefinition[], publicRoot: string) => {
  const findings: MediaAssetFinding[] = [];
  const seen = new Set<string>();
  for (const asset of assets) {
    if (seen.has(asset.id))
      findings.push({ severity: "error", assetId: asset.id, code: "duplicate-id", message: "Asset ID is duplicated." });
    seen.add(asset.id);
    if (!isAllowedSourceUrl(asset, asset.source?.pageUrl) || !isAllowedSourceUrl(asset, asset.source?.fileUrl))
      findings.push({
        severity: "error",
        assetId: asset.id,
        code: "insecure-source",
        message: "Source URLs must use HTTPS, except explicit local provenance for user-provided private assets.",
      });
    if (asset.status === "approved" && !Object.keys(asset.variants).length)
      findings.push({
        severity: "error",
        assetId: asset.id,
        code: "approved-without-file",
        message: "Approved asset has no local variant.",
      });
    if (asset.status === "candidate" && !asset.source)
      findings.push({
        severity: "error",
        assetId: asset.id,
        code: "candidate-without-source",
        message: "Candidate asset has no provenance.",
      });
    if (asset.source?.license !== "public-domain" && asset.source?.license.startsWith("cc-") && !asset.source.author)
      findings.push({
        severity: "error",
        assetId: asset.id,
        code: "missing-author",
        message: "Attribution license requires an author.",
      });
    for (const [variant, file] of Object.entries(asset.variants)) {
      if (!file) continue;
      const absolute = path.join(publicRoot, file.path);
      if (!existsSync(absolute)) {
        findings.push({
          severity: "error",
          assetId: asset.id,
          code: "missing-file",
          message: `${variant} file is missing.`,
        });
        continue;
      }
      const actual = createHash("sha256").update(readFileSync(absolute)).digest("hex");
      if (actual !== file.sha256)
        findings.push({
          severity: "error",
          assetId: asset.id,
          code: "checksum-mismatch",
          message: `${variant} checksum differs.`,
        });
      if (asset.kind === "person" && variant === "original" && Math.min(file.width, file.height) < 512)
        findings.push({
          severity: "warning",
          assetId: asset.id,
          code: "low-resolution",
          message: "Portrait original is below 512 px on one edge.",
        });
    }
    if (!asset.fallback.value)
      findings.push({
        severity: "error",
        assetId: asset.id,
        code: "missing-fallback",
        message: "Every asset needs a deterministic fallback.",
      });
  }
  return findings;
};
