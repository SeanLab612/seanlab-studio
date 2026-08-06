import type { VisualDirectionCandidate } from "./types.ts";

export type CandidateOutcomeStatus =
  | "materialized"
  | "superseded"
  | "intentionally-skipped"
  | "safely-skipped"
  | "blocked";

const statusFor = (candidate: VisualDirectionCandidate): CandidateOutcomeStatus => {
  if (candidate.handling?.status) return candidate.handling.status;
  if (candidate.materializationStatus === "planned") return "materialized";
  if (candidate.materializationStatus === "blocked") return "blocked";
  if (/speaker-only|low semantic value|confidence|consecutive|duplicate/i.test(candidate.materializationReason ?? ""))
    return "intentionally-skipped";
  return "safely-skipped";
};

export const summarizeCandidateOutcomes = (candidates: readonly VisualDirectionCandidate[]) => {
  const entries = candidates.map((candidate) => ({
    id: candidate.id,
    status: statusFor(candidate),
    code: candidate.handling?.code ?? candidate.materializationStatus,
    reason: candidate.handling?.reason ?? candidate.materializationReason ?? candidate.reason,
  }));
  const counts = Object.fromEntries(
    (["materialized", "superseded", "intentionally-skipped", "safely-skipped", "blocked"] as const).map((status) => [
      status,
      entries.filter((entry) => entry.status === status).length,
    ]),
  );
  return { schemaVersion: "1.0", counts, entries };
};
