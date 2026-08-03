import { resolve } from "node:path";
import { applyRevision } from "./operations/revisions.mjs";

const values = process.argv.slice(2);
const option = (name) => {
  const index = values.indexOf(name);
  return index >= 0 ? values[index + 1] : undefined;
};
const manifestPath = option("--project");
const revisionPath = option("--revision");
if (!manifestPath || !revisionPath)
  throw new Error("Usage: npm run revision:apply -- --project <project.json> --revision <revision.json>");

const result = await applyRevision({ manifestPath: resolve(manifestPath), revisionPath: resolve(revisionPath) });
console.log(JSON.stringify({ schemaVersion: "1.0", event: "revision.applied", revision: result }));
