import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const kind = args.includes("--people") ? "people" : args.includes("--identities") ? "identities" : undefined;
const approvalIndex = args.indexOf("--approval");
const approval = approvalIndex >= 0 ? args[approvalIndex + 1] : undefined;
const idsIndex = args.indexOf("--ids");
const ids = idsIndex >= 0 ? new Set(args[idsIndex + 1].split(",").filter(Boolean)) : undefined;

if (!kind) throw new Error("Choose --people or --identities.");
if (!approval?.trim()) throw new Error("Explicit --approval text is required.");
if (!ids?.size && !args.includes("--all-candidates")) throw new Error("Choose --ids a,b or --all-candidates.");

const manifestPath = `public/media-assets/${kind}/manifest.json`;
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
let promoted = 0;
for (const asset of manifest) {
  if (asset.status !== "candidate") continue;
  if (ids && !ids.has(asset.id)) continue;
  asset.status = "approved";
  asset.approval = { decision: approval, approvedAt: new Date().toISOString() };
  promoted += 1;
}
if (!promoted) throw new Error("No matching candidate assets were promoted.");
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
if (kind === "people") {
  const result = spawnSync("node", ["scripts/build-media-registry.mjs"], { stdio: "inherit" });
  if (result.status) process.exit(result.status);
} else {
  // Identity acquisition is intentionally not rerun here because that would reset human status.
  const source = `// Generated from public/media-assets/identities/manifest.json after explicit promotion.\nimport type { MediaAssetDefinition } from "./types.ts";\n\nexport const identityAssets = ${JSON.stringify(manifest, null, 2)} as const satisfies readonly MediaAssetDefinition[];\n\nexport type IdentityAssetId = (typeof identityAssets)[number]["id"];\nexport const identityAssetById = new Map(identityAssets.map((asset) => [asset.id, asset]));\n`;
  await writeFile("src/media-assets/identity-assets.ts", source);
}
console.log(`Promoted ${promoted} ${kind} assets.`);
