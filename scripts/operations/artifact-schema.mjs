import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";

const ajv = new Ajv2020({ allErrors: true, strict: false });
const validators = new Map();

export const validateArtifactSchema = async ({ schemaPath, artifact, label }) => {
  const absolute = resolve(schemaPath);
  let validate = validators.get(absolute);
  if (!validate) {
    validate = ajv.compile(JSON.parse(await readFile(absolute, "utf8")));
    validators.set(absolute, validate);
  }
  if (validate(artifact)) return artifact;
  const detail = ajv.errorsText(validate.errors, { separator: "; " });
  throw new Error(`${label ?? "Artifact"} does not match ${schemaPath}: ${detail}`);
};
