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
const registeredComponentIds = new Set();
for (const fixture of registry.fixtures) {
  if (!fixture.expectedManifest) continue;
  const expected = JSON.parse(await readFile(resolve(fixture.expectedManifest), "utf8"));
  if (expected.fixtureId !== fixture.id)
    throw new Error(`${fixture.id} expected manifest points to ${expected.fixtureId}.`);
  if (fixture.id === "approved-components-19" || fixture.id === "editorial-statement-candidate") {
    const ids = expected.cases.map((item) => item.id);
    if (new Set(ids).size !== ids.length) throw new Error(`${fixture.id} contains duplicate component cases.`);
    for (const id of ids) {
      if (!APPROVED_COMPONENT_IDS.includes(id)) throw new Error(`${fixture.id} contains unknown component ${id}.`);
      if (registeredComponentIds.has(id)) throw new Error(`Component ${id} is registered more than once.`);
      registeredComponentIds.add(id);
    }
  }
  if (fixture.id === "layout-private-four") {
    for (const item of expected.cases) {
      const actual = layoutFixtureRegistry.find((candidate) => candidate.id === item.id);
      if (!actual || actual.recommendedTemplate !== item.expectedLayout)
        throw new Error(`Layout fixture expectation changed: ${item.id}`);
    }
  }
  if (fixture.id === "portable-workflow-edge-cases") {
    if (expected.schemaVersion !== "1.0" || !Array.isArray(expected.cases) || !expected.cases.length)
      throw new Error("Portable workflow fixture requires versioned cases.");
    const caseIds = new Set();
    const caseCoverage = new Set();
    for (const item of expected.cases) {
      if (typeof item.id !== "string" || !item.id || caseIds.has(item.id))
        throw new Error("Portable workflow fixture case ids must be unique.");
      caseIds.add(item.id);
      if (!Array.isArray(item.coverage) || !item.coverage.length)
        throw new Error(`${item.id} requires explicit regression coverage.`);
      for (const tag of item.coverage) caseCoverage.add(tag);
      if (!item.input || !item.expected) throw new Error(`${item.id} requires input and expected output.`);
    }
    const undeclared = [...caseCoverage].filter((tag) => !fixture.coverage.includes(tag));
    const unexercised = fixture.coverage.filter((tag) => !caseCoverage.has(tag));
    if (undeclared.length || unexercised.length)
      throw new Error(
        `Portable workflow coverage mismatch. undeclared=${undeclared.join(",")} unexercised=${unexercised.join(",")}`,
      );
  }
}
if (
  registeredComponentIds.size !== APPROVED_COMPONENT_IDS.length ||
  APPROVED_COMPONENT_IDS.some((id) => !registeredComponentIds.has(id))
)
  throw new Error("Registered component fixtures must cover all approved components exactly once.");
console.log(
  JSON.stringify({
    event: "fixtures.validated",
    profileId: registry.profileId,
    fixtures: registry.fixtures.length,
    coverage: [...new Set(registry.fixtures.flatMap((item) => item.coverage))].sort(),
    verifiedLocalSources: args.includes("--verify-local"),
  }),
);
