import type { ComponentType } from "react";
import {
  DesignTokenLibraryReview,
  LayoutFixtureMatrixReview,
  LayoutTemplateReview,
  layoutReviewDefinitions,
  MigratedDistributionBarsReview,
  MigratedHistoricalTimelineReview,
  MigratedProcessStepsReview,
  MotionPrimitiveLibraryReview,
} from "./AssetLibraryReviews";
import {
  MotionPack2CandidateReview,
  MotionPack2MvpReview,
  MotionRecipeConnectionReview,
  motionPack2ReviewDefinitions,
} from "./MotionPack2Reviews";
import {
  RealMotionPack2MvpReview,
  RealMotionSceneReview,
  realMotionPack2ReviewDefinitions,
} from "./MotionPack2RealScenes";
import {
  AdaptiveAShareScenarioReview,
  AdaptiveMemoryComparisonReview,
  AdaptiveMemoryTrendReview,
  AdaptivePersonEvidenceReview,
  DistributionBarsReview,
  MarketCapLinesReview,
  PersonEvidenceCardReview,
  ScenarioBranchesReview,
} from "./ComponentReviews";
import {
  CapabilitySurfaceGridReview,
  CorePositioningNodeReview,
  DecisionMatrixReview,
  DirectionalTradeoffReview,
  ExpandedBrandIconsReview,
  ExpandedSystemIconsReview,
  HistoricalTimelineReview,
  ModelClassificationMapReview,
  ProgressionTimelineReview,
  QualitativeCapabilitySurfaceReview,
  QualitativeDecisionMatrixReview,
  TradeoffScaleReview,
} from "./FifthBatchReviews";
import {
  CausalChainFiveReview,
  CausalChainMvpReview,
  CausalChainReview,
  ProcessStepsMvpReview,
  ProcessStepsReview,
  ProcessStepsSixReview,
  QuoteSourceMvpReview,
  QuoteSourcePersonReview,
  QuoteSourceReportReview,
} from "./FourthBatchReviews";
import {
  FactorSequenceFiveReview,
  FactorSequenceFourReview,
  FactorSequenceMvpReview,
  FactorSequenceThreeReview,
  IconLibraryReview,
  RankedMetricMvpReview,
  RankedMetricPriceReview,
  RankedMetricScoreReview,
} from "./SecondBatchReviews";
import { SemanticMotionAlignmentReview } from "./SemanticMotionAlignmentReview";
import {
  BinaryVersusMvpReview,
  BinaryVersusReview,
  KeyStatSummaryMvpReview,
  KeyStatSummaryReview,
  KeyStatSummarySingleReview,
  MediaComparisonMvpReview,
  MediaComparisonOneReview,
  MediaComparisonThreeReview,
  MediaComparisonTwoReview,
} from "./ThirdBatchReviews";
import {
  ChartConnectionReview,
  ChartFoundationMvpReview,
  ChartRecipeReview,
  chartReviewDefinitions,
} from "./ChartFoundationReviews";
import {
  IdentityAssetContactSheetReview,
  MediaAssetConnectionReview,
  MediaAssetMvpReview,
  PersonAssetContactSheetReview,
  identityAssetReviewDefinitions,
  personAssetReviewDefinitions,
} from "./MediaAssetReviews";
import {
  ImageEvidenceLandscapeReview,
  ImageEvidenceLongPortraitReview,
  ImageEvidencePortraitReview,
  ImageEvidenceSquareReview,
  ImageEvidenceTransitionReview,
} from "./ImageEvidenceReviews";
import {
  RoughAnnotationEffectReview,
  RoughAnnotationNegationReview,
  RoughAnnotationSequenceReview,
  roughAnnotationReviewDefinitions,
} from "./RoughAnnotationReviews";
import {
  TypographyPolicyAnnotationSceneReview,
  TypographyPolicyDecisionReview,
  TypographyPolicyRealSceneReview,
} from "./TypographyPolicyReviews";
import { HumanReviewGateBeatReview, ProductionProcessBeatReview } from "./VisualBeatCaseReviews";
import { EditorialStatementReview } from "./EditorialStatementReviews";

export type ReviewCompositionDefinition = {
  id: string;
  component: ComponentType;
  durationInFrames: number;
};

const review = (id: string, component: ComponentType, durationInFrames = 360): ReviewCompositionDefinition => ({
  id,
  component,
  durationInFrames,
});

export const reviewCompositions: ReviewCompositionDefinition[] = [
  review("ReviewEditorialStatement", EditorialStatementReview, 180),
  review("ReviewTest2ProductionProcessBeat", ProductionProcessBeatReview, 240),
  review("ReviewTest2HumanReviewGateBeat", HumanReviewGateBeatReview, 180),
  review("ReviewTypographyPolicyDecision", TypographyPolicyDecisionReview, 180),
  review("ReviewTypographyPolicyRealScene", TypographyPolicyRealSceneReview, 180),
  review("ReviewTypographyPolicyAnnotationScene", TypographyPolicyAnnotationSceneReview, 180),
  review("ReviewSemanticMotionAlignment", SemanticMotionAlignmentReview, 720),
  review("ReviewMediaAssetMvp", MediaAssetMvpReview, 720),
  review("ReviewMediaAssetConnection", MediaAssetConnectionReview, 300),
  ...personAssetReviewDefinitions.map(({ id, page }) =>
    review(id, () => <PersonAssetContactSheetReview page={page} />, 180),
  ),
  ...identityAssetReviewDefinitions.map(({ id, page }) =>
    review(id, () => <IdentityAssetContactSheetReview page={page} />, 180),
  ),
  review("ReviewChartFoundationMvp", ChartFoundationMvpReview, 720),
  review("ReviewChartConnection", ChartConnectionReview, 300),
  ...chartReviewDefinitions.map(({ id, recipeId }) =>
    review(
      id,
      ({ backgroundSrc }: { backgroundSrc?: string }) => (
        <ChartRecipeReview recipeId={recipeId} backgroundSrc={backgroundSrc} />
      ),
      240,
    ),
  ),
  review("ReviewRealMotionPack2Mvp", RealMotionPack2MvpReview, 720),
  ...realMotionPack2ReviewDefinitions.map(({ id, sceneId }) =>
    review(id, () => <RealMotionSceneReview sceneId={sceneId} />, 180),
  ),
  review("ReviewMotionRecipeConnection", MotionRecipeConnectionReview, 300),
  review("ReviewMotionPack2Mvp", MotionPack2MvpReview, 360),
  ...motionPack2ReviewDefinitions.map(({ id, primitiveId }) =>
    review(id, () => <MotionPack2CandidateReview primitiveId={primitiveId} />, 300),
  ),
  review("ReviewDesignTokenLibrary", DesignTokenLibraryReview, 300),
  review("ReviewMotionPrimitiveLibrary", MotionPrimitiveLibraryReview, 360),
  review("ReviewLayoutFixtureMatrix", LayoutFixtureMatrixReview, 300),
  ...layoutReviewDefinitions.map(({ id, templateId }) =>
    review(id, () => <LayoutTemplateReview templateId={templateId} />, 300),
  ),
  review("ReviewMigratedDistributionBars", MigratedDistributionBarsReview, 300),
  review("ReviewMigratedProcessSteps", MigratedProcessStepsReview, 300),
  review("ReviewMigratedHistoricalTimeline", MigratedHistoricalTimelineReview, 300),
  review("ReviewDistributionBars", DistributionBarsReview, 300),
  review("ReviewScenarioBranches", ScenarioBranchesReview, 300),
  review("ReviewMarketCapLines", MarketCapLinesReview, 300),
  review("ReviewPersonEvidenceCard", PersonEvidenceCardReview, 300),
  review("ReviewAdaptiveAShareScenario", AdaptiveAShareScenarioReview, 300),
  review("ReviewAdaptiveMemoryComparison", AdaptiveMemoryComparisonReview, 300),
  review("ReviewAdaptiveMemoryTrend", AdaptiveMemoryTrendReview, 300),
  review("ReviewAdaptivePersonEvidence", AdaptivePersonEvidenceReview, 300),
  review("ReviewFactorSequenceThree", FactorSequenceThreeReview),
  review("ReviewFactorSequenceFour", FactorSequenceFourReview),
  review("ReviewFactorSequenceFive", FactorSequenceFiveReview),
  review("ReviewFactorSequenceMvp", FactorSequenceMvpReview),
  review("ReviewRankedMetricPrice", RankedMetricPriceReview),
  review("ReviewRankedMetricScore", RankedMetricScoreReview),
  review("ReviewRankedMetricMvp", RankedMetricMvpReview),
  review("ReviewIconLibrary", IconLibraryReview),
  review("ReviewBinaryVersus", BinaryVersusReview),
  review("ReviewBinaryVersusMvp", BinaryVersusMvpReview),
  review("ReviewKeyStatSummary", KeyStatSummaryReview),
  review("ReviewKeyStatSummarySingle", KeyStatSummarySingleReview),
  review("ReviewKeyStatSummaryMvp", KeyStatSummaryMvpReview),
  review("ReviewMediaComparisonOne", MediaComparisonOneReview),
  review("ReviewMediaComparisonTwo", MediaComparisonTwoReview),
  review("ReviewMediaComparisonThree", MediaComparisonThreeReview),
  review("ReviewMediaComparisonMvp", MediaComparisonMvpReview),
  review("ReviewImageEvidenceLandscape", ImageEvidenceLandscapeReview, 180),
  review("ReviewImageEvidencePortrait", ImageEvidencePortraitReview, 180),
  review("ReviewImageEvidenceSquare", ImageEvidenceSquareReview, 180),
  review("ReviewImageEvidenceLongPortrait", ImageEvidenceLongPortraitReview, 180),
  review("ReviewImageEvidenceTransition", ImageEvidenceTransitionReview, 90),
  review("ReviewProcessSteps", ProcessStepsReview),
  review("ReviewProcessStepsSix", ProcessStepsSixReview),
  review("ReviewProcessStepsMvp", ProcessStepsMvpReview),
  review("ReviewCausalChain", CausalChainReview),
  review("ReviewCausalChainFive", CausalChainFiveReview),
  review("ReviewCausalChainMvp", CausalChainMvpReview),
  review("ReviewQuoteSourceReport", QuoteSourceReportReview),
  review("ReviewQuoteSourcePerson", QuoteSourcePersonReview),
  review("ReviewQuoteSourceMvp", QuoteSourceMvpReview),
  review("ReviewHistoricalTimeline", HistoricalTimelineReview),
  review("ReviewDecisionMatrix", DecisionMatrixReview),
  review("ReviewModelClassificationMap", ModelClassificationMapReview),
  review("ReviewCorePositioningNode", CorePositioningNodeReview),
  review("ReviewCapabilitySurfaceGrid", CapabilitySurfaceGridReview),
  review("ReviewTradeoffScale", TradeoffScaleReview),
  review("ReviewProgressionTimeline", ProgressionTimelineReview),
  review("ReviewQualitativeDecisionMatrix", QualitativeDecisionMatrixReview),
  review("ReviewQualitativeCapabilitySurface", QualitativeCapabilitySurfaceReview),
  review("ReviewDirectionalTradeoff", DirectionalTradeoffReview),
  review("ReviewRoughAnnotationSequence", RoughAnnotationSequenceReview, 252),
  review("ReviewRoughAnnotationNegation", RoughAnnotationNegationReview, 150),
  ...roughAnnotationReviewDefinitions.map(({ id, index }) =>
    review(id, () => <RoughAnnotationEffectReview index={index} />, 120),
  ),
  review("ReviewExpandedBrandIcons", ExpandedBrandIconsReview),
  review("ReviewExpandedSystemIcons", ExpandedSystemIconsReview),
];
