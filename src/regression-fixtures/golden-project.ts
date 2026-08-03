import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { animationPrototypeRegistry } from "../visual-production/animation-registry.ts";
import { ANIMATION_STYLE_PROFILE_IDS } from "../visual-production/types.ts";
import { APPROVED_COMPONENT_IDS } from "../visual-brief/types.ts";

export type GoldenVisualType = "component" | "image" | "screen-demo" | "animation" | "speaker";

export type GoldenProjectSource = {
  id: string;
  path: string;
  kind: "video" | "image";
  sha256: string;
  rights: string;
  provenance: string;
};

export type GoldenVisualBeat = {
  id: string;
  type: GoldenVisualType;
  start: number;
  end: number;
  componentId?: string;
  animationPrototypeId?: string;
  animationStyleId?: string;
};

export type GoldenProjectManifest = {
  schemaVersion: "1.0";
  fixtureId: "golden-img2threejs";
  derivedFrom: {
    projectId: "002-imgthreejs";
    privacy: "sanitized-no-original-media";
  };
  composition: {
    id: "GoldenImg2ThreejsReview";
    durationSeconds: number;
    width: number;
    height: number;
    fps: number;
  };
  sources: GoldenProjectSource[];
  visualPlan: GoldenVisualBeat[];
  terminology: {
    mustContain: string[];
    mustNotContain: string[];
    sampleCaptionText: string;
  };
  expected: {
    visualTypes: GoldenVisualType[];
    planSha256: string;
  };
};

export type GoldenProjectFinding = {
  ruleId: string;
  message: string;
};

export type GoldenProjectValidation = {
  status: "passed" | "failed";
  findings: GoldenProjectFinding[];
  summary: {
    sourceCount: number;
    visualBeatCount: number;
    visualTypes: GoldenVisualType[];
  };
};

const stableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, stableValue(child)]),
    );
  return value;
};

export const goldenJsonSha256 = (value: unknown) =>
  createHash("sha256")
    .update(JSON.stringify(stableValue(value)))
    .digest("hex");

export const goldenVisualPlanSha256 = (plan: GoldenVisualBeat[]) => goldenJsonSha256(plan);

const fileSha256 = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");

const add = (findings: GoldenProjectFinding[], ruleId: string, message: string) => {
  findings.push({ ruleId, message });
};

export const validateGoldenProject = (
  manifest: GoldenProjectManifest,
  options: { rootDir: string },
): GoldenProjectValidation => {
  const findings: GoldenProjectFinding[] = [];
  const visualTypes = [...new Set(manifest.visualPlan.map((beat) => beat.type))] as GoldenVisualType[];

  for (const source of manifest.sources) {
    const absolutePath = resolve(options.rootDir, source.path);
    if (!existsSync(absolutePath)) {
      add(findings, "golden.source-missing", `${source.id}: ${source.path}`);
      continue;
    }
    if (fileSha256(absolutePath) !== source.sha256)
      add(findings, "golden.source-checksum", `${source.id}: checksum differs from the manifest`);
  }

  if (goldenVisualPlanSha256(manifest.visualPlan) !== manifest.expected.planSha256)
    add(findings, "golden.plan-stale", "The visual plan hash differs from the approved expectation.");

  const requiredTypes = new Set(manifest.expected.visualTypes);
  for (const requiredType of requiredTypes)
    if (!visualTypes.includes(requiredType))
      add(findings, "golden.visual-type-missing", `Missing visual type: ${requiredType}`);

  const sorted = [...manifest.visualPlan].sort((left, right) => left.start - right.start);
  let cursor = 0;
  for (const beat of sorted) {
    if (beat.end <= beat.start) add(findings, "golden.timeline-invalid", `${beat.id}: end must be greater than start`);
    if (Math.abs(beat.start - cursor) > 0.001)
      add(findings, "golden.timeline-gap", `${beat.id}: expected start ${cursor}, received ${beat.start}`);
    cursor = beat.end;

    if (beat.componentId && !APPROVED_COMPONENT_IDS.includes(beat.componentId as never))
      add(findings, "golden.component-unsupported", `${beat.id}: ${beat.componentId}`);

    if (beat.type === "animation") {
      const prototype = beat.animationPrototypeId
        ? animationPrototypeRegistry[beat.animationPrototypeId as keyof typeof animationPrototypeRegistry]
        : undefined;
      if (!prototype)
        add(
          findings,
          "golden.animation-prototype-unsupported",
          `${beat.id}: ${beat.animationPrototypeId ?? "missing"}`,
        );
      if (!beat.animationStyleId || !ANIMATION_STYLE_PROFILE_IDS.includes(beat.animationStyleId as never))
        add(findings, "golden.animation-style-unsupported", `${beat.id}: ${beat.animationStyleId ?? "missing"}`);
      else if (prototype && !prototype.compatibleStyleIds.includes(beat.animationStyleId as never))
        add(findings, "golden.animation-style-incompatible", `${beat.id}: ${beat.animationStyleId}`);
    }
  }
  if (Math.abs(cursor - manifest.composition.durationSeconds) > 0.001)
    add(
      findings,
      "golden.timeline-duration",
      `Visual plan ends at ${cursor}, composition ends at ${manifest.composition.durationSeconds}`,
    );

  for (const term of manifest.terminology.mustContain)
    if (!manifest.terminology.sampleCaptionText.includes(term))
      add(findings, "golden.terminology-missing", `Missing term: ${term}`);
  for (const term of manifest.terminology.mustNotContain)
    if (manifest.terminology.sampleCaptionText.includes(term))
      add(findings, "golden.terminology-rejected", `Rejected term: ${term}`);

  return {
    status: findings.length === 0 ? "passed" : "failed",
    findings,
    summary: {
      sourceCount: manifest.sources.length,
      visualBeatCount: manifest.visualPlan.length,
      visualTypes,
    },
  };
};
