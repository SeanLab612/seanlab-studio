export const VISUAL_BRIEF_SCHEMA_VERSION = "1.0" as const;

import type {
  GeneratedVisualBrief,
  GenerationMode,
  NarrationSegment,
  ApprovedVisualComponentId,
  VisualBriefAnalysis,
  VisualBriefDraft,
  VisualBriefModelAdapter,
  VisualBriefNarrative,
  VisualComponentId,
  VisualRhetoric,
} from "./types.ts";
import { selectMotionRecipe } from "../motion-recipes/selector.ts";
import type { MotionIntent } from "../motion-recipes/types.ts";
import { componentChartBindings } from "../charts/registry.ts";
import { validateChartIntent } from "../charts/selector.ts";
import {
  compressViewerTitle,
  correctTerminology,
  glossaryForPrompt,
  normalizeNumbersAndUnits,
  validateViewerCopy,
  type ResolvedTerminologyProfile,
} from "../terminology/index.ts";

export type {
  ApprovedVisualComponentId,
  GeneratedVisualBrief,
  GenerationMode,
  NarrationSegment,
  VisualBriefAnalysis,
  VisualBriefDraft,
  VisualBriefModelAdapter,
  VisualBriefNarrative,
  VisualComponentId,
  VisualRhetoric,
} from "./types.ts";

const rhetoricIds = new Set<VisualRhetoric>([
  "scenario",
  "comparison",
  "trend",
  "distribution",
  "person-evidence",
  "factor-sequence",
  "process",
  "process-steps",
  "ranking",
  "key-stat",
  "media-comparison",
  "image-evidence",
  "causal-chain",
  "quote-source",
  "historical-timeline",
  "decision-matrix",
  "model-classification",
  "core-positioning",
  "capability-surface",
  "tradeoff",
  "rough-annotation",
]);

const motionIntents = new Set<MotionIntent>(["introduce", "compare", "progress", "reorder", "transform", "emphasize"]);
const mediaKinds = new Set<import("../media-assets/types.ts").MediaEntityKind>([
  "person",
  "brand",
  "biotech",
  "government",
  "country",
  "ticker",
  "exchange",
  "research",
  "university",
  "media",
  "ai",
  "design",
]);

const defaultMotionIntent = (rhetoric: VisualRhetoric): MotionIntent => {
  if (
    ["process", "process-steps", "factor-sequence", "causal-chain", "historical-timeline", "trend"].includes(rhetoric)
  )
    return "progress";
  if (["comparison", "ranking", "distribution", "key-stat", "tradeoff", "capability-surface"].includes(rhetoric))
    return "compare";
  if (rhetoric === "rough-annotation") return "emphasize";
  return "introduce";
};

const asCount = (value: number | undefined) => (Number.isFinite(value) ? Math.max(0, Math.floor(value ?? 0)) : 0);

export const selectVisualComponent = (
  analysis: VisualBriefAnalysis,
  _mode: GenerationMode,
): { id: ApprovedVisualComponentId; reason: string } => {
  const entities = asCount(analysis.entityCount);
  const branches = asCount(analysis.branchCount);
  const sequenceItems = Math.max(asCount(analysis.factorCount), asCount(analysis.stepCount));
  const stats = asCount(analysis.statCount);
  const media = asCount(analysis.mediaCount);
  const nodes = asCount(analysis.nodeCount);
  const milestones = asCount(analysis.milestoneCount),
    dimensions = asCount(analysis.dimensionCount),
    categories = asCount(analysis.categoryCount);

  let decision: { id: ApprovedVisualComponentId; reason: string };

  if (analysis.rhetoric === "rough-annotation" && entities >= 1 && entities <= 3) {
    decision = {
      id: "rough-annotation",
      reason: "One to three short evidence-bound phrases carry explicit emphasis, negation, correction, or grouping.",
    };
  } else if (analysis.rhetoric === "historical-timeline" && milestones >= 3 && milestones <= 6) {
    decision = {
      id: "historical-timeline",
      reason: "Three to six explicit milestones describe historical evolution or ordered progression.",
    };
  } else if (analysis.rhetoric === "decision-matrix" && entities >= 2 && entities <= 8) {
    decision = { id: "decision-matrix", reason: "Entities are positioned using two explicit decision axes." };
  } else if (analysis.rhetoric === "model-classification" && categories >= 2 && categories <= 6) {
    decision = { id: "model-classification-map", reason: "Two to six named categories form a classification map." };
  } else if (analysis.rhetoric === "core-positioning" && nodes >= 2 && nodes <= 6) {
    throw new Error("No approved component currently covers core-positioning hub-and-spoke semantics.");
  } else if (
    analysis.rhetoric === "capability-surface" &&
    entities >= 2 &&
    entities <= 6 &&
    dimensions >= 2 &&
    dimensions <= 6
  ) {
    decision = {
      id: "capability-surface-grid",
      reason: "Multiple entities are compared across multiple capability dimensions.",
    };
  } else if (analysis.rhetoric === "tradeoff" && dimensions >= 2 && dimensions <= 3) {
    decision = { id: "tradeoff-scale", reason: "Two or three dimensions move in tension and require a tradeoff view." };
  } else if (analysis.rhetoric === "person-evidence") {
    decision = { id: "person-evidence-card", reason: "The narration is anchored to a named person and evidence." };
  } else if (analysis.rhetoric === "scenario" && branches >= 2) {
    decision = { id: "scenario-branches", reason: "The narration presents at least two conditional outcomes." };
  } else if (analysis.hasTimeSeries && entities >= 2) {
    decision = { id: "market-cap-lines", reason: "Multiple entities are measured across time." };
  } else if (
    entities >= 3 &&
    entities <= 8 &&
    analysis.sharedMetric &&
    (analysis.rhetoric === "ranking" || analysis.rhetoric === "comparison")
  ) {
    decision = { id: "ranked-metric-list", reason: "Three to eight entities share one comparable numeric metric." };
  } else if (analysis.rhetoric === "process-steps" && sequenceItems >= 3 && sequenceItems <= 6) {
    decision = {
      id: "process-steps",
      reason: "The narration describes three to six strictly ordered procedural steps.",
    };
  } else if (
    sequenceItems >= 3 &&
    sequenceItems <= 5 &&
    (analysis.rhetoric === "factor-sequence" || analysis.rhetoric === "process")
  ) {
    decision = { id: "factor-sequence", reason: "The narration contains three to five factors or ordered stages." };
  } else if (analysis.rhetoric === "comparison" && entities === 2) {
    decision = { id: "binary-versus", reason: "Exactly two options or viewpoints are contrasted." };
  } else if (analysis.rhetoric === "key-stat" && stats >= 1 && stats <= 3) {
    decision = { id: "key-stat-summary", reason: "One to three headline statistics carry the conclusion." };
  } else if (analysis.rhetoric === "image-evidence") {
    decision = {
      id: "image-evidence-inset",
      reason: "A registered project image directly supports this narration claim.",
    };
  } else if (analysis.rhetoric === "media-comparison" && media >= 1 && media <= 3) {
    decision = {
      id: "media-comparison",
      reason: "One to three interfaces, screenshots, or visual sources are compared.",
    };
  } else if (analysis.rhetoric === "causal-chain" && nodes >= 3 && nodes <= 5) {
    decision = {
      id: "causal-chain",
      reason: "Three to five linked nodes form one directional cause-and-effect chain.",
    };
  } else if (analysis.rhetoric === "quote-source") {
    decision = {
      id: "quote-source-card",
      reason: "An exact quote is anchored to a named person, institution, publication, or report.",
    };
  } else {
    decision = {
      id: "distribution-bars",
      reason: analysis.involvesPopulation
        ? "A point-in-time comparison includes a population-coverage claim."
        : "A point-in-time category comparison is the safest deterministic fallback.",
    };
  }

  return decision;
};

const assertObject: (value: unknown, label: string) => asserts value is Record<string, unknown> = (value, label) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
};

const assertString = (value: unknown, label: string) => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }
};

const forbiddenViewerTerms = [
  "mvp",
  "illustrative",
  "review frame",
  "review output",
  "component id",
  "layout template",
  "组件",
  "审核帧",
  "测试画面",
  "设计语言",
  "动效演示",
  "content-led visuals",
  "visual component",
  "semantic component",
  "motion component",
];

export const validateViewerFacingNarrative = (narrative: VisualBriefNarrative) => {
  const text = [
    narrative.eyebrow,
    narrative.title,
    narrative.subtitleZh,
    narrative.subtitleEn,
    narrative.takeaway ?? "",
  ]
    .join(" ")
    .toLowerCase();
  const forbidden = forbiddenViewerTerms.find((term) => text.includes(term));
  if (forbidden) throw new Error(`Viewer-facing narrative contains production terminology: ${forbidden}`);
};

const assertItems = (props: Record<string, unknown>, min: number, max: number, componentId: string) => {
  if (!Array.isArray(props.items) || props.items.length < min || props.items.length > max) {
    throw new Error(`${componentId} expects ${min}-${max} items.`);
  }
};

const textLength = (value: string) => [...value.trim()].length;
const assertTextCapacity = (value: unknown, maximum: number, label: string) => {
  if (value === undefined) return;
  assertString(value, label);
  if (textLength(value as string) > maximum) {
    throw new Error(`component-text-overflow: ${label} exceeds ${maximum} display characters.`);
  }
};
const compactText = (value: unknown, maximum: number) => {
  if (typeof value !== "string" || textLength(value) <= maximum) return value;
  const characters = [...value.trim()];
  const preferred = characters
    .slice(0, maximum - 1)
    .map((character, index) => (/[,，。；;、：:]/.test(character) ? index : -1))
    .filter((index) => index >= Math.floor(maximum * 0.6))
    .at(-1);
  return `${characters
    .slice(0, preferred === undefined ? maximum - 1 : preferred)
    .join("")
    .trim()}…`;
};

const componentTextLimits: Record<string, number> = {
  eyebrow: 18,
  label: 28,
  metric: 18,
  detail: 48,
  description: 48,
  title: 22,
  takeaway: 36,
  sourceName: 28,
};
const visitComponentText = (
  value: unknown,
  visitor: (container: Record<string, unknown>, key: string, maximum: number) => void,
) => {
  if (Array.isArray(value)) {
    value.forEach((item) => {
      visitComponentText(item, visitor);
    });
    return;
  }
  if (!value || typeof value !== "object") return;
  const object = value as Record<string, unknown>;
  for (const [key, child] of Object.entries(object)) {
    const maximum = componentTextLimits[key];
    if (maximum && typeof child === "string") visitor(object, key, maximum);
    else visitComponentText(child, visitor);
  }
};

export const compactComponentProps = (componentId: VisualComponentId, input: Record<string, unknown>) => {
  const props = structuredClone(input);
  visitComponentText(props, (container, key, maximum) => {
    container[key] = compactText(container[key], maximum);
  });
  if (componentId === "binary-versus" && Array.isArray(props.items)) {
    props.items = props.items.map((raw) => {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
      const item = raw as Record<string, unknown>;
      return {
        ...item,
        eyebrow: compactText(item.eyebrow, 16),
        label: compactText(item.label, 10),
        metric: compactText(item.metric, 14),
        detail: compactText(item.detail, 30),
      };
    });
    props.takeaway = compactText(props.takeaway, 36);
  }
  return props;
};

export const validateComponentProps = (componentId: VisualComponentId, props: Record<string, unknown>) => {
  visitComponentText(props, (container, key, maximum) => {
    assertTextCapacity(container[key], maximum, `${componentId}.${key}`);
  });
  switch (componentId) {
    case "binary-versus":
      assertItems(props, 2, 2, componentId);
      for (const [index, raw] of (props.items as unknown[]).entries()) {
        if (!raw || typeof raw !== "object" || Array.isArray(raw))
          throw new Error(`binary-versus.items[${index}] must be an object.`);
        const item = raw as Record<string, unknown>;
        assertTextCapacity(item.eyebrow, 16, `binary-versus.items[${index}].eyebrow`);
        assertTextCapacity(item.label, 10, `binary-versus.items[${index}].label`);
        assertTextCapacity(item.metric, 14, `binary-versus.items[${index}].metric`);
        assertTextCapacity(item.detail, 30, `binary-versus.items[${index}].detail`);
      }
      assertTextCapacity(props.takeaway, 36, "binary-versus.takeaway");
      break;
    case "key-stat-summary":
      assertItems(props, 1, 3, componentId);
      break;
    case "media-comparison":
      assertItems(props, 1, 3, componentId);
      break;
    case "image-evidence-inset":
      assertString(props.assetId, "image-evidence-inset.assetId");
      assertString(props.imageSrc, "image-evidence-inset.imageSrc");
      if ((props.fit ?? "contain") !== "contain" && props.fit !== "cover")
        throw new Error("image-evidence-inset.fit must be contain or cover.");
      if ("url" in props || String(props.imageSrc).startsWith("http"))
        throw new Error("image-evidence-inset accepts only locally materialized imageSrc values.");
      break;
    case "process-steps":
      assertItems(props, 3, 6, componentId);
      break;
    case "causal-chain":
      if (!Array.isArray(props.nodes) || props.nodes.length < 3 || props.nodes.length > 5) {
        throw new Error("causal-chain expects 3-5 nodes.");
      }
      break;
    case "quote-source-card":
      assertString(props.quote, "quote-source-card.quote");
      assertString(props.sourceName, "quote-source-card.sourceName");
      break;
    case "factor-sequence":
      assertItems(props, 3, 5, componentId);
      break;
    case "ranked-metric-list":
      assertItems(props, 3, 8, componentId);
      break;
    case "scenario-branches":
      if (!Array.isArray(props.branches) || props.branches.length < 2) {
        throw new Error("scenario-branches expects at least two branches.");
      }
      break;
    case "distribution-bars":
      if (!Array.isArray(props.bars) || props.bars.length < 1) {
        throw new Error("distribution-bars expects at least one bar.");
      }
      break;
    case "market-cap-lines":
      if (!Array.isArray(props.series) || props.series.length < 2) {
        throw new Error("market-cap-lines expects at least two series.");
      }
      break;
    case "person-evidence-card":
      assertString(props.name, "person-evidence-card.name");
      assertString(props.role, "person-evidence-card.role");
      break;
    case "historical-timeline":
      assertItems(props, 3, 6, componentId);
      break;
    case "decision-matrix":
      if (!Array.isArray(props.points) || props.points.length < 2 || props.points.length > 8)
        throw new Error("decision-matrix expects 2-8 points.");
      assertString(props.xLabel, "decision-matrix.xLabel");
      assertString(props.yLabel, "decision-matrix.yLabel");
      break;
    case "model-classification-map":
      assertItems(props, 2, 6, componentId);
      break;
    case "core-positioning-node":
      if (!Array.isArray(props.nodes) || props.nodes.length < 2 || props.nodes.length > 6)
        throw new Error("core-positioning-node expects 2-6 nodes.");
      assertString(props.centerLabel, "core-positioning-node.centerLabel");
      break;
    case "capability-surface-grid":
      if (
        !Array.isArray(props.rows) ||
        props.rows.length < 2 ||
        props.rows.length > 6 ||
        !Array.isArray(props.columns) ||
        props.columns.length < 2 ||
        props.columns.length > 6
      )
        throw new Error("capability-surface-grid expects 2-6 rows and columns.");
      break;
    case "tradeoff-scale":
      assertItems(props, 2, 3, componentId);
      break;
    case "rough-annotation":
      assertItems(props, 1, 3, componentId);
      for (const [index, raw] of (props.items as unknown[]).entries()) {
        if (!raw || typeof raw !== "object" || Array.isArray(raw))
          throw new Error(`rough-annotation.items[${index}] must be an object.`);
        const item = raw as Record<string, unknown>;
        assertString(item.text, `rough-annotation.items[${index}].text`);
        if (/\r|\n/.test(String(item.text)))
          throw new Error(
            `rough-annotation.items[${index}].text must remain single-line; multiline copy is unsupported.`,
          );
        assertTextCapacity(item.text, 14, `rough-annotation.items[${index}].text`);
        if (
          !["highlight", "underline", "circle", "box", "crossed-off", "strike-through", "bracket"].includes(
            String(item.effect),
          )
        )
          throw new Error(`rough-annotation.items[${index}].effect is unsupported.`);
      }
      break;
  }
};

export const parseVisualBriefDraft = (value: unknown): VisualBriefDraft => {
  assertObject(value, "VisualBrief draft");
  assertObject(value.analysis, "VisualBrief analysis");
  assertObject(value.narrative, "VisualBrief narrative");
  assertObject(value.props, "VisualBrief props");
  assertString(value.analysis.rhetoric, "analysis.rhetoric");
  if (!rhetoricIds.has(value.analysis.rhetoric as VisualRhetoric)) {
    throw new Error(`Unsupported analysis.rhetoric: ${value.analysis.rhetoric}`);
  }
  if (value.analysis.motionIntent && !motionIntents.has(value.analysis.motionIntent as MotionIntent))
    throw new Error(`Unsupported analysis.motionIntent: ${value.analysis.motionIntent}`);
  if (value.analysis.chartIntent) {
    assertObject(value.analysis.chartIntent, "analysis.chartIntent");
    validateChartIntent(value.analysis.chartIntent as unknown as import("../charts/types.ts").ChartIntent);
  }
  if (value.analysis.mediaIntents) {
    if (!Array.isArray(value.analysis.mediaIntents) || value.analysis.mediaIntents.length > 8)
      throw new Error("analysis.mediaIntents must contain at most eight identity references.");
    for (const [index, intent] of value.analysis.mediaIntents.entries()) {
      assertObject(intent, `analysis.mediaIntents[${index}]`);
      assertString(intent.entityId, `analysis.mediaIntents[${index}].entityId`);
      if (!mediaKinds.has(intent.kind as import("../media-assets/types.ts").MediaEntityKind))
        throw new Error(`Unsupported media kind: ${intent.kind}`);
      if ("path" in intent || "url" in intent || "src" in intent)
        throw new Error("Media intents must identify an entity, never a remote file or path.");
    }
  }
  assertString(value.narrative.eyebrow, "narrative.eyebrow");
  assertString(value.narrative.title, "narrative.title");
  assertString(value.narrative.subtitleZh, "narrative.subtitleZh");
  assertString(value.narrative.subtitleEn, "narrative.subtitleEn");
  return value as unknown as VisualBriefDraft;
};

export const createVisualBriefPrompt = (
  segment: NarrationSegment,
  mode: GenerationMode,
  terminologyProfile?: ResolvedTerminologyProfile,
) => ({
  system: [
    "You convert one narration segment into structured visual semantics for a talking-head overlay.",
    "The person remains the hero. Return JSON only, with analysis, narrative, and props.",
    "Do not choose a component id. A deterministic local selector will do that.",
    "Optionally classify motionIntent as introduce, compare, progress, reorder, transform, or emphasize. This is semantic intent only; a deterministic local profile selects the allowed motion recipe.",
    "For an explicit quantitative claim, optionally emit analysis.chartIntent with relation, entityCount, metricCount, and only relevant flags. Relation must be category-comparison, time-series, distribution, proportion, bridge, range, funnel, before-after, or risk-return. Do not name or choose a chart recipe.",
    "When a named person, company, institution, country, exchange, university, research group, or publication materially supports the visual, emit analysis.mediaIntents=[{kind,entityId,preferredVariant?}]. Use a stable lowercase snake_case person id or namespaced identity id. Never output an image URL, path, screenshot, or invented asset; deterministic local resolution supplies an approved asset or fallback.",
    "Treat generic local-model labels (本地模型, local model, local LLM) as the approved brand.ollama identity pairing unless the narration explicitly names another local runtime.",
    "Write only viewer-facing content derived from the narration. Never mention internal component ids, layout-template selection, animation behavior, tests, review artifacts, MVPs, or design-system terminology. Product templates, components, and review actions may be mentioned when the narration itself discusses them.",
    "Use rhetoric: scenario, comparison, trend, distribution, person-evidence, factor-sequence, process, process-steps, ranking, key-stat, media-comparison, image-evidence, causal-chain, quote-source, historical-timeline, decision-matrix, model-classification, core-positioning, capability-surface, or tradeoff.",
    "Counts and data shape must match the narration. Keep titles short and subtitles bilingual.",
    "Text roles are strict: the segment text is verbatim caption truth; narrative fields are concise display-copy; item labels are design-labels. Never copy a visual summary back into captions.",
    "Keep the Chinese title at 18 characters or fewer, display-copy at 72 characters or fewer, and design labels at 28 characters or fewer.",
    terminologyProfile ? `Canonical terminology: ${glossaryForPrompt(terminologyProfile)}` : "",
    "Set analysis.visualPriority to skip when the segment is transitional, repetitive, purely conversational, or would not benefit from a visual. Use normal for a useful explanation and high only for a major claim, comparison, process, or conclusion.",
    "Make props match the rhetoric: scenario={branches:[...]}; distribution={bars:[...]}; trend={series:[...]}; person-evidence={name,role}; factor-sequence/process={items:[3-5]}; process-steps={items:[3-6]}; ranking={items:[3-8]}; comparison with two entities={items:[2]}; key-stat={items:[1-3]}; media-comparison={items:[1-3]}; causal-chain={nodes:[3-5]}; quote-source={quote,sourceName}; historical-timeline={items:[3-6],mode:'historical'|'progression'}; decision-matrix={points:[2-8],xLabel,yLabel,mode:'numeric'|'qualitative'}; model-classification={items:[2-6]}; core-positioning={nodes:[2-6],centerLabel}; capability-surface={rows:[2-6],columns:[2-6],mode:'numeric'|'qualitative'}; tradeoff={items:[2-3],mode:'numeric'|'directional'}. Never invent numeric values for a qualitative mode.",
    "Every array item must be an object with short viewer-facing labels and any numeric value explicitly supported by the narration.",
    `Generation mode: ${mode}.`,
  ]
    .filter(Boolean)
    .join("\n"),
  user: JSON.stringify(segment),
});

export const generateVisualBriefFromDraft = (
  segment: NarrationSegment,
  draftValue: unknown,
  mode: GenerationMode = "production",
  terminologyProfile?: ResolvedTerminologyProfile,
): GeneratedVisualBrief => {
  if (!(segment.end > segment.start)) throw new Error("Narration segment end must be after start.");
  assertString(segment.text, "segment.text");
  const draft = parseVisualBriefDraft(draftValue);
  const normalizedTitle = normalizeNumbersAndUnits(
    correctTerminology(draft.narrative.title, terminologyProfile),
    "display-copy",
  );
  draft.narrative.eyebrow = correctTerminology(draft.narrative.eyebrow, terminologyProfile);
  draft.narrative.subtitleZh = normalizeNumbersAndUnits(
    correctTerminology(draft.narrative.subtitleZh, terminologyProfile),
    "display-copy",
  );
  validateViewerFacingNarrative({ ...draft.narrative, title: normalizedTitle });
  validateViewerCopy(normalizedTitle, "display-copy");
  draft.narrative.title = compressViewerTitle(normalizedTitle);
  validateViewerFacingNarrative(draft.narrative);
  validateViewerCopy(draft.narrative.title, "display-copy");
  validateViewerCopy(draft.narrative.subtitleZh, "display-copy");
  validateViewerCopy(draft.narrative.eyebrow, "design-label");
  const decision = selectVisualComponent(draft.analysis, mode);
  draft.props = compactComponentProps(decision.id, draft.props);
  validateComponentProps(decision.id, draft.props);
  const motionIntent = draft.analysis.motionIntent ?? defaultMotionIntent(draft.analysis.rhetoric);
  const motionRecipe = selectMotionRecipe({
    componentId: decision.id,
    intent: motionIntent,
    allowCandidates: mode === "review",
  });
  const validatedChartDecision = draft.analysis.chartIntent
    ? validateChartIntent(draft.analysis.chartIntent)
    : undefined;
  const chartDecision = validatedChartDecision;
  if (chartDecision) {
    const allowed = componentChartBindings[decision.id];
    if (!allowed?.includes(chartDecision.id))
      throw new Error(`Chart recipe ${chartDecision.id} is not allowlisted for component ${decision.id}.`);
  }
  const chart =
    chartDecision && draft.analysis.chartIntent
      ? { intent: draft.analysis.chartIntent, recipeId: chartDecision.id, selectionReason: chartDecision.reason }
      : undefined;
  return {
    schemaVersion: VISUAL_BRIEF_SCHEMA_VERSION,
    segment,
    analysis: draft.analysis,
    component: {
      id: decision.id,
      status: "approved",
      selectionReason: decision.reason,
    },
    motion: { intent: motionIntent, recipeId: motionRecipe },
    chart,
    narrative: draft.narrative,
    textRoles: { segmentText: "caption", narrative: "display-copy", labels: "design-label" },
    props: draft.props,
  };
};

export const generateVisualBrief = async (
  segment: NarrationSegment,
  adapter: VisualBriefModelAdapter,
  mode: GenerationMode = "production",
  terminologyProfile?: ResolvedTerminologyProfile,
) => {
  const prompt = createVisualBriefPrompt(segment, mode, terminologyProfile);
  const draft = await adapter.completeJson(prompt);
  return generateVisualBriefFromDraft(segment, draft, mode, terminologyProfile);
};
