import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { validateNarrationScriptPackage } from "../creator-workflow/contract.ts";
import {
  NARRATION_VISUAL_FORMS,
  NARRATION_VISUAL_FORM_IDS,
  type NarrationVisualForm,
} from "../creator-workflow/visual-authoring.ts";
import type { NarrationScriptPackage } from "../creator-workflow/types.ts";
import { APPROVED_COMPONENT_IDS, type ApprovedVisualComponentId } from "../visual-brief/types.ts";
import { isIconId, type IconId } from "../icons/registry.ts";

export const TOPIC_REGRESSION_SCHEMA_VERSION = "1.0" as const;

export type TopicRegressionMaterial = {
  id: string;
  kind: "image" | "screen-recording" | "person" | "document";
  path: string;
  sha256: string;
  description: string;
  rights: string;
  provenance: string;
  redistributable: boolean;
};

export type TopicRegressionExpectation = {
  id: string;
  sectionId: string;
  form: NarrationVisualForm;
  evidenceText: string;
  requirement: "required" | "optional";
  sourceIds: string[];
  expectedOneOf: ApprovedVisualComponentId[];
  expectedIconIds?: IconId[];
  forbidden: ApprovedVisualComponentId[];
  polarity: "affirmed" | "negated" | "question";
  materialId?: string;
  timing: { maxLeadSeconds: number; maxTrailSeconds: number };
};

export type TopicRegressionFixture = {
  id: string;
  title: string;
  purpose: string;
  sourceFacts: Array<{
    id: string;
    text: string;
    sourceUrl: string;
    accessedAt: string;
    sourceType: "official-publisher" | "official-documentation" | "independent-benchmark" | "local-project";
  }>;
  materials: TopicRegressionMaterial[];
  narration: NarrationScriptPackage;
  expectations: TopicRegressionExpectation[];
};

export type TopicRegressionSuite = {
  schemaVersion: typeof TOPIC_REGRESSION_SCHEMA_VERSION;
  suiteId: string;
  status: "candidate" | "approved";
  fixtures: TopicRegressionFixture[];
};

export type TopicSelectionObservation = {
  expectationId: string;
  componentId?: ApprovedVisualComponentId;
  evidenceText?: string;
  evidenceStart: number;
  evidenceEnd: number;
  visualStart?: number;
  visualEnd?: number;
  polarity?: TopicRegressionExpectation["polarity"];
  materialId?: string;
  viewerCopy?: string[];
  iconIds?: IconId[];
};

type TopicFinding = {
  severity: "error" | "warning";
  rule: string;
  fixtureId: string;
  expectationId?: string;
  message: string;
};

const idPattern = /^[a-z0-9][a-z0-9-]{2,63}$/;
const shaPattern = /^[a-f0-9]{64}$/;

const sha256File = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");

export const validateTopicRegressionSuite = (
  suite: TopicRegressionSuite,
  options: { verifyMaterials?: boolean } = {},
) => {
  if (suite.schemaVersion !== TOPIC_REGRESSION_SCHEMA_VERSION) throw new Error("Unsupported topic suite schema");
  if (!idPattern.test(suite.suiteId)) throw new Error("Topic suite id is invalid");
  if (!suite.fixtures.length) throw new Error("Topic suite requires fixtures");
  const fixtureIds = new Set<string>();
  const coveredComponents = new Set<ApprovedVisualComponentId>();
  const coveredForms = new Set<NarrationVisualForm>();

  for (const fixture of suite.fixtures) {
    if (!idPattern.test(fixture.id) || fixtureIds.has(fixture.id))
      throw new Error(`Invalid or duplicate topic fixture id: ${fixture.id}`);
    fixtureIds.add(fixture.id);
    const narration = validateNarrationScriptPackage(fixture.narration);
    const sourceIds = new Set(fixture.sourceFacts.map((source) => source.id));
    if (!sourceIds.size || sourceIds.size !== fixture.sourceFacts.length)
      throw new Error(`${fixture.id} requires unique source facts`);
    if (
      fixture.sourceFacts.some(
        (source) =>
          !idPattern.test(source.id) ||
          !source.text.trim() ||
          !/^https:\/\//.test(source.sourceUrl) ||
          !/^\d{4}-\d{2}-\d{2}$/.test(source.accessedAt),
      )
    )
      throw new Error(`${fixture.id} contains an invalid source fact`);

    const materialIds = new Set<string>();
    for (const material of fixture.materials) {
      if (!idPattern.test(material.id) || materialIds.has(material.id))
        throw new Error(`${fixture.id} contains an invalid or duplicate material id`);
      materialIds.add(material.id);
      if (!shaPattern.test(material.sha256) || !material.rights.trim() || !material.provenance.trim())
        throw new Error(`${fixture.id}/${material.id} lacks a valid checksum or rights record`);
      if (!material.redistributable)
        throw new Error(`${fixture.id}/${material.id} must be redistributable in the portable topic suite`);
      if (options.verifyMaterials) {
        const path = resolve(material.path);
        if (!existsSync(path)) throw new Error(`${fixture.id}/${material.id} material is unavailable`);
        if (sha256File(path) !== material.sha256) throw new Error(`${fixture.id}/${material.id} checksum changed`);
      }
    }

    const expectationIds = new Set<string>();
    const boundMaterialIds = new Set<string>();
    for (const expectation of fixture.expectations) {
      if (!idPattern.test(expectation.id) || expectationIds.has(expectation.id))
        throw new Error(`${fixture.id} contains an invalid or duplicate expectation id`);
      expectationIds.add(expectation.id);
      const section = narration.sections.find((candidate) => candidate.id === expectation.sectionId);
      if (!section?.narration.includes(expectation.evidenceText))
        throw new Error(`${fixture.id}/${expectation.id} must quote its narration exactly`);
      if (
        !section.visualOpportunities?.some(
          (opportunity) =>
            opportunity.form === expectation.form && opportunity.evidenceText === expectation.evidenceText,
        )
      )
        throw new Error(`${fixture.id}/${expectation.id} is not declared by its narration section`);
      if (!expectation.sourceIds.length || expectation.sourceIds.some((sourceId) => !sourceIds.has(sourceId)))
        throw new Error(`${fixture.id}/${expectation.id} references unavailable source facts`);
      if (!expectation.expectedOneOf.length)
        throw new Error(`${fixture.id}/${expectation.id} requires at least one eligible component`);
      const form = NARRATION_VISUAL_FORMS.find((candidate) => candidate.id === expectation.form);
      if (!form) throw new Error(`${fixture.id}/${expectation.id} uses an unsupported visual form`);
      const eligibleComponents = new Set<string>(form.componentCoverage);
      if (expectation.expectedOneOf.some((component) => !eligibleComponents.has(component)))
        throw new Error(`${fixture.id}/${expectation.id} expects a component outside ${expectation.form}`);
      if (expectation.expectedIconIds?.some((iconId) => !isIconId(iconId)))
        throw new Error(`${fixture.id}/${expectation.id} expects an unavailable icon`);
      if (expectation.forbidden.some((component) => expectation.expectedOneOf.includes(component)))
        throw new Error(`${fixture.id}/${expectation.id} has overlapping allowed and forbidden components`);
      if (expectation.timing.maxLeadSeconds < 0 || expectation.timing.maxTrailSeconds < 0)
        throw new Error(`${fixture.id}/${expectation.id} has an invalid timing tolerance`);
      if (expectation.materialId) {
        if (!materialIds.has(expectation.materialId) || !section.materialIds.includes(expectation.materialId))
          throw new Error(`${fixture.id}/${expectation.id} material is not bound to its narration section`);
        if (boundMaterialIds.has(expectation.materialId))
          throw new Error(`${fixture.id}/${expectation.materialId} may bind to only one expectation`);
        boundMaterialIds.add(expectation.materialId);
      }
      for (const component of expectation.expectedOneOf) coveredComponents.add(component);
      coveredForms.add(expectation.form);
    }

    for (const internalId of [...APPROVED_COMPONENT_IDS, ...NARRATION_VISUAL_FORM_IDS])
      if (narration.fullScript.includes(internalId))
        throw new Error(`${fixture.id} leaks internal visual id into spoken narration: ${internalId}`);
  }

  const missingComponents = APPROVED_COMPONENT_IDS.filter((component) => !coveredComponents.has(component));
  if (missingComponents.length)
    throw new Error(`Topic suite component coverage is incomplete: ${missingComponents.join(", ")}`);
  const componentBackedForms = NARRATION_VISUAL_FORMS.filter((form) => form.componentCoverage.length > 0).map(
    (form) => form.id,
  );
  const missingForms = componentBackedForms.filter((form) => !coveredForms.has(form));
  if (missingForms.length)
    throw new Error(`Topic suite visual-form coverage is incomplete: ${missingForms.join(", ")}`);
  return true;
};

export const evaluateTopicRegressionFixture = (
  fixture: TopicRegressionFixture,
  observations: TopicSelectionObservation[],
) => {
  const findings: TopicFinding[] = [];
  const observationById = new Map(observations.map((observation) => [observation.expectationId, observation]));
  const add = (severity: TopicFinding["severity"], rule: string, message: string, expectationId?: string) =>
    findings.push({ severity, rule, message, fixtureId: fixture.id, expectationId });

  for (const expectation of fixture.expectations) {
    const actual = observationById.get(expectation.id);
    if (!actual?.componentId) {
      if (expectation.requirement === "required")
        add("error", "selection.required-missing", "Required visual relationship was not selected", expectation.id);
      continue;
    }
    if (!expectation.expectedOneOf.includes(actual.componentId))
      add(
        "error",
        "selection.outside-eligible-family",
        `Selected ${actual.componentId}; expected one of ${expectation.expectedOneOf.join(", ")}`,
        expectation.id,
      );
    if (expectation.forbidden.includes(actual.componentId))
      add("error", "selection.forbidden", `Selected forbidden component ${actual.componentId}`, expectation.id);
    if (actual.evidenceText !== undefined && actual.evidenceText !== expectation.evidenceText)
      add("error", "evidence.text-mismatch", "Selected evidence text does not match the contract", expectation.id);
    if (actual.polarity !== undefined && actual.polarity !== expectation.polarity)
      add(
        "error",
        "evidence.polarity-mismatch",
        `Expected ${expectation.polarity}, received ${actual.polarity}`,
        expectation.id,
      );
    if (actual.materialId !== expectation.materialId)
      add("error", "evidence.material-mismatch", "Selected material does not match the bound evidence", expectation.id);
    for (const iconId of expectation.expectedIconIds ?? [])
      if (!actual.iconIds?.includes(iconId))
        add("error", "icon.required-missing", `Expected icon is missing: ${iconId}`, expectation.id);
    if (
      actual.visualStart !== undefined &&
      actual.visualStart < actual.evidenceStart - expectation.timing.maxLeadSeconds
    )
      add("error", "timing.too-early", "Visual begins before the allowed evidence lead", expectation.id);
    if (actual.visualEnd !== undefined && actual.visualEnd > actual.evidenceEnd + expectation.timing.maxTrailSeconds)
      add("error", "timing.too-late", "Visual remains after the allowed evidence trail", expectation.id);
    for (const copy of actual.viewerCopy ?? [])
      if (APPROVED_COMPONENT_IDS.some((component) => copy.toLowerCase().includes(component)))
        add("error", "viewer-copy.internal-id", `Viewer copy leaks an internal component id: ${copy}`, expectation.id);
  }

  for (const observation of observations)
    if (!fixture.expectations.some((expectation) => expectation.id === observation.expectationId))
      add(
        "warning",
        "selection.uncontracted",
        "Observation is not declared by this fixture",
        observation.expectationId,
      );

  const selectedComponents = [
    ...new Set(observations.flatMap((observation) => (observation.componentId ? [observation.componentId] : []))),
  ];
  return {
    fixtureId: fixture.id,
    findings,
    summary: {
      expectations: fixture.expectations.length,
      required: fixture.expectations.filter((expectation) => expectation.requirement === "required").length,
      observed: observations.filter((observation) => observation.componentId).length,
      selectedComponents,
      errors: findings.filter((finding) => finding.severity === "error").length,
      warnings: findings.filter((finding) => finding.severity === "warning").length,
    },
  };
};
