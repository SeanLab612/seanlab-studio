import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { assertPublicSourceUrl, resolveAuthoringSources } from "../scripts/creator/source-context.mjs";

test("authoring rejects loopback and private source URLs before fetching", async () => {
  await assert.rejects(assertPublicSourceUrl("http://127.0.0.1/admin"), /Private or local/);
  await assert.rejects(assertPublicSourceUrl("http://192.168.1.2/admin"), /Private or local/);
  await assert.rejects(assertPublicSourceUrl("http://[::1]/admin"), /Private or local/);
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
