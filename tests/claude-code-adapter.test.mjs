import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { resolve } from "node:path";
import {
  assertMatchesJsonSchema,
  createClaudeCodeJsonAdapter,
  parseClaudeStructuredOutput,
} from "../scripts/workflow/claude-code-adapter.mjs";

test("Claude Code adapter parses the native structured output envelope", () => {
  assert.deepEqual(
    parseClaudeStructuredOutput(JSON.stringify({ structured_output: { title: "SeanLab" } })),
    { title: "SeanLab" },
  );
});

test("Claude Code adapter accepts an exact fenced JSON result", () => {
  assert.deepEqual(
    parseClaudeStructuredOutput(JSON.stringify({ result: '```json\n{"title":"SeanLab"}\n```' })),
    { title: "SeanLab" },
  );
});

test("Claude Code adapter rejects prose wrapped around a JSON fence", () => {
  assert.throws(
    () =>
      parseClaudeStructuredOutput(
        JSON.stringify({ result: 'Here is the result:\n```json\n{"title":"SeanLab"}\n```' }),
      ),
    /Unexpected token/,
  );
});

test("Claude Code adapter rejects arrays as the structured root", () => {
  assert.throws(
    () => parseClaudeStructuredOutput(JSON.stringify({ structured_output: [] })),
    /no structured_output object/,
  );
});

test("Claude Code adapter validates required fields before returning provider output", () => {
  const schema = {
    type: "object",
    required: ["schemaVersion", "sections"],
    properties: {
      schemaVersion: { const: "1.0" },
      sections: { type: "array", minItems: 2, items: { type: "object" } },
    },
    additionalProperties: false,
  };
  assert.throws(() => assertMatchesJsonSchema({ sections: [] }, schema), /schemaVersion is required/);
  assert.throws(
    () => assertMatchesJsonSchema({ schemaVersion: "1.0", sections: [] }, schema),
    /at least 2 items/,
  );
  assert.doesNotThrow(() => assertMatchesJsonSchema({ schemaVersion: "1.0", sections: [{}, {}] }, schema));
});

test("Claude Code adapter shares the strict structured read-only contract", async () => {
  let invocation;
  const root = await mkdtemp(join(tmpdir(), "claude-schema-"));
  const schemaPath = join(root, "schema.json");
  await writeFile(
    schemaPath,
    JSON.stringify({
      type: "object",
      required: ["ok"],
      properties: { ok: { const: true } },
      additionalProperties: false,
    }),
  );
  const adapter = createClaudeCodeJsonAdapter({
    config: { timeoutSeconds: 30, maxRetries: 0, model: "sonnet" },
    schemaPath,
    runImpl: async (input) => {
      invocation = input;
      await writeFile(input.outputPath, '{"ok":true}\n');
      return { stdout: "Claude Code 2.1.186" };
    },
  });
  assert.deepEqual(await adapter.completeJson({ system: "system", user: "user" }), { ok: true });
  assert.match(invocation.prompt, /Do not modify files, run commands, browse/);
  assert.match(invocation.prompt, /The complete JSON Schema is included below/);
  assert.match(invocation.prompt, /"required":\["ok"\]/);
  assert.equal(invocation.config.model, "sonnet");
  assert.deepEqual(
    {
      ...adapter.getLastRunMetadata(),
      elapsedMs: 0,
    },
    {
      provider: "claude-code",
      executor: "claude-code",
      cliVersion: "2.1.186",
      model: "sonnet",
      modelSource: "project-declared",
      sandbox: "tools-disabled-safe-mode",
      approval: "plan",
      schemaPath: resolve(invocation.schemaPath),
      status: "succeeded",
      attemptCount: 1,
      elapsedMs: 0,
    },
  );
});

test("Claude Code adapter records cancellation and never retries it", async () => {
  let calls = 0;
  const root = await mkdtemp(join(tmpdir(), "claude-cancel-"));
  const schemaPath = join(root, "schema.json");
  await writeFile(schemaPath, JSON.stringify({ type: "object" }));
  const adapter = createClaudeCodeJsonAdapter({
    config: { maxRetries: 3 },
    schemaPath,
    runImpl: async () => {
      calls += 1;
      throw Object.assign(new Error("cancelled"), { name: "AbortError" });
    },
  });
  await assert.rejects(adapter.completeJson({ system: "system", user: "user" }), /cancelled/);
  assert.equal(calls, 1);
  assert.equal(adapter.getLastRunMetadata().status, "cancelled");
  assert.equal(adapter.getLastRunMetadata().attemptCount, 1);
});

test("Claude Code adapter permits only read access when local images are supplied", async () => {
  let invocation;
  const root = await mkdtemp(join(tmpdir(), "claude-image-schema-"));
  const schemaPath = join(root, "schema.json");
  await writeFile(
    schemaPath,
    JSON.stringify({
      type: "object",
      required: ["ok"],
      properties: { ok: { const: true } },
      additionalProperties: false,
    }),
  );
  const adapter = createClaudeCodeJsonAdapter({
    config: { maxRetries: 0 },
    schemaPath,
    runImpl: async (input) => {
      invocation = input;
      await writeFile(input.outputPath, '{"ok":true}\n');
      return {};
    },
  });
  await adapter.completeJson({ system: "system", user: "user", imagePaths: ["/tmp/source-frame.png"] });
  assert.deepEqual(invocation.imagePaths, ["/tmp/source-frame.png"]);
  assert.match(invocation.prompt, /Use the Read tool only/);
  assert.equal(adapter.getLastRunMetadata().sandbox, "read-only-images-safe-mode");
});
