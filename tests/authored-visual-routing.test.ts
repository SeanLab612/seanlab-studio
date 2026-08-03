import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveAuthoredVisualConstraint,
  selectInformationConstraintOwners,
} from "../src/creator-workflow/authored-visual-routing.ts";

const intents = [
  { startCue: 0, endCue: 1, confidence: 0.8, items: ["旧流程"], rhetoric: "process" },
  { startCue: 2, endCue: 3, confidence: 0.9, items: ["左", "右"], rhetoric: "comparison" },
  { startCue: 4, endCue: 5, confidence: 0.75, items: ["甲", "乙", "丙"], rhetoric: "factors" },
];

const matchesRhetoric = (constraint: { componentId?: string }, intent: (typeof intents)[number]) =>
  constraint.componentId === intent.rhetoric;

test("information choice pins only its matching evidence segment without suppressing siblings", () => {
  const constraints = [
    {
      sectionId: "comparison-section",
      mode: "information",
      componentId: "comparison",
      startCue: 0,
      endCue: 5,
    },
  ];
  const owners = selectInformationConstraintOwners({ constraints, intents, matchesRhetoric });
  assert.equal(owners.get("comparison-section"), 1);
  assert.equal(
    resolveAuthoredVisualConstraint({
      constraints,
      intent: intents[0],
      semanticIndex: 0,
      informationOwners: owners,
      matchesRhetoric,
    }),
    undefined,
  );
  assert.equal(
    resolveAuthoredVisualConstraint({
      constraints,
      intent: intents[1],
      semanticIndex: 1,
      informationOwners: owners,
      matchesRhetoric,
    })?.sectionId,
    "comparison-section",
  );
});

test("speaker policy applies independently to every semantic segment in its range", () => {
  const constraints = [{ sectionId: "speaker-section", mode: "speaker", startCue: 0, endCue: 5 }];
  const informationOwners = new Map<string, number>();
  for (const [semanticIndex, intent] of intents.entries())
    assert.equal(
      resolveAuthoredVisualConstraint({
        constraints,
        intent,
        semanticIndex,
        informationOwners,
        matchesRhetoric,
      })?.sectionId,
      "speaker-section",
    );
});
