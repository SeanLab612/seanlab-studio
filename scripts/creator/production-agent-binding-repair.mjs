import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { resolveAuthoredScenes } from "../../src/supplemental-media/alignment.ts";
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
  return (
    /Confirmed visual beat anchor was not found in semantic captions:\s*([a-z0-9-]+)/i.exec(text)?.[1] ??
    /Recording scene preflight failed:\s*(scene-[a-z0-9-]+):/i.exec(text)?.[1]
  );
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

const bigramRecall = (needle, candidate) => {
  const expected = bigrams(needle);
  const actual = new Map();
  for (const value of bigrams(candidate)) actual.set(value, (actual.get(value) ?? 0) + 1);
  if (!expected.length) return 0;
  let matched = 0;
  for (const value of expected) {
    const count = actual.get(value) ?? 0;
    if (!count) continue;
    matched += 1;
    actual.set(value, count - 1);
  }
  return matched / expected.length;
};

const patchedScene = (scene, quote) => ({
  ...scene,
  startAnchor: { text: quote },
  endAnchor: { text: quote },
});

export const buildSceneBindingCandidates = ({ plan, captions, assets, targetId, limit = 6 }) => {
  const sceneIndex = (plan.scenes ?? []).findIndex((scene) => scene.id === targetId);
  if (sceneIndex < 0) return [];
  const target = plan.scenes[sceneIndex];
  if (normalizeSpokenText(target.startAnchor.text) !== normalizeSpokenText(target.endAnchor.text)) return [];
  const intended = target.startAnchor.text;
  const targetLength = normalizeSpokenText(intended).length;
  const candidates = [];
  for (let startCue = 0; startCue < captions.length; startCue += 1) {
    let quote = "";
    for (let endCue = startCue; endCue < Math.min(captions.length, startCue + 8); endCue += 1) {
      quote += captions[endCue].zh;
      const length = normalizeSpokenText(quote).length;
      if (length < Math.max(4, Math.floor(targetLength * 0.7))) continue;
      if (length > Math.max(targetLength * 4, targetLength + 18)) break;
      const similarity = diceSimilarity(intended, quote);
      const targetCoverage = bigramRecall(intended, quote);
      if (similarity < 0.32 || targetCoverage < 0.7) continue;
      const nextPlan = structuredClone(plan);
      nextPlan.scenes[sceneIndex] = patchedScene(nextPlan.scenes[sceneIndex], quote);
      const resolved = resolveAuthoredScenes({ plan: nextPlan, captions, assets });
      if (resolved.status === "blocked" || !resolved.scenes.some((scene) => scene.id === targetId)) continue;
      candidates.push({
        candidateId: `caption-${startCue}-${endCue}`,
        startCue,
        endCue,
        start: captions[startCue].start,
        end: captions[endCue].end,
        quote,
        similarity: Number(similarity.toFixed(4)),
        targetCoverage: Number(targetCoverage.toFixed(4)),
      });
    }
  }
  return candidates
    .sort(
      (left, right) =>
        right.targetCoverage - left.targetCoverage ||
        right.similarity - left.similarity ||
        left.startCue - right.startCue,
    )
    .filter((candidate, index, all) => all.findIndex((item) => item.quote === candidate.quote) === index)
    .slice(0, limit);
};

const repairPrompt = ({ targets, candidates, issue }) => ({
  system: [
    "You are the fixed production Agent repairing one stale spoken-text binding in SeanLab Studio.",
    "The creator has delegated this technical binding repair to you.",
    "Choose only one supplied target and only from the supplied, locally verified caption candidates; never invent or rewrite spoken text.",
    "Use rebind when one candidate clearly preserves the intended meaning and location despite ASR spelling or punctuation differences.",
    "Use speaker-fallback only for a non-required visual beat when no candidate is semantically reliable. Required uploaded recordings must be rebound and may never be silently removed.",
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
          primaryVisualType: target.primaryVisualType ?? target.type,
          intendedSpokenQuote: target.exactSpokenQuote ?? target.startAnchor?.text,
          required: target.required ?? false,
        })),
        candidates: candidates.map(({ candidateId, start, end, quote, similarity, targetCoverage }) => ({
          candidateId,
          start,
          end,
          quote,
          similarity,
          ...(targetCoverage === undefined ? {} : { targetCoverage }),
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

const applySceneAgentChoice = ({ plan, response, candidates, targetId }) => {
  if (response.targetId !== targetId) throw new Error("Agent selected a recording scene outside the issue");
  const sceneIndex = (plan.scenes ?? []).findIndex((scene) => scene.id === targetId);
  if (sceneIndex < 0) throw new Error("Agent selected a missing recording scene");
  const previous = plan.scenes[sceneIndex];
  if (response.action !== "rebind") {
    if (previous.required) throw new Error("Required recording scenes cannot fall back to the speaker");
    throw new Error("Recording scene repair requires an exact caption rebind");
  }
  const candidate = candidates.find((item) => item.candidateId === response.candidateId);
  if (!candidate) throw new Error("Agent selected an invalid recording-scene binding candidate");
  plan.scenes[sceneIndex] = patchedScene(previous, candidate.quote);
  return {
    targetId,
    action: "rebind",
    previous,
    replacement: plan.scenes[sceneIndex],
    candidate,
  };
};

export const repairProductionBinding = async ({ projectId, recovery, adapter, projectRoot }) => {
  const targetId = bindingTargetId(recovery.failure);
  if (!targetId) return { kind: "validated-binding-repair", success: false, reason: "unsupported-binding-failure" };
  const root = projectRoot ?? projectDir(projectId);
  const runtime = JSON.parse(await readFile(resolve(root, "video/workspace/runtime-config.json"), "utf8"));
  const captionsPath = resolve(runtime.semanticCaptionSourceFile);
  const captions = JSON.parse(await readFile(captionsPath, "utf8"));
  const scenePlanPath = runtime.authoredScenePlanFile ? resolve(runtime.authoredScenePlanFile) : undefined;
  const scenePlan = scenePlanPath
    ? JSON.parse(await readFile(scenePlanPath, "utf8"))
    : { schemaVersion: "1.0", scenes: [] };
  const sceneIndex = (scenePlan.scenes ?? []).findIndex((scene) => scene.id === targetId);
  if (sceneIndex >= 0) {
    const supplemental = JSON.parse(await readFile(resolve(runtime.supplementalMediaManifestFile), "utf8"));
    const nextPlan = structuredClone(scenePlan);
    const candidates = buildSceneBindingCandidates({
      plan: nextPlan,
      captions,
      assets: supplemental.assets ?? [],
      targetId,
    });
    if (!candidates.length)
      return { kind: "validated-binding-repair", success: false, reason: "no-verified-scene-candidates", targetId };
    const response = await adapter.completeJson(
      repairPrompt({
        targets: [nextPlan.scenes[sceneIndex]],
        candidates,
        issue: { kind: "recording-scene-anchor", targetId },
      }),
    );
    const modification = applySceneAgentChoice({ plan: nextPlan, response, candidates, targetId });
    const resolved = resolveAuthoredScenes({ plan: nextPlan, captions, assets: supplemental.assets ?? [] });
    if (resolved.status === "blocked" || !resolved.scenes.some((scene) => scene.id === targetId))
      throw new Error("Recording-scene repair did not pass full timeline validation");
    await writeJsonAtomic(scenePlanPath, nextPlan);
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
      targetKind: "recording-scene",
      responses: [response],
      modifications: [modification],
      candidates,
      validation: resolved.summary,
    });
    return {
      kind: "validated-binding-repair",
      success: true,
      action: modification.action,
      targetId,
      targetKind: "recording-scene",
      modifications: [{ targetId, action: modification.action }],
      evidencePath,
    };
  }

  const planPath = resolve(runtime.authoredVisualPlanFile);
  const plan = JSON.parse(await readFile(planPath, "utf8"));
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
