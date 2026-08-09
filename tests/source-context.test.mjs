import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  assertPublicSourceUrl,
  createPinnedLookup,
  fetchPublicSourceText,
  resolveAuthoringSources,
  resolvePublicSourceTarget,
} from "../scripts/creator/source-context.mjs";

test("authoring rejects loopback and private source URLs before fetching", async () => {
  await assert.rejects(assertPublicSourceUrl("http://127.0.0.1/admin"), /Private or local/);
  await assert.rejects(assertPublicSourceUrl("http://192.168.1.2/admin"), /Private or local/);
  await assert.rejects(assertPublicSourceUrl("http://[::1]/admin"), /Private or local/);
});

test("authoring pins the validated public address for the actual request", async () => {
  let resolutions = 0;
  const target = await resolvePublicSourceTarget("https://example.test/source", {
    resolver: async () => {
      resolutions += 1;
      return [{ address: "203.0.113.10", family: 4 }];
    },
  });
  assert.equal(resolutions, 1);
  assert.equal(target.address, "203.0.113.10");
  const lookup = createPinnedLookup(target);
  const address = await new Promise((resolveLookup, rejectLookup) =>
    lookup("example.test", {}, (error, value) => (error ? rejectLookup(error) : resolveLookup(value))),
  );
  assert.equal(address, "203.0.113.10");
});

test("authoring revalidates and pins every redirect target", async () => {
  const targets = [];
  const responses = [
    {
      statusCode: 302,
      headers: { location: "https://redirect.test/final" },
      resume() {},
    },
    {
      statusCode: 200,
      headers: {},
      async *[Symbol.asyncIterator]() {
        yield Buffer.from("verified source");
      },
    },
  ];
  const result = await fetchPublicSourceText("https://origin.test/source", {}, {
    resolveTarget: async (url) => {
      targets.push(url.hostname);
      return { url, address: "203.0.113.10", family: 4 };
    },
    requestSource: async () => responses.shift(),
  });
  assert.equal(result, "verified source");
  assert.deepEqual(targets, ["origin.test", "redirect.test"]);
});

test("authoring freezes supported notes and local text while failing closed on binary references", async () => {
  const directory = await mkdtemp(join(tmpdir(), "remotion-md-source-"));
  const markdown = join(directory, "brief.md");
  const image = join(directory, "screen.png");
  await writeFile(markdown, "# Evidence\nThe project has three modules.");
  await writeFile(image, "not-real-image");
  const result = await resolveAuthoringSources([
    { id: "note", kind: "note", label: "creator note", value: "只展示成果，不做安装教程" },
    { id: "brief", kind: "file", label: "brief", value: markdown },
    { id: "image", kind: "file", label: "image", value: image },
  ]);
  assert.equal(result[0].status, "resolved");
  assert.match(result[1].content, /three modules/);
  assert.equal(result[2].status, "failed");
});

test("authoring keeps a previously resolved source when a later refresh fails", async () => {
  const previous = [
    { id: "site", kind: "url", label: "官网", status: "resolved", content: "已经冻结的可信内容" },
  ];
  const result = await resolveAuthoringSources(
    [{ id: "site", kind: "url", label: "官网", value: "http://127.0.0.1:1/unavailable" }],
    { previous },
  );
  assert.equal(result[0].status, "resolved");
  assert.equal(result[0].cached, true);
  assert.match(result[0].content, /可信内容/);
});
