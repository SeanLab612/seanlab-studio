import type {
  VisualDirectionCandidate,
  VisualDirectionDecision,
  VisualDirectionPlan,
  VisualDirectionPolicy,
  VisualImportance,
} from "./types.ts";
import { TITLE_CONTINUITY_REPETITION_WINDOW_SECONDS } from "./types.ts";

const TIMING_EPSILON_SECONDS = 0.001;

export const DEFAULT_VISUAL_DIRECTION_POLICY: VisualDirectionPolicy = Object.freeze({
  version: "1.0",
  maximumVisualsPerMinute: 12,
  minimumBreathingGapSeconds: 0.6,
  minimumVisibleSeconds: 2.2,
  maximumAccentSeconds: 8,
  maximumSupportSeconds: 12,
  maximumHeroSeconds: 18,
  maximumContinuousVisualSeconds: 32,
  repetitionWindowSeconds: 12,
  minimumHeroGapSeconds: 42,
  maximumVisualCoverageRatio: 1,
  maximumAnimationCoverageRatio: 0.25,
  maximumChapterSeconds: 120,
  maximumChapterCandidates: 6,
  heroConfidence: 0.88,
  supportConfidence: 0.72,
  accentConfidence: 0.58,
});

const normalizeLabel = (value: string) => value.trim().toLocaleUpperCase() || "NARRATIVE";

const importanceFor = (candidate: VisualDirectionCandidate, policy: VisualDirectionPolicy): VisualImportance => {
  if (candidate.materializationStatus !== "planned" || candidate.visualPriority === "skip") return "none";
  if (candidate.creatorConstraint) return candidate.visualPriority === "high" ? "hero" : "support";
  if (candidate.visualPriority === "high" && candidate.confidence >= policy.heroConfidence) return "hero";
  if (candidate.confidence >= policy.supportConfidence) return "support";
  if (candidate.confidence >= policy.accentConfidence) return "accent";
  return "none";
};

const score = (decision: VisualDirectionDecision) => {
  const tier = { hero: 4, support: 3, accent: 2, none: 0 }[decision.importance];
  return tier * 100 + (decision.displayEnd ?? 0) - (decision.displayStart ?? 0);
};

const contentSignature = (candidate: VisualDirectionCandidate) => {
  const visual = candidate.overlayCue?.generatedVisual;
  if (!visual) return "";
  const props = { ...visual.props };
  delete props.activeIndex;
  delete props.activeIndexTimeline;
  return JSON.stringify({
    component: visual.component.id,
    title: visual.narrative.title,
    subtitleZh: visual.narrative.subtitleZh,
    props,
  });
};

const createChapters = (candidates: VisualDirectionCandidate[], policy: VisualDirectionPolicy) => {
  const chapters: VisualDirectionPlan["chapters"] = [];
  for (const candidate of candidates) {
    const previous = chapters.at(-1);
    const previousCandidate = previous
      ? candidates.find((item) => item.id === previous.candidateIds.at(-1))
      : undefined;
    const firstCandidate = previous ? candidates.find((item) => item.id === previous.candidateIds[0]) : undefined;
    const shouldBreak =
      !previous ||
      !previousCandidate ||
      !firstCandidate ||
      candidate.startCue - previousCandidate.endCue > 1 ||
      candidate.end - firstCandidate.start > policy.maximumChapterSeconds ||
      previous.candidateIds.length >= policy.maximumChapterCandidates;
    if (shouldBreak) {
      chapters.push({
        id: `chapter-${chapters.length + 1}`,
        label: normalizeLabel(candidate.overlayCue?.title ?? candidate.overlayCue?.eyebrow ?? candidate.rhetoric),
        startCue: candidate.startCue,
        endCue: candidate.endCue,
        candidateIds: [candidate.id],
      });
      continue;
    }
    previous.endCue = candidate.endCue;
    previous.candidateIds.push(candidate.id);
  }
  for (const chapter of chapters) {
    const firstRenderable = candidates.find(
      (candidate) => chapter.candidateIds.includes(candidate.id) && candidate.overlayCue,
    );
    if (firstRenderable)
      chapter.label = normalizeLabel(
        firstRenderable.overlayCue?.title ?? firstRenderable.overlayCue?.eyebrow ?? chapter.label,
      );
  }
  return chapters;
};

const chapterIdFor = (chapters: VisualDirectionPlan["chapters"], candidateId: string) =>
  chapters.find((chapter) => chapter.candidateIds.includes(candidateId))?.id ?? "chapter-1";

const skip = (decision: VisualDirectionDecision, reason: string) => {
  decision.action = "skip";
  decision.importance = "none";
  decision.displayStart = null;
  decision.displayEnd = null;
  decision.reasons.push(reason);
};

export const directVisualPacing = ({
  candidates,
  durationSeconds,
  policy: inputPolicy,
}: {
  candidates: VisualDirectionCandidate[];
  durationSeconds: number;
  policy?: Partial<VisualDirectionPolicy>;
}): VisualDirectionPlan => {
  const policy = { ...DEFAULT_VISUAL_DIRECTION_POLICY, ...inputPolicy, version: "1.0" as const };
  const breathingGapSeconds = policy.minimumVisualCoverageRatio ? 0 : policy.minimumBreathingGapSeconds;
  const ordered = [...candidates].sort((left, right) => left.startCue - right.startCue);
  const chapters = createChapters(ordered, policy);
  const decisions: VisualDirectionDecision[] = [];

  for (const [index, candidate] of ordered.entries()) {
    let importance = importanceFor(candidate, policy);
    const priorHero = [...decisions].reverse().find((item) => item.action === "show" && item.importance === "hero");
    const heroDowngraded =
      importance === "hero" &&
      priorHero !== undefined &&
      candidate.start - priorHero.sourceStart < policy.minimumHeroGapSeconds;
    if (heroDowngraded) importance = "support";
    const previousCandidate = ordered[index - 1];
    const boundaryActions: VisualDirectionDecision["boundaryActions"] = [
      candidate.endCue > candidate.startCue ? "merge-captions" : "single-caption",
    ];
    if (previousCandidate && previousCandidate.endCue + 1 === candidate.startCue)
      boundaryActions.push("split-adjacent-claim");

    const decision: VisualDirectionDecision = {
      candidateId: candidate.id,
      semanticIndex: candidate.semanticIndex,
      startCue: candidate.startCue,
      endCue: candidate.endCue,
      sourceStart: candidate.start,
      sourceEnd: candidate.end,
      displayStart: candidate.overlayCue?.start ?? null,
      displayEnd: candidate.overlayCue?.end ?? null,
      action: importance === "none" ? "skip" : "show",
      importance,
      rhetoric: candidate.rhetoric,
      componentId: candidate.overlayCue?.generatedVisual.component.id ?? null,
      chapterId: chapterIdFor(chapters, candidate.id),
      boundaryActions,
      adjustments: [],
      reasons: [
        candidate.reason,
        ...(heroDowngraded ? ["Downgraded to support to preserve hero-level spacing."] : []),
      ].filter(Boolean),
      ...(candidate.creatorConstraint ? { creatorConstraint: candidate.creatorConstraint } : {}),
    };

    if (candidate.materializationStatus !== "planned") {
      skip(decision, candidate.materializationReason ?? "Candidate failed deterministic materialization.");
      decisions.push(decision);
      continue;
    }
    if (importance === "none") {
      skip(decision, "Confidence or semantic priority is below the visual-direction threshold.");
      decisions.push(decision);
      continue;
    }

    if (decision.displayStart !== null && decision.displayEnd !== null) {
      // A requested minimum coverage is a delivery contract. Keep an eligible,
      // evidence-bounded visual for its full semantic passage (up to the global
      // continuous limit) instead of applying the short accent/support styling
      // caps that are intended only for sparse editorial pacing.
      const tierMaximum = policy.minimumVisualCoverageRatio
        ? policy.maximumContinuousVisualSeconds
        : candidate.creatorConstraint
          ? policy.maximumContinuousVisualSeconds
          : importance === "hero"
            ? policy.maximumHeroSeconds
            : importance === "support"
              ? policy.maximumSupportSeconds
              : policy.maximumAccentSeconds;
      const shortened = Math.min(
        decision.displayEnd,
        decision.displayStart + Math.min(tierMaximum, policy.maximumContinuousVisualSeconds),
      );
      if (shortened < decision.displayEnd) {
        decision.displayEnd = shortened;
        decision.adjustments.push("shortened-to-tier-budget");
      }
    }
    if (
      candidate.creatorConstraint?.mode === "information" &&
      decision.displayStart !== null &&
      decision.displayEnd !== null &&
      decision.displayEnd - decision.displayStart < policy.minimumVisibleSeconds - TIMING_EPSILON_SECONDS
    ) {
      const nextConfirmedCandidate = ordered
        .slice(index + 1)
        .find((item) => item.creatorConstraint && (item.overlayCue || item.materializationStatus === "planned"));
      const nextStart = nextConfirmedCandidate?.overlayCue?.start ?? nextConfirmedCandidate?.start ?? durationSeconds;
      const safeEnd = Math.min(durationSeconds, nextStart - breathingGapSeconds);
      const extendedEnd = Math.min(decision.displayStart + policy.minimumVisibleSeconds, safeEnd);
      if (extendedEnd > decision.displayEnd) {
        decision.displayEnd = extendedEnd;
        decision.adjustments.push("extended-for-readability");
      }
      if (decision.displayEnd - decision.displayStart < policy.minimumVisibleSeconds - TIMING_EPSILON_SECONDS) {
        const previousConfirmedCandidate = ordered
          .slice(0, index)
          .reverse()
          .find((item) => item.creatorConstraint && (item.overlayCue || item.materializationStatus === "planned"));
        const previousEnd = previousConfirmedCandidate?.overlayCue?.end ?? previousConfirmedCandidate?.end ?? 0;
        const safeStart = Math.max(0, previousEnd + breathingGapSeconds);
        const extendedStart = Math.max(safeStart, decision.displayEnd - policy.minimumVisibleSeconds);
        if (extendedStart < decision.displayStart) {
          decision.displayStart = extendedStart;
          decision.adjustments.push("extended-backward-for-readability");
        }
      }
    }
    if (
      decision.displayStart === null ||
      decision.displayEnd === null ||
      decision.displayEnd - decision.displayStart < policy.minimumVisibleSeconds - TIMING_EPSILON_SECONDS
    ) {
      skip(decision, "Candidate is shorter than the minimum readable duration.");
      decisions.push(decision);
      continue;
    }

    const selected = decisions.filter((item) => item.action === "show");
    const previous = selected.at(-1);
    if (previous && decision.displayStart !== null && decision.displayEnd !== null && previous.displayEnd !== null) {
      const priorCandidate = ordered.find((item) => item.id === previous.candidateId);
      const duplicateContent =
        priorCandidate &&
        contentSignature(priorCandidate) !== "" &&
        contentSignature(priorCandidate) === contentSignature(candidate) &&
        decision.displayStart - previous.displayEnd < policy.repetitionWindowSeconds;
      if (duplicateContent && !decision.creatorConstraint) {
        skip(decision, `Duplicate visual content inside the ${policy.repetitionWindowSeconds}s pacing window.`);
        decisions.push(decision);
        continue;
      }

      const directConfirmedTransition =
        Boolean(previous.creatorConstraint && decision.creatorConstraint) &&
        decision.displayStart >= previous.displayEnd - TIMING_EPSILON_SECONDS;
      const requiredStart = previous.displayEnd + (directConfirmedTransition ? 0 : breathingGapSeconds);
      if (decision.displayStart < requiredStart) {
        if (decision.displayEnd - requiredStart >= policy.minimumVisibleSeconds) {
          decision.displayStart = requiredStart;
          decision.adjustments.push("delayed-for-breathing");
        } else if (decision.creatorConstraint && !previous.creatorConstraint) {
          skip(previous, "A creator-confirmed component has priority over this overlapping visual.");
        } else if (importance === "hero" && previous.importance !== "hero") {
          skip(previous, "A following hero visual has priority over this overlapping visual.");
        } else {
          skip(decision, "No readable duration remains after the required breathing gap.");
          decisions.push(decision);
          continue;
        }
      }
    }

    if (decision.displayStart !== null) {
      const currentStart = decision.displayStart;
      const window = decisions.filter(
        (item) => item.action === "show" && item.displayStart !== null && item.displayStart >= currentStart - 60,
      );
      if (window.length >= policy.maximumVisualsPerMinute) {
        if (importance === "hero" || decision.creatorConstraint) {
          const evictable = window
            .filter((item) => !item.creatorConstraint && item.importance !== "hero")
            .sort((a, b) => score(a) - score(b))[0];
          if (evictable) skip(evictable, "Evicted to preserve the per-minute budget for a hero visual.");
          else if (!decision.creatorConstraint)
            skip(decision, "Per-minute visual budget already contains only hero visuals.");
        } else {
          skip(decision, "Per-minute visual density budget is exhausted.");
        }
      }
    }
    decisions.push(decision);
  }

  const coverageBudget = durationSeconds * policy.maximumVisualCoverageRatio;
  const selectedSeconds = () =>
    decisions
      .filter((item) => item.action === "show")
      .reduce((total, item) => total + Math.max(0, (item.displayEnd ?? 0) - (item.displayStart ?? 0)), 0);
  while (selectedSeconds() > coverageBudget) {
    const selected = decisions
      .filter((item) => item.action === "show" && !item.creatorConstraint)
      .sort((left, right) => score(left) - score(right));
    const removable = selected[0];
    if (!removable) break;
    skip(removable, "Removed to satisfy the whole-video visual coverage budget.");
  }

  return { schemaVersion: "1.0", policy, durationSeconds, chapters, decisions };
};

export const summarizeVisualDirection = (plan: VisualDirectionPlan) => {
  const shown = plan.decisions.filter((decision) => decision.action === "show");
  const visualSeconds = shown.reduce(
    (total, decision) => total + Math.max(0, (decision.displayEnd ?? 0) - (decision.displayStart ?? 0)),
    0,
  );
  const countBy = (key: "importance" | "componentId" | "rhetoric") =>
    Object.fromEntries(
      [...new Set(shown.map((decision) => String(decision[key] ?? "none")))].map((value) => [
        value,
        shown.filter((decision) => String(decision[key] ?? "none") === value).length,
      ]),
    );
  return {
    schemaVersion: "1.0",
    status: "review",
    summary: {
      candidateCount: plan.decisions.length,
      selectedCount: shown.length,
      skippedCount: plan.decisions.length - shown.length,
      chapterCount: plan.chapters.length,
      visualSeconds: Number(visualSeconds.toFixed(3)),
      visualCoverageRatio: plan.durationSeconds > 0 ? Number((visualSeconds / plan.durationSeconds).toFixed(4)) : 0,
      visualsPerMinute: plan.durationSeconds > 0 ? Number(((shown.length * 60) / plan.durationSeconds).toFixed(3)) : 0,
    },
    importanceUsage: countBy("importance"),
    componentUsage: countBy("componentId"),
    rhetoricUsage: countBy("rhetoric"),
    decisions: plan.decisions,
  };
};

export const validateVisualDirectionPlan = (plan: VisualDirectionPlan) => {
  if (plan.schemaVersion !== "1.0") throw new Error("visual direction plan schemaVersion must be 1.0");
  const ids = new Set<string>();
  let previousStart = -1;
  let visualSeconds = 0;
  for (const decision of plan.decisions) {
    if (ids.has(decision.candidateId)) throw new Error(`duplicate visual direction candidate: ${decision.candidateId}`);
    ids.add(decision.candidateId);
    if (decision.sourceStart < previousStart) throw new Error("visual direction decisions must preserve source order");
    previousStart = decision.sourceStart;
    if (decision.action === "skip") {
      if (decision.displayStart !== null || decision.displayEnd !== null)
        throw new Error(`skipped decision ${decision.candidateId} must not retain display timing`);
      continue;
    }
    if (
      decision.importance === "none" ||
      decision.displayStart === null ||
      decision.displayEnd === null ||
      decision.displayEnd <= decision.displayStart
    )
      throw new Error(`shown decision ${decision.candidateId} has invalid importance or timing`);
    if (decision.displayEnd - decision.displayStart < plan.policy.minimumVisibleSeconds - TIMING_EPSILON_SECONDS)
      throw new Error(`shown decision ${decision.candidateId} is shorter than the minimum visible duration`);
    visualSeconds += decision.displayEnd - decision.displayStart;
  }
  if (visualSeconds > plan.durationSeconds * plan.policy.maximumVisualCoverageRatio + 0.001)
    throw new Error("visual direction plan exceeds the whole-video coverage budget");
  const chapterIds = new Set(plan.chapters.map((chapter) => chapter.id));
  if (plan.decisions.some((decision) => !chapterIds.has(decision.chapterId)))
    throw new Error("visual direction decision references an unknown chapter");
  let priorTitleEnd = -Infinity;
  for (const cue of plan.titleCues ?? []) {
    if (cue.end <= cue.start || cue.end - cue.start < 4.8) throw new Error(`title cue ${cue.id} has invalid timing`);
    if (cue.start - priorTitleEnd < TITLE_CONTINUITY_REPETITION_WINDOW_SECONDS)
      throw new Error("whole-video identity title repeats inside the pacing window");
    if (
      plan.decisions.some(
        (decision) =>
          decision.action === "show" &&
          decision.displayStart !== null &&
          decision.displayEnd !== null &&
          cue.start < decision.displayEnd &&
          cue.end > decision.displayStart,
      )
    )
      throw new Error(`title cue ${cue.id} overlaps a semantic component`);
    priorTitleEnd = cue.end;
  }
  return true;
};
