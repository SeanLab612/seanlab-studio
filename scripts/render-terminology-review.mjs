import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  TERMINOLOGY_PROFILE_VERSION,
  compressViewerTitle,
  correctTerminology,
  resolveTerminologyProfile,
} from "../src/terminology/index.ts";

const fixturePath = resolve("tests/fixtures/terminology-copy-cases.json");
const outputPath = resolve(process.argv[2] ?? "out/feature-0.1.12/terminology-copy-review.md");
const fixtures = JSON.parse(await readFile(fixturePath, "utf8"));
const rows = fixtures.map((fixture) => {
  const profile = resolveTerminologyProfile({ version: TERMINOLOGY_PROFILE_VERSION, domains: [fixture.domain] });
  return {
    ...fixture,
    actualCorrected: correctTerminology(fixture.spoken, profile),
    actualTitle: compressViewerTitle(fixture.displaySource),
  };
});
const markdown = `# Terminology and copy review — feature-0.1.12

Caption corrections below preserve the spoken sentence and change only allowlisted ASR/domain terms. Display titles are a separate copy product.

${rows
  .map(
    (row) => `## ${row.domain}

- Original transcript: ${row.spoken}
- Corrected verbatim caption: ${row.actualCorrected}
- Display-copy source: ${row.displaySource}
- Compressed title: ${row.actualTitle}
- Result: ${row.actualCorrected === row.corrected && row.actualTitle === row.expectedTitle ? "PASS" : "FAIL"}
`,
  )
  .join("\n")}
`;
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, markdown);
console.log(outputPath);
