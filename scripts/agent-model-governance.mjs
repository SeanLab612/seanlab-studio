import { createHash } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  registerConformanceCandidate,
  reviewAgentModelCandidate,
  validateAgentModelGovernance,
} from "../src/agents/governance.ts";

const args = process.argv.slice(2);
const command = args[0] ?? "list";
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};
const required = (name) => {
  const value = option(name);
  if (!value) throw new Error(`Missing required option ${name}`);
  return value;
};
const registryPath = resolve(option("--registry", "config/agent-model-governance.json"));
const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));
const writeJsonAtomic = async (path, value) => {
  const temporary = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporary, path);
};

if (command === "list") {
  const registry = validateAgentModelGovernance(await readJson(registryPath));
  console.log(JSON.stringify(registry, null, 2));
} else if (command === "register") {
  const reportPath = resolve(required("--report"));
  const reportBytes = await readFile(reportPath);
  const reportSha256 = createHash("sha256").update(reportBytes).digest("hex");
  const registry = registerConformanceCandidate({
    registry: await readJson(registryPath),
    report: JSON.parse(reportBytes.toString("utf8")),
    reportSha256,
  });
  await writeJsonAtomic(registryPath, registry);
  const candidate = registry.pairs.find((pair) => pair.conformanceReportSha256 === reportSha256);
  console.log(
    JSON.stringify({
      status: "candidate",
      pairId: candidate?.id,
      report: reportPath,
      reportSha256,
      next: "Human review is required before approve or block.",
    }),
  );
} else if (command === "approve" || command === "block") {
  const registry = reviewAgentModelCandidate({
    registry: await readJson(registryPath),
    pairId: required("--pair"),
    decision: command === "approve" ? "approved" : "blocked",
    reportSha256: required("--report-sha256"),
    reviewer: required("--reviewer"),
    reviewedAt: option("--reviewed-at", new Date().toISOString()),
    reason: required("--reason"),
  });
  await writeJsonAtomic(registryPath, registry);
  console.log(JSON.stringify({ status: command === "approve" ? "approved" : "blocked", pairId: required("--pair") }));
} else {
  throw new Error("Usage: agent-model-governance.mjs list|register|approve|block [options]");
}
