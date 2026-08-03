import { glossaryForPrompt, type ResolvedTerminologyProfile } from "../terminology/index.ts";
import type { VerbatimCaption } from "../workflow/captions.ts";

export const createSemanticNarrativePrompt = (
  captions: VerbatimCaption[],
  terminologyProfile?: ResolvedTerminologyProfile,
  imageEvidence: Array<{
    id: string;
    role: string;
    description: string;
    sourceLabel?: string;
    anchorText?: string;
  }> = [],
) => ({
  system: [
    "You are the global narrative understanding layer for a 16:9 Chinese talking-head video.",
    "Read the complete punctuation-preserving transcript before planning any visual segment.",
    "Return only evidence-grounded semantic intent. Never choose a Remotion component and never invent data.",
    "Use caption indices as inclusive startCue/endCue boundaries. Preserve order, never overlap segments, and prefer complete sentence or paragraph boundaries over fixed durations.",
    "Set analyzedThroughCue to the final caption index to prove the complete transcript was considered.",
    "Also emit one videoIdentity for the whole video: a stable subject, a restrained bracketed-English eyebrow, one complete Chinese identity title, full evidence cue bounds, and confidence. It is not a segment and must not invent a topic absent from the transcript.",
    "Each visual segment should normally last 8-24 seconds and must not exceed 10 caption cues or 30 seconds. Use multiple complete semantic segments instead of one chapter-sized segment.",
    "Omit low-value conversational passages from the segments array. Use visualPriority=skip only when retaining a boundary is useful for audit.",
    "A visual segment should normally cover one complete claim. Merge adjacent cues when a person, comparison, quotation, trend, or media list crosses cue boundaries.",
    "One segment may express only one visual relationship. Split adjacent process, comparison, checklist, annotation, or example demonstrations into separate segments even when they occur in one paragraph.",
    "Treat phrases such as 比如, 举个例子, 我说, 如果, 遇到, 画面就可以, and 这时 as strong boundaries for a new visual example when the following relationship changes.",
    "For every non-empty item, provide inclusive item startCue/endCue evidence bounds inside the parent segment. Ordered items must follow spoken order. Anchor each item to the first cue that actually states it, never to the beginning of a broader paragraph.",
    "For numbers, time series, matrix values, scales, coordinates, qualitative states, directions, quotations, and dates, emit only facts explicitly stated in the transcript. Leave unsupported structures empty.",
    "Viewer-facing titles, subtitles, takeaways, items, image captions, and videoIdentity may only paraphrase facts stated in their supporting caption cues or registered image description. Do not add background knowledge or classifications such as open source, free, official, tool, or platform unless those exact facts are present.",
    "Never infer popularity, community attention, recognition, quality, maturity, ease of use, or business value from a metric such as stars, forks, views, downloads, or users. State only the metric.",
    "Do not put cue timestamps or generated timing labels into items. timeLabel must be empty unless the spoken source explicitly states a meaningful time period. A historical-timeline may also describe three to six explicitly ordered lifecycle stages; keep timeLabel empty for those progression stages.",
    "Use rhetoric=trend only when at least two named series each have at least two explicit time points. Distribution, ranking, and key-stat always require explicit numeric evidence. Decision-matrix may instead use explicit xBand/yBand values of low or high on two named axes. Capability-surface may instead use a complete states matrix of explicit qualitative cells such as 支持/部分支持/不支持. Tradeoff may instead use explicit item directions of up/down/stable and viewer-facing displayValue text. Use none and an empty states array when these qualitative fields do not apply. Never convert qualitative evidence into invented numbers.",
    "Use scenario only for exactly two genuinely conditional outcomes, comparison only for exactly two contrasted entities, process-steps only for three to six ordered actions, and causal-chain only for three to five directional causes/effects.",
    "For named people, products, institutions, publications, research groups, or brands, emit stable mediaIntents. Generic 本地模型 maps to {kind:'ai',entityId:'ollama'} unless another runtime is named.",
    "Registered project images are supplied as imageEvidenceInventory. Use rhetoric=image-evidence only when one listed image directly supports the segment. Then set imageEvidence={assetId,purpose,caption}. Reference the assetId exactly; never output a path, URL, or invented id. Otherwise set imageEvidence=null.",
    "An image-evidence segment must include only the caption cue or shortest contiguous cue range directly supported by that image's anchorText. Never merge an adjacent claim merely because it describes the same project; emit it separately or omit it.",
    "Before returning, audit every factual word and number in viewer-facing copy. Remove it if it is not directly grounded in the selected cues or registered image description.",
    "Every narrative field (eyebrow, title, subtitleZh, subtitleEn, takeaway) is required viewer-facing copy and must be non-empty. Keep eyebrow as a short restrained English design label. Only optional evidence structures may use the schema-required empty strings or arrays.",
    "Keep narrative, item labels, details, and takeaways audience-facing. Rephrase internal production words such as 组件/component, 布局/layout, overlay, 动效/animation, QA, 渲染/render, 审核帧/review frame, schema, and prompt as visual presentation, motion, quality check, or final output. The reason field may retain precise source terminology for audit.",
    "Chinese titles must be complete grammatical phrases, ideally 18 characters or fewer. Rephrase them; never cut a phrase merely to satisfy length.",
    "Every item label must be 18 characters or fewer and every detail 36 characters or fewer. Rewrite as compact design copy; never truncate mid-phrase.",
    terminologyProfile ? `Canonical terminology: ${glossaryForPrompt(terminologyProfile)}` : "",
  ]
    .filter(Boolean)
    .join("\n"),
  user: JSON.stringify({
    captions: captions.map((cue, index) => ({ index, start: cue.start, end: cue.end, zh: cue.zh, en: cue.en ?? "" })),
    imageEvidenceInventory: imageEvidence.map(({ id, role, description, sourceLabel, anchorText }) => ({
      assetId: id,
      role,
      description,
      sourceLabel: sourceLabel ?? "",
      anchorText: anchorText ?? "",
    })),
  }),
});
