import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { FixtureCoverageTag, RegressionFixture, RegressionFixtureRegistry } from "./types.ts";

export const requiredCoverage: FixtureCoverageTag[] = [
  "speaker-left",
  "speaker-center",
  "speaker-right",
  "lighting-dark",
  "lighting-bright",
  "rapid-speech",
  "long-caption",
  "terminology-ai",
  "terminology-finance",
  "terminology-laboratory",
  "numbers-units",
  "comparison",
  "process",
  "quotation",
  "screenshot",
  "all-components",
];

const sha256 = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");

export const validateRegressionFixture = (
  fixture: RegressionFixture,
  options: { verifyFiles?: false | "tracked" | "all" } = {},
) => {
  if (!/^[a-z0-9][a-z0-9-]{2,63}$/.test(fixture.id)) throw new Error(`Invalid fixture id: ${fixture.id}`);
  if (fixture.canvas.width !== 1920 || fixture.canvas.height !== 1080)
    throw new Error(`${fixture.id} must use the approved 1920x1080 canvas.`);
  if (!fixture.sources.length) throw new Error(`${fixture.id} requires at least one source.`);
  for (const source of fixture.sources) {
    if (!source.rights.trim() || !source.provenance.trim()) throw new Error(`${fixture.id} lacks source provenance.`);
    if (source.gitPolicy === "local-only" && source.redistributable)
      throw new Error(`${fixture.id} local-only sources must not be marked redistributable.`);
    const path = resolve(source.path);
    const shouldVerify =
      options.verifyFiles === "all" || (options.verifyFiles === "tracked" && source.gitPolicy === "tracked");
    if (shouldVerify && !existsSync(path)) throw new Error(`${fixture.id} source is unavailable: ${source.path}`);
    if (shouldVerify && source.sha256 && sha256(path) !== source.sha256)
      throw new Error(`${fixture.id} source checksum changed: ${source.path}`);
  }
  return true;
};

export const validateRegressionRegistry = (
  registry: RegressionFixtureRegistry,
  options: { verifyFiles?: false | "tracked" | "all" } = {},
) => {
  if (registry.schemaVersion !== "1.0" || registry.profileId !== "foundation-0.1.13")
    throw new Error("Unsupported regression fixture registry.");
  const ids = registry.fixtures.map((item) => item.id);
  if (new Set(ids).size !== ids.length) throw new Error("Regression fixture ids must be unique.");
  for (const fixture of registry.fixtures) validateRegressionFixture(fixture, options);
  const coverage = new Set(registry.fixtures.flatMap((item) => item.coverage));
  const missing = requiredCoverage.filter((item) => !coverage.has(item));
  if (missing.length) throw new Error(`Regression coverage is incomplete: ${missing.join(", ")}`);
  return true;
};
