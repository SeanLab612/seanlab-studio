import type React from "react";
import { Audio, Sequence, staticFile, useVideoConfig } from "remotion";
import { getSoundAsset } from "./registry.ts";
import type { SoundEvent } from "./types.ts";

const dbToAmplitude = (gainDb: number) => 10 ** (gainDb / 20);

export const SoundEventLayer: React.FC<{ events?: SoundEvent[] }> = ({ events = [] }) => {
  const { fps } = useVideoConfig();
  return events.map((event) => {
    const asset = getSoundAsset(event.assetId);
    if (event.role === "brand-signature") return null;
    return (
      <Sequence
        key={event.id}
        from={Math.max(0, Math.round(event.at * fps))}
        durationInFrames={Math.max(1, Math.ceil(asset.durationSeconds * fps))}
      >
        <Audio src={staticFile(asset.file)} volume={dbToAmplitude(event.gainDb)} />
      </Sequence>
    );
  });
};
