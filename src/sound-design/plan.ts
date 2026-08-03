import { soundAssetForRole } from "./registry.ts";
import type { SoundEvent, SoundPlan, SoundPolicy } from "./types.ts";

export const defaultSoundPolicy: SoundPolicy = Object.freeze({
  enabled: true,
  maximumEventsPerMinute: 6,
  minimumEventGapSeconds: 0.75,
  maximumEventsPerCue: 2,
  speechGainCeilingDb: -16,
});

type OverlayCueLike = {
  start: number;
  end: number;
  visualImportance?: "hero" | "support" | "accent";
  generatedVisual?: {
    segment?: { id?: string };
    component?: { id?: string };
    motion?: { recipeId?: string };
    props?: Record<string, unknown>;
  };
};

type ScreenSceneLike = { id: string; start: number; end: number };

const candidate = ({ id, at, role, priority, reason, cueId }: Omit<SoundEvent, "assetId" | "gainDb">): SoundEvent => {
  const asset = soundAssetForRole(role);
  return { id, at, role, priority, reason, cueId, assetId: asset.id, gainDb: asset.gainDb };
};

const itemTimeline = (props: Record<string, unknown> | undefined) => {
  if (!props) return [];
  const timeline = props.activeIndexTimeline;
  if (!Array.isArray(timeline)) return [];
  return timeline.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || !("at" in entry) || !Number.isFinite(entry.at)) return [];
    return [Number(entry.at)];
  });
};

export const planSoundEvents = ({
  durationSeconds,
  overlayCues,
  screenScenes,
  brandTimeline,
  policy = defaultSoundPolicy,
}: {
  durationSeconds: number;
  overlayCues: OverlayCueLike[];
  screenScenes: ScreenSceneLike[];
  brandTimeline?: { status?: string; presentationTimeSeconds?: number };
  policy?: SoundPolicy;
}): SoundPlan => {
  const candidates: SoundEvent[] = [];
  if (policy.enabled && brandTimeline?.status === "resolved" && Number.isFinite(brandTimeline.presentationTimeSeconds))
    candidates.push(
      candidate({
        id: "brand-signature",
        at: Number(brandTimeline.presentationTimeSeconds),
        role: "brand-signature",
        priority: 100,
        reason: "Legacy project-local bumper signature",
        cueId: "brand-bumper",
      }),
    );
  for (const scene of screenScenes) {
    candidates.push(
      candidate({
        id: `screen-${scene.id}-enter`,
        at: scene.start,
        role: "scene-transition",
        priority: 70,
        reason: "Authored screen scene enters",
        cueId: scene.id,
      }),
    );
    candidates.push(
      candidate({
        id: `screen-${scene.id}-exit`,
        at: Math.max(scene.start, scene.end - 0.22),
        role: "component-exit",
        priority: 24,
        reason: "Authored screen scene exits",
        cueId: scene.id,
      }),
    );
  }
  for (const [index, cue] of overlayCues.entries()) {
    const cueId = cue.generatedVisual?.segment?.id ?? `overlay-${index + 1}`;
    if (cue.generatedVisual?.component?.id === "image-evidence-inset") {
      candidates.push(
        candidate({
          id: `${cueId}-image-enter`,
          at: cue.start,
          role: "scene-transition",
          priority: 65,
          reason: "Registered image evidence enters",
          cueId,
        }),
        candidate({
          id: `${cueId}-image-exit`,
          at: Math.max(cue.start, cue.end - 0.22),
          role: "component-exit",
          priority: 24,
          reason: "Registered image evidence exits",
          cueId,
        }),
      );
    }
    if (cue.visualImportance !== "hero") continue;
    candidates.push(
      candidate({
        id: `${cueId}-hero-enter`,
        at: cue.start,
        role: "hero-entry",
        priority: 60,
        reason: "Hero visual enters",
        cueId,
      }),
    );
    for (const [itemIndex, relativeAt] of itemTimeline(cue.generatedVisual?.props).slice(1, 3).entries()) {
      if (relativeAt <= 0 || cue.start + relativeAt >= cue.end) continue;
      candidates.push(
        candidate({
          id: `${cueId}-item-${itemIndex + 1}`,
          at: cue.start + relativeAt,
          role: "item-step",
          priority: 30,
          reason: "Hero sequence advances to a reviewed item",
          cueId,
        }),
      );
    }
    if (cue.generatedVisual?.component?.id === "tradeoff-scale")
      candidates.push(
        candidate({
          id: `${cueId}-warning`,
          at: Math.min(cue.end - 0.4, cue.start + 0.7),
          role: "warning",
          priority: 50,
          reason: "Approved tradeoff component emphasizes a constraint",
          cueId,
        }),
      );
    candidates.push(
      candidate({
        id: `${cueId}-exit`,
        at: Math.max(cue.start, cue.end - 0.22),
        role: "component-exit",
        priority: 20,
        reason: "Hero visual exits after its reviewed readable interval",
        cueId,
      }),
    );
  }

  candidates.sort(
    (left, right) => right.priority - left.priority || left.at - right.at || left.id.localeCompare(right.id),
  );
  const events: SoundEvent[] = [];
  const suppressed: Array<{ id: string; reason: string }> = [];
  const perCue = new Map<string, number>();
  const eventBudget = Math.max(1, Math.floor((durationSeconds / 60) * policy.maximumEventsPerMinute));
  const requiredBrandEvents = candidates.some((event) => event.role === "brand-signature") ? 1 : 0;
  const ordinaryBudget = Math.max(0, eventBudget - requiredBrandEvents);
  for (const event of candidates) {
    if (!policy.enabled) {
      suppressed.push({ id: event.id, reason: "sound-disabled" });
      continue;
    }
    if (
      events.filter((selected) => selected.role !== "brand-signature").length >= ordinaryBudget &&
      event.role !== "brand-signature"
    ) {
      suppressed.push({ id: event.id, reason: "per-minute-budget" });
      continue;
    }
    const cueCount = perCue.get(event.cueId ?? "global") ?? 0;
    if (cueCount >= policy.maximumEventsPerCue && event.role !== "brand-signature") {
      suppressed.push({ id: event.id, reason: "per-cue-budget" });
      continue;
    }
    const conflict = events.find((selected) => Math.abs(selected.at - event.at) < policy.minimumEventGapSeconds);
    if (conflict) {
      if (event.priority > conflict.priority) {
        events.splice(events.indexOf(conflict), 1);
        const conflictCue = conflict.cueId ?? "global";
        perCue.set(conflictCue, Math.max(0, (perCue.get(conflictCue) ?? 1) - 1));
        suppressed.push({ id: conflict.id, reason: `collision-replaced-by-${event.id}` });
      } else {
        suppressed.push({ id: event.id, reason: `collision-with-${conflict.id}` });
        continue;
      }
    }
    const effectiveEvent =
      event.role === "brand-signature"
        ? event
        : { ...event, gainDb: Math.min(event.gainDb, policy.speechGainCeilingDb) };
    events.push(effectiveEvent);
    const effectiveCue = event.cueId ?? "global";
    perCue.set(effectiveCue, (perCue.get(effectiveCue) ?? 0) + 1);
  }
  events.sort((left, right) => left.at - right.at);
  return {
    schemaVersion: "1.0",
    profileId: "seanlab-sound-1.0",
    policy,
    events,
    suppressed,
    summary: {
      eventCount: events.length,
      suppressedCount: suppressed.length,
      eventsPerMinute: Number((events.length / Math.max(durationSeconds / 60, 1 / 60)).toFixed(3)),
    },
  };
};
