import type { ApprovedVisualComponentId } from "../visual-brief/types.ts";
import type { LayoutTemplateId } from "./types.ts";
import { getLayoutTemplate } from "./registry.ts";

type LayoutSelectionInput = {
  componentId: ApprovedVisualComponentId;
  faceCenterX: number;
  componentProps?: Record<string, unknown>;
};

const faceAwareSideLayout = (faceCenterX: number): LayoutTemplateId => {
  if (faceCenterX < 0.42) return "speaker-left-overlay-right";
  if (faceCenterX > 0.58) return "speaker-right-overlay-left";
  return "speaker-center-left";
};

export const selectLayoutTemplate = ({
  componentId,
  faceCenterX,
  componentProps = {},
}: LayoutSelectionInput): LayoutTemplateId => {
  if (componentId === "binary-versus" && faceCenterX >= 0.42 && faceCenterX <= 0.58) return "bilateral-comparison";

  const hasMedia =
    componentId === "media-comparison" ||
    componentId === "image-evidence-inset" ||
    (componentId === "quote-source-card" && Boolean(componentProps.imageSrc));
  if (hasMedia && faceCenterX < 0.42) return "media-evidence";

  return faceAwareSideLayout(faceCenterX);
};

const naturalComponentWidths: Partial<Record<ApprovedVisualComponentId, number>> = {
  "scenario-branches": 830,
  "market-cap-lines": 780,
  "person-evidence-card": 760,
  "quote-source-card": 760,
  "image-evidence-inset": 740,
  "key-stat-summary": 760,
  "rough-annotation": 740,
};

export const selectContentScale = ({
  componentId,
  layoutTemplateId,
}: {
  componentId: ApprovedVisualComponentId;
  layoutTemplateId: LayoutTemplateId;
}) => {
  const zone = getLayoutTemplate(layoutTemplateId).contentZones[0];
  const naturalWidth = naturalComponentWidths[componentId] ?? 740;
  return Math.max(0.82, Math.min(1, Number((zone.width / naturalWidth).toFixed(3))));
};
