import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { resolveAgentExecutable } from "../../src/agents/registry.ts";
import { processTreeSpawnOptions, terminateProcessTree } from "./process-tree.mjs";

const safeCliToken = /^[A-Za-z0-9._-]+$/;

const assertSafeOptionalToken = (value, label) => {
  if (value !== undefined && (!safeCliToken.test(value) || value.length > 128)) {
    throw new Error(`${label} contains unsupported characters`);
  }
};

const cancelledError = () => Object.assign(new Error("Codex CLI structured run was cancelled"), { name: "AbortError" });

// Codex structured outputs intentionally support a smaller JSON Schema subset
// than Ajv. Keep the repository schema authoritative for local validation, but
// remove response-format-only incompatibilities before handing it to the CLI.
const nullableSchema = (schema) => {
  if (Array.isArray(schema.type))
    return { ...schema, type: schema.type.includes("null") ? schema.type : [...schema.type, "null"] };
  if (typeof schema.type === "string") return { ...schema, type: [schema.type, "null"] };
  if (Array.isArray(schema.enum))
    return { ...schema, enum: schema.enum.includes(null) ? schema.enum : [...schema.enum, null] };
  return { anyOf: [schema, { type: "null" }] };
};

export const toCodexOutputSchema = (value) => {
  if (Array.isArray(value)) return value.map(toCodexOutputSchema);
  if (!value || typeof value !== "object") return value;
  const converted = Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "uniqueItems")
      .map(([key, child]) => [key, toCodexOutputSchema(child)]),
  );
  if (!converted.properties || typeof converted.properties !== "object") return converted;
  const originallyRequired = new Set(value.required ?? []);
  converted.properties = Object.fromEntries(
    Object.entries(converted.properties).map(([key, child]) => [
      key,
      originallyRequired.has(key) ? child : nullableSchema(child),
    ]),
  );
  converted.required = Object.keys(converted.properties);
  return converted;
};

export const stripOptionalNulls = (value, schema) => {
  if (Array.isArray(value)) return value.map((item) => stripOptionalNulls(item, schema?.items));
  if (!value || typeof value !== "object" || !schema?.properties) return value;
  const required = new Set(schema.required ?? []);
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key, child]) => child !== null || required.has(key))
      .map(([key, child]) => [key, stripOptionalNulls(child, schema.properties[key])]),
  );
};

export const runCodexExec = async ({ prompt, schemaPath, outputPath, imagePaths = [], config, cwd, signal }) => {
  const executablePath = await resolveAgentExecutable("codex");
  if (!executablePath)
    throw new Error("Codex CLI executable could not be resolved from PATH or supported user-local bins");
  const sourceSchema = JSON.parse(await readFile(resolve(schemaPath), "utf8"));
  const codexSchemaPath = `${outputPath}.schema.json`;
  await writeFile(codexSchemaPath, `${JSON.stringify(toCodexOutputSchema(sourceSchema), null, 2)}\n`, "utf8");

  return new Promise((resolveRun, rejectRun) => {
    assertSafeOptionalToken(config.model, "Codex model");
    assertSafeOptionalToken(config.profile, "Codex profile");
    const args = [
      "exec",
      "--ephemeral",
      "--sandbox",
      "read-only",
      "--color",
      "never",
      "--output-schema",
      codexSchemaPath,
      "--output-last-message",
      outputPath,
      "-C",
      cwd,
      ...(config.model ? ["--model", config.model] : []),
      ...(config.profile ? ["--profile", config.profile] : []),
      ...imagePaths.flatMap((path) => ["--image", resolve(path)]),
      "-",
    ];
    const child = spawn(
      executablePath,
      args,
      processTreeSpawnOptions({ cwd, env: process.env, stdio: ["pipe", "pipe", "pipe"] }),
    );
    let stdout = "";
    let stderr = "";
    let settled = false;
    let timeout;
    const cleanup = () => {
      if (timeout) clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
    };
    const succeed = (value) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolveRun(value);
    };
    const fail = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      rejectRun(error);
    };
    const onAbort = () => {
      terminateProcessTree(child, "SIGTERM");
      fail(cancelledError());
    };
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    timeout = setTimeout(
      () => {
        terminateProcessTree(child, "SIGTERM");
        fail(new Error(`Codex CLI semantic planning timed out after ${config.timeoutSeconds ?? 300}s`));
      },
      (config.timeoutSeconds ?? 300) * 1000,
    );
    if (signal?.aborted) onAbort();
    else signal?.addEventListener("abort", onAbort, { once: true });
    child.on("error", fail);
    child.on("close", (code) => {
      if (code === 0) succeed({ stdout, stderr });
      else fail(new Error(`Codex CLI semantic planning exited with code ${code}: ${stderr.trim()}`));
    });
    child.stdin.end(prompt);
  });
};

export const createCodexCliJsonAdapter = ({ config, schemaPath, cwd = process.cwd(), runImpl = runCodexExec }) => {
  let lastRunMetadata;
  return {
    getLastRunMetadata: () => lastRunMetadata,
    async completeJson({ system, user, imagePaths = [], signal }) {
      const sourceSchema = JSON.parse(await readFile(resolve(schemaPath), "utf8"));
      const attempts = (config.maxRetries ?? 1) + 1;
      let lastError;
      let executedAttempts = 0;
      const started = performance.now();
      for (let attempt = 0; attempt < attempts; attempt++) {
        executedAttempts = attempt + 1;
        const temp = await mkdtemp(join(tmpdir(), "remotion-md-codex-"));
        const outputPath = join(temp, "semantic-output.json");
        try {
          const prompt = [
            system,
            "",
            "The supplied JSON Schema is authoritative. Return only the requested JSON value.",
            "Do not modify files, run commands, or use external information.",
            "",
            user,
          ].join("\n");
          const run = await runImpl({
            prompt,
            schemaPath: resolve(schemaPath),
            outputPath,
            imagePaths,
            config,
            cwd: resolve(cwd),
            signal,
          });
          const diagnostic = `${run?.stdout ?? ""}\n${run?.stderr ?? ""}`;
          lastRunMetadata = {
            provider: "codex-cli",
            executor: "codex-cli",
            cliVersion: diagnostic.match(/OpenAI Codex v([^\n]+)/)?.[1]?.trim() ?? "unknown",
            model: diagnostic.match(/^model:\s*(.+)$/m)?.[1]?.trim() ?? config.model ?? "unknown",
            modelSource: diagnostic.match(/^model:\s*(.+)$/m)
              ? "executor-reported"
              : config.model
                ? "project-declared"
                : "unreported",
            sandbox: diagnostic.match(/^sandbox:\s*(.+)$/m)?.[1]?.trim() ?? "read-only",
            approval: diagnostic.match(/^approval:\s*(.+)$/m)?.[1]?.trim() ?? "never",
            schemaPath: resolve(schemaPath),
            status: "succeeded",
            attemptCount: attempt + 1,
            elapsedMs: Math.round(performance.now() - started),
          };
          return stripOptionalNulls(JSON.parse(await readFile(outputPath, "utf8")), sourceSchema);
        } catch (error) {
          lastError = error;
          if (error?.name === "AbortError") break;
        } finally {
          await rm(temp, { recursive: true, force: true });
        }
      }
      lastRunMetadata = {
        provider: "codex-cli",
        executor: "codex-cli",
        model: config.model ?? "unknown",
        modelSource: config.model ? "project-declared" : "unreported",
        sandbox: "read-only",
        approval: "never",
        schemaPath: resolve(schemaPath),
        status: lastError?.name === "AbortError" ? "cancelled" : "failed",
        attemptCount: executedAttempts,
        elapsedMs: Math.round(performance.now() - started),
        failure: lastError?.message ?? "unknown error",
      };
      if (lastError?.name === "AbortError") throw lastError;
      throw new Error(
        `Codex CLI semantic planning failed after ${executedAttempts} attempts: ${lastError?.message ?? "unknown error"}`,
        { cause: lastError },
      );
    },
  };
};
