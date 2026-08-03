export type SoundRole =
  | "brand-signature"
  | "scene-transition"
  | "hero-entry"
  | "item-step"
  | "settle"
  | "warning"
  | "component-exit";

export type SoundAsset = {
  id: string;
  role: SoundRole;
  file: string;
  durationSeconds: number;
  sampleRate: number;
  channels: number;
  gainDb: number;
  meanVolumeDb: number;
  peakDbfs: number;
  provenance: string;
  license: string;
  sha256: string;
};

export type SoundEvent = {
  id: string;
  at: number;
  assetId: string;
  role: SoundRole;
  gainDb: number;
  priority: number;
  reason: string;
  cueId?: string;
};

export type SoundPolicy = {
  enabled: boolean;
  maximumEventsPerMinute: number;
  minimumEventGapSeconds: number;
  maximumEventsPerCue: number;
  speechGainCeilingDb: number;
};

export type SoundPlan = {
  schemaVersion: "1.0";
  profileId: "seanlab-sound-1.0";
  policy: SoundPolicy;
  events: SoundEvent[];
  suppressed: Array<{ id: string; reason: string }>;
  summary: {
    eventCount: number;
    suppressedCount: number;
    eventsPerMinute: number;
  };
};
