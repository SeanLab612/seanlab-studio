import type { IconId } from "../icons/registry.ts";
import { resolveMediaEntityReference } from "../media-assets/registry.ts";
import type { ResolvedTerminologyProfile } from "../terminology/types.ts";
import { generateVisualBriefFromDraft, type NarrationSegment } from "../visual-brief/generator.ts";
import type { GeneratedVisualBrief, VisualBriefAnalysis, VisualRhetoric } from "../visual-brief/types.ts";
import { validateMaterializedBriefContent } from "./content-validation.ts";
import { activeIndexTimelineFor, type SemanticTimingCaption } from "./evidence-timing.ts";
import { effectForRoughAnnotationIntent, resolveLocalRoughAnnotationPlan } from "./rough-annotation-routing.ts";
import type { LocalRoughAnnotationPlan, SemanticItem, SemanticNarrativeSegment } from "./types.ts";

export type SemanticMaterialization =
  | { status: "planned"; brief: GeneratedVisualBrief }
  | { status: "skipped"; reason: string };

export type ProbedImageEvidence = {
  id: string;
  anchorText?: string;
  publicSrc: string;
  description: string;
  sourceLabel: string;
  orientation: "landscape" | "portrait" | "square" | "long-portrait";
  fit: "contain" | "cover";
  focalPoint: { x: number; y: number };
};

export const withLocalRoughAnnotationPlan = (
  intent: SemanticNarrativeSegment,
  roughAnnotation: LocalRoughAnnotationPlan,
): SemanticNarrativeSegment => {
  const template = intent.items[0] ?? {
    label: "",
    detail: "",
    value: null,
    displayValue: "",
    unit: "",
    timeLabel: "",
    entityId: "",
    entityKind: "none" as const,
    x: null,
    y: null,
  };
  return {
    ...intent,
    rhetoric: "rough-annotation",
    motionIntent: "emphasize",
    visualPriority: intent.visualPriority === "skip" ? "normal" : intent.visualPriority,
    confidence: Math.max(0.72, intent.confidence),
    roughAnnotation,
    items: roughAnnotation.targets.map((label) => ({
      ...template,
      label,
      detail: intent.narrative.takeaway || label,
      value: null,
      displayValue: "",
      unit: "",
      timeLabel: "",
      entityId: "",
      entityKind: "none",
      x: null,
      y: null,
    })),
  };
};

const id = (prefix: string, index: number) => `${prefix}-${index + 1}`;
const numericItems = (items: SemanticItem[]) => items.filter((item) => Number.isFinite(item.value));
const hasQualitativeMatrix = (intent: SemanticNarrativeSegment) => {
  const { rows, columns, states } = intent.matrix;
  return (
    rows.length >= 2 &&
    rows.length <= 6 &&
    columns.length >= 2 &&
    columns.length <= 6 &&
    Array.isArray(states) &&
    states.length === rows.length &&
    states.every(
      (row) =>
        Array.isArray(row) &&
        row.length === columns.length &&
        row.every((state) => typeof state === "string" && state.trim().length > 0),
    )
  );
};
const hasNumericMatrix = (intent: SemanticNarrativeSegment) => {
  const { rows, columns, values } = intent.matrix;
  return (
    rows.length >= 2 &&
    rows.length <= 6 &&
    columns.length >= 2 &&
    columns.length <= 6 &&
    values.length === rows.length &&
    values.every((row) => row.length === columns.length && row.every(Number.isFinite))
  );
};
const iconAliases: Readonly<Record<string, IconId>> = {
  chatgpt: "brand.chatgpt",
  openai: "brand.openai",
  claude: "brand.claude",
  anthropic: "brand.anthropic",
  deepseek: "brand.deepseek",
  gemini: "brand.google-gemini",
  google: "brand.google-gemini",
  qwen: "brand.qwen",
  tongyi: "brand.qwen",
  通义: "brand.qwen",
  kimi: "brand.kimi",
  minimax: "brand.minimax",
  github: "brand.github",
};

const normalizeIdentityKey = (value: string) => value.toLocaleLowerCase().replace(/[^a-z0-9㐀-鿿]+/g, "");

const semanticIdentityAliases: Readonly<Record<string, string>> = {
  chatgpt: "chatgpt",
  claude: "claude-code",
  claudecode: "claude-code",
  deepseek: "deepseek",
  通义千问: "tongyi-qianwen",
  tongyiqianwen: "tongyi-qianwen",
};

const entityFields = (item: SemanticItem) => {
  const key = normalizeIdentityKey(item.entityId || item.label);
  const iconId = iconAliases[key] ?? Object.entries(iconAliases).find(([alias]) => key.includes(alias))?.[1];
  if (iconId) return { iconId };
  const resolved = resolveMediaEntityReference(item.entityId || item.label);
  return resolved ? { entityId: resolved.entityId, entityKind: resolved.kind } : {};
};

const incompleteTitle = /(?:的情|与|及|和|需要权|连接研究与大|the new)$/i;

const rhetoricEyebrows: Readonly<Record<SemanticNarrativeSegment["rhetoric"], string>> = {
  none: "KEY POINT",
  scenario: "SCENARIO",
  comparison: "COMPARISON",
  trend: "TREND",
  distribution: "DISTRIBUTION",
  "person-evidence": "PERSON EVIDENCE",
  "factor-sequence": "KEY FACTORS",
  "process-steps": "PROCESS",
  ranking: "RANKING",
  "key-stat": "KEY NUMBERS",
  "media-comparison": "SOURCE COMPARISON",
  "image-evidence": "IMAGE EVIDENCE",
  "causal-chain": "CAUSE & EFFECT",
  "quote-source": "SOURCE QUOTE",
  "historical-timeline": "TIMELINE",
  "decision-matrix": "DECISION MATRIX",
  "model-classification": "CLASSIFICATION",
  "core-positioning": "CORE IDEA",
  "capability-surface": "CAPABILITY MAP",
  tradeoff: "TRADEOFF",
  "rough-annotation": "KEY POINT",
};

const withDeterministicNarrativeFallbacks = (intent: SemanticNarrativeSegment): SemanticNarrativeSegment => {
  const eyebrow = intent.narrative.eyebrow.trim() || rhetoricEyebrows[intent.rhetoric];
  const title =
    intent.narrative.title.trim() ||
    intent.narrative.takeaway.trim() ||
    intent.items.find((item) => item.label.trim())?.label.trim() ||
    "核心内容";
  const takeaway = intent.narrative.takeaway.trim() || title;
  return {
    ...intent,
    items: intent.items.map((item) => ({
      ...item,
      label: item.label.trim(),
      detail: item.detail.trim() || item.label.trim(),
    })),
    narrative: {
      ...intent.narrative,
      eyebrow,
      title,
      subtitleZh: intent.narrative.subtitleZh.trim() || takeaway,
      subtitleEn: intent.narrative.subtitleEn.trim() || eyebrow,
      takeaway,
    },
  };
};

const compactDesignCopy = (value: string, maximum: number, fallback: string) => {
  const text = value.trim();
  if (text.length <= maximum) return text;
  const conditionalResult = text
    .split(/(?:时|以后|情况下)[，,]/)
    .at(-1)
    ?.trim();
  if (conditionalResult && conditionalResult.length <= maximum) return conditionalResult;
  const clauses = text
    .split(/[，,;；。]/)
    .map((clause) => clause.trim())
    .filter((clause) => clause.length > 0 && clause.length <= maximum);
  return clauses.sort((left, right) => right.length - left.length)[0] ?? fallback;
};

const compactMetric = (item: SemanticItem) => {
  if (item.displayValue) return item.displayValue;
  const clause =
    item.detail
      .split(/[，,；;。]/)
      .find((value) => value.trim())
      ?.trim() ?? item.detail;
  return clause.length <= 24 ? clause : item.label;
};

const completeTitleFor = (intent: SemanticNarrativeSegment) => {
  const title = intent.narrative.title.trim();
  if (title.length <= 18 && !incompleteTitle.test(title)) return title;
  switch (intent.rhetoric) {
    case "key-stat":
      return intent.items[0]?.timeLabel ? `${intent.items[0].timeLabel}年任务分布` : "关键任务分布";
    case "person-evidence":
      return intent.items[1]
        ? `${intent.items[0].label}与${intent.items[1].label}`
        : `${intent.items[0]?.label ?? "人物"}的关键证据`;
    case "quote-source":
      return `${intent.quote.sourceName || "来源"}的核心比喻`;
    case "media-comparison":
      return "三家媒体的互补视角";
    case "comparison":
      return "不同平台的能力取舍";
    case "model-classification":
      return "平台能力分工";
    default:
      return intent.narrative.takeaway.length <= 18 ? intent.narrative.takeaway : "核心判断与证据";
  }
};

export const normalizeRoutingIntent = (intent: SemanticNarrativeSegment, sourceText = ""): SemanticNarrativeSegment => {
  if (
    intent.rhetoric === "none" &&
    intent.motionIntent === "introduce" &&
    intent.items.length >= 2 &&
    /先显示/.test(sourceText)
  )
    return { ...intent, rhetoric: intent.items.length === 2 ? "comparison" : "factor-sequence" };
  const roughAnnotation = resolveLocalRoughAnnotationPlan(sourceText, intent);
  if (roughAnnotation) {
    return withLocalRoughAnnotationPlan(intent, roughAnnotation);
  }
  if (intent.rhetoric === "core-positioning" && intent.items.length === 2) return { ...intent, rhetoric: "comparison" };
  if (intent.rhetoric === "media-comparison" && intent.items.length === 2) return { ...intent, rhetoric: "comparison" };
  if (
    intent.rhetoric === "none" &&
    intent.items.length === 2 &&
    /(?:左右(?:两边)?(?:比较|对比)|两种方案.{0,12}区别)/.test(sourceText)
  )
    return { ...intent, rhetoric: "comparison" };
  if (
    intent.rhetoric === "none" &&
    intent.items.length >= 2 &&
    /(?:步骤.{0,16}(?:顺序|逐个|依次)|流程.{0,16}(?:顺序|逐个|依次))/.test(sourceText)
  )
    return { ...intent, rhetoric: intent.items.length >= 3 ? "process-steps" : "comparison" };
  if (intent.rhetoric === "none" && intent.items.length >= 3 && /(?:检查项|逐项检查|检查清单)/.test(sourceText))
    return { ...intent, rhetoric: "factor-sequence" };
  if (intent.rhetoric === "model-classification") {
    const expandedItems = intent.items.flatMap((item) => {
      const labels = item.label
        .split(/(?:与|、|&)/)
        .map((label) => label.trim())
        .filter(Boolean);
      if (labels.length < 2) return [item];
      return labels.map((label) => {
        const entityId = semanticIdentityAliases[normalizeIdentityKey(label)] ?? "";
        return { ...item, label, entityId, entityKind: entityId ? ("ai" as const) : item.entityKind };
      });
    });
    if (expandedItems.length > intent.items.length)
      return { ...intent, items: expandedItems, rhetoric: "model-classification" };
    const resolvedIdentityItems = intent.items.filter((item) =>
      resolveMediaEntityReference(item.entityId || item.label),
    );
    if (resolvedIdentityItems.length === 2) return { ...intent, rhetoric: "comparison", items: resolvedIdentityItems };
    if (intent.items.length === 2) return { ...intent, rhetoric: "comparison" };
  }
  if (intent.rhetoric === "key-stat") {
    const supported = numericItems(intent.items);
    if (supported.length >= 1 && supported.length <= 3 && supported.length < intent.items.length)
      return { ...intent, items: supported };
  }
  if (intent.rhetoric === "quote-source" && intent.quote.sourceName.trim())
    return {
      ...intent,
      narrative: { ...intent.narrative, title: `${intent.quote.sourceName.trim()} 原话` },
    };
  return intent;
};

const eligibilityFailure = (intent: SemanticNarrativeSegment): string | undefined => {
  const count = intent.items.length;
  const numeric = numericItems(intent.items).length;
  switch (intent.rhetoric) {
    case "none":
      return "No visual rhetoric was selected.";
    case "scenario":
      return count === 2 && intent.items.every((item) => item.detail)
        ? undefined
        : "Scenario requires two detailed outcomes.";
    case "comparison":
      return count === 2 ? undefined : "Comparison requires exactly two contrasted entities.";
    case "trend":
      return intent.timeSeries.length >= 2 && intent.timeSeries.every((series) => series.points.length >= 2)
        ? undefined
        : "Trend requires at least two series with two explicit time points each.";
    case "distribution":
      return count >= 2 && count <= 8 && numeric === count
        ? undefined
        : "Distribution requires 2-8 explicit numeric values.";
    case "person-evidence":
      return intent.mediaIntents.some((item) => item.kind === "person") && count >= 1
        ? undefined
        : "Person evidence requires a named person and at least one evidence item.";
    case "factor-sequence":
      return count >= 3 && count <= 5 ? undefined : "Factor sequence requires 3-5 supported factors.";
    case "process-steps":
      return count >= 3 && count <= 6 ? undefined : "Process requires 3-6 ordered steps.";
    case "ranking":
      return count >= 3 && count <= 8 && numeric === count ? undefined : "Ranking requires 3-8 values on one metric.";
    case "key-stat":
      return count >= 1 && count <= 3 && numeric === count ? undefined : "Key statistics require 1-3 explicit numbers.";
    case "media-comparison":
      return count >= 1 && count <= 3 && intent.items.every((item) => item.entityId && item.detail)
        ? undefined
        : "Media comparison requires 1-3 named sources with distinct evidence.";
    case "image-evidence":
      return intent.imageEvidence?.assetId ? undefined : "Image evidence requires one registered asset id.";
    case "causal-chain":
      return count >= 3 && count <= 5 ? undefined : "Causal chain requires 3-5 directional nodes.";
    case "quote-source":
      return intent.quote.text && intent.quote.sourceName ? undefined : "Quote requires exact text and a named source.";
    case "historical-timeline":
      return count >= 3 &&
        count <= 6 &&
        (intent.items.every((item) => item.timeLabel) ||
          intent.items.every((item) => item.label.trim() && item.startCue !== undefined && item.endCue !== undefined))
        ? undefined
        : "Timeline requires 3-6 dated milestones or 3-6 explicitly ordered progression stages.";
    case "decision-matrix":
      return count >= 2 &&
        count <= 8 &&
        intent.matrix.xLabel.trim() &&
        intent.matrix.yLabel.trim() &&
        (intent.items.every((item) => item.x !== null && item.y !== null) ||
          intent.items.every(
            (item) => ["low", "high"].includes(item.xBand ?? "") && ["low", "high"].includes(item.yBand ?? ""),
          ))
        ? undefined
        : "Decision matrix requires two named axes and explicit coordinates or high/low axis bands for every entity.";
    case "model-classification":
      return count >= 2 && count <= 6 && intent.items.every((item) => item.detail)
        ? undefined
        : "Classification requires 2-6 explained categories.";
    case "core-positioning":
      return "Core positioning requires a creator-confirmed layered-system animation; no approved information component is available.";
    case "capability-surface": {
      return hasNumericMatrix(intent) || hasQualitativeMatrix(intent)
        ? undefined
        : "Capability surface requires a complete 2-6 by 2-6 numeric or qualitative matrix.";
    }
    case "tradeoff":
      return count >= 2 &&
        count <= 3 &&
        (numeric === count ||
          intent.items.every(
            (item) =>
              ["up", "down", "stable"].includes(item.direction ?? "") &&
              (item.displayValue.trim().length > 0 || item.detail.trim().length > 0),
          ))
        ? undefined
        : "Tradeoff requires 2-3 explicit scale values or directional qualitative statements.";
    case "rough-annotation":
      return intent.roughAnnotation && count >= 1 && count <= 3
        ? undefined
        : "Rough annotation requires 1-3 locally derived evidence targets.";
  }
};

const analysisFor = (intent: SemanticNarrativeSegment): VisualBriefAnalysis => {
  const rhetoric = intent.rhetoric as VisualRhetoric;
  const base: VisualBriefAnalysis = {
    rhetoric,
    visualPriority: intent.visualPriority,
    motionIntent: intent.motionIntent,
    mediaIntents: intent.mediaIntents,
  };
  const count = intent.items.length;
  if (["comparison", "distribution", "ranking", "decision-matrix", "capability-surface"].includes(rhetoric))
    base.entityCount = rhetoric === "capability-surface" ? intent.matrix.rows.length : count;
  if (rhetoric === "scenario") base.branchCount = count;
  if (rhetoric === "factor-sequence") base.factorCount = count;
  if (rhetoric === "process-steps") base.stepCount = count;
  if (rhetoric === "ranking") base.sharedMetric = true;
  if (rhetoric === "key-stat") base.statCount = count;
  if (rhetoric === "media-comparison") base.mediaCount = count;
  if (["causal-chain", "core-positioning"].includes(rhetoric)) base.nodeCount = count;
  if (rhetoric === "historical-timeline") base.milestoneCount = count;
  if (rhetoric === "model-classification") base.categoryCount = count;
  if (rhetoric === "capability-surface") base.dimensionCount = intent.matrix.columns.length;
  if (rhetoric === "tradeoff") base.dimensionCount = count;
  if (rhetoric === "rough-annotation") base.entityCount = count;
  if (rhetoric === "trend") {
    base.hasTimeSeries = true;
    base.entityCount = intent.timeSeries.length;
  }
  return base;
};

const propsFor = (
  intent: SemanticNarrativeSegment,
  imageEvidenceInventory: readonly ProbedImageEvidence[] = [],
  timing?: { captions: readonly SemanticTimingCaption[]; originSeconds: number },
): Record<string, unknown> => {
  const takeaway = intent.narrative.takeaway || undefined;
  const activeIndexTimeline = timing
    ? activeIndexTimelineFor(intent, timing.captions, timing.originSeconds)
    : undefined;
  switch (intent.rhetoric) {
    case "scenario":
      return {
        kicker: intent.narrative.eyebrow,
        question: intent.narrative.title,
        branches: intent.items.map((item) => ({
          label: item.label,
          detail: compactDesignCopy(item.detail, 36, item.label),
        })),
        activeBranch: null,
      };
    case "comparison":
      return {
        items: intent.items.map((item, index) => ({
          id: id("comparison", index),
          label: item.label,
          metric: item.unit || compactMetric(item) || "对比",
          detail: item.detail || undefined,
          ...entityFields(item),
        })),
        relation: "VS",
        activeIndex: 0,
        activeIndexTimeline,
        takeaway,
      };
    case "trend":
      return {
        series: intent.timeSeries.map((series) => ({
          name: series.name,
          valueLabel: `${series.points.at(-1)?.timeLabel ?? "末值"}：${series.points.at(-1)?.value ?? ""}项`,
          points: series.points.map((point) => point.value),
        })),
        timeLabels: intent.timeSeries[0]?.points.map((point) => point.timeLabel) ?? [],
        groupLabel: intent.narrative.eyebrow,
        totalValue: "",
        totalCaption: "",
        takeaway,
      };
    case "distribution":
      return {
        bars: intent.items.map((item, index) => ({
          label: item.label,
          value: item.value,
          displayValue: item.displayValue || `${item.value}${item.unit}`,
          emphasized: index === intent.items.length - 1,
        })),
        annotation: takeaway ?? "",
        populationRow: null,
      };
    case "person-evidence": {
      const person = intent.items[0];
      return {
        name: person.label,
        role: person.detail,
        quote: intent.quote.text || takeaway,
        evidence: intent.items.slice(1, 3).map((item, index) => ({
          eyebrow: item.timeLabel || `EVIDENCE ${index + 1}`,
          title: item.label,
          meta: item.detail,
        })),
      };
    }
    case "factor-sequence":
      return {
        items: intent.items.map((item, index) => ({ id: id("factor", index), title: item.label, detail: item.detail })),
        activeIndex: 0,
        activeIndexTimeline,
        summary: takeaway,
      };
    case "process-steps":
      return {
        items: intent.items.map((item, index) => ({ id: id("step", index), title: item.label, detail: item.detail })),
        activeIndex: 0,
        activeIndexTimeline,
        takeaway,
      };
    case "ranking":
      return {
        items: intent.items.map((item, index) => ({
          id: id("rank", index),
          label: item.label,
          value: item.value,
          displayValue: item.displayValue || `${item.value}${item.unit}`,
          ...entityFields(item),
        })),
        mode: "number",
        metricLabel: intent.items[0]?.unit || undefined,
        takeaway,
      };
    case "key-stat":
      return {
        items: intent.items.map((item, index) => ({
          id: id("stat", index),
          value: item.displayValue || `${item.value}${item.unit}`,
          numericValue: item.value,
          label: item.label,
          detail: item.detail || undefined,
        })),
        conclusion: takeaway,
      };
    case "media-comparison":
      return {
        items: intent.items.map((item, index) => ({
          id: id("media", index),
          label: item.label,
          source: item.label,
          caption: compactDesignCopy(item.detail, 36, item.label),
          ...entityFields(item),
        })),
        relation: "VS",
        takeaway,
      };
    case "image-evidence": {
      const requested = intent.imageEvidence;
      const asset = imageEvidenceInventory.find((item) => item.id === requested?.assetId);
      if (!asset) throw new Error(`Unknown image evidence asset: ${requested?.assetId ?? "missing"}`);
      return {
        assetId: asset.id,
        imageSrc: asset.publicSrc,
        orientation: asset.orientation,
        fit: asset.fit,
        focalPoint: asset.focalPoint,
        caption: requested?.caption || asset.description,
        sourceLabel: asset.sourceLabel,
      };
    }
    case "causal-chain":
      return {
        nodes: intent.items.map((item, index) => ({ id: id("cause", index), label: item.label, detail: item.detail })),
        activeIndex: 0,
        activeIndexTimeline,
        takeaway,
      };
    case "quote-source":
      return {
        quote: intent.quote.text,
        sourceName: intent.quote.sourceName,
        sourceRole: intent.quote.sourceRole || undefined,
      };
    case "historical-timeline":
      return {
        mode: intent.items.every((item) => item.timeLabel) ? "historical" : "progression",
        items: intent.items.map((item, index) => ({
          id: id("milestone", index),
          marker: item.timeLabel || String(index + 1).padStart(2, "0"),
          title: item.label,
          detail: item.detail,
        })),
        activeIndex: 0,
        activeIndexTimeline,
        takeaway,
      };
    case "decision-matrix":
      return {
        mode: intent.items.every((item) => item.x !== null && item.y !== null) ? "numeric" : "qualitative",
        points: intent.items.map((item, index) => ({
          id: id("point", index),
          label: item.label,
          x: item.x,
          y: item.y,
          xBand: item.xBand,
          yBand: item.yBand,
        })),
        xLabel: intent.matrix.xLabel,
        yLabel: intent.matrix.yLabel,
      };
    case "model-classification":
      return {
        items: intent.items.map((item, index) => ({
          id: id("class", index),
          title: item.label,
          detail: item.detail,
          ...entityFields(item),
        })),
        headline: takeaway,
      };
    case "core-positioning":
      return {
        centerLabel: intent.narrative.title,
        nodes: intent.items.map((item, index) => ({ id: id("node", index), label: item.label, detail: item.detail })),
      };
    case "capability-surface":
      return {
        mode: hasNumericMatrix(intent) ? "numeric" : "qualitative",
        rows: intent.matrix.rows,
        columns: intent.matrix.columns,
        values: intent.matrix.values.map((row) => row.map((value) => value / 100)),
        states: intent.matrix.states,
        legend: takeaway,
      };
    case "tradeoff":
      return {
        mode: numericItems(intent.items).length === intent.items.length ? "numeric" : "directional",
        items: intent.items.map((item, index) => ({
          id: id("tradeoff", index),
          label: item.label,
          value: item.value,
          valueLabel: item.displayValue || item.detail,
          direction: item.direction,
          note: item.detail,
        })),
      };
    case "rough-annotation": {
      if (!intent.roughAnnotation) throw new Error("Missing locally derived rough annotation plan.");
      const annotations =
        intent.roughAnnotation.annotations ??
        intent.roughAnnotation.targets.map((target) => ({
          target,
          intent: intent.roughAnnotation?.intent ?? "light-emphasis",
        }));
      return {
        headline: intent.narrative.eyebrow || undefined,
        layout: annotations.length > 1 ? "stack" : "row",
        items: annotations.map(({ target: text, intent: annotationIntent }, index) => ({
          id: id("annotation", index),
          text,
          effect: effectForRoughAnnotationIntent(annotationIntent),
        })),
        activeIndex: 0,
        activeIndexTimeline,
      };
    }
    case "none":
      return {};
  }
};

export const boundSemanticIntentItems = (
  intent: SemanticNarrativeSegment,
  startCue: number,
  endCue: number,
): SemanticNarrativeSegment => ({
  ...intent,
  startCue,
  endCue,
  items: intent.items.filter(
    (item) =>
      typeof item.startCue === "number" &&
      typeof item.endCue === "number" &&
      item.startCue <= endCue &&
      item.endCue >= startCue,
  ),
});

const comparisonLabel = (clause: string, fallback: string) => {
  const compact = clause
    .replace(/[。！？!?]+$/g, "")
    .replace(/^(?:它|这个结果|一个|一种|一份)/, "")
    .trim();
  const nounTail = compact.includes("的") ? compact.slice(compact.lastIndexOf("的") + 1) : compact;
  const subject = nounTail.split(/(?:已经|仍然|可以|能够|会|为|是)/)[0]?.trim() || nounTail;
  return compactDesignCopy(subject, 10, fallback);
};

export const withConfirmedComparisonItems = (
  intent: SemanticNarrativeSegment,
  sourceText: string,
  startCue: number,
  endCue: number,
): SemanticNarrativeSegment => {
  if (intent.items.length === 2) return intent;
  const normalized = sourceText.replace(/\s+/g, "").trim();
  const clauses =
    normalized.match(/不是只有([^，,。]+)[，,]([^。]+)/)?.slice(1, 3) ??
    normalized.match(/不是([^，,。]+)[，,]而是([^。]+)/)?.slice(1, 3) ??
    normalized.match(/([^，,。]+)[，,](?:但|而)([^。]+)/)?.slice(1, 3) ??
    normalized.match(/([^，,。]+)[，,]还是([^。？?]+)/)?.slice(1, 3);
  if (clauses?.length !== 2) return intent;
  const template = intent.items[0] ?? {
    label: "",
    detail: "",
    value: null,
    displayValue: "",
    unit: "",
    timeLabel: "",
    entityId: "",
    entityKind: "none" as const,
    x: null,
    y: null,
  };
  return {
    ...intent,
    items: clauses.map((clause, index) => ({
      ...template,
      label: comparisonLabel(clause, index === 0 ? "前者" : "后者"),
      detail: compactDesignCopy(clause, 30, index === 0 ? "前者" : "后者"),
      value: null,
      displayValue: "",
      unit: "",
      timeLabel: "",
      entityId: "",
      entityKind: "none",
      x: null,
      y: null,
      startCue,
      endCue,
    })),
  };
};

export const materializeSemanticIntent = (
  segment: NarrationSegment,
  sourceIntent: SemanticNarrativeSegment,
  terminologyProfile?: ResolvedTerminologyProfile,
  imageEvidenceInventory: readonly ProbedImageEvidence[] = [],
  timing?: {
    captions: readonly SemanticTimingCaption[];
    originSeconds: number;
    preserveExplicitRhetoric?: boolean;
  },
): SemanticMaterialization => {
  const intent = withDeterministicNarrativeFallbacks(
    timing?.preserveExplicitRhetoric ? sourceIntent : normalizeRoutingIntent(sourceIntent, segment.text),
  );
  if (intent.visualPriority === "skip")
    return { status: "skipped", reason: intent.reason || "Provider skipped visual." };
  if (intent.confidence < 0.65)
    return { status: "skipped", reason: `Semantic confidence ${intent.confidence} is below 0.65.` };
  const failure = eligibilityFailure(intent);
  if (failure) return { status: "skipped", reason: failure };
  const { takeaway, ...narrative } = intent.narrative;
  narrative.title = completeTitleFor(intent);
  const brief = generateVisualBriefFromDraft(
    segment,
    {
      analysis: analysisFor(intent),
      narrative: { ...narrative, takeaway: takeaway || undefined },
      props: propsFor(intent, imageEvidenceInventory, timing),
    },
    "production",
    terminologyProfile,
  );
  validateMaterializedBriefContent(brief);
  return { status: "planned", brief };
};
