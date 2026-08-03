import { readFile } from "node:fs/promises";
import { detectAgents } from "../src/agents/registry.ts";
import { createVideoHandoff, lockNarration, updateNarration } from "./creator/lock-handoff.mjs";
import { analyzeMaterialUnderstanding, confirmMaterialUnderstanding } from "./creator/material-understanding.mjs";
import { generateNarration } from "./creator/narration.mjs";
import {
  createCreatorProject,
  importCreatorAsset,
  listCreatorProjects,
  loadCreatorProject,
} from "./creator/project-store.mjs";

const args = process.argv.slice(2);
const command = args.shift();
const option = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const required = (name) =>
  option(name) ??
  (() => {
    throw new Error(`Missing ${name}`);
  })();

let result;
if (command === "agents") result = await detectAgents();
else if (command === "list") result = await listCreatorProjects();
else if (command === "show") result = await loadCreatorProject(required("--id"));
else if (command === "init") {
  result = await createCreatorProject({
    id: required("--id"),
    title: required("--title"),
    topic: required("--topic"),
    category: required("--category"),
    agentId: required("--agent"),
    model: option("--model"),
  });
} else if (command === "asset") {
  result = await importCreatorAsset({
    projectId: required("--id"),
    sourcePath: required("--path"),
    kind: required("--kind"),
    label: option("--label"),
  });
} else if (command === "understand") {
  result = await analyzeMaterialUnderstanding(required("--id"), { fixture: option("--fixture") });
} else if (command === "confirm-understanding") {
  result = await confirmMaterialUnderstanding(required("--id"), required("--sha"));
} else if (command === "draft") {
  result = await generateNarration(required("--id"), { fixture: option("--fixture") });
} else if (command === "update-script") {
  result = await updateNarration(required("--id"), JSON.parse(await readFile(required("--package"), "utf8")));
} else if (command === "lock") {
  result = await lockNarration(required("--id"));
} else if (command === "handoff") {
  result = await createVideoHandoff(required("--id"), { speakerAssetId: required("--speaker-asset") });
} else {
  throw new Error(
    "Usage: creator-project.mjs agents|list|show|init|asset|understand|confirm-understanding|draft|update-script|lock|handoff [options]",
  );
}
console.log(JSON.stringify(result, null, 2));
