import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { resolveLockedVisualBeatTimeline } from "../../src/visual-production/timeline.ts";
import { projectDir, writeJsonAtomic } from "./project-store.mjs";

export const visualContractTargetId = (failure = {}) => {
  const text = [failure.message, failure.details?.logTail].filter(Boolean).join("\n");
  return (
    /Confirmed component beat [a-z0-9-]+:([a-z0-9-]+) could not be materialized/i.exec(text)?.[1] ??
    /Confirmed component beat ([a-z0-9-]+) has no overlapping semantic evidence/i.exec(text)?.[1]
  );
};

export const repairProductionVisualContract = async ({ projectId, recovery }) => {
  const targetId = visualContractTargetId(recovery.failure);
  if (!targetId)
    return { kind: "validated-visual-contract-repair", success: false, reason: "unsupported-visual-contract-failure" };
  const root = projectDir(projectId);
  const runtime = JSON.parse(await readFile(resolve(root, "video/workspace/runtime-config.json"), "utf8"));
  const planPath = resolve(runtime.authoredVisualPlanFile);
  const captions = JSON.parse(await readFile(resolve(runtime.semanticCaptionSourceFile), "utf8"));
  const plan = JSON.parse(await readFile(planPath, "utf8"));
  const beatIndex = (plan.beats ?? []).findIndex((beat) => beat.id === targetId);
  if (beatIndex < 0)
    return { kind: "validated-visual-contract-repair", success: false, reason: "target-not-found", targetId };
  const previous = plan.beats[beatIndex];
  if (previous.primaryVisualType !== "component")
    return { kind: "validated-visual-contract-repair", success: false, reason: "target-is-not-component", targetId };
  const nextPlan = structuredClone(plan);
  nextPlan.beats.splice(beatIndex, 1);
  resolveLockedVisualBeatTimeline({ plan: nextPlan, captions });
  await writeJsonAtomic(planPath, nextPlan);
  const createdAt = new Date().toISOString();
  const evidencePath = resolve(
    root,
    "review/production-agent-visual-contract-repairs",
    `${createdAt.replaceAll(/[:.]/g, "-")}-${targetId}.json`,
  );
  await writeJsonAtomic(evidencePath, {
    schemaVersion: "1.0",
    kind: "production-agent-visual-contract-repair",
    projectId,
    createdAt,
    targetId,
    action: "speaker-fallback",
    reason: recovery.failure.message,
    previous,
  });
  return {
    kind: "validated-visual-contract-repair",
    success: true,
    action: "speaker-fallback",
    targetId,
    evidencePath,
  };
};
