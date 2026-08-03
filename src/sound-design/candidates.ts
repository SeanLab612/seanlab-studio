import generated from "./generated-candidate-registry.json" with { type: "json" };
import libraryApproval from "./library-approval.json" with { type: "json" };

export type SoundCandidateAsset = {
  id: string;
  status: "candidate";
  family: "transition" | "impact" | "interface" | "reveal" | "annotation";
  gesture: string;
  description: string;
  file: string;
  durationSeconds: number;
  sampleRate: number;
  channels: number;
  gainDb: number;
  meanVolumeDb: number;
  peakDbfs: number;
  provenance: string;
  inspirationBoundary: string;
  license: "SeanLab owned original";
  sha256: string;
};

export const soundCandidateRegistry = Object.freeze(generated.assets as SoundCandidateAsset[]);
export const approvedSoundCandidateIds = Object.freeze(libraryApproval.assetIds as string[]);

const candidateIds = new Set(soundCandidateRegistry.map((item) => item.id));
if (
  libraryApproval.decision !== "approved-library-retention" ||
  libraryApproval.productionMapping !== "deferred" ||
  approvedSoundCandidateIds.length !== soundCandidateRegistry.length ||
  approvedSoundCandidateIds.some((id) => !candidateIds.has(id))
) {
  throw new Error("Sound candidate library approval does not match the isolated candidate registry");
}

export const getSoundCandidate = (id: string) => {
  const candidate = soundCandidateRegistry.find((item) => item.id === id);
  if (!candidate) throw new Error(`Unknown sound candidate: ${id}`);
  return candidate;
};
