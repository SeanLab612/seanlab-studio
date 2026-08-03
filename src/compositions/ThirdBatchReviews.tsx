import type React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import {
  BinaryVersus,
  type BinaryVersusItem,
  type KeyStatChip,
  type KeyStatItem,
  KeyStatSummary,
  MediaComparison,
  type MediaComparisonItem,
  ReviewStage,
} from "../components/review";

const deploymentOptions: [BinaryVersusItem, BinaryVersusItem] = [
  {
    id: "local",
    iconId: "system.chip",
    eyebrow: "CONTROL",
    label: "本地部署",
    metric: "数据可控",
    detail: "前期投入更高，适合严格合规场景",
    accent: "#59D98E",
  },
  {
    id: "cloud",
    iconId: "system.globe",
    eyebrow: "SPEED",
    label: "云端方案",
    metric: "上线更快",
    detail: "按量付费，适合快速验证需求",
    accent: "#6EA8FF",
  },
];

const educationStats: KeyStatItem[] = [
  { id: "students", value: "1,290万", label: "全国报名考生", detail: "覆盖全国不同地区", accent: "#6EA8FF" },
  { id: "counties", value: "60%", label: "来自县域城镇", detail: "资源可达性影响更明显", accent: "#F3B545" },
];

const evidenceChips: KeyStatChip[] = [
  { id: "coverage", iconId: "system.trophy", text: "县域学生是主要受益者", accent: "#59D98E" },
  { id: "access", iconId: "system.gift", text: "免费使用 · 降低门槛", accent: "#59D98E" },
  { id: "support", iconId: "system.team", text: "覆盖更多学校", accent: "#B59CFF" },
];

const interfaceItems: MediaComparisonItem[] = [
  {
    id: "codex",
    imageSrc: "review-assets/interface-codex.svg",
    iconId: "brand.openai",
    label: "Codex",
    source: "OPENAI",
    caption: "项目与任务工作区",
    accent: "#6EA8FF",
  },
  {
    id: "claude",
    imageSrc: "review-assets/interface-claude.svg",
    iconId: "brand.anthropic",
    label: "Claude",
    source: "ANTHROPIC",
    caption: "对话与协作界面",
    accent: "#F3B545",
  },
  {
    id: "qwen",
    imageSrc: "review-assets/interface-qwen.svg",
    iconId: "brand.qwen",
    label: "Qwen",
    source: "ALIBABA",
    caption: "问答与快捷入口",
    accent: "#B59CFF",
  },
];

export const BinaryVersusReview: React.FC<{ backgroundSrc?: string }> = ({ backgroundSrc }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <ReviewStage
      eyebrow="DEPLOYMENT CHOICE"
      title="本地部署还是云端方案？"
      subtitleZh="两种方案没有绝对优劣，关键在当前约束"
      subtitleEn="The right choice depends on control, speed, and current constraints."
      accent="#59D98E"
      backgroundSrc={backgroundSrc}
      textEmphasis={[
        { phrase: "数据可控", color: "#59D98E" },
        { phrase: "上线更快", color: "#6EA8FF" },
      ]}
    >
      <BinaryVersus
        frame={frame}
        fps={fps}
        items={deploymentOptions}
        relation="VS"
        selectedId="local"
        takeaway="合规优先选本地，验证优先选云端"
      />
    </ReviewStage>
  );
};

export const BinaryVersusMvpReview: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <ReviewStage
      eyebrow="DEPLOYMENT CHOICE"
      title="本地部署还是云端方案？"
      subtitleZh="如果合规优先，就选本地；如果验证优先，就选云端"
      subtitleEn="Choose local for control, or cloud for faster validation."
      accent="#59D98E"
    >
      <BinaryVersus
        frame={frame}
        fps={fps}
        items={deploymentOptions}
        relation="VS"
        selectedId={frame > 210 ? "cloud" : undefined}
        takeaway="选择取决于当前最重要的约束"
      />
    </ReviewStage>
  );
};

export const KeyStatSummaryReview: React.FC<{ backgroundSrc?: string }> = ({ backgroundSrc }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <ReviewStage
      eyebrow="NATIONAL REACH"
      title="两组数字，说明真正的覆盖人群"
      subtitleZh="报名规模很大，而县域学生占到了六成"
      subtitleEn="The scale is national, with county students forming the majority."
      accent="#6EA8FF"
      backgroundSrc={backgroundSrc}
      textEmphasis={[
        { phrase: "1,290万", color: "#6EA8FF" },
        { phrase: "60%", color: "#F3B545" },
      ]}
    >
      <KeyStatSummary
        frame={frame}
        fps={fps}
        items={educationStats}
        conclusion="县域学生 = 最大受益群体"
        chips={evidenceChips}
      />
    </ReviewStage>
  );
};

export const KeyStatSummarySingleReview: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <ReviewStage
      eyebrow="KEY RESULT"
      title="一个数字，直接承载核心结论"
      subtitleZh="主峰纯度达到百分之九十八点一"
      subtitleEn="Main-peak purity reached 98.1 percent."
      accent="#59D98E"
    >
      <KeyStatSummary
        frame={frame}
        fps={fps}
        items={[{ id: "purity", value: "98.1%", label: "主峰纯度", detail: "本批次检测结果", accent: "#59D98E" }]}
        conclusion="达到当前放行标准"
        chips={[{ id: "lab", iconId: "system.chip", text: "HPLC 检测", accent: "#6EA8FF" }]}
      />
    </ReviewStage>
  );
};

export const KeyStatSummaryMvpReview: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <ReviewStage
      eyebrow="NATIONAL REACH"
      title="报名规模背后，谁是主要受益者？"
      subtitleZh="全国报名人数达到一千二百九十万，其中县域学生占六成"
      subtitleEn="There are 12.9 million applicants, and 60 percent come from county areas."
      accent="#6EA8FF"
    >
      <KeyStatSummary
        frame={frame}
        fps={fps}
        items={educationStats}
        conclusion="县域学生 = 最大受益群体"
        chips={evidenceChips}
      />
    </ReviewStage>
  );
};

const MediaReview: React.FC<{ count: 1 | 2 | 3; backgroundSrc?: string }> = ({ count, backgroundSrc }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <ReviewStage
      eyebrow="AI PRODUCT INTERFACES"
      title={`${count} 个产品界面，背后能力各不相同`}
      subtitleZh="界面看起来相似，背后的产品定位并不相同"
      subtitleEn="Similar shells can still represent different products and models."
      accent="#B59CFF"
      backgroundSrc={backgroundSrc}
      textEmphasis={[
        { phrase: "相似界面", color: "#B59CFF" },
        { phrase: "相同能力", color: "#FF626B" },
      ]}
    >
      <MediaComparison
        frame={frame}
        fps={fps}
        items={interfaceItems.slice(0, count)}
        relation={count === 1 ? "=" : "≠"}
        takeaway={count === 1 ? "界面截图作为当前论点的直接证据" : "相似界面 ≠ 相同能力"}
      />
    </ReviewStage>
  );
};

export const MediaComparisonOneReview: React.FC = () => <MediaReview count={1} />;
export const MediaComparisonTwoReview: React.FC<{ backgroundSrc?: string }> = ({ backgroundSrc }) => (
  <MediaReview count={2} backgroundSrc={backgroundSrc} />
);
export const MediaComparisonThreeReview: React.FC<{ backgroundSrc?: string }> = ({ backgroundSrc }) => (
  <MediaReview count={3} backgroundSrc={backgroundSrc} />
);
export const MediaComparisonMvpReview: React.FC = () => <MediaReview count={3} />;
