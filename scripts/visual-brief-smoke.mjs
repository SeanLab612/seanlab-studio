import { buildVisualBriefExampleOutputs } from "../src/visual-brief/examples.ts";

const outputs = buildVisualBriefExampleOutputs();
for (const example of outputs) {
  if (example.output.component.id !== example.expected) {
    throw new Error(`${example.name}: expected ${example.expected}, received ${example.output.component.id}`);
  }
}

let blockedProductionCopy = false;
try {
  const binary = outputs.find((example) => example.expected === "binary-versus");
  if (!binary) throw new Error("Missing binary example.");
  const { generateVisualBriefFromDraft } = await import("../src/visual-brief/generator.ts");
  generateVisualBriefFromDraft(
    binary.segment,
    { ...binary.draft, narrative: { ...binary.draft.narrative, title: "Binary component MVP review" } },
    "production",
  );
} catch (error) {
  blockedProductionCopy = error instanceof Error && error.message.includes("production terminology");
}

if (!blockedProductionCopy) throw new Error("Viewer-facing copy validation did not block production terminology.");

let blockedShape = false;
try {
  const keyStat = outputs.find((example) => example.expected === "key-stat-summary");
  if (!keyStat) throw new Error("Missing key-stat example.");
  const { generateVisualBriefFromDraft } = await import("../src/visual-brief/generator.ts");
  generateVisualBriefFromDraft(keyStat.segment, { ...keyStat.draft, props: { items: [] } }, "review");
} catch (error) {
  blockedShape = error instanceof Error && error.message.includes("expects 1-3 items");
}

if (!blockedShape) throw new Error("Component payload validation did not reject an invalid item count.");
const promotedIds = new Set([
  "historical-timeline",
  "decision-matrix",
  "model-classification-map",
  "capability-surface-grid",
  "tradeoff-scale",
]);
for (const example of outputs.filter(({ expected }) => promotedIds.has(expected))) {
  if (example.output.component.status !== "approved")
    throw new Error(`${example.expected} was not promoted to approved.`);
}
console.log(outputs.map(({ name, output }) => `${name} -> ${output.component.id}`).join("\n"));
console.log("viewer copy gate -> production terminology blocked");
console.log("payload gate -> invalid item count blocked");
console.log("promotion gate -> five approved 0.1.5 components verified");
