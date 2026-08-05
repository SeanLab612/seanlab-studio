import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { resolveAgentExecutable } from "../../src/agents/registry.ts";
import { processTreeSpawnOptions, terminateProcessTree } from "./process-tree.mjs";

const safeCliToken = /^[A-Za-z0-9._[\]-]+$/;

const assertSafeOptionalToken = (value, label) => {
  if (value !== undefined && (!safeCliToken.test(value) || value.length > 128)) {
    throw new Error(`${label} contains unsupported characters`);
  }
};

const unwrapExactJsonFence = (value) => {
  const trimmed = value.trim();
  const match = trimmed.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i);
  return match ? match[1].trim() : trimmed;
};

const jsonTypeMatches = (value, type) => {
  if (type === "null") return value === null;
  if (type === "array") return Array.isArray(value);
  if (type === "object") return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  if (type === "integer") return Number.isInteger(value);
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  return typeof value === type;
};

export const assertMatchesJsonSchema = (value, schema, path = "$") => {
  if (schema.const !== undefined && !Object.is(value, schema.const))
    throw new Error(`${path} must equal ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.some((item) => Object.is(item, value)))
    throw new Error(`${path} must be one of ${schema.enum.map((item) => JSON.stringify(item)).join(", ")}`);
  const types = schema.type === undefined ? [] : Array.isArray(schema.type) ? schema.type : [schema.type];
  if (types.length && !types.some((type) => jsonTypeMatches(value, type)))
    throw new Error(`${path} must have type ${types.join(" or ")}`);
  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength)
      throw new Error(`${path} must contain at least ${schema.minLength} characters`);
    if (schema.maxLength !== undefined && value.length > schema.maxLength)
      throw new Error(`${path} must contain at most ${schema.maxLength} characters`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value))
      throw new Error(`${path} does not match its pattern`);
  }
  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) throw new Error(`${path} is below its minimum`);
    if (schema.maximum !== undefined && value > schema.maximum) throw new Error(`${path} exceeds its maximum`);
    if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum)
      throw new Error(`${path} must exceed its exclusive minimum`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems)
      throw new Error(`${path} must contain at least ${schema.minItems} items`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems)
      throw new Error(`${path} must contain at most ${schema.maxItems} items`);
    if (schema.items)
      value.forEach((item, index) => {
        assertMatchesJsonSchema(item, schema.items, `${path}[${index}]`);
      });
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const key of schema.required ?? [])
      if (!Object.hasOwn(value, key)) throw new Error(`${path}.${key} is required`);
    if (schema.additionalProperties === false) {
      const unknown = Object.keys(value).filter((key) => !Object.hasOwn(schema.properties ?? {}, key));
      if (unknown.length) throw new Error(`${path} contains unsupported fields: ${unknown.join(", ")}`);
    }
    for (const [key, childSchema] of Object.entries(schema.properties ?? {}))
      if (Object.hasOwn(value, key)) assertMatchesJsonSchema(value[key], childSchema, `${path}.${key}`);
  }
  return value;
};

export const parseClaudeStructuredOutput = (stdout) => {
  const envelope = JSON.parse(stdout);
  const structured = envelope.structured_output ?? envelope.structuredOutput ?? envelope.result;
  const value = typeof structured === "string" ? JSON.parse(unwrapExactJsonFence(structured)) : structured;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Claude Code returned no structured_output object");
  }
  return value;
};

const cancelledError = () =>
  Object.assign(new Error("Claude Code structured run was cancelled"), { name: "AbortError" });

export const runClaudePrint = async ({ prompt, schemaPath, outputPath, imagePaths = [], config, cwd, signal }) => {
  assertSafeOptionalToken(config.model, "Claude model");
  const executablePath = await resolveAgentExecutable("claude");
  if (!executablePath)
    throw new Error("Claude Code executable could not be resolved from PATH or supported user-local bins");
  const schema = JSON.parse(await readFile(resolve(schemaPath), "utf8"));
  return new Promise((resolveRun, rejectRun) => {
    const args = [
      "--print",
      "--safe-mode",
      "--tools",
      imagePaths.length ? "Read" : "",
      "--permission-mode",
      "plan",
      "--no-session-persistence",
      "--output-format",
      "json",
      "--json-schema",
      JSON.stringify(schema),
      ...(config.model ? ["--model", config.model] : []),
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
        fail(new Error(`Claude Code structured run timed out after ${config.timeoutSeconds ?? 300}s`));
      },
      (config.timeoutSeconds ?? 300) * 1000,
    );
    if (signal?.aborted) onAbort();
    else signal?.addEventListener("abort", onAbort, { once: true });
    child.on("error", fail);
    child.on("close", async (code) => {
      if (code !== 0) {
        fail(new Error(`Claude Code structured run exited with code ${code}: ${stderr.trim()}`));
        return;
      }
      try {
        const value = parseClaudeStructuredOutput(stdout);
        assertMatchesJsonSchema(value, schema);
        await writeFile(outputPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
        succeed({ stdout, stderr });
      } catch (error) {
        fail(new Error(`Claude Code output was not valid structured JSON: ${error.message}`));
      }
    });
    child.stdin.end(prompt);
  });
};

export const createClaudeCodeJsonAdapter = ({ config, schemaPath, cwd = process.cwd(), runImpl = runClaudePrint }) => {
  let lastRunMetadata;
  return {
    getLastRunMetadata: () => lastRunMetadata,
    async completeJson({ system, user, imagePaths = [], signal }) {
      const attempts = (config.maxRetries ?? 1) + 1;
      const schema = JSON.parse(await readFile(resolve(schemaPath), "utf8"));
      let lastError;
      let executedAttempts = 0;
      const started = performance.now();
      for (let attempt = 0; attempt < attempts; attempt++) {
        executedAttempts = attempt + 1;
        const outputPath = resolve(cwd, `.claude-structured-${process.pid}-${attempt}.json`);
        try {
          const prompt = [
            system,
            "",
            "The supplied JSON Schema is authoritative. Return only the requested JSON value.",
            imagePaths.length
              ? "Do not modify files, run commands, browse, or use external information. Use the Read tool only to inspect the explicitly listed local images."
              : "Do not modify files, run commands, browse, or use external information.",
            ...(imagePaths.length
              ? ["Local images to inspect:", ...imagePaths.map((path) => `- ${resolve(path)}`)]
              : []),
            "The complete JSON Schema is included below because some local Claude Code providers do not enforce --json-schema natively:",
            JSON.stringify(schema),
            ...(lastError
              ? [
                  "",
                  `The previous attempt was rejected: ${lastError.message}`,
                  "Correct the structure and return a complete replacement object that matches the schema exactly.",
                ]
              : []),
            "",
            user,
          ].join("\n");
          const run = await runImpl({
            prompt,
            schemaPath,
            outputPath,
            imagePaths,
            config,
            cwd: resolve(cwd),
            signal,
          });
          const value = JSON.parse(await readFile(outputPath, "utf8"));
          assertMatchesJsonSchema(value, schema);
          const diagnostic = `${run?.stdout ?? ""}\n${run?.stderr ?? ""}`;
          lastRunMetadata = {
            provider: "claude-code",
            executor: "claude-code",
            cliVersion: diagnostic.match(/Claude Code[^\d]*([0-9][^\s"]*)/i)?.[1] ?? "unknown",
            model: config.model ?? "unknown",
            modelSource: config.model ? "project-declared" : "unreported",
            sandbox: imagePaths.length ? "read-only-images-safe-mode" : "tools-disabled-safe-mode",
            approval: "plan",
            schemaPath: resolve(schemaPath),
            status: "succeeded",
            attemptCount: attempt + 1,
            elapsedMs: Math.round(performance.now() - started),
          };
          return value;
        } catch (error) {
          lastError = error;
          if (error?.name === "AbortError") break;
        } finally {
          const { rm } = await import("node:fs/promises");
          await rm(outputPath, { force: true });
        }
      }
      lastRunMetadata = {
        provider: "claude-code",
        executor: "claude-code",
        model: config.model ?? "unknown",
        modelSource: config.model ? "project-declared" : "unreported",
        sandbox: imagePaths.length ? "read-only-images-safe-mode" : "tools-disabled-safe-mode",
        approval: "plan",
        schemaPath: resolve(schemaPath),
        status: lastError?.name === "AbortError" ? "cancelled" : "failed",
        attemptCount: executedAttempts,
        elapsedMs: Math.round(performance.now() - started),
        failure: lastError?.message ?? "unknown error",
      };
      if (lastError?.name === "AbortError") throw lastError;
      throw new Error(
        `Claude Code structured run failed after ${executedAttempts} attempts: ${lastError?.message ?? "unknown error"}`,
        { cause: lastError },
      );
    },
  };
};
