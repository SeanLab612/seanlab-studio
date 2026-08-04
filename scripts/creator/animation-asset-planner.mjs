import { resolve } from "node:path";
import { recommendImageAssetOrIcon } from "../../src/visual-production/image-asset-matcher.ts";
import { createStructuredAgentJsonAdapter } from "../workflow/agent-json-adapter.mjs";
import { listPromotedImageAssets } from "./generated-assets.mjs";
import { projectDir, writeJsonAtomic } from "./project-store.mjs";

const schemaPath = resolve("schemas/animation-asset-plan.schema.json");
const targetIdFor = (sectionId, beatId, stageId) => `${sectionId}/${beatId ?? "section"}/${stageId}`;

export const animationAssetTargets = (storyboard) =>
  Object.entries(storyboard.sections).flatMap(([sectionId, review]) => {
    const entries = [
      ...(review.animationIntent ? [{ intent: review.animationIntent }] : []),
      ...(review.beats ?? [])
        .filter((beat) => beat.primaryVisualType === "animation" && beat.animationIntent)
        .map((beat) => ({ beatId: beat.id, intent: beat.animationIntent })),
    ];
    return entries.flatMap(({ beatId, intent }) =>
      intent.stages.map((stage) => ({
        targetId: targetIdFor(sectionId, beatId, stage.id),
        sectionId,
        beatId,
        stage,
        styleProfileId: intent.styleProfileId,
      })),
    );
  });

const compatibleAssets = (assets, styleProfileId) =>
  assets.filter((asset) => !asset.templateId || asset.templateId === styleProfileId);

const deterministicFixturePlan = (targets, assets) => ({
  schemaVersion: "1.0",
  bindings: targets.map((target) => {
    const decision = recommendImageAssetOrIcon(
      `${target.stage.label} ${target.stage.action} ${target.stage.spokenQuote}`,
      compatibleAssets(assets, target.styleProfileId),
    );
    return {
      targetId: target.targetId,
      imageAssetId: decision.kind === "image" ? decision.recommended.asset.id : null,
      reason: decision.reason,
    };
  }),
});

const validatePlan = ({ plan, targets, assets }) => {
  if (plan?.schemaVersion !== "1.0" || !Array.isArray(plan.bindings))
    throw new Error("Animation asset Agent returned an invalid plan");
  const targetById = new Map(targets.map((target) => [target.targetId, target]));
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  const bindings = new Map();
  for (const binding of plan.bindings) {
    const target = targetById.get(binding?.targetId);
    if (!target || bindings.has(binding.targetId))
      throw new Error(
        `Animation asset Agent returned an unknown or duplicate target: ${binding?.targetId ?? "missing"}`,
      );
    if (!binding.reason?.trim()) throw new Error(`Animation asset binding ${binding.targetId} requires a reason`);
    if (binding.imageAssetId !== null) {
      const asset = assetById.get(binding.imageAssetId);
      if (!asset) throw new Error(`Animation asset Agent invented an image asset id: ${binding.imageAssetId}`);
      if (asset.templateId && asset.templateId !== target.styleProfileId)
        throw new Error(`Animation asset ${asset.id} is incompatible with ${target.styleProfileId}`);
    }
    bindings.set(binding.targetId, binding);
  }
  if (bindings.size !== targets.length) throw new Error("Animation asset Agent must decide every animation stage");
  return bindings;
};

const applyBindings = ({ storyboard, targets, assets, bindings }) => {
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  for (const target of targets) {
    const binding = bindings.get(target.targetId);
    const candidates = compatibleAssets(assets, target.styleProfileId);
    const fallback = recommendImageAssetOrIcon(
      `${target.stage.label} ${target.stage.action} ${target.stage.spokenQuote}`,
      candidates,
    ).fallbackIconId;
    delete target.stage.imageAssetId;
    delete target.stage.imageAssetLabel;
    target.stage.iconId = fallback;
    if (!binding.imageAssetId) continue;
    const asset = assetById.get(binding.imageAssetId);
    target.stage.imageAssetId = asset.id;
    target.stage.imageAssetLabel = asset.subject ?? asset.displayName ?? asset.id;
  }
  return storyboard;
};

export const planAnimationAssets = async ({
  project,
  storyboard,
  adapterFactory = createStructuredAgentJsonAdapter,
}) => {
  const result = await createAnimationAssetPlan({ project, storyboard, adapterFactory });
  if (!result.report) return result.storyboard;
  await writeJsonAtomic(
    resolve(projectDir(project.project.id), "authoring/animation-asset-provider-report.json"),
    result.report,
  );
  return result.storyboard;
};

export const createAnimationAssetPlan = async ({
  project,
  storyboard,
  adapterFactory = createStructuredAgentJsonAdapter,
}) => {
  const targets = animationAssetTargets(storyboard);
  const assets = (await listPromotedImageAssets()).filter(
    (asset) => typeof asset.id === "string" && /^[a-z0-9][a-z0-9-]{1,61}$/.test(asset.id),
  );
  if (!targets.length) return { storyboard, report: null };
  let plan;
  let provider;
  if (!assets.length) {
    plan = deterministicFixturePlan(targets, assets);
    provider = { provider: "local-icon-fallback", reason: "no-promoted-image-assets" };
  } else if (project.agent.id === "fixture") {
    plan = deterministicFixturePlan(targets, assets);
    provider = { provider: "fixture" };
  } else {
    const adapter = adapterFactory({
      config: {
        provider: project.agent.id,
        model: project.agent.model,
        timeoutSeconds: 300,
        maxRetries: 1,
      },
      schemaPath,
    });
    try {
      plan = await adapter.completeJson({
        system:
          "You are SeanLab's visual planning Agent. Select reusable image assets only as ingredients inside already-directed animations.",
        user: `为每个动画阶段选择图片素材，严格输出 JSON。

规则：
- 动画结构和风格已经确定，不得改成独立图片画面、组件或其他视觉类型。
- 只可使用 inventory 中真实存在且 templateId 与动画 styleProfileId 相同的图片；templateId 为空表示通用素材。
- 图片必须与阶段中的具体对象或概念直接对应。牵强、只匹配抽象词或没有合适图片时，imageAssetId 必须为 null，交给本地图标兜底。
- 每个 targetId 必须且只能返回一次。不得输出路径、URL 或虚构 id。

动画阶段：
${JSON.stringify(
  targets.map(({ targetId, styleProfileId, stage }) => ({
    targetId,
    styleProfileId,
    label: stage.label,
    action: stage.action,
    spokenQuote: stage.spokenQuote,
  })),
  null,
  2,
)}

图片素材 inventory：
${JSON.stringify(
  assets.map(
    ({
      id,
      displayName,
      subject,
      description,
      templateId,
      keywords,
      tags,
      aliases,
      applicableScenes,
      excludedTerms,
    }) => ({
      id,
      displayName,
      subject,
      description,
      templateId,
      keywords,
      tags,
      aliases,
      applicableScenes,
      excludedTerms,
    }),
  ),
  null,
  2,
)}`,
      });
    } catch (error) {
      throw new Error(`动画图片素材规划失败：${error?.message ?? error}`, { cause: error });
    }
    provider = adapter.getLastRunMetadata();
  }
  const bindings = validatePlan({ plan, targets, assets });
  const output = applyBindings({ storyboard, targets, assets, bindings });
  return {
    storyboard: output,
    report: {
      schemaVersion: "1.0",
      agent: project.agent,
      provider,
      plan,
      createdAt: new Date().toISOString(),
    },
  };
};
