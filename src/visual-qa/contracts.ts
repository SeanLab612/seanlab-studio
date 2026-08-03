import { layoutTemplateRegistry } from "../layout-templates/registry.ts";
import { APPROVED_COMPONENT_IDS } from "../visual-brief/types.ts";
import type { ComponentQaContract, LayoutQaContract } from "./types.ts";

const defaultChecks: ComponentQaContract["checks"] = ["canvas", "face", "subtitle", "title", "font", "end-state"];

const component = (
  componentId: ComponentQaContract["componentId"],
  contentBounds: ComponentQaContract["contentBounds"],
  options: Partial<Omit<ComponentQaContract, "componentId" | "contentBounds">> = {},
): ComponentQaContract => ({
  componentId,
  contentBounds,
  minimumFontPx: 12,
  expectedEndState: "visible",
  mediaPolicy: "none",
  checks: defaultChecks,
  ...options,
});

export const componentQaContracts: ComponentQaContract[] = [
  component("distribution-bars", { x: 60, y: 198, width: 780, height: 610 }, { minimumFontPx: 22 }),
  component("scenario-branches", { x: 55, y: 190, width: 800, height: 620 }, { minimumFontPx: 22 }),
  component("market-cap-lines", { x: 55, y: 190, width: 810, height: 625 }, { minimumFontPx: 24 }),
  component(
    "person-evidence-card",
    { x: 60, y: 195, width: 800, height: 620 },
    { minimumFontPx: 22, mediaPolicy: "optional-cover", checks: [...defaultChecks, "media"] },
  ),
  component("factor-sequence", { x: 60, y: 195, width: 790, height: 610 }, { minimumFontPx: 22 }),
  component("ranked-metric-list", { x: 60, y: 195, width: 760, height: 620 }, { minimumFontPx: 18 }),
  component("binary-versus", { x: 70, y: 210, width: 740, height: 420 }, { minimumFontPx: 20 }),
  component("key-stat-summary", { x: 55, y: 195, width: 810, height: 610 }, { minimumFontPx: 22 }),
  component(
    "media-comparison",
    { x: 55, y: 195, width: 810, height: 625 },
    { minimumFontPx: 22, mediaPolicy: "optional-cover", checks: [...defaultChecks, "media"] },
  ),
  component(
    "image-evidence-inset",
    { x: 70, y: 205, width: 740, height: 625 },
    { minimumFontPx: 22, mediaPolicy: "required-contain", checks: [...defaultChecks, "media"] },
  ),
  component("process-steps", { x: 60, y: 195, width: 760, height: 620 }, { minimumFontPx: 22 }),
  component("causal-chain", { x: 70, y: 260, width: 740, height: 350 }, { minimumFontPx: 22 }),
  component(
    "quote-source-card",
    { x: 55, y: 195, width: 815, height: 625 },
    { minimumFontPx: 22, mediaPolicy: "optional-cover", checks: [...defaultChecks, "media"] },
  ),
  component("historical-timeline", { x: 55, y: 240, width: 790, height: 520 }, { minimumFontPx: 22 }),
  component("decision-matrix", { x: 55, y: 205, width: 750, height: 560 }, { minimumFontPx: 22 }),
  component("model-classification-map", { x: 55, y: 195, width: 790, height: 610 }, { minimumFontPx: 22 }),
  component("capability-surface-grid", { x: 55, y: 205, width: 760, height: 590 }, { minimumFontPx: 24 }),
  component("tradeoff-scale", { x: 55, y: 195, width: 790, height: 610 }, { minimumFontPx: 22 }),
  component("rough-annotation", { x: 55, y: 195, width: 790, height: 610 }, { minimumFontPx: 24 }),
];

// Manual text annotations reuse the approved rough-annotation renderer and
// therefore must reuse its QA crop instead of introducing a second component
// identity with an unreviewed content-bound contract.
export const textAnnotationQaComponentId: ComponentQaContract["componentId"] = "rough-annotation";

if (componentQaContracts.length !== APPROVED_COMPONENT_IDS.length)
  throw new Error("Visual QA contracts must cover all approved components.");

export const layoutQaContracts: LayoutQaContract[] = layoutTemplateRegistry.map((layout) => ({
  layoutId: layout.id,
  canvas: { width: 1920, height: 1080 },
  // The layout title zone includes editorial breathing room. Collision checks use
  // the occupied title band so that padding is not mistaken for visible ink.
  titleBounds: { ...layout.titleZone, height: Math.min(layout.titleZone.height, 96) },
  faceBounds: layout.faceExclusion,
  subtitleBounds: layout.subtitleExclusion,
  contentBounds: layout.contentZones,
}));

export const getComponentQaContract = (id: ComponentQaContract["componentId"]) => {
  const contract = componentQaContracts.find((item) => item.componentId === id);
  if (!contract) throw new Error(`Missing component QA contract: ${id}`);
  return contract;
};

export const getLayoutQaContract = (id: LayoutQaContract["layoutId"]) => {
  const contract = layoutQaContracts.find((item) => item.layoutId === id);
  if (!contract) throw new Error(`Missing layout QA contract: ${id}`);
  return contract;
};
