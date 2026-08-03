import { approvedComponentRegistry } from "../src/components/library/registry.ts";
import { semanticCoverageRegistry } from "../src/components/library/semantic-coverage.ts";
import { APPROVED_COMPONENT_IDS } from "../src/visual-brief/types.ts";

const components = Object.values(approvedComponentRegistry);
if (components.length !== APPROVED_COMPONENT_IDS.length)
  throw new Error(`Expected ${APPROVED_COMPONENT_IDS.length} approved components, received ${components.length}.`);
for (const component of components) {
  if (component.status !== "approved") throw new Error(`${component.id} is not approved.`);
  if (!component.useWhen.length || !component.avoidWhen.length || !component.requiredFields.length)
    throw new Error(`${component.id} has incomplete registry guidance.`);
}
const unsupportedCoverage = semanticCoverageRegistry.filter(
  ({ status }) => status !== "approved" && status !== "review",
);
if (unsupportedCoverage.length)
  throw new Error(
    `Semantic coverage contains unsupported statuses: ${unsupportedCoverage.map(({ id }) => id).join(", ")}`,
  );
const approvedCoverage = semanticCoverageRegistry.filter(({ status }) => status === "approved");
const approvedCoverageIds = new Set(approvedCoverage.flatMap(({ componentIds }) => componentIds));
for (const component of components) {
  if (!approvedCoverageIds.has(component.id)) throw new Error(`${component.id} has no approved semantic coverage.`);
}
console.log(`component registry -> ${components.length} approved components verified`);
console.log(
  `semantic coverage -> ${approvedCoverage.length} approved structures, ${semanticCoverageRegistry.length - approvedCoverage.length} review structure verified`,
);
