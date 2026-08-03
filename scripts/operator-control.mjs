import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { basename, isAbsolute, relative, resolve, sep } from "node:path";
import { classifyOperationalError, redactSecrets } from "./operations/errors.mjs";
import { validateOperatorRequest } from "../src/operator-control/contract.ts";
import { revisionRequestPathForOperator } from "./operations/revisions.mjs";

const requestPath = process.argv[process.argv.indexOf("--request") + 1];
if (!requestPath) throw new Error("Usage: npm run operator:control -- --request <request.json>");
const request = validateOperatorRequest(JSON.parse(await readFile(resolve(requestPath), "utf8")));
const projectPath = request.projectId ? resolve("projects", request.projectId, "project.json") : undefined;
const projectArgs = projectPath ? ["--project", projectPath] : [];
const repositoryRoot = resolve(".");
const publicPath = (value) => {
  if (!isAbsolute(value)) return value;
  const repositoryRelative = relative(repositoryRoot, value);
  if (!repositoryRelative.startsWith(`..${sep}`) && repositoryRelative !== "..")
    return `repository/${repositoryRelative}`;
  return `external/${basename(value)}`;
};
const sanitizePayload = (value) => {
  if (Array.isArray(value)) return value.map(sanitizePayload);
  if (value && typeof value === "object")
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitizePayload(item)]));
  if (typeof value !== "string") return value;
  const redacted = redactSecrets(value);
  if (isAbsolute(redacted)) return publicPath(redacted);
  const repositoryRedacted = redacted.replaceAll(repositoryRoot, "repository");
  return process.env.HOME ? repositoryRedacted.replaceAll(process.env.HOME, "$HOME") : repositoryRedacted;
};

const invocation = (() => {
  switch (request.action) {
    case "doctor":
      return [process.execPath, ["scripts/check-env.mjs", ...projectArgs, "--json"]];
    case "preflight":
      return [process.execPath, ["scripts/project-preflight.mjs", ...projectArgs, "--json"]];
    case "status":
      return [process.execPath, ["--experimental-strip-types", "scripts/project-status.mjs", ...projectArgs]];
    case "plan":
      return [process.execPath, ["scripts/workflow.mjs", ...projectArgs, "--until", "plan", "--dry-run"]];
    case "review":
      return [process.execPath, ["scripts/workflow.mjs", ...projectArgs, "--until", "review"]];
    case "resume":
      return [
        process.execPath,
        [
          "scripts/workflow.mjs",
          ...projectArgs,
          "--until",
          request.target ?? "review",
          ...(request.fromStage ? ["--from", request.fromStage] : []),
        ],
      ];
    case "apply-revision":
      return [
        process.execPath,
        [
          "--experimental-strip-types",
          "--experimental-specifier-resolution=node",
          "scripts/apply-revision.mjs",
          ...projectArgs,
          "--revision",
          revisionRequestPathForOperator({ projectId: request.projectId, revisionId: request.revisionId }),
        ],
      ];
    case "approve":
      return [
        process.execPath,
        [
          "scripts/workflow.mjs",
          ...projectArgs,
          "--approve",
          ...(request.qaWaiverReason ? ["--waive-qa", request.qaWaiverReason] : []),
        ],
      ];
    case "approve-recut":
      return [process.execPath, ["scripts/workflow.mjs", ...projectArgs, "--approve-recut"]];
    case "export-bundle":
      return [
        process.execPath,
        [
          "scripts/project-export.mjs",
          ...projectArgs,
          "--output",
          resolve("out/project-bundles", `${request.projectId}-${request.requestId}.vrbundle`),
          ...(request.includeReview ? ["--include-review"] : []),
        ],
      ];
    case "acceptance":
      return [process.execPath, ["scripts/acceptance.mjs", ...projectArgs]];
  }
})();

const emit = (event, extra = {}) =>
  console.log(
    JSON.stringify({
      schemaVersion: "1.0",
      requestId: request.requestId,
      projectId: request.projectId,
      event,
      at: new Date().toISOString(),
      ...sanitizePayload(extra),
    }),
  );

emit("control.started", { payload: { action: request.action } });
const [command, commandArgs] = invocation;
const child = spawn(command, commandArgs, { cwd: process.cwd(), env: process.env });
let stderr = "";
const forward = (chunk, stream) => {
  const text = chunk.toString();
  if (stream === "stderr") stderr += text;
  for (const line of text.split(/\r?\n/).filter(Boolean)) {
    try {
      emit("control.output", { payload: JSON.parse(line) });
    } catch {
      emit("control.output", { payload: { stream, message: line } });
    }
  }
};
child.stdout.on("data", (chunk) => forward(chunk, "stdout"));
child.stderr.on("data", (chunk) => forward(chunk, "stderr"));
const exitCode = await new Promise((done) => {
  child.on("error", () => done(-1));
  child.on("close", done);
});
if (exitCode === 0) emit("control.finished", { payload: { action: request.action, exitCode } });
else {
  const failure = classifyOperationalError(new Error(stderr || `${request.action} exited with code ${exitCode}`), {
    stage: request.action,
    exitCode,
  });
  emit("control.failed", { failure });
  process.exitCode = 1;
}
