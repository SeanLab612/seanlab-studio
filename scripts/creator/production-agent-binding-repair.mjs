import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { resolveLockedVisualBeatTimeline } from "../../src/visual-production/timeline.ts";
import { projectDir, writeJsonAtomic } from "./project-store.mjs";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const normalizeSpokenText = (value) =>
  value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]/gu, "");

const bigrams = (value) => {
  const normalized = normalizeSpokenText(value);
  if (normalized.length < 2) return normalized ? [normalized] : [];
  return Array.from({ length: normalized.length - 1 }, (_, index) => normalized.slice(index, index + 2));
};

const diceSimilarity = (left, right) => {
  const leftBigrams = bigrams(left);
  const rightBigrams = bigrams(right);
  if (!leftBigrams.length || !rightBigrams.length) return 0;
  const available = new Map();
  for (const value of rightBigrams) available.set(value, (available.get(value) ?? 0) + 1);
  let intersection = 0;
  for (const value of leftBigrams) {
    const count = available.get(value) ?? 0;
    if (!count) continue;
    intersection += 1;
    available.set(value, count - 1);
  }
  return (2 * intersection) / (leftBigrams.length + rightBigrams.length);
};

export const bindingTargetId = (failure = {}) => {
  const text = [failure.message, failure.details?.logTail].filter(Boolean).join("\n");
  return /Confirmed visual beat anchor was not found in semantic captions:\s*([a-z0-9-]+)/i.exec(text)?.[1];
};

const patchedBeat = (beat, quote) => ({
  ...beat,
  exactSpokenQuote: quote,
  quoteOccurrence: 1,
  exactSpokenQuoteSha256: sha256(quote),
});

export const buildBindingCandidates = ({ plan, captions, targetId, limit = 6 }) => {
  const beatIndex = (plan.beats ?? []).findIndex((beat) => beat.id === targetId);
  if (beatIndex < 0) return [];
  const target = plan.beats[beatIndex];
  const targetLength = normalizeSpokenText(target.exactSpokenQuote).length;
  const candidates = [];
  for (let startCue = 0; startCue < captions.length; startCue += 1) {
    let quote = "";
    for (let endCue = startCue; endCue < Math.min(captions.length, startCue + 30); endCue += 1) {
      quote += captions[endCue].zh;
      const length = normalizeSpokenText(quote).length;
      if (length < Math.max(4, Math.floor(targetLength * 0.45))) continue;
      if (length > Math.ceil(targetLength * 1.35)) break;
      const similarity = diceSimilarity(target.exactSpokenQuote, quote);
      if (similarity < 0.58) continue;
      const nextPlan = structuredClone(plan);
      nextPlan.beats[beatIndex] = patchedBeat(nextPlan.beats[beatIndex], quote);
      try {
        resolveLockedVisualBeatTimeline({ plan: { beats: [nextPlan.beats[beatIndex]] }, captions });
      } catch {
        continue;
      }
      candidates.push({
        candidateId: `caption-${startCue}-${endCue}`,
        startCue,
        endCue,
        start: captions[startCue].start,
        end: captions[endCue].end,
        quote,
        similarity: Number(similarity.toFixed(4)),
      });
    }
  }
  return candidates
    .sort((left, right) => right.similarity - left.similarity || left.startCue - right.startCue)
    .filter((candidate, index, all) => all.findIndex((item) => item.quote === candidate.quote) === index)
    .slice(0, limit);
};

const repairPrompt = ({ targets, candidates, issue }) => ({
  system: [
    "You are the fixed production Agent repairing one stale spoken-text binding in SeanLab Studio.",
    "The creator has delegated this technical binding repair to you.",
    "Choose only one supplied target and only from the supplied, locally verified caption candidates; never invent or rewrite spoken text.",
    "Use rebind when one candidate clearly preserves the intended meaning and location despite ASR spelling or punctuation differences.",
    "Use speaker-fallback when no candidate is semantically reliable. This removes only the failed visual beat and keeps the speaker on screen.",
    "Do not alter narration, captions, media, approvals, delivery, Agent selection, or any other visual beat.",
    "Return concise Simplified Chinese that matches the JSON Schema.",
  ].join("\n"),
  user: [
    "请为这个失效的画面口播绑定选择最小安全修复。",
    JSON.stringify(
      {
        issue,
        targets: targets.map((target) => ({
          id: target.id,
          sectionId: target.sectionId,
          primaryVisualType: target.primaryVisualType,
          intendedSpokenQuote: target.exactSpokenQuote,
        })),
        candidates: candidates.map(({ candidateId, start, end, quote, similarity }) => ({
          candidateId,
          start,
          end,
          quote,
          similarity,
        })),
      },
      null,
      2,
    ),
    "targetId 必须是上述 targets 之一。rebind 时 candidateId 必须是上述候选之一；speaker-fallback 时 candidateId 必须为 null。如果是重叠冲突且没有候选，从对语义表达影响更小的一个节拍回退为人物画面。",
  ].join("\n\n"),
});

const applyAgentChoice = ({ plan, response, candidates, allowedTargetIds }) => {
  if (!allowedTargetIds.includes(response.targetId))
    throw new Error("Agent selected a binding target outside the issue");
  const beatIndex = (plan.beats ?? []).findIndex((beat) => beat.id === response.targetId);
  if (beatIndex < 0) throw new Error("Agent selected a missing binding target");
  const previous = plan.beats[beatIndex];
  const candidate = candidates.find((item) => item.candidateId === response.candidateId);
  if (response.action === "rebind") {
    if (!candidate) throw new Error("Agent selected an invalid binding candidate");
    plan.beats[beatIndex] = patchedBeat(previous, candidate.quote);
    return {
      targetId: response.targetId,
      action: response.action,
      previous,
      replacement: plan.beats[beatIndex],
      candidate,
    };
  }
  if (response.action !== "speaker-fallback" || response.candidateId !== null)
    throw new Error("Agent returned an invalid speaker fallback");
  plan.beats.splice(beatIndex, 1);
  return { targetId: response.targetId, action: response.action, previous, replacement: null, candidate: null };
};

export const repairProductionBinding = async ({ projectId, recovery, adapter }) => {
  const targetId = bindingTargetId(recovery.failure);
  if (!targetId) return { kind: "validated-binding-repair", success: false, reason: "unsupported-binding-failure" };
  const root = projectDir(projectId);
  const runtime = JSON.parse(await readFile(resolve(root, "video/workspace/runtime-config.json"), "utf8"));
  const planPath = resolve(runtime.authoredVisualPlanFile);
  const captionsPath = resolve(runtime.semanticCaptionSourceFile);
  const plan = JSON.parse(await readFile(planPath, "utf8"));
  const captions = JSON.parse(await readFile(captionsPath, "utf8"));
  const beatIndex = (plan.beats ?? []).findIndex((beat) => beat.id === targetId);
  if (beatIndex < 0) return { kind: "validated-binding-repair", success: false, reason: "target-not-found", targetId };
  const nextPlan = structuredClone(plan);
  const candidates = buildBindingCandidates({ plan: nextPlan, captions, targetId });
  const responses = [];
  const modifications = [];
  const firstResponse = await adapter.completeJson(
    repairPrompt({
      targets: [nextPlan.beats[beatIndex]],
      candidates,
      issue: { kind: "missing-anchor", targetId },
    }),
  );
  responses.push(firstResponse);
  modifications.push(
    applyAgentChoice({ plan: nextPlan, response: firstResponse, candidates, allowedTargetIds: [targetId] }),
  );
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      resolveLockedVisualBeatTimeline({ plan: nextPlan, captions });
      break;
    } catch (error) {
      const overlap = /Resolved visual beats ([a-z0-9-]+) and ([a-z0-9-]+) overlap/i.exec(error.message);
      if (!overlap) throw error;
      const allowedTargetIds = [overlap[1], overlap[2]];
      const targets = allowedTargetIds.map((id) => nextPlan.beats.find((beat) => beat.id === id)).filter(Boolean);
      if (targets.length !== 2) throw error;
      const response = await adapter.completeJson(
        repairPrompt({ targets, candidates: [], issue: { kind: "overlap", targetIds: allowedTargetIds } }),
      );
      responses.push(response);
      modifications.push(applyAgentChoice({ plan: nextPlan, response, candidates: [], allowedTargetIds }));
      if (attempt === 7) throw new Error("Binding repair exceeded the bounded conflict limit");
    }
  }
  await writeJsonAtomic(planPath, nextPlan);
  const createdAt = new Date().toISOString();
  const evidencePath = resolve(
    root,
    "review/production-agent-binding-repairs",
    `${createdAt.replaceAll(/[:.]/g, "-")}-${targetId}.json`,
  );
  await writeJsonAtomic(evidencePath, {
    schemaVersion: "1.0",
    kind: "production-agent-binding-repair",
    projectId,
    createdAt,
    targetId,
    responses,
    modifications,
    candidates,
  });
  return {
    kind: "validated-binding-repair",
    success: true,
    action: modifications[0].action,
    targetId,
    modifications: modifications.map(({ targetId: id, action }) => ({ targetId: id, action })),
    evidencePath,
  };
};
