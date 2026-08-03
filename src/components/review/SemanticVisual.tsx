import type React from "react";
import { BinaryVersus } from "./BinaryVersus";
import { CausalChain } from "./CausalChain";
import { DistributionBars } from "./DistributionBars";
import { FactorSequence } from "./FactorSequence";
import {
  CapabilitySurfaceGrid,
  DecisionMatrix,
  HistoricalTimeline,
  ModelClassificationMap,
  TradeoffScale,
} from "./FifthComponents";
import { KeyStatSummary } from "./KeyStatSummary";
import { MarketCapLines } from "./MarketCapLines";
import { MediaComparison } from "./MediaComparison";
import { ImageEvidenceInset } from "./ImageEvidenceInset";
import { PersonEvidenceCard } from "./PersonEvidenceCard";
import { ProcessSteps } from "./ProcessSteps";
import { QuoteSourceCard } from "./QuoteSourceCard";
import { RankedMetricList } from "./RankedMetricList";
import { ScenarioBranches } from "./ScenarioBranches";
import { selectReviewComponent, type VisualAnalysis } from "./selection";

type WithoutRuntime<T> = Omit<T, "frame" | "fps">;

export type SemanticVisualProps = {
  frame: number;
  fps: number;
  analysis: VisualAnalysis;
  distribution?: WithoutRuntime<React.ComponentProps<typeof DistributionBars>>;
  scenario?: WithoutRuntime<React.ComponentProps<typeof ScenarioBranches>>;
  lines?: WithoutRuntime<React.ComponentProps<typeof MarketCapLines>>;
  person?: WithoutRuntime<React.ComponentProps<typeof PersonEvidenceCard>>;
  factors?: WithoutRuntime<React.ComponentProps<typeof FactorSequence>>;
  ranking?: WithoutRuntime<React.ComponentProps<typeof RankedMetricList>>;
  binary?: WithoutRuntime<React.ComponentProps<typeof BinaryVersus>>;
  keyStats?: WithoutRuntime<React.ComponentProps<typeof KeyStatSummary>>;
  media?: WithoutRuntime<React.ComponentProps<typeof MediaComparison>>;
  imageEvidence?: WithoutRuntime<React.ComponentProps<typeof ImageEvidenceInset>>;
  process?: WithoutRuntime<React.ComponentProps<typeof ProcessSteps>>;
  causal?: WithoutRuntime<React.ComponentProps<typeof CausalChain>>;
  quote?: WithoutRuntime<React.ComponentProps<typeof QuoteSourceCard>>;
  timeline?: WithoutRuntime<React.ComponentProps<typeof HistoricalTimeline>>;
  matrix?: WithoutRuntime<React.ComponentProps<typeof DecisionMatrix>>;
  classification?: WithoutRuntime<React.ComponentProps<typeof ModelClassificationMap>>;
  capability?: WithoutRuntime<React.ComponentProps<typeof CapabilitySurfaceGrid>>;
  tradeoff?: WithoutRuntime<React.ComponentProps<typeof TradeoffScale>>;
};

export const SemanticVisual: React.FC<SemanticVisualProps> = ({
  frame,
  fps,
  analysis,
  distribution,
  scenario,
  lines,
  person,
  factors,
  ranking,
  binary,
  keyStats,
  media,
  imageEvidence,
  process,
  causal,
  quote,
  timeline,
  matrix,
  classification,
  capability,
  tradeoff,
}) => {
  const decision = selectReviewComponent(analysis);

  switch (decision.componentId) {
    case "scenario-branches":
      return scenario ? <ScenarioBranches frame={frame} fps={fps} {...scenario} /> : null;
    case "market-cap-lines":
      return lines ? <MarketCapLines frame={frame} fps={fps} {...lines} /> : null;
    case "person-evidence-card":
      return person ? <PersonEvidenceCard frame={frame} fps={fps} {...person} /> : null;
    case "factor-sequence":
      return factors ? <FactorSequence frame={frame} fps={fps} {...factors} /> : null;
    case "ranked-metric-list":
      return ranking ? <RankedMetricList frame={frame} fps={fps} {...ranking} /> : null;
    case "binary-versus":
      return binary ? <BinaryVersus frame={frame} fps={fps} {...binary} /> : null;
    case "key-stat-summary":
      return keyStats ? <KeyStatSummary frame={frame} fps={fps} {...keyStats} /> : null;
    case "media-comparison":
      return media ? <MediaComparison frame={frame} fps={fps} {...media} /> : null;
    case "image-evidence-inset":
      return imageEvidence ? <ImageEvidenceInset frame={frame} fps={fps} {...imageEvidence} /> : null;
    case "process-steps":
      return process ? <ProcessSteps frame={frame} fps={fps} {...process} /> : null;
    case "causal-chain":
      return causal ? <CausalChain frame={frame} fps={fps} {...causal} /> : null;
    case "quote-source-card":
      return quote ? <QuoteSourceCard frame={frame} fps={fps} {...quote} /> : null;
    case "historical-timeline":
      return timeline ? <HistoricalTimeline frame={frame} fps={fps} {...timeline} /> : null;
    case "decision-matrix":
      return matrix ? <DecisionMatrix frame={frame} fps={fps} {...matrix} /> : null;
    case "model-classification-map":
      return classification ? <ModelClassificationMap frame={frame} fps={fps} {...classification} /> : null;
    case "capability-surface-grid":
      return capability ? <CapabilitySurfaceGrid frame={frame} fps={fps} {...capability} /> : null;
    case "tradeoff-scale":
      return tradeoff ? <TradeoffScale frame={frame} fps={fps} {...tradeoff} /> : null;
    case "distribution-bars":
      return distribution ? (
        <DistributionBars
          frame={frame}
          fps={fps}
          {...distribution}
          populationRow={decision.modules.populationRow ? distribution.populationRow : null}
        />
      ) : null;
  }
};
