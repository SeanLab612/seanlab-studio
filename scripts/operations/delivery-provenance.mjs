import { readFile, stat } from "node:fs/promises";
import { hashFile } from "../workflow/state.mjs";

const provenanceKeys = [
  "inputSignature",
  "approvalSnapshotSha256",
  "deliveryPropsSha256",
  "sourceSha256",
  "projectManifestSha256",
];

export const sameDeliveryProvenance = (left, right) =>
  provenanceKeys.every((key) => typeof left?.[key] === "string" && left[key] === right?.[key]);

export const reusableDeliveryReport = async ({ reportPath, outputPath, provenance }) => {
  try {
    const report = JSON.parse(await readFile(reportPath, "utf8"));
    if (report.schemaVersion !== "1.0" || report.kind !== "delivery-render-report") return false;
    if (!sameDeliveryProvenance(report.provenance, provenance)) return false;
    const info = await stat(outputPath);
    return info.size === report.output?.bytes && (await hashFile(outputPath)) === report.output?.sha256;
  } catch {
    return false;
  }
};
