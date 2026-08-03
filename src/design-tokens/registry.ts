import type { DesignTokenGroup } from "./types.ts";

export const designTokenRegistry: DesignTokenGroup[] = [
  {
    id: "color",
    status: "approved",
    purpose: "Global component accent contract: blue, mint, amber, violet, red, and neutral",
    useWhen: ["all semantic components", "all overlays", "charts", "status emphasis"],
    avoidWhen: ["unregistered accent colors", "decorative rainbow palettes"],
  },
  {
    id: "typography",
    status: "approved",
    purpose: "Consistent bilingual hierarchy",
    useWhen: ["titles", "labels", "captions"],
    avoidWhen: ["long paragraphs inside cards"],
  },
  {
    id: "glass",
    status: "approved",
    purpose: "Compact content-bearing surfaces",
    useWhen: ["chips", "evidence cards", "short callouts"],
    avoidWhen: ["subtitles", "debug copy", "full-screen panels"],
  },
  {
    id: "scrim",
    status: "approved",
    purpose: "Local readability without dimming the speaker",
    useWhen: ["text over footage", "low-information side columns"],
    avoidWhen: ["full-frame dark filters"],
  },
  {
    id: "spacing",
    status: "approved",
    purpose: "Stable rhythm and edge clearance",
    useWhen: ["all 16:9 compositions"],
    avoidWhen: ["freehand placement"],
  },
  {
    id: "safe-area",
    status: "approved",
    purpose: "Protect face, subtitles, and platform edges",
    useWhen: ["layout selection", "collision checks"],
    avoidWhen: ["covering the center by default"],
  },
];

export const getDesignTokenGroup = (id: DesignTokenGroup["id"]) => {
  const group = designTokenRegistry.find((entry) => entry.id === id);
  if (!group) throw new Error(`Unknown design token group: ${id}`);
  return group;
};
