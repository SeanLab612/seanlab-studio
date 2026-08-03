import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";

const run = promisify(execFile);
const outputDir = "out/media-asset-reviews";
const pagesDir = `${outputDir}/contact-pages`;
const riskDir = `${outputDir}/risk-frames`;
await mkdir(pagesDir, { recursive: true });
await mkdir(riskDir, { recursive: true });
const peopleCount = JSON.parse(await readFile("public/media-assets/people/manifest.json", "utf8")).length;
const identityCount = JSON.parse(await readFile("public/media-assets/identities/manifest.json", "utf8")).length;
const personAssetReviewDefinitions = Array.from({ length: Math.ceil(peopleCount / 20) }, (_, page) => ({
  id: `ReviewPersonAssetContactSheet${page + 1}`,
}));
const identityAssetReviewDefinitions = Array.from({ length: Math.ceil(identityCount / 20) }, (_, page) => ({
  id: `ReviewIdentityAssetContactSheet${page + 1}`,
}));

const pages = [
  ...personAssetReviewDefinitions.map(({ id }, index) => ({ id, file: `${pagesDir}/people-${index + 1}.png` })),
  ...identityAssetReviewDefinitions.map(({ id }, index) => ({ id, file: `${pagesDir}/identities-${index + 1}.png` })),
];

for (const [index, page] of pages.entries()) {
  await run("npx", ["remotion", "still", "src/index.ts", page.id, page.file, "--frame", "120"], {
    maxBuffer: 20 * 1024 * 1024,
  });
  console.log(`${index + 1}/${pages.length} ${page.id}`);
}

await run(
  "npx",
  [
    "remotion",
    "still",
    "src/index.ts",
    "ReviewMediaAssetConnection",
    `${outputDir}/media-component-connection.png`,
    "--frame",
    "150",
  ],
  { maxBuffer: 20 * 1024 * 1024 },
);

const riskFrames = [
  { phase: "person", frame: 130 },
  { phase: "local-model", frame: 300 },
  { phase: "source-types", frame: 480 },
  { phase: "connection", frame: 660 },
];
for (const item of riskFrames)
  await run(
    "npx",
    [
      "remotion",
      "still",
      "src/index.ts",
      "ReviewMediaAssetMvp",
      `${riskDir}/${item.phase}.png`,
      "--frame",
      String(item.frame),
    ],
    { maxBuffer: 20 * 1024 * 1024 },
  );

await writeFile(
  `${outputDir}/review-manifest.json`,
  `${JSON.stringify({ schemaVersion: "1.0", canvas: { width: 1920, height: 1080 }, pages, riskFrames }, null, 2)}\n`,
);
await run("python3", ["scripts/media_review_contact_sheet.py", outputDir], { maxBuffer: 20 * 1024 * 1024 });
if (process.argv.includes("--stills-only")) {
  console.log(`${outputDir}/contact-sheet.jpg`);
  process.exit(0);
}
await run(
  "npx",
  [
    "remotion",
    "render",
    "src/index.ts",
    "ReviewMediaAssetMvp",
    `${outputDir}/media-asset-mvp.mp4`,
    "--codec",
    "h264",
    "--crf",
    "18",
  ],
  { maxBuffer: 30 * 1024 * 1024 },
);
console.log(`${outputDir}/media-asset-mvp.mp4`);
