import { createHash } from "node:crypto";
import {
  CREATOR_CATEGORIES,
  CREATOR_WORKFLOW_MODES,
  type CreatorProject,
  type NarrationScriptPackage,
} from "./types.ts";
import { normalizeEditorialBrief } from "./editorial-brief.ts";
import { AGENT_IDS } from "../agents/types.ts";
import { animationTemplateIds } from "../animation-system/template-registry.ts";
import { TYPOGRAPHY_MODES, TYPOGRAPHY_POLICY_VERSION } from "../typography-policy/types.ts";
import { NARRATION_VISUAL_FORM_IDS } from "./visual-authoring.ts";

const idPattern = /^[a-z0-9][a-z0-9-]{1,62}$/;
const sha256Pattern = /^[a-f0-9]{64}$/;
const creatorProjectStatuses = [
  "intake",
  "drafting",
  "script-review",
  "script-locked",
  "awaiting-media",
  "video-ready",
  "video-running",
  "review",
  "approved",
  "delivered",
] as const;
const authoringStates = ["not-started", "drafted", "locked"] as const;
const sourceKinds = ["url", "file", "note"] as const;
const materialKinds = ["screenshot", "screen-recording", "reference", "speaker-video"] as const;
const evidenceRoles = ["interface", "result", "source", "comparison", "document", "other"] as const;
const materialFits = ["contain", "cover"] as const;
const productionTreatments = ["direct", "merge", "trim"] as const;
const materialDecisionSources = ["agent", "user"] as const;
const authoringPathFields = [
  "inputScript",
  "draftScript",
  "sourceContext",
  "finalScript",
  "shootingGuide",
  "authoredScenePlan",
  "authoredVisualPlan",
  "handoff",
  "providerReport",
] as const;
const isId = (value: unknown): value is string => typeof value === "string" && idPattern.test(value);
export const sha256Text = (value: string) => createHash("sha256").update(value).digest("hex");

export const composeNarrationScript = (value: NarrationScriptPackage) =>
  [value.opening, value.overview, ...value.sections.map((section) => section.narration), value.conclusion]
    .map((item) => item.trim())
    .filter(Boolean)
    .join("\n\n");

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const assertNonEmptyString = (value: unknown, field: string) => {
  if (typeof value !== "string" || !value.trim()) throw new Error(`Creator project ${field} is required`);
};

const assertOptionalString = (value: unknown, field: string) => {
  if (value !== undefined && typeof value !== "string") throw new Error(`Creator project ${field} must be a string`);
};

const assertTimestamp = (value: unknown, field: string) => {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)))
    throw new Error(`Creator project ${field} must be a valid timestamp`);
};

const assertRelativeProjectPath = (value: unknown, field: string) => {
  if (value === undefined) return;
  assertNonEmptyString(value, field);
  const normalized = (value as string).replaceAll("\\", "/");
  if (normalized.startsWith("/") || normalized.split("/").includes("..") || normalized.includes("\0"))
    throw new Error(`Creator project ${field} must stay inside the project directory`);
};

export const validateCreatorProject = (input: unknown): CreatorProject => {
  if (!isRecord(input)) throw new Error("Creator project must be an object");
  const value = input as CreatorProject;
  if (value.schemaVersion !== "1.0") throw new Error("Creator project schemaVersion must be 1.0");
  if (!isRecord(value.project) || !isId(value.project.id)) throw new Error("Creator project id is invalid");
  if (typeof value.project.title !== "string" || !value.project.title.trim())
    throw new Error("Creator project title is required");
  if (value.project.title.trim().length > 80) throw new Error("Creator project title must not exceed 80 characters");
  assertTimestamp(value.project.createdAt, "createdAt");
  assertTimestamp(value.project.updatedAt, "updatedAt");
  if (!creatorProjectStatuses.includes(value.project.status)) throw new Error("Creator project status is invalid");
  if (value.project.workflowMode !== undefined && !CREATOR_WORKFLOW_MODES.includes(value.project.workflowMode))
    throw new Error("Creator project workflow mode is invalid");
  if (!isRecord(value.agent) || !AGENT_IDS.includes(value.agent.id))
    throw new Error("Creator project Agent is invalid");
  if (
    value.agent.model !== undefined &&
    (typeof value.agent.model !== "string" || !value.agent.model.trim() || value.agent.model.length > 80)
  )
    throw new Error("Creator project Agent model must be 1-80 characters");
  if (value.agent.fallback !== "none") throw new Error("Creator project Agent fallback must be none");
  if (value.agent.authoringContractVersion !== "1.0")
    throw new Error("Creator project Agent authoring contract must be 1.0");
  if (value.agent.semanticContractVersion !== "1.1")
    throw new Error("Creator project Agent semantic contract must be 1.1");
  if (value.animation !== undefined) {
    if (!isRecord(value.animation)) throw new Error("Creator project animation must be an object");
    const legacyTemplateId = (value.animation as { templateId?: unknown }).templateId;
    if (legacyTemplateId === "stop-motion-machine" || legacyTemplateId === "research-archive")
      (value.animation as { templateId: "paper-editorial" }).templateId = "paper-editorial";
    if (!animationTemplateIds.includes(value.animation.templateId))
      throw new Error("Creator project animation template is invalid");
    assertTimestamp(value.animation.lockedAt, "animation lockedAt");
  }
  if (value.typography !== undefined) {
    if (!isRecord(value.typography)) throw new Error("Creator project typography must be an object");
    if (value.typography.version !== TYPOGRAPHY_POLICY_VERSION)
      throw new Error(`Creator project typography version must be ${TYPOGRAPHY_POLICY_VERSION}`);
    if (!TYPOGRAPHY_MODES.includes(value.typography.mode))
      throw new Error("Creator project typography mode is invalid");
  }
  if (!isRecord(value.brief) || typeof value.brief.topic !== "string" || !value.brief.topic.trim())
    throw new Error("Creator project topic is required");
  if (!CREATOR_CATEGORIES.includes(value.brief.category)) throw new Error("Creator project category is invalid");
  if (
    value.brief.targetDurationMinutes !== undefined &&
    (!Number.isFinite(value.brief.targetDurationMinutes) || value.brief.targetDurationMinutes <= 0)
  )
    throw new Error("Creator project target duration must be positive");
  assertOptionalString(value.brief.audience, "audience");
  assertOptionalString(value.brief.creatorNotes, "creatorNotes");
  if (value.brief.editorialBrief !== undefined)
    value.brief.editorialBrief = normalizeEditorialBrief(value.brief.category, value.brief.editorialBrief);
  if (!Array.isArray(value.sources) || !Array.isArray(value.materials))
    throw new Error("Sources and materials must be arrays");
  const sourceIds = new Set<string>();
  for (const source of value.sources) {
    if (!isRecord(source) || !isId(source.id) || sourceIds.has(source.id))
      throw new Error("Creator project source id is invalid or duplicated");
    sourceIds.add(source.id);
    if (!sourceKinds.includes(source.kind)) throw new Error(`Creator project source kind is invalid: ${source.id}`);
    assertNonEmptyString(source.label, `source ${source.id} label`);
    assertNonEmptyString(source.value, `source ${source.id} value`);
  }
  const materialIds = new Set<string>();
  const assetIds = new Set<string>();
  for (const material of value.materials) {
    if (!isRecord(material) || !isId(material.id) || materialIds.has(material.id))
      throw new Error("Creator project material id is invalid or duplicated");
    materialIds.add(material.id);
    if (!materialKinds.includes(material.kind))
      throw new Error(`Creator project material kind is invalid: ${material.id}`);
    assertNonEmptyString(material.label, `material ${material.id} label`);
    if (typeof material.required !== "boolean")
      throw new Error(`Creator project material required flag is invalid: ${material.id}`);
    if (material.productionTreatment !== undefined && !productionTreatments.includes(material.productionTreatment))
      throw new Error(`Creator project material production treatment is invalid: ${material.id}`);
    if (material.decisionSource !== undefined && !materialDecisionSources.includes(material.decisionSource))
      throw new Error(`Creator project material decision source is invalid: ${material.id}`);
    if (material.productionNote !== undefined) {
      assertOptionalString(material.productionNote, `material ${material.id} productionNote`);
      if (material.productionNote.length > 1000)
        throw new Error(`Creator project material productionNote is too long: ${material.id}`);
    }
    if (material.assetId !== undefined) {
      if (!isId(material.assetId) || assetIds.has(material.assetId))
        throw new Error(`Creator project material asset id is invalid or duplicated: ${material.id}`);
      assetIds.add(material.assetId);
    }
    for (const field of ["description", "sourceLabel", "anchorText"] as const)
      assertOptionalString(material[field], `material ${material.id} ${field}`);
    if (
      material.anchorTexts !== undefined &&
      (!Array.isArray(material.anchorTexts) || material.anchorTexts.some((item) => typeof item !== "string"))
    )
      throw new Error(`Creator project material anchorTexts is invalid: ${material.id}`);
    if (material.evidenceRole !== undefined && !evidenceRoles.includes(material.evidenceRole))
      throw new Error(`Creator project material evidenceRole is invalid: ${material.id}`);
    if (material.fit !== undefined && !materialFits.includes(material.fit))
      throw new Error(`Creator project material fit is invalid: ${material.id}`);
    if (
      material.focalPoint !== undefined &&
      (!isRecord(material.focalPoint) ||
        !Number.isFinite(material.focalPoint.x) ||
        !Number.isFinite(material.focalPoint.y) ||
        Number(material.focalPoint.x) < 0 ||
        Number(material.focalPoint.x) > 1 ||
        Number(material.focalPoint.y) < 0 ||
        Number(material.focalPoint.y) > 1)
    )
      throw new Error(`Creator project material focalPoint is invalid: ${material.id}`);
  }
  if (!isRecord(value.authoring) || !authoringStates.includes(value.authoring.state))
    throw new Error("Creator project authoring state is invalid");
  for (const field of authoringPathFields) assertRelativeProjectPath(value.authoring[field], `authoring ${field}`);
  for (const field of ["currentAttemptId", "lockedAttemptId"] as const) {
    const attemptId = value.authoring?.[field];
    if (attemptId !== undefined && !isId(attemptId)) throw new Error(`Creator project ${field} is invalid`);
  }
  for (const field of ["currentAttemptSha256", "lockedAttemptSha256", "finalScriptSha256"] as const) {
    const hash = value.authoring?.[field];
    if (hash !== undefined && !sha256Pattern.test(hash)) throw new Error(`Creator project ${field} is invalid`);
  }
  if (value.authoring.lockedAt !== undefined) assertTimestamp(value.authoring.lockedAt, "authoring lockedAt");
  if (!isRecord(value.video)) throw new Error("Creator project video must be an object");
  if (value.video.projectId !== undefined && !isId(value.video.projectId))
    throw new Error("Creator project video projectId is invalid");
  if (value.video.manifest !== undefined) {
    assertNonEmptyString(value.video.manifest, "video manifest");
    if (value.video.manifest.includes("\0")) throw new Error("Creator project video manifest is invalid");
    if (!value.video.projectId) throw new Error("Creator project video manifest requires a video projectId");
  }
  if (value.video.sourceAssetId !== undefined) {
    if (!isId(value.video.sourceAssetId) || !assetIds.has(value.video.sourceAssetId))
      throw new Error("Creator project video sourceAssetId must reference a registered material asset");
  }
  return value;
};

export const validateNarrationScriptPackage = (input: unknown): NarrationScriptPackage => {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Narration package must be an object");
  const raw = input as NarrationScriptPackage;
  const value: NarrationScriptPackage = {
    ...raw,
    sections: Array.isArray(raw.sections)
      ? raw.sections.map((section) => ({
          ...section,
          visualOpportunities: section.visualOpportunities ?? [],
        }))
      : raw.sections,
  };
  if (value.schemaVersion !== "1.0") throw new Error("Narration package schemaVersion must be 1.0");
  if (!value.title?.trim() || !value.fullScript?.trim()) throw new Error("Narration title and fullScript are required");
  if (!Array.isArray(value.sections) || value.sections.length < 2)
    throw new Error("Narration requires at least two sections");
  if (!Array.isArray(value.shootingGuide) || value.shootingGuide.length === 0)
    throw new Error("Narration shootingGuide is required");
  const sectionIds = new Set<string>();
  for (const section of value.sections) {
    if (!idPattern.test(section.id) || sectionIds.has(section.id))
      throw new Error(`Invalid or duplicate section id: ${section.id}`);
    sectionIds.add(section.id);
    if (!section.title?.trim() || !section.narration?.trim()) throw new Error(`Section ${section.id} is incomplete`);
    if (!Array.isArray(section.materialIds) || section.materialIds.length > 12)
      throw new Error(`Section ${section.id} may reference at most twelve materials`);
    if (new Set(section.materialIds).size !== section.materialIds.length)
      throw new Error(`Section ${section.id} contains duplicate material references`);
    if (!Array.isArray(section.visualOpportunities) || section.visualOpportunities.length > 3)
      throw new Error(`Section ${section.id} visualOpportunities must contain zero to three items`);
    for (const opportunity of section.visualOpportunities) {
      if (!NARRATION_VISUAL_FORM_IDS.includes(opportunity.form))
        throw new Error(`Section ${section.id} contains an unsupported visual form`);
      const evidenceText = opportunity.evidenceText?.trim();
      if (!evidenceText || evidenceText.length > 160 || !section.narration.includes(evidenceText))
        throw new Error(`Section ${section.id} visual opportunity must quote its narration exactly`);
    }
  }
  if (value.fullScript.trim() !== composeNarrationScript(value))
    throw new Error("Narration fullScript must match the editable structured sections");
  return value;
};

export const approvedBrandTransitions = () => [];
