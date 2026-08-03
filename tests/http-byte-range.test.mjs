import assert from "node:assert/strict";
import test from "node:test";
import { parseSingleByteRange } from "../scripts/operations/http-byte-range.mjs";

test("parses explicit, open-ended, and suffix byte ranges", () => {
  assert.deepEqual(parseSingleByteRange("bytes=0-1023", 5000), { start: 0, end: 1023 });
  assert.deepEqual(parseSingleByteRange("bytes=4096-", 5000), { start: 4096, end: 4999 });
  assert.deepEqual(parseSingleByteRange("bytes=-1024", 5000), { start: 3976, end: 4999 });
});

test("caps ranges to the file without changing suffix semantics", () => {
  assert.deepEqual(parseSingleByteRange("bytes=4500-9000", 5000), { start: 4500, end: 4999 });
  assert.deepEqual(parseSingleByteRange("bytes=-9000", 5000), { start: 0, end: 4999 });
});

test("rejects malformed, empty, multiple, and unsatisfiable ranges", () => {
  for (const header of ["bytes=-", "bytes=-0", "bytes=5000-", "bytes=20-10", "bytes=0-1,4-5", "items=0-1"])
    assert.equal(parseSingleByteRange(header, 5000), undefined);
  assert.equal(parseSingleByteRange("bytes=0-1", 0), undefined);
});
