import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { validateRegressionRegistry } from "../../src/regression-fixtures/index.ts";
import { APPROVED_COMPONENT_IDS } from "../../src/visual-brief/types.ts";
import { layoutFixtureRegistry } from "../../src/layout-templates/registry.ts";

const args = process.argv.slice(2);
const option = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const registryPath = resolve(option("--registry") ?? "regression-fixtures/registry.json");
const registry = JSON.parse(await readFile(registryPath, "utf8"));
validateRegressionRegistry(registry, { verifyFiles: args.includes("--verify-local") ? "all" : "tracked" });
for (const fixture of registry.fixtures) {
  if (!fixture.expectedManifest) continue;
  const expected = JSON.parse(await readFile(resolve(fixture.expectedManifest), "utf8"));
  if (expected.fixtureId !== fixture.id)
    throw new Error(`${fixture.id} expected manifest points to ${expected.fixtureId}.`);
  if (fixture.id === "approved-components-20") {
    const ids = expected.cases.map((item) => item.id);
    if (ids.length !== APPROVED_COMPONENT_IDS.length || APPROVED_COMPONENT_IDS.some((id) => !ids.includes(id)))
      throw new Error("Component regression suite must cover all approved components exactly once.");
  }
  if (fixture.id === "layout-private-four") {
    for (const item of expected.cases) {
      const actual = layoutFixtureRegistry.find((candidate) => candidate.id === item.id);
      if (!actual || actual.recommendedTemplate !== item.expectedLayout)
        throw new Error(`Layout fixture expectation changed: ${item.id}`);
    }
  }
}
console.log(
  JSON.stringify({
    event: "fixtures.validated",
    profileId: registry.profileId,
    fixtures: registry.fixtures.length,
    coverage: [...new Set(registry.fixtures.flatMap((item) => item.coverage))].sort(),
    verifiedLocalSources: args.includes("--verify-local"),
  }),
);
