import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { resolveTerminologyProfile, TERMINOLOGY_PROFILE_VERSION } from "../src/terminology/index.ts";

const config = JSON.parse(await readFile(resolve(process.argv[2] ?? "config/workflow-test.json"), "utf8"));
const terminology = config.terminology ?? {
  version: TERMINOLOGY_PROFILE_VERSION,
  domains: ["ai-software", "finance-markets", "laboratory-biopharma"],
};
let projectOverrides = [];
if (terminology.projectOverridesFile) {
  const value = JSON.parse(await readFile(resolve(terminology.projectOverridesFile), "utf8"));
  projectOverrides = Array.isArray(value) ? value : value.entries;
  if (!Array.isArray(projectOverrides))
    throw new Error("Project terminology overrides must be an array or {entries: []}.");
}
const profile = resolveTerminologyProfile({
  version: terminology.version ?? TERMINOLOGY_PROFILE_VERSION,
  domains: terminology.domains ?? [],
  projectOverrides,
});
const output = resolve(config.terminologyProfileFile ?? `${config.editDir}/terminology-profile.json`);
await writeFile(output, `${JSON.stringify(profile, null, 2)}\n`);
const report = {
  schemaVersion: "1.0",
  profileVersion: profile.schemaVersion,
  precedence: profile.precedence,
  domains: profile.domains,
  entryCount: profile.entries.length,
  projectOverrideCount: projectOverrides.length,
  canonicalPairs: profile.entries.map(({ id, canonicalZh, canonicalEn }) => ({ id, canonicalZh, canonicalEn })),
};
await writeFile(
  resolve(config.terminologyReviewFile ?? `${config.editDir}/terminology-review.json`),
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(`terminology profile: ${profile.entries.length} entries, ${projectOverrides.length} project overrides`);
