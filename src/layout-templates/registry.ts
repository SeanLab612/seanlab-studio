import type { FixtureDefinition, LayoutTemplateDefinition, LayoutTemplateId } from "./types.ts";

const subtitleExclusion = { x: 320, y: 900, width: 1280, height: 150 };

export const layoutTemplateRegistry: LayoutTemplateDefinition[] = [
  {
    id: "speaker-center-left",
    status: "approved",
    purpose: "Primary side-column explanation with a centered speaker",
    speakerPosition: "center",
    overlaySide: "left",
    scrimSide: "left",
    titleZone: { x: 68, y: 58, width: 650, height: 112 },
    contentZones: [{ x: 68, y: 205, width: 620, height: 640 }],
    faceExclusion: { x: 720, y: 115, width: 520, height: 720 },
    subtitleExclusion,
    maxTextWidth: 610,
    useWhen: ["speaker centered", "single argument", "charts or cards"],
    avoidWhen: ["speaker occupies the left third"],
  },
  {
    id: "speaker-center-right",
    status: "approved",
    purpose: "Right-column alternative for a centered speaker",
    speakerPosition: "center",
    overlaySide: "right",
    scrimSide: "right",
    titleZone: { x: 1250, y: 58, width: 602, height: 112 },
    contentZones: [{ x: 1250, y: 205, width: 602, height: 640 }],
    faceExclusion: { x: 680, y: 115, width: 540, height: 720 },
    subtitleExclusion,
    maxTextWidth: 610,
    useWhen: ["speaker centered", "left background is busy"],
    avoidWhen: ["speaker occupies the right third"],
  },
  {
    id: "speaker-left-overlay-right",
    status: "approved",
    purpose: "Protect a left-positioned speaker and use the open right field",
    speakerPosition: "left",
    overlaySide: "right",
    scrimSide: "right",
    titleZone: { x: 1120, y: 58, width: 732, height: 112 },
    contentZones: [{ x: 1120, y: 205, width: 732, height: 640 }],
    faceExclusion: { x: 30, y: 70, width: 820, height: 800 },
    subtitleExclusion,
    maxTextWidth: 690,
    useWhen: ["speaker left", "right field is low information"],
    avoidWhen: ["right-side screenshot already occupies the field"],
  },
  {
    id: "speaker-right-overlay-left",
    status: "approved",
    purpose: "Protect a right-positioned speaker and use the open left field",
    speakerPosition: "right",
    overlaySide: "left",
    scrimSide: "left",
    titleZone: { x: 68, y: 58, width: 732, height: 112 },
    contentZones: [{ x: 68, y: 205, width: 732, height: 640 }],
    faceExclusion: { x: 1080, y: 70, width: 810, height: 800 },
    subtitleExclusion,
    maxTextWidth: 690,
    useWhen: ["speaker right", "left field is low information"],
    avoidWhen: ["left-side media already occupies the field"],
  },
  {
    id: "bilateral-comparison",
    status: "approved",
    purpose: "Two balanced evidence zones around a compact centered speaker",
    speakerPosition: "center",
    overlaySide: "both",
    scrimSide: "none",
    titleZone: { x: 68, y: 58, width: 570, height: 112 },
    contentZones: [
      { x: 68, y: 260, width: 570, height: 520 },
      { x: 1282, y: 260, width: 570, height: 520 },
    ],
    faceExclusion: { x: 680, y: 120, width: 560, height: 720 },
    subtitleExclusion,
    maxTextWidth: 520,
    useWhen: ["two-option comparison", "symmetric evidence"],
    avoidWhen: ["large close-up speaker", "more than two options"],
  },
  {
    id: "media-evidence",
    status: "approved",
    purpose: "One large screenshot or citation with compact supporting copy",
    speakerPosition: "adaptive",
    overlaySide: "right",
    scrimSide: "right",
    titleZone: { x: 1080, y: 58, width: 772, height: 112 },
    contentZones: [
      { x: 1080, y: 190, width: 772, height: 498 },
      { x: 1080, y: 712, width: 772, height: 132 },
    ],
    faceExclusion: { x: 150, y: 130, width: 780, height: 720 },
    subtitleExclusion,
    maxTextWidth: 720,
    useWhen: ["screenshot", "source evidence", "picture-in-picture"],
    avoidWhen: ["no authorized media", "dense multi-item ranking"],
  },
];

export const layoutFixtureRegistry: FixtureDefinition[] = [
  {
    id: "center-dark",
    src: "review-assets/creator-placeholder.svg",
    speakerPosition: "center",
    luminance: "dark",
    recommendedTemplate: "speaker-center-left",
  },
  {
    id: "right-dark",
    src: "review-assets/creator-placeholder.svg",
    speakerPosition: "right",
    luminance: "dark",
    recommendedTemplate: "speaker-right-overlay-left",
  },
  {
    id: "left-dark",
    src: "review-assets/creator-placeholder.svg",
    speakerPosition: "left",
    luminance: "dark",
    recommendedTemplate: "speaker-left-overlay-right",
  },
  {
    id: "center-bright",
    src: "review-assets/creator-placeholder.svg",
    speakerPosition: "center",
    luminance: "bright",
    recommendedTemplate: "speaker-center-left",
  },
];

export const getLayoutTemplate = (id: LayoutTemplateId) => {
  const template = layoutTemplateRegistry.find((entry) => entry.id === id);
  if (!template) throw new Error(`Unknown layout template: ${id}`);
  return template;
};

export const rectanglesOverlap = (
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

export const validateLayoutTemplate = (template: LayoutTemplateDefinition) => {
  const zones = [template.titleZone, ...template.contentZones, template.faceExclusion, template.subtitleExclusion];
  for (const zone of zones) {
    if (
      zone.x < 0 ||
      zone.y < 0 ||
      zone.width <= 0 ||
      zone.height <= 0 ||
      zone.x + zone.width > 1920 ||
      zone.y + zone.height > 1080
    )
      throw new Error(`${template.id} contains an out-of-bounds zone`);
  }
  if (template.contentZones.some((zone) => rectanglesOverlap(zone, template.faceExclusion)))
    throw new Error(`${template.id} content overlaps the face exclusion zone`);
  if (template.contentZones.some((zone) => rectanglesOverlap(zone, template.titleZone)))
    throw new Error(`${template.id} content overlaps the title zone`);
  if (rectanglesOverlap(template.titleZone, template.faceExclusion))
    throw new Error(`${template.id} title overlaps the face exclusion zone`);
  if (template.contentZones.some((zone) => rectanglesOverlap(zone, template.subtitleExclusion)))
    throw new Error(`${template.id} content overlaps the subtitle exclusion zone`);
  return true;
};
