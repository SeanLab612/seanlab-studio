import { glossaryForPrompt, type ResolvedTerminologyProfile } from "../terminology/index.ts";
import type { VerbatimCaption } from "../workflow/captions.ts";
import { approvedComponentRegistry } from "../components/library/registry.ts";
import { chartRecipeRegistry } from "../charts/registry.ts";
import { animationPrototypeRegistry } from "../visual-production/animation-registry.ts";

const productionCapabilityCatalog = () =>
  JSON.stringify({
    components: Object.values(approvedComponentRegistry).map(({ id, useWhen, avoidWhen }) => ({
      id,
      useWhen,
      avoidWhen,
    })),
    charts: Object.values(chartRecipeRegistry).map(({ id, relations, minItems, maxItems }) => ({
      id,
      relations,
      minItems,
      maxItems,
    })),
    animations: Object.values(animationPrototypeRegistry)
      .filter((item) => item.rendererStatus === "approved")
      .map(({ id, label, relationship, minimumStages, maximumStages, defaultStyleId }) => ({
        id,
        label,
        relationship,
        minimumStages,
        maximumStages,
        styleProfileId: defaultStyleId,
      })),
  });

export const createSemanticNarrativePrompt = (
  captions: VerbatimCaption[],
  terminologyProfile?: ResolvedTerminologyProfile,
  imageEvidence: Array<{
    id: string;
    role: string;
    required?: boolean;
    description: string;
    sourceLabel?: string;
    anchorText?: string;
  }> = [],
  referenceVisualBeats: Array<{
    id: string;
    sectionId: string;
    exactSpokenQuote: string;
    primaryVisualType: string;
    materialAssetIds?: string[];
    animationPrototypeId?: string;
    animationStyleProfileId?: string;
  }> = [],
  supplementalMediaInventory: Array<{
    id: string;
    role: string;
    required?: boolean;
    description?: string;
    productionTreatment?: string;
    durationSeconds?: number;
  }> = [],
  maximumAnimationCoverageRatio = 0.25,
) => ({
  system: [
    "You are the global narrative understanding layer for a 16:9 Chinese talking-head video.",
    "Read the complete punctuation-preserving transcript before planning any visual segment.",
    "Return only evidence-grounded production intent and never invent data or media.",
    `Approved production capability catalog: ${productionCapabilityCatalog()}`,
    "Choose the relationship and visual form with the complete catalog in mind. The deterministic renderer may only validate and materialize your compatible choice; it must not invent a different creative visual.",
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
    "For rhetoric=media-comparison, every item must have a non-empty stable entityId and a non-empty evidence-grounded detail. If the source does not identify each medium, use another rhetoric or omit the segment.",
    "Registered project images are supplied as imageEvidenceInventory. Use rhetoric=image-evidence only when one listed image directly supports the segment. Then set imageEvidence={assetId,purpose,caption}. Reference the assetId exactly; never output a path, URL, or invented id. Otherwise set imageEvidence=null.",
    "The creator visual plan is referenceVisualBeats, not a lock. Always return visualDecisions. When no beats are supplied return an empty array. Otherwise independently decide every supplied beat with visualDecisions=[{beatId,action:'use'|'skip',reason}]. Preserve every beat id exactly and provide one decision per beat.",
    "materialAssetIds on a reference beat are creator-registered materials. A video or screen recording is listed in supplementalMediaInventory rather than imageEvidenceInventory. Never call a referenced material missing or unregistered when its id appears in either supplied inventory.",
    "Every required imageEvidenceInventory or supplementalMediaInventory item is a hard production obligation. Use its description and treatment to understand what it proves. Never replace it with an animation or component, and never mark it unused merely because another visual is easier.",
    "Return materialAssignments with exactly one assignment for every required image and recording. Use kind=image for imageEvidenceInventory and kind=screen-demo for supplementalMediaInventory. Choose inclusive startCue/endCue evidence bounds and an explicit global order. Several materials may share a broader evidence range when they should play sequentially; order decides their sequence. Never assign an asset outside narration it can support.",
    "Use a reference beat only when its exact spoken evidence benefits from that visual. Prefer directly relevant screenshots or recordings when they prove the spoken claim.",
    "For non-material relationships, choose an approved information component or chart first. Comparisons, lists, processes, statistics, timelines, matrices, classifications, evidence cards, and causal relationships should remain component-led whenever the catalog supports them.",
    "Use rhetoric=editorial-statement only for one complete plain-language claim that has no registered material, data, steps, comparison, quotation, chronology, classification, or other stronger relationship. Keep items empty or limited to one supporting concept. Prefer every specialized component and every required user material over editorial-statement.",
    "Editorial-statement is a restrained coverage bridge, not a default. Its segments should normally last 4-8 seconds and must not appear more than twice consecutively. There is no whole-video share cap: keep selecting it for semantically suitable plain-language claims even after the 80 percent minimum has been reached, while always preferring stronger materials and specialized components.",
    `Animation is auxiliary, not the default. Use it only for a meaningful state change, mechanism, or spatial transformation that no approved component or chart can explain clearly. Animation may cover at most ${(maximumAnimationCoverageRatio * 100).toFixed(0)} percent of the spoken duration. Never use animation merely to increase visual coverage. Skip redundant or misleading reference beats.`,
    "For a new hand-drawn animation, set animationIntent using one approved prototype, paper-editorial style, and two to six evidence-grounded stages. Each stage spokenQuote must occur inside the segment cues. Do not add animationIntent to a segment already assigned to required image or recording evidence. Otherwise set animationIntent=null.",
    "A referenced material does not need to prove every clause in a beat. Use it when it visibly supports a meaningful subset of the spoken evidence, and state the narrower proof boundary in the reason instead of discarding the material.",
    "Your segments and used reference beats together should provide useful primary visuals for at least 80 percent of the spoken duration. Do not satisfy coverage with irrelevant visuals: split the transcript into additional evidence-grounded segments instead. Avoid unexplained speaker-only gaps longer than 15 seconds.",
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
    imageEvidenceInventory: imageEvidence.map(({ id, role, required, description, sourceLabel, anchorText }) => ({
      assetId: id,
      role,
      required: Boolean(required),
      description,
      sourceLabel: sourceLabel ?? "",
      anchorText: anchorText ?? "",
    })),
    referenceVisualBeats,
    supplementalMediaInventory,
  }),
});
