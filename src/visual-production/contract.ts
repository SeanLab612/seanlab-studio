import { createHash } from "node:crypto";
import { NARRATION_VISUAL_FORMS, NARRATION_VISUAL_FORM_IDS } from "../creator-workflow/visual-authoring.ts";
import { resolveFunctionalIconId } from "../icons/resolve-functional-icon.ts";
import { APPROVED_COMPONENT_IDS } from "../visual-brief/types.ts";
import { animationPrototypeRegistry } from "./animation-registry.ts";
import {
  ANIMATION_PROTOTYPE_IDS,
  ANIMATION_STYLE_PROFILE_IDS,
  type AnimationIntent,
  PRIMARY_VISUAL_TYPES,
  SPEAKER_PRESENCE_MODES,
  TAKEOVER_MODES,
  TEXT_ANNOTATION_EFFECTS,
  type TextAnnotation,
  type VisualBeat,
} from "./types.ts";

const beatIdPattern = /^[a-z0-9][a-z0-9-]{1,62}$/;
const stageIdPattern = /^[a-z0-9][a-z0-9-]{1,62}$/;
const imageAssetIdPattern = /^[a-z0-9][a-z0-9-]{1,61}$/;

export const sha256VisualText = (value: string) => createHash("sha256").update(value).digest("hex");

const occurrenceRange = (source: string, quote: string, occurrence: number) => {
  let from = 0;
  let found = -1;
  for (let index = 0; index < occurrence; index += 1) {
    found = source.indexOf(quote, from);
    if (found < 0) return undefined;
    from = found + quote.length;
  }
  return { start: found, end: found + quote.length };
};

export const validateAnimationIntent = (input: unknown, spokenRange?: string): AnimationIntent => {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Animation intent is required");
  const intent = input as AnimationIntent;
  if (!ANIMATION_PROTOTYPE_IDS.includes(intent.prototypeId)) throw new Error("Animation prototype is unsupported");
  if (!ANIMATION_STYLE_PROFILE_IDS.includes(intent.styleProfileId)) throw new Error("Animation style is unsupported");
  if (!intent.takeaway?.trim()) throw new Error("Animation takeaway is required");
  const prototype = animationPrototypeRegistry[intent.prototypeId];
  if (!prototype.compatibleStyleIds.includes(intent.styleProfileId))
    throw new Error(`Animation style ${intent.styleProfileId} is incompatible with ${prototype.id}`);
  if (
    !Array.isArray(intent.stages) ||
    intent.stages.length < prototype.minimumStages ||
    intent.stages.length > prototype.maximumStages
  )
    throw new Error(
      `Animation ${prototype.id} requires ${prototype.minimumStages} to ${prototype.maximumStages} stages`,
    );
  const stageIds = new Set<string>();
  const stages = intent.stages.map((stage) => {
    if (!stageIdPattern.test(stage.id) || stageIds.has(stage.id))
      throw new Error("Animation contains an invalid or duplicate stage");
    stageIds.add(stage.id);
    if (!stage.spokenQuote?.trim()) throw new Error("Animation stage must quote spoken narration");
    if (spokenRange && !spokenRange.includes(stage.spokenQuote))
      throw new Error("Animation stage must quote its spoken range");
    if (!stage.action?.trim() || !stage.label?.trim()) throw new Error("Animation stage action and label are required");
    if (stage.imageAssetId !== undefined && !imageAssetIdPattern.test(stage.imageAssetId))
      throw new Error("Animation stage image asset id is invalid");
    if (stage.imageAssetLabel !== undefined && (!stage.imageAssetLabel.trim() || stage.imageAssetLabel.length > 120))
      throw new Error("Animation stage image asset label is invalid");
    if (stage.imageAssetSrc !== undefined)
      throw new Error("Animation stage runtime image source cannot be persisted in authored intent");
    return {
      id: stage.id,
      spokenQuote: stage.spokenQuote,
      action: stage.action,
      label: stage.label,
      ...(stage.imageAssetId ? { imageAssetId: stage.imageAssetId } : {}),
      ...(stage.imageAssetLabel ? { imageAssetLabel: stage.imageAssetLabel.trim() } : {}),
      iconId: resolveFunctionalIconId(stage.iconId, `${stage.label} ${stage.action} ${stage.spokenQuote}`),
    };
  });
  return {
    prototypeId: intent.prototypeId,
    styleProfileId: intent.styleProfileId,
    takeaway: intent.takeaway,
    stages,
  };
};

export const validateTextAnnotations = (input: unknown, narration: string): TextAnnotation[] => {
  if (!Array.isArray(input)) throw new Error("Text annotations must be an array");
  if (input.length > 12) throw new Error("A narration section may contain at most twelve text annotations");
  const ids = new Set<string>();
  const ranges: Array<{ id: string; start: number; end: number }> = [];
  const output = input.map((raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Text annotation must be an object");
    const annotation = raw as TextAnnotation;
    if (!beatIdPattern.test(annotation.id) || ids.has(annotation.id))
      throw new Error(`Invalid or duplicate text annotation id: ${annotation.id}`);
    ids.add(annotation.id);
    const target = annotation.exactSpokenQuote?.trim();
    const targetLength = [...(target ?? "")].length;
    if (!target || targetLength < 2 || targetLength > 24 || /[\r\n]/.test(target))
      throw new Error(`Text annotation ${annotation.id} must quote a single-line 2-24 character phrase`);
    if (!["suggested", "confirmed"].includes(annotation.status))
      throw new Error(`Text annotation ${annotation.id} status is unsupported`);
    if (annotation.origin !== undefined && !["user", "agent"].includes(annotation.origin))
      throw new Error(`Text annotation ${annotation.id} origin is unsupported`);
    if (annotation.executionPolicy !== undefined && !["reference", "locked"].includes(annotation.executionPolicy))
      throw new Error(`Text annotation ${annotation.id} execution policy is unsupported`);
    if (!TEXT_ANNOTATION_EFFECTS.includes(annotation.effect))
      throw new Error(`Text annotation ${annotation.id} effect is unsupported`);
    const occurrence = annotation.quoteOccurrence ?? 1;
    if (!Number.isInteger(occurrence) || occurrence < 1)
      throw new Error(`Text annotation ${annotation.id} quoteOccurrence is invalid`);
    const range = occurrenceRange(narration, target, occurrence);
    if (!range) throw new Error(`Text annotation ${annotation.id} must quote its narration exactly`);
    if (annotation.quoteOccurrence === undefined && narration.indexOf(target, range.end) >= 0)
      throw new Error(`Text annotation ${annotation.id} repeated quote requires quoteOccurrence`);
    ranges.push({ id: annotation.id, ...range });
    return {
      id: annotation.id,
      exactSpokenQuote: target,
      ...(annotation.quoteOccurrence ? { quoteOccurrence: annotation.quoteOccurrence } : {}),
      status: annotation.status,
      ...(annotation.origin ? { origin: annotation.origin } : {}),
      ...(annotation.executionPolicy ? { executionPolicy: annotation.executionPolicy } : {}),
      effect: annotation.effect,
    } satisfies TextAnnotation;
  });
  ranges.sort((left, right) => left.start - right.start || left.end - right.end);
  for (let index = 1; index < ranges.length; index += 1) {
    if (ranges[index].start < ranges[index - 1].end)
      throw new Error(`Text annotations ${ranges[index - 1].id} and ${ranges[index].id} overlap`);
  }
  return output;
};

export const resolveTextAnnotationQuoteRange = (annotation: TextAnnotation, narration: string) => {
  const range = occurrenceRange(narration, annotation.exactSpokenQuote, annotation.quoteOccurrence ?? 1);
  if (!range) throw new Error(`Text annotation ${annotation.id} must quote its narration exactly`);
  return range;
};

const assertPresentationContract = (beat: VisualBeat) => {
  const materialIds = [...new Set([...(beat.materialIds ?? []), ...(beat.materialId ? [beat.materialId] : [])])];
  if (beat.primaryVisualType === "speaker") {
    if (beat.takeover !== "none" || beat.speakerPresence !== "full")
      throw new Error(`Visual beat ${beat.id} speaker presentation must remain full-frame`);
  }
  if (beat.primaryVisualType === "component") {
    if (!beat.semanticForm || !NARRATION_VISUAL_FORM_IDS.includes(beat.semanticForm))
      throw new Error(`Visual beat ${beat.id} component requires a supported semantic form`);
    if (materialIds.length || beat.animationIntent)
      throw new Error(`Visual beat ${beat.id} component cannot bind material or animation intent`);
    if (beat.componentId) {
      if (!APPROVED_COMPONENT_IDS.includes(beat.componentId))
        throw new Error(`Visual beat ${beat.id} component id is unsupported`);
      const form = NARRATION_VISUAL_FORMS.find((item) => item.id === beat.semanticForm);
      if (!(form?.componentCoverage as readonly string[] | undefined)?.includes(beat.componentId))
        throw new Error(`Visual beat ${beat.id} component is incompatible with ${beat.semanticForm}`);
    }
    if (beat.takeover !== "partial" || beat.speakerPresence !== "full")
      throw new Error(`Visual beat ${beat.id} component must use partial takeover with the speaker retained`);
    const emphasisTarget = beat.exactSpokenQuote
      .trim()
      .replace(/^[“《〈『「"']+|[”》〉』」"'。，；！？,.!?;]+$/g, "")
      .trim();
    if (beat.semanticForm === "text-emphasis" && ([...emphasisTarget].length < 2 || [...emphasisTarget].length > 14))
      throw new Error(`Visual beat ${beat.id} text emphasis must quote a 2-14 character phrase`);
  }
  if (["image", "screen-demo"].includes(beat.primaryVisualType) && !materialIds.length)
    throw new Error(`Visual beat ${beat.id} ${beat.primaryVisualType} requires a material`);
  if (beat.primaryVisualType === "screen-demo" && materialIds.length !== 1)
    throw new Error(`Visual beat ${beat.id} screen-demo requires exactly one recording`);
  if (beat.primaryVisualType === "image" && materialIds.length > 3)
    throw new Error(`Visual beat ${beat.id} image group may contain at most three images`);
  if (beat.primaryVisualType === "animation") {
    if (!beat.animationIntent) throw new Error(`Visual beat ${beat.id} animation requires animationIntent`);
    if (beat.takeover !== "full" || beat.speakerPresence !== "circle-pip")
      throw new Error(`Visual beat ${beat.id} animation must use full takeover with circle-pip`);
    validateAnimationIntent(beat.animationIntent, beat.exactSpokenQuote);
  } else if (beat.animationIntent) {
    throw new Error(`Visual beat ${beat.id} non-animation cannot contain animationIntent`);
  }
};

export const validateVisualBeats = (input: unknown, narration: string): VisualBeat[] => {
  if (!Array.isArray(input)) throw new Error("Visual beats must be an array");
  if (input.length > 12) throw new Error("A narration section may contain at most twelve visual beats");
  const ids = new Set<string>();
  const ranges: Array<{ id: string; start: number; end: number }> = [];
  const output = input.map((raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Visual beat must be an object");
    const beat = raw as VisualBeat;
    if (!beatIdPattern.test(beat.id) || ids.has(beat.id))
      throw new Error(`Invalid or duplicate visual beat id: ${beat.id}`);
    ids.add(beat.id);
    if (!beat.exactSpokenQuote?.trim() || beat.exactSpokenQuote.length > 240)
      throw new Error(`Visual beat ${beat.id} exact spoken quote is required and must not exceed 240 characters`);
    if (!PRIMARY_VISUAL_TYPES.includes(beat.primaryVisualType))
      throw new Error(`Visual beat ${beat.id} primary visual type is unsupported`);
    if (!["suggested", "confirmed"].includes(beat.status))
      throw new Error(`Visual beat ${beat.id} status is unsupported`);
    if (beat.executionPolicy !== undefined && !["reference", "locked"].includes(beat.executionPolicy))
      throw new Error(`Visual beat ${beat.id} execution policy is unsupported`);
    if (!TAKEOVER_MODES.includes(beat.takeover) || !SPEAKER_PRESENCE_MODES.includes(beat.speakerPresence))
      throw new Error(`Visual beat ${beat.id} presentation mode is unsupported`);
    if (beat.materialDisplay && !["full", "crop", "annotate"].includes(beat.materialDisplay))
      throw new Error(`Visual beat ${beat.id} material display is unsupported`);
    if (
      beat.materialIds !== undefined &&
      (!Array.isArray(beat.materialIds) ||
        beat.materialIds.some((materialId) => typeof materialId !== "string" || !materialId.trim()))
    )
      throw new Error(`Visual beat ${beat.id} materialIds must contain valid material ids`);
    const occurrence = beat.quoteOccurrence ?? 1;
    if (!Number.isInteger(occurrence) || occurrence < 1)
      throw new Error(`Visual beat ${beat.id} quoteOccurrence is invalid`);
    const range = occurrenceRange(narration, beat.exactSpokenQuote, occurrence);
    if (!range) throw new Error(`Visual beat ${beat.id} must quote its narration exactly`);
    if (beat.quoteOccurrence === undefined && narration.indexOf(beat.exactSpokenQuote, range.end) >= 0)
      throw new Error(`Visual beat ${beat.id} repeated quote requires quoteOccurrence`);
    assertPresentationContract(beat);
    ranges.push({ id: beat.id, ...range });
    return {
      id: beat.id,
      exactSpokenQuote: beat.exactSpokenQuote,
      ...(beat.quoteOccurrence ? { quoteOccurrence: beat.quoteOccurrence } : {}),
      status: beat.status,
      ...(beat.executionPolicy ? { executionPolicy: beat.executionPolicy } : {}),
      primaryVisualType: beat.primaryVisualType,
      ...(beat.semanticForm ? { semanticForm: beat.semanticForm } : {}),
      ...(beat.componentId ? { componentId: beat.componentId } : {}),
      ...(beat.materialId ? { materialId: beat.materialId } : {}),
      ...(beat.materialIds?.length ? { materialIds: [...new Set(beat.materialIds)] } : {}),
      ...(beat.materialDisplay ? { materialDisplay: beat.materialDisplay } : {}),
      ...(beat.animationIntent ? { animationIntent: beat.animationIntent } : {}),
      takeover: beat.takeover,
      speakerPresence: beat.speakerPresence,
    } satisfies VisualBeat;
  });
  ranges.sort((left, right) => left.start - right.start || left.end - right.end);
  for (let index = 1; index < ranges.length; index += 1) {
    if (ranges[index].start < ranges[index - 1].end)
      throw new Error(`Visual beats ${ranges[index - 1].id} and ${ranges[index].id} overlap`);
  }
  return output;
};

export const resolveVisualBeatQuoteRange = (beat: VisualBeat, narration: string) => {
  const occurrence = beat.quoteOccurrence ?? 1;
  const range = occurrenceRange(narration, beat.exactSpokenQuote, occurrence);
  if (!range) throw new Error(`Visual beat ${beat.id} must quote its narration exactly`);
  return range;
};
