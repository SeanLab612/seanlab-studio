import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { reusableDeliveryReport } from "../scripts/operations/delivery-provenance.mjs";
import { hashFile } from "../scripts/workflow/state.mjs";

test("final delivery reuse requires identical approval and input provenance", async () => {
  const directory = await mkdtemp(join(tmpdir(), "remotion-delivery-provenance-"));
  const outputPath = join(directory, "delivery.mp4");
  const reportPath = join(directory, "delivery-render-report.json");
  await writeFile(outputPath, "approved-output");
  const provenance = {
    inputSignature: "input",
    approvalSnapshotSha256: "approval",
    deliveryPropsSha256: "props",
    sourceSha256: "source",
    projectManifestSha256: "manifest",
  };
  await writeFile(
    reportPath,
    JSON.stringify({
      schemaVersion: "1.0",
      kind: "delivery-render-report",
      provenance,
      output: {
        bytes: (await readFile(outputPath)).length,
        sha256: await hashFile(outputPath),
      },
    }),
  );
  assert.equal(await reusableDeliveryReport({ reportPath, outputPath, provenance }), true);
  assert.equal(
    await reusableDeliveryReport({
      reportPath,
      outputPath,
      provenance: { ...provenance, deliveryPropsSha256: "changed" },
    }),
    false,
  );
  await writeFile(outputPath, "tampered-output");
  assert.equal(await reusableDeliveryReport({ reportPath, outputPath, provenance }), false);
});
