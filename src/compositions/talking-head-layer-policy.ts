export type TimelineLayerInventory = {
  overlayCues?: readonly unknown[];
  subtitleCues?: readonly unknown[];
  screenScenes?: readonly unknown[];
  titleCues?: readonly unknown[];
  animationCues?: readonly unknown[];
  annotationCues?: readonly unknown[];
  imageCues?: readonly unknown[];
};

export const hasManagedProductionTimeline = (inventory: TimelineLayerInventory) =>
  [
    inventory.overlayCues,
    inventory.subtitleCues,
    inventory.screenScenes,
    inventory.titleCues,
    inventory.animationCues,
    inventory.annotationCues,
    inventory.imageCues,
  ].some((cues) => (cues?.length ?? 0) > 0);

export const shouldRenderLegacyFallback = (inventory: TimelineLayerInventory, hasActiveVisualBrief: boolean) =>
  !hasActiveVisualBrief && !hasManagedProductionTimeline(inventory);
