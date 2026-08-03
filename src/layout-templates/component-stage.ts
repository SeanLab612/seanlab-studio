import type { ScrimSide } from "../design-tokens";

export const MIN_PRODUCTION_COMPONENT_SCALE = 1;

export const resolveProductionScrimSide = ({
  hasComponentCue,
  layoutScrimSide,
}: {
  hasComponentCue: boolean;
  layoutScrimSide: ScrimSide;
}): ScrimSide => (hasComponentCue ? "left" : layoutScrimSide);

export const resolveProductionComponentScale = ({
  hasComponentCue,
  requestedScale,
}: {
  hasComponentCue: boolean;
  requestedScale: number;
}) => (hasComponentCue ? Math.max(MIN_PRODUCTION_COMPONENT_SCALE, requestedScale) : requestedScale);
