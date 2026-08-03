import assert from "node:assert/strict";
import test from "node:test";
import { formatBytes, parseGitCountObjects } from "../scripts/repository-health.mjs";

test("parses raw git object statistics without depending on localized human units", () => {
  assert.deepEqual(parseGitCountObjects("count: 3\nsize: 12\npacks: 2\nsize-pack: 4096\ngarbage: 1\nsize-garbage: 8\n"), {
    count: "3",
    size: "12",
    packs: "2",
    "size-pack": "4096",
    garbage: "1",
    "size-garbage": "8",
  });
});

test("formats repository sizes for a concise operator report", () => {
  assert.equal(formatBytes(0), "0 B");
  assert.equal(formatBytes(1024), "1.00 KB");
  assert.equal(formatBytes(11 * 1024 * 1024 * 1024), "11.0 GB");
});
