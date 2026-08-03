import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import test from "node:test";
import { typographyTokens } from "../src/design-tokens/tokens.ts";

const sourceFiles = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = resolve(directory, entry.name);
      return entry.isDirectory() ? sourceFiles(path) : [path];
    }),
  );
  return nested.flat().filter((path) => [".ts", ".tsx", ".mjs", ".md"].includes(extname(path)));
};

test("production and operator contracts permanently exclude the retired bundled font", async () => {
  assert.equal(typographyTokens.policyVersion, "system-1.0");
  assert.match(typographyTokens.family, /SF Pro Display/);
  assert.match(typographyTokens.family, /PingFang SC/);
  assert.doesNotMatch(typographyTokens.family, /\bInter\b/);
  const files = [
    ...(await sourceFiles(resolve("src"))),
    ...(await sourceFiles(resolve("scripts"))),
    ...(await sourceFiles(resolve("skills"))),
    ...(await sourceFiles(resolve("docs"))),
    resolve("README.md"),
  ];
  const offenders = [];
  for (const path of files) if (/\bInter\b/.test(await readFile(path, "utf8"))) offenders.push(path);
  assert.deepEqual(offenders, []);
  await assert.rejects(readFile(resolve("public/fonts/InterVariable.woff2")));
  await assert.rejects(readFile(resolve("src/fonts/load-fonts.ts")));
});
