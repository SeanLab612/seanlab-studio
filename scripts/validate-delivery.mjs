import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { execFile } from "node:child_process";
import { readFile, stat, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { evaluateDeliveryProbe } from "./operations/delivery-validation.mjs";
import { resolveDeliveryProfile } from "./creator/delivery-profile.mjs";
import { validateArtifactSchema } from "./operations/artifact-schema.mjs";

const execFileAsync = promisify(execFile);
const config = JSON.parse(await readFile(resolve(process.argv[2]), "utf8"));
const output = resolve(config.deliveryOutputFile);
const media = JSON.parse(await readFile(resolve(config.editDir, "media-manifest.json"), "utf8"));
const edl = JSON.parse(await readFile(resolve(config.editDir, "edl.json"), "utf8"));
const brandTimeline = config.brandEnabled
  ? JSON.parse(await readFile(resolve(config.brandTimelineFile), "utf8"))
  : { totalInsertedSeconds: 0 };
const durationSeconds =
  edl.ranges.reduce((total, range) => total + range.end - range.start, 0) +
  Number(brandTimeline.totalInsertedSeconds ?? 0);
const { stdout } = await execFileAsync("ffprobe", [
  "-v",
  "error",
  "-show_entries",
  "stream=codec_type,codec_name,width,height,r_frame_rate:format=duration,size",
  "-of",
  "json",
  output,
]);
const probe = JSON.parse(stdout);
let decodePassed = true;
let decodeError;
try {
  await execFileAsync("ffmpeg", ["-v", "error", "-i", output, "-map", "0:v:0", "-map", "0:a?", "-f", "null", "-"], {
    maxBuffer: 4 * 1024 * 1024,
  });
} catch (error) {
  decodePassed = false;
  decodeError = error.stderr?.slice(0, 2000) ?? error.message;
}
const profile = resolveDeliveryProfile({ profile: config.delivery, source: media });
const expected = {
  width: profile.width,
  height: profile.height,
  fps: profile.fps,
  codec: config.delivery?.codec ?? "h264",
  durationSeconds: Number(durationSeconds.toFixed(3)),
  durationToleranceSeconds: Math.max(1, 2 / Number(media.fps ?? 30)),
};
const evaluated = evaluateDeliveryProbe({ probe, expected, decodePassed });
const sha256 = await new Promise((done, reject) => {
  const hash = createHash("sha256");
  const stream = createReadStream(output);
  stream.on("data", (chunk) => hash.update(chunk));
  stream.on("error", reject);
  stream.on("end", () => done(hash.digest("hex")));
});
const report = {
  schemaVersion: "1.0",
  kind: "delivery-validation",
  generatedAt: new Date().toISOString(),
  projectId: config.projectId,
  ...evaluated,
  expected,
  decode: { status: decodePassed ? "passed" : "failed", error: decodeError },
  output: { path: output, bytes: (await stat(output)).size, sha256 },
  provenance: JSON.parse(await readFile(resolve(config.editDir, "delivery-render-report.json"), "utf8")),
  probe,
};
await validateArtifactSchema({
  schemaPath: "schemas/delivery-validation.schema.json",
  artifact: report,
  label: "Delivery validation",
});
await writeFile(resolve(config.deliveryValidationFile), `${JSON.stringify(report, null, 2)}\n`);
console.log(`${config.deliveryValidationFile}: ${report.status}`);
if (report.status !== "passed") process.exitCode = 2;
