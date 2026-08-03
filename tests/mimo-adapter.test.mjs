import assert from "node:assert/strict";
import test from "node:test";
import { createMimoJsonAdapter, groupCaptionSegments } from "../scripts/workflow/mimo-adapter.mjs";

test("MiMo adapter returns JSON without exposing the key in its request body", async () => {
  const original = process.env.TEST_MIMO_KEY;
  process.env.TEST_MIMO_KEY = "top-secret";
  let request;
  const fetchImpl = async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => ({ choices: [{ message: { content: '```json\n{"ok":true}\n```' } }] }) };
  };
  const adapter = createMimoJsonAdapter({
    config: { apiKeyEnv: "TEST_MIMO_KEY", baseUrl: "https://example.test/v1", maxRetries: 0 },
    fetchImpl,
  });
  assert.deepEqual(await adapter.completeJson({ system: "system", user: "user" }), { ok: true });
  assert.equal(request.url, "https://example.test/v1/chat/completions");
  assert.equal(JSON.parse(request.options.body).messages[1].content, "user");
  assert.equal(request.options.body.includes("top-secret"), false);
  if (original === undefined) delete process.env.TEST_MIMO_KEY;
  else process.env.TEST_MIMO_KEY = original;
});

test("caption grouping keeps all text in order", () => {
  const captions = [
    { start: 0, end: 4, zh: "第一句" },
    { start: 4, end: 8, zh: "第二句。" },
    { start: 8, end: 12, zh: "第三句" },
  ];
  const segments = groupCaptionSegments(captions, { minimumSegmentSeconds: 7, maximumSegmentSeconds: 10 });
  assert.equal(segments.map((item) => item.text).join(""), "第一句第二句。第三句");
  assert.ok(segments.every((item) => item.end > item.start));
});
