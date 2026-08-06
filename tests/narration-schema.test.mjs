import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Codex narration response schema declares strict property types", async () => {
  const schema = JSON.parse(await readFile("schemas/narration-script-package.schema.json", "utf8"));
  for (const [name, property] of Object.entries(schema.properties)) {
    assert.ok(property.type, `root property ${name} must declare a type`);
  }
  const section = schema.properties.sections.items;
  assert.deepEqual(new Set(section.required), new Set(Object.keys(section.properties)));
  for (const [name, property] of Object.entries(section.properties)) {
    assert.ok(property.type, `section property ${name} must declare a type`);
  }
  const opportunity = section.properties.visualOpportunities.items;
  assert.equal(opportunity.additionalProperties, false);
  assert.deepEqual(new Set(opportunity.required), new Set(Object.keys(opportunity.properties)));
  for (const [name, property] of Object.entries(opportunity.properties)) {
    assert.ok(property.type, `visual opportunity property ${name} must declare a type`);
  }
  assert.equal(section.properties.materialIds.maxItems, 12);
  assert.equal(section.properties.materialIds.uniqueItems, true);
});
