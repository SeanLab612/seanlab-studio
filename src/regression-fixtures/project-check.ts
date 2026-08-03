type Finding = { severity: "error" | "warning"; rule: string; message: string; cueId?: string };

type SemanticCue = {
  id: string;
  componentId: string;
  layoutId: string;
  motionRecipeId: string;
  start: number;
  end: number;
};

type ProjectFixtureInput = {
  expected: {
    captionAssertions?: { mustContain?: string[]; mustNotContain?: string[] };
    semanticCues?: SemanticCue[];
    terminologyDomains?: string[];
    qa?: { status?: string; cues?: number; frames?: number; errors?: number; warnings?: number };
  };
  plan: {
    overlayCues: Array<{
      start: number;
      end: number;
      layoutTemplateId: string;
      generatedVisual: {
        segment: { id: string };
        component: { id: string };
        motion?: { recipeId?: string };
      };
    }>;
  };
  captions: Array<{ zh: string }>;
  terminology: { domains: string[] };
  qa: { status: string; summary?: { cues?: number; frames?: number; errors?: number; warnings?: number } };
};

export const compareProjectFixture = ({ expected, plan, captions, terminology, qa }: ProjectFixtureInput) => {
  const findings: Finding[] = [];
  const add = (severity: Finding["severity"], rule: string, message: string, context: Partial<Finding> = {}) =>
    findings.push({ severity, rule, message, ...context });
  const captionText = captions.map((item: { zh: string }) => item.zh).join("");
  for (const term of expected.captionAssertions?.mustContain ?? [])
    if (!captionText.includes(term)) add("error", "caption.term-missing", `Expected caption term is missing: ${term}`);
  for (const term of expected.captionAssertions?.mustNotContain ?? [])
    if (captionText.includes(term)) add("error", "caption.term-regressed", `Rejected ASR term returned: ${term}`);

  const actualCues = plan.overlayCues.map((cue) => ({
    id: cue.generatedVisual.segment.id,
    componentId: cue.generatedVisual.component.id,
    layoutId: cue.layoutTemplateId,
    motionRecipeId: cue.generatedVisual.motion?.recipeId,
    start: cue.start,
    end: cue.end,
  }));
  if (actualCues.length !== (expected.semanticCues?.length ?? 0))
    add(
      "error",
      "semantic.cue-count",
      `Expected ${expected.semanticCues?.length ?? 0} cues, received ${actualCues.length}.`,
    );
  for (const expectedCue of expected.semanticCues ?? []) {
    const actual = actualCues.find((item: { id: string }) => item.id === expectedCue.id);
    if (!actual) {
      add("error", "semantic.cue-missing", `Expected cue is missing: ${expectedCue.id}`, { cueId: expectedCue.id });
      continue;
    }
    for (const key of ["componentId", "layoutId", "motionRecipeId"] as const)
      if (actual[key] !== expectedCue[key])
        add(
          "error",
          `semantic.${key}-changed`,
          `${expectedCue.id} expected ${expectedCue[key]}, received ${actual[key]}.`,
          {
            cueId: expectedCue.id,
          },
        );
    for (const key of ["start", "end"] as const)
      if (Math.abs(actual[key] - expectedCue[key]) > 0.01)
        add(
          "error",
          `semantic.${key}-changed`,
          `${expectedCue.id} expected ${key}=${expectedCue[key]}, received ${actual[key]}.`,
          {
            cueId: expectedCue.id,
          },
        );
  }
  if (
    JSON.stringify([...terminology.domains].sort()) !== JSON.stringify([...(expected.terminologyDomains ?? [])].sort())
  )
    add(
      "error",
      "terminology.domains-changed",
      `Expected domains ${(expected.terminologyDomains ?? []).join(", ")}, received ${terminology.domains.join(", ")}.`,
    );
  if (qa.status !== expected.qa?.status)
    add("error", "qa.status", `Expected QA status=${expected.qa?.status}, received ${qa.status}.`);
  for (const key of ["cues", "frames", "errors", "warnings"] as const)
    if (qa.summary?.[key] !== expected.qa?.[key])
      add("error", `qa.${key}`, `Expected QA ${key}=${expected.qa?.[key]}, received ${qa.summary?.[key]}.`);

  return {
    findings,
    actualCues,
    summary: {
      expectedCues: expected.semanticCues?.length ?? 0,
      actualCues: actualCues.length,
      errors: findings.filter((item) => item.severity === "error").length,
      warnings: findings.filter((item) => item.severity === "warning").length,
    },
  };
};
