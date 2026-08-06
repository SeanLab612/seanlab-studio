import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import test from "node:test";
import {
  createCodexCliJsonAdapter,
  stripOptionalNulls,
  toCodexOutputSchema,
} from "../scripts/workflow/codex-cli-adapter.mjs";

test("Codex response schema removes unsupported constraints and makes optional properties nullable", () => {
  const schema = toCodexOutputSchema({
    type: "object",
    properties: {
      ids: { type: "array", uniqueItems: true, items: { type: "string" } },
      nested: { type: "object", properties: { note: { type: "string" } } },
    },
    required: ["ids"],
  });

  assert.deepEqual(schema, {
    type: "object",
    properties: {
      ids: { type: "array", items: { type: "string" } },
      nested: {
        type: ["object", "null"],
        properties: { note: { type: ["string", "null"] } },
        required: ["note"],
      },
    },
    required: ["ids", "nested"],
  });
});

test("Codex response cleanup removes null placeholders only for optional properties", () => {
  const schema = {
    type: "object",
    properties: {
      id: { type: "string" },
      recommendation: {
        type: "object",
        properties: { action: { type: "string" }, relatedIds: { type: "array", items: { type: "string" } } },
        required: ["action"],
      },
    },
    required: ["id", "recommendation"],
  };
  assert.deepEqual(
    stripOptionalNulls({ id: "one", recommendation: { action: "keep", relatedIds: null } }, schema),
    { id: "one", recommendation: { action: "keep" } },
  );
});

test("Codex CLI adapter enforces read-only structured ephemeral execution", async () => {
  let invocation;
  const adapter = createCodexCliJsonAdapter({
    config: { timeoutSeconds: 30, maxRetries: 0 },
    schemaPath: "schemas/project.schema.json",
    runImpl: async (input) => {
      invocation = input;
      await writeFile(input.outputPath, '{"ok":true}\n');
    },
  });
  assert.deepEqual(await adapter.completeJson({ system: "system", user: "user" }), { ok: true });
  assert.match(invocation.prompt, /Do not modify files/);
  assert.match(invocation.schemaPath, /schemas\/project\.schema\.json$/);
  assert.equal(invocation.config.timeoutSeconds, 30);
  assert.deepEqual(
    {
      ...adapter.getLastRunMetadata(),
      elapsedMs: 0,
    },
    {
      provider: "codex-cli",
      executor: "codex-cli",
      cliVersion: "unknown",
      model: "unknown",
      modelSource: "unreported",
      sandbox: "read-only",
      approval: "never",
      schemaPath: invocation.schemaPath,
      status: "succeeded",
      attemptCount: 1,
      elapsedMs: 0,
    },
  );
});

test("Codex CLI adapter rejects model or profile strings that could inject arguments", async () => {
  const adapter = createCodexCliJsonAdapter({
    config: { model: "model --danger", maxRetries: 0 },
    schemaPath: "schemas/project.schema.json",
    runImpl: async ({ outputPath, config }) => {
      if (!/^[A-Za-z0-9._-]+$/.test(config.model)) throw new Error("Codex model contains unsupported characters");
      await writeFile(outputPath, '{}');
    },
  });
  await assert.rejects(adapter.completeJson({ system: "system", user: "user" }), /unsupported characters/);
});

test("Codex CLI adapter records cancellation and never retries it", async () => {
  let calls = 0;
  const adapter = createCodexCliJsonAdapter({
    config: { maxRetries: 3 },
    schemaPath: "schemas/project.schema.json",
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

test("Codex CLI adapter forwards approved local images to the structured run", async () => {
  let invocation;
  const adapter = createCodexCliJsonAdapter({
    config: { maxRetries: 0 },
    schemaPath: "schemas/project.schema.json",
    runImpl: async (input) => {
      invocation = input;
      await writeFile(input.outputPath, '{"ok":true}\n');
    },
  });
  await adapter.completeJson({ system: "system", user: "user", imagePaths: ["/tmp/source-frame.png"] });
  assert.deepEqual(invocation.imagePaths, ["/tmp/source-frame.png"]);
});
