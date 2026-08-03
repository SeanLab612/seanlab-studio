import type { ApprovedVisualComponentId } from "../visual-brief/types.ts";
import type { LayoutTemplateId } from "../layout-templates/types.ts";
import type { MotionRecipeId } from "../motion-recipes/types.ts";

export const REGRESSION_FIXTURE_SCHEMA_VERSION = "1.0" as const;

export type FixtureCoverageTag =
  | "speaker-left"
  | "speaker-center"
  | "speaker-right"
  | "lighting-dark"
  | "lighting-bright"
  | "rapid-speech"
  | "long-caption"
  | "terminology-ai"
  | "terminology-finance"
  | "terminology-laboratory"
  | "numbers-units"
  | "comparison"
  | "process"
  | "quotation"
  | "screenshot"
  | "all-components";

export type FixtureSource = {
  kind: "local-video-reference" | "frozen-image" | "structured-data" | "generated-composition-suite";
  path: string;
  sha256?: string;
  gitPolicy: "tracked" | "local-only";
  redistributable: boolean;
  rights: string;
  provenance: string;
};

export type RegressionFixture = {
  id: string;
  status: "approved" | "candidate";
  title: string;
  canvas: { width: 1920; height: 1080 };
  sources: FixtureSource[];
  coverage: FixtureCoverageTag[];
  expectedManifest?: string;
  approvedBaseline?: string;
};

export type RegressionFixtureRegistry = {
  schemaVersion: typeof REGRESSION_FIXTURE_SCHEMA_VERSION;
  profileId: "foundation-0.1.13";
  fixtures: RegressionFixture[];
};

export type ExpectedSemanticCue = {
  id: string;
  componentId: ApprovedVisualComponentId;
  layoutId: LayoutTemplateId;
  motionRecipeId: MotionRecipeId;
  start: number;
  end: number;
};
