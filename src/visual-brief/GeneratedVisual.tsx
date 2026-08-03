import type React from "react";
import {
  BinaryVersus,
  CapabilitySurfaceGrid,
  CausalChain,
  CorePositioningNode,
  DecisionMatrix,
  DistributionBars,
  FactorSequence,
  HistoricalTimeline,
  KeyStatSummary,
  MarketCapLines,
  MediaComparison,
  ImageEvidenceInset,
  ModelClassificationMap,
  PersonEvidenceCard,
  ProcessSteps,
  QuoteSourceCard,
  RankedMetricList,
  ScenarioBranches,
  TradeoffScale,
  RoughAnnotation,
} from "../components/review";
import type { GeneratedVisualBrief } from "./generator";
import { resolveMediaEntityId, resolveMediaEntityReference } from "../media-assets";
import { normalizeComponentAccentProps } from "../design-tokens";
import { isIconId, type IconId } from "../icons/registry";
import { usesMobilePersonEvidenceDensity } from "./component-density";

type RuntimeProps = { frame: number; fps: number; compact?: boolean };
type WithoutRuntime<T> = Omit<T, keyof RuntimeProps>;

const resolveTimedProps = (props: Record<string, unknown>, frame: number, fps: number) => {
  const timeline = Array.isArray(props.activeIndexTimeline)
    ? (props.activeIndexTimeline as Array<{ at: number; index: number }>)
    : [];
  if (!timeline.length) return props;
  const seconds = frame / fps;
  const activePoint = timeline.filter((point) => point.at <= seconds).at(-1) ?? timeline[0];
  const active = activePoint.index;
  const activeProgress = Math.max(0, Math.min(1, (seconds - activePoint.at) / 0.35));
  const { activeIndexTimeline: _ignored, ...rest } = props;
  return { ...rest, activeIndex: active, activeProgress };
};

const brandIconFor = (entityId: string): IconId | undefined => {
  if (isIconId(entityId) && entityId.startsWith("brand.")) return entityId;
  return undefined;
};

const connectMediaIntents = (brief: GeneratedVisualBrief, props: Record<string, unknown>) => {
  const intents = brief.analysis.mediaIntents ?? [];
  const firstPerson = intents.find((intent) => intent.kind === "person");
  const firstBrand = intents.find((intent) => intent.kind === "brand");
  const firstSource = intents[0];
  if (brief.component.id === "person-evidence-card") {
    const brandIconId = firstBrand ? brandIconFor(firstBrand.entityId) : undefined;
    return {
      ...props,
      ...(firstPerson && !props.personId ? { personId: firstPerson.entityId } : {}),
      ...(brandIconId && !props.brandIconId ? { brandIconId, brandLabel: firstBrand?.entityId ?? "" } : {}),
    };
  }
  if (brief.component.id === "quote-source-card" && firstSource && !props.sourceEntityId)
    return { ...props, sourceEntityId: firstSource.entityId, sourceEntityKind: firstSource.kind };
  if (
    ["binary-versus", "ranked-metric-list", "model-classification-map"].includes(brief.component.id) &&
    Array.isArray(props.items)
  ) {
    const unused = [...intents];
    const items = props.items.map((value, index) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return value;
      const item = value as Record<string, unknown>;
      if (item.entityId || item.iconId) return item;
      const itemKey = resolveMediaEntityId(String(item.id ?? item.label ?? item.title ?? ""));
      let intentIndex = itemKey ? unused.findIndex((intent) => resolveMediaEntityId(intent.entityId) === itemKey) : -1;
      if (intentIndex < 0 && index < unused.length) intentIndex = index;
      const intent = intentIndex >= 0 ? unused.splice(intentIndex, 1)[0] : undefined;
      if (intent) return { ...item, entityId: intent.entityId, entityKind: intent.kind };
      const identityText = [item.label, item.title, item.detail, item.id].filter(Boolean).join(" ");
      const pairedIdentity = resolveMediaEntityReference(identityText);
      return pairedIdentity ? { ...item, entityId: pairedIdentity.entityId, entityKind: pairedIdentity.kind } : item;
    });
    return { ...props, items };
  }
  return props;
};

export const GeneratedVisual: React.FC<RuntimeProps & { brief: GeneratedVisualBrief }> = ({
  brief,
  frame,
  fps,
  compact = false,
}) => {
  const props = normalizeComponentAccentProps(connectMediaIntents(brief, resolveTimedProps(brief.props, frame, fps)));
  switch (brief.component.id) {
    case "distribution-bars":
      return (
        <DistributionBars
          frame={frame}
          fps={fps}
          {...(props as WithoutRuntime<React.ComponentProps<typeof DistributionBars>>)}
        />
      );
    case "scenario-branches":
      return (
        <ScenarioBranches
          frame={frame}
          fps={fps}
          {...(props as WithoutRuntime<React.ComponentProps<typeof ScenarioBranches>>)}
        />
      );
    case "market-cap-lines":
      return (
        <MarketCapLines
          frame={frame}
          fps={fps}
          {...(props as WithoutRuntime<React.ComponentProps<typeof MarketCapLines>>)}
        />
      );
    case "person-evidence-card":
      return (
        <PersonEvidenceCard
          frame={frame}
          fps={fps}
          {...(props as WithoutRuntime<React.ComponentProps<typeof PersonEvidenceCard>>)}
          mobilePriority={usesMobilePersonEvidenceDensity(brief.component.id)}
        />
      );
    case "factor-sequence":
      return (
        <FactorSequence
          frame={frame}
          fps={fps}
          {...(props as WithoutRuntime<React.ComponentProps<typeof FactorSequence>>)}
        />
      );
    case "ranked-metric-list":
      return (
        <RankedMetricList
          frame={frame}
          fps={fps}
          compact={compact}
          {...(props as WithoutRuntime<React.ComponentProps<typeof RankedMetricList>>)}
        />
      );
    case "binary-versus":
      return (
        <BinaryVersus
          frame={frame}
          fps={fps}
          compact={compact}
          {...(props as WithoutRuntime<React.ComponentProps<typeof BinaryVersus>>)}
        />
      );
    case "key-stat-summary":
      return (
        <KeyStatSummary
          frame={frame}
          fps={fps}
          {...(props as WithoutRuntime<React.ComponentProps<typeof KeyStatSummary>>)}
        />
      );
    case "media-comparison":
      return (
        <MediaComparison
          frame={frame}
          fps={fps}
          {...(props as WithoutRuntime<React.ComponentProps<typeof MediaComparison>>)}
        />
      );
    case "image-evidence-inset":
      return (
        <ImageEvidenceInset
          frame={frame}
          fps={fps}
          {...(props as WithoutRuntime<React.ComponentProps<typeof ImageEvidenceInset>>)}
        />
      );
    case "process-steps":
      return (
        <ProcessSteps
          frame={frame}
          fps={fps}
          {...(props as WithoutRuntime<React.ComponentProps<typeof ProcessSteps>>)}
        />
      );
    case "causal-chain":
      return (
        <CausalChain frame={frame} fps={fps} {...(props as WithoutRuntime<React.ComponentProps<typeof CausalChain>>)} />
      );
    case "quote-source-card":
      return (
        <QuoteSourceCard
          frame={frame}
          fps={fps}
          {...(props as WithoutRuntime<React.ComponentProps<typeof QuoteSourceCard>>)}
        />
      );
    case "historical-timeline":
      return (
        <HistoricalTimeline
          frame={frame}
          fps={fps}
          {...(props as WithoutRuntime<React.ComponentProps<typeof HistoricalTimeline>>)}
        />
      );
    case "decision-matrix":
      return (
        <DecisionMatrix
          frame={frame}
          fps={fps}
          {...(props as WithoutRuntime<React.ComponentProps<typeof DecisionMatrix>>)}
        />
      );
    case "model-classification-map":
      return (
        <ModelClassificationMap
          frame={frame}
          fps={fps}
          compact={compact}
          {...(props as WithoutRuntime<React.ComponentProps<typeof ModelClassificationMap>>)}
        />
      );
    case "core-positioning-node":
      return (
        <CorePositioningNode
          frame={frame}
          fps={fps}
          {...(props as WithoutRuntime<React.ComponentProps<typeof CorePositioningNode>>)}
        />
      );
    case "capability-surface-grid":
      return (
        <CapabilitySurfaceGrid
          frame={frame}
          fps={fps}
          {...(props as WithoutRuntime<React.ComponentProps<typeof CapabilitySurfaceGrid>>)}
        />
      );
    case "tradeoff-scale":
      return (
        <TradeoffScale
          frame={frame}
          fps={fps}
          compact={compact}
          {...(props as WithoutRuntime<React.ComponentProps<typeof TradeoffScale>>)}
        />
      );
    case "rough-annotation":
      return (
        <RoughAnnotation
          frame={frame}
          fps={fps}
          {...(props as WithoutRuntime<React.ComponentProps<typeof RoughAnnotation>>)}
        />
      );
  }
};
