import type { ApprovedVisualComponentId } from "./types.ts";

export const usesMobilePersonEvidenceDensity = (componentId: ApprovedVisualComponentId) =>
  componentId === "person-evidence-card";
