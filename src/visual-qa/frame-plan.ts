import type { OverlayCue } from "../data/sample-props.ts";
import type { QaPhase } from "./types.ts";

export const qaPhaseTimes = (cue: Pick<OverlayCue, "start" | "end">): Record<QaPhase, number> => {
  const safeTime = (ratio: number, inset: number) =>
    Math.min(cue.end - 0.034, Math.max(cue.start, cue.start + (cue.end - cue.start) * ratio + inset));
  return {
    entry: safeTime(0.04, 0.08),
    transition: safeTime(0.5, 0),
    stable: safeTime(0.78, 0),
    "exit-risk": Math.max(cue.start, cue.end - Math.min(0.2, (cue.end - cue.start) * 0.04)),
  };
};

export const createQaFramePlan = (cues: OverlayCue[], fps = 30) =>
  cues.flatMap((cue, cueIndex) => {
    if (!cue.generatedVisual) throw new Error(`Cue ${cueIndex + 1} is missing generatedVisual.`);
    const cueId = cue.generatedVisual.segment?.id ?? `cue-${String(cueIndex + 1).padStart(2, "0")}`;
    const componentId = cue.generatedVisual.component.id;
    return Object.entries(qaPhaseTimes(cue)).map(([phase, timeSeconds]) => ({
      cueIndex,
      cueId,
      componentId,
      layoutId: cue.layoutTemplateId,
      phase: phase as QaPhase,
      timeSeconds,
      frame: Math.max(0, Math.round(timeSeconds * fps)),
    }));
  });
