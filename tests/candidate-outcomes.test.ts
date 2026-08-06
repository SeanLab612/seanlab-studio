import assert from "node:assert/strict";
import test from "node:test";
import { summarizeCandidateOutcomes } from "../src/visual-direction/candidate-outcomes.ts";
import type { VisualDirectionCandidate } from "../src/visual-direction/types.ts";

const candidate = (patch: Partial<VisualDirectionCandidate>): VisualDirectionCandidate => ({
  id: "candidate",
  semanticIndex: 0,
  startCue: 0,
  endCue: 0,
  start: 0,
  end: 5,
  visualPriority: "normal",
  confidence: 0.9,
  rhetoric: "editorial-statement",
  reason: "evidence-grounded",
  materializationStatus: "planned",
  ...patch,
});

test("candidate outcomes distinguish materialized, superseded, skipped, and blocked work", () => {
  const report = summarizeCandidateOutcomes([
    candidate({ id: "planned" }),
    candidate({
      id: "superseded",
      materializationStatus: "skipped",
      handling: { status: "superseded", code: "required-material-assignment", reason: "primary image owns interval" },
    }),
    candidate({ id: "intentional", materializationStatus: "skipped", materializationReason: "low semantic value" }),
    candidate({ id: "safe", materializationStatus: "skipped", materializationReason: "invalid local props" }),
    candidate({ id: "blocked", materializationStatus: "blocked", materializationReason: "anchor is ambiguous" }),
  ]);
  assert.deepEqual(report.counts, {
    materialized: 1,
    superseded: 1,
    "intentionally-skipped": 1,
    "safely-skipped": 1,
    blocked: 1,
  });
});
