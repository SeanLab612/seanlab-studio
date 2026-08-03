import { resolveFunctionalIconId } from "../icons/resolve-functional-icon.ts";
import { animationPrototypeRegistry } from "./animation-registry.ts";
import type { AnimationIntent, AnimationPrototypeId, AnimationStyleProfileId, PrimaryVisualType } from "./types.ts";

type VisualOpportunity = { form?: string; evidenceText?: string };
type NarrationSection = {
  id?: string;
  title?: string;
  narration?: string;
  visualIntent?: string;
  materialIds?: string[];
  visualOpportunities?: VisualOpportunity[];
};

const animationFormPrototype: Partial<Record<string, AnimationPrototypeId>> = {
  "ordered-progression": "process-flow",
  "progressive-explanation": "process-flow",
  "cause-to-result": "causal-chain",
  "change-over-time": "state-transition",
  "dated-milestones": "state-transition",
  "core-and-supports": "layered-system",
  "category-map": "layered-system",
};

const researchPrototypeFor = (text: string): AnimationPrototypeId | undefined => {
  const evidence = text.trim();
  if (
    /(?:目标|标准|阈值|预期|基准|及格线)/.test(evidence) &&
    /(?:实际|最终|达到|超过|低于|差距|落在|结果|\d)/.test(evidence)
  )
    return "threshold-landing";
  if (/(?:整体|全局|全貌|表面上|宏观)/.test(evidence) && /(?:关键|细节|局部|深入|具体|真正重要|重点)/.test(evidence))
    return "focus-zoom";
  if (
    /(?:多个|多条|几条|各自|分别|不同来源|多个方面)/.test(evidence) &&
    /(?:共同|汇聚|汇成|最终|结论|推动|指向|形成)/.test(evidence)
  )
    return "converge-diffuse";
  if (
    /(?:组成|构成|组合|融合|整合|拼成|拆解|拆成|分解|分成)/.test(evidence) &&
    /(?:整体|完整|部分|模块|要素|环节|内容)/.test(evidence)
  )
    return "aggregate-decompose";
  return undefined;
};

const cleanStage = (value: string) =>
  value
    .trim()
    .replace(/^[：:，,。；;、\s]+|[：:，,。；;、\s]+$/g, "")
    .replace(/^(?:然后|接着|再|最后|并且|以及|同时|会|要|让|把)/, "")
    .trim();

const stageFragments = (text: string) => {
  const afterColon = text.includes("：") ? text.slice(text.indexOf("：") + 1) : text;
  const list = afterColon
    .split(/(?:、|，|；|。|\n|最后)/)
    .map(cleanStage)
    .filter((item) => [...item].length >= 2 && [...item].length <= 28);
  if (list.length >= 2) return list.slice(0, 6);
  return text
    .split(/[，；。！？\n]/)
    .map(cleanStage)
    .filter((item) => [...item].length >= 2 && [...item].length <= 32)
    .slice(0, 6);
};

const actionFor = (prototypeId: AnimationPrototypeId, index: number, count: number) => {
  if (prototypeId === "evidence-gate")
    return index === count - 1 ? "审核后放行" : index === 0 ? "送达门前" : "核验条件";
  if (prototypeId === "causal-chain") return index === 0 ? "起因" : index === count - 1 ? "形成结果" : "继续传导";
  if (prototypeId === "state-transition")
    return index === 0 ? "进入初态" : index === count - 1 ? "到达新状态" : "发生变化";
  if (prototypeId === "layered-system") return index === 0 ? "建立底层" : "叠加职责";
  if (prototypeId === "aggregate-decompose")
    return index === count - 1 ? "汇入整体" : index === 0 ? "放入要素" : "继续聚合";
  if (prototypeId === "focus-zoom")
    return index === 0 ? "观察全局" : index === 1 ? "聚焦细节" : index === count - 1 ? "返回整体" : "补充观察";
  if (prototypeId === "threshold-landing")
    return index === 0 ? "设定标准" : index === count - 1 ? "确认落点" : "对照结果";
  if (prototypeId === "converge-diffuse")
    return index === count - 1 ? "汇成结论" : index === 0 ? "引入线索" : "继续汇流";
  return index === 0 ? "写入起点" : index === count - 1 ? "到达终点" : "向前推进";
};

const mechanicalLanguage =
  /(?:流程|工作流|步骤|阶段|处理|生成|制作|渲染|交付|输入|输出|上传|下载|系统|模块|数据|审核|检查|验证|门槛|放行|链路|管线|自动化)/;

export const recommendAnimationStyleProfile = (
  prototypeId: AnimationPrototypeId,
  section: NarrationSection,
): AnimationStyleProfileId => {
  const registration = animationPrototypeRegistry[prototypeId];
  const evidence = `${section.title ?? ""} ${section.narration ?? ""} ${(section.visualOpportunities ?? [])
    .map((item) => item.evidenceText ?? "")
    .join(" ")}`;
  if (
    registration.compatibleStyleIds.includes("stop-motion-machine") &&
    mechanicalLanguage.test(evidence) &&
    ["process-flow", "evidence-gate", "causal-chain", "layered-system"].includes(prototypeId)
  )
    return "stop-motion-machine";
  return registration.defaultStyleId;
};

export const recommendAnimationIntent = (
  section: NarrationSection,
  overrides: Partial<Pick<AnimationIntent, "prototypeId" | "styleProfileId">> = {},
): AnimationIntent | undefined => {
  const opportunities = section.visualOpportunities ?? [];
  const opportunity = opportunities.find(
    (item) => researchPrototypeFor(item.evidenceText ?? "") || animationFormPrototype[item.form ?? ""],
  );
  const narration = section.narration?.trim() ?? "";
  if (!opportunity || !narration) return undefined;
  const evidence = opportunity.evidenceText?.trim() || narration;
  let prototypeId =
    overrides.prototypeId ?? researchPrototypeFor(evidence) ?? animationFormPrototype[opportunity.form ?? ""];
  if (!prototypeId) return undefined;
  if (
    !overrides.prototypeId &&
    /(?:必须|只有|通过以后|审核|放行)/.test(evidence) &&
    /(?:通过|进入|才能|才会)/.test(evidence)
  )
    prototypeId = "evidence-gate";
  const fragments = stageFragments(evidence).filter((item) => narration.includes(item));
  const prototype = animationPrototypeRegistry[prototypeId];
  const boundedFragments = fragments.slice(0, prototype.maximumStages);
  if (boundedFragments.length < prototype.minimumStages) return undefined;
  return {
    prototypeId,
    styleProfileId: overrides.styleProfileId ?? recommendAnimationStyleProfile(prototypeId, section),
    takeaway: section.title?.trim() || evidence.slice(0, 36),
    stages: boundedFragments.map((spokenQuote, index) => ({
      id: `stage-${index + 1}`,
      spokenQuote,
      action: actionFor(prototypeId, index, boundedFragments.length),
      label: [...spokenQuote].slice(0, 12).join(""),
      iconId: resolveFunctionalIconId(undefined, spokenQuote),
    })),
  };
};

export const recommendPrimaryVisualType = (section: NarrationSection): PrimaryVisualType => {
  if (section.visualIntent === "screen-recording") return "screen-demo";
  if (recommendAnimationIntent(section)) return "animation";
  if (section.materialIds?.length || section.visualIntent === "screenshot") return "image";
  if (section.visualOpportunities?.some((item) => item.form)) return "component";
  return "speaker";
};
