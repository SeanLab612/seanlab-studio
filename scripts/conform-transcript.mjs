import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { conformTranscriptToLockedScript } from "../src/workflow/transcript-conformance.ts";

const config = JSON.parse(await readFile(resolve(process.argv[2]), "utf8"));
const transcript = JSON.parse(await readFile(resolve(config.rawTranscript), "utf8"));
let lockedScript;
if (config.referenceScript) {
  try {
    lockedScript = await readFile(resolve(config.referenceScript), "utf8");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}
const result = conformTranscriptToLockedScript(transcript, lockedScript);
await mkdir(dirname(resolve(config.transcript)), { recursive: true });
await writeFile(resolve(config.transcript), `${JSON.stringify(result.transcript, null, 2)}\n`);
await writeFile(resolve(config.transcriptConformanceReportFile), `${JSON.stringify(result.report, null, 2)}\n`);
console.log(
  `Transcript conformance ${result.report.status}: ${result.report.changes.length} correction(s), ${(result.report.referenceCoverage * 100).toFixed(1)}% reference coverage.`,
);
