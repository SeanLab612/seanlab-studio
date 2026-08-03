import { copyFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { signatureFor } from "./workflow/state.mjs";

const config = JSON.parse(await readFile(resolve(process.argv[2]), "utf8"));
const state = JSON.parse(await readFile(resolve(config.editDir, "run-state.json"), "utf8"));
const approval = state.stages?.["recut-approval"];
if (approval?.status !== "approved") throw new Error("recut proposal promotion requires explicit recut approval");
const reviewedInputs = [
  config.proposedEdlFile,
  config.recutCandidatesFile,
  config.recutReviewFile,
  config.recutPreviewFile,
].map((path) => resolve(path));
if ((await signatureFor(reviewedInputs)) !== approval.reviewSha256)
  throw new Error("recut proposal promotion is blocked because reviewed artifacts changed after approval");
const proposal = JSON.parse(await readFile(resolve(config.proposedEdlFile), "utf8"));
const review = JSON.parse(await readFile(resolve(config.recutCandidatesFile), "utf8"));
if (proposal.version !== 2 || review.schemaVersion !== "2.0" || review.status !== "proposed")
  throw new Error("recut promotion requires a valid reviewed 2.0 proposal");
if (Math.abs(proposal.totalDurationS - review.summary.proposedDurationSeconds) > 0.001)
  throw new Error("recut proposal and candidate review duration do not match");
await copyFile(resolve(config.proposedEdlFile), resolve(config.editDir, "edl.json"));
console.log(`${resolve(config.editDir, "edl.json")}: promoted reviewed recut proposal`);
