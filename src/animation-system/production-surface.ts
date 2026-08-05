import type { AnimationTemplateId } from "./template-registry.ts";

const canvasByTemplate: Record<AnimationTemplateId, string> = {
  "paper-editorial": "#F2EEDF",
};

export const resolveAnimationProductionSurface = (templateId: AnimationTemplateId) => ({
  backgroundColor: canvasByTemplate[templateId],
  opacity: 1,
  isolation: "isolate" as const,
});
