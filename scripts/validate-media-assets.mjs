import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { personAssets } from "../src/media-assets/person-assets.ts";
import { identityAssets } from "../src/media-assets/identity-assets.ts";
import { validateMediaAssets } from "../src/media-assets/qa.ts";

const findings = validateMediaAssets([...personAssets, ...identityAssets], path.join(process.cwd(), "public"));
const report = {
  schemaVersion: "1.0",
  generatedAt: new Date().toISOString(),
  inventory: {
    people: personAssets.length,
    identities: identityAssets.length,
    approved: [...personAssets, ...identityAssets].filter((asset) => asset.status === "approved").length,
    candidates: [...personAssets, ...identityAssets].filter((asset) => asset.status === "candidate").length,
    plannedOrBlocked: [...personAssets, ...identityAssets].filter((asset) =>
      ["planned", "blocked"].includes(asset.status),
    ).length,
  },
  summary: {
    errors: findings.filter((finding) => finding.severity === "error").length,
    warnings: findings.filter((finding) => finding.severity === "warning").length,
  },
  findings,
};
await mkdir("out/media-assets", { recursive: true });
await writeFile("out/media-assets/qa-report.json", `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report.summary));
if (report.summary.errors) process.exitCode = 1;
