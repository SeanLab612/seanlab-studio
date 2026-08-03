import { composeNarrationScript } from "../creator-workflow/contract.ts";
import type { NarrationScriptPackage } from "../creator-workflow/types.ts";
import type { TopicRegressionExpectation, TopicRegressionFixture, TopicRegressionSuite } from "./topic-suite.ts";

type Section = NarrationScriptPackage["sections"][number];

const makeNarration = (input: {
  title: string;
  overview: string;
  sections: Section[];
  conclusion: string;
  shootingGuide?: string[];
}): NarrationScriptPackage => {
  const narration: NarrationScriptPackage = {
    schemaVersion: "1.0",
    title: input.title,
    opening: "这件事为什么值得现在讨论？",
    overview: input.overview,
    sections: input.sections,
    conclusion: input.conclusion,
    fullScript: "",
    shootingGuide: input.shootingGuide ?? ["正对镜头自然讲述；涉及登记素材时停顿半秒，方便后续对齐。"],
  };
  narration.fullScript = composeNarrationScript(narration);
  return narration;
};

const timing = { maxLeadSeconds: 0.5, maxTrailSeconds: 0.8 };
const expectation = (
  value: Omit<TopicRegressionExpectation, "requirement" | "forbidden" | "polarity" | "timing"> &
    Partial<Pick<TopicRegressionExpectation, "requirement" | "forbidden" | "polarity" | "timing">>,
): TopicRegressionExpectation => ({
  requirement: "required",
  forbidden: [],
  polarity: "affirmed",
  timing,
  ...value,
});

const officialKimiBlog = "https://www.kimi.com/fr-fr/blog/kimi-k3";
const officialKimiModels = "https://www.kimi.com/code/docs/en/kimi-code/models.html";
const officialKimiChanges = "https://www.kimi.com/code/docs/en/kimi-code/whats-new.html";
const deepSwe = "https://deepswe.datacurve.ai/";
const nasaKoch = "https://www.nasa.gov/people/christina-koch/";
const nasaPortrait = "https://www.nasa.gov/image-article/nasa-astronaut-christina-koch/";
const nasaUsage = "https://www.nasa.gov/nasa-brand-center/images-and-media/";
const projectReadme = "https://github.com/SeanLab612/video-remotion/blob/main/README.md";

const modelBenchmark: TopicRegressionFixture = {
  id: "model-benchmark-real",
  title: "真实模型榜单、成本与版本变化",
  purpose: "验证排名、分布、重点数字、同口径版本变化和发布日期节点。",
  sourceFacts: [
    {
      id: "deepswe-board",
      text: "DeepSWE v1.1 于 2026-07-17 更新，113 个任务统一使用 mini-swe-agent；GPT-5.6 Sol max 为 73%±3%，Claude Fable 5 max 为 70%±4%，Kimi K3 max 为 69%±5%，Kimi K2.7 Code 为 31%±1%。",
      sourceUrl: deepSwe,
      accessedAt: "2026-07-19",
      sourceType: "independent-benchmark",
    },
    {
      id: "deepswe-cost",
      text: "同一榜单列出的平均每任务成本依次包括 GPT-5.6 Sol 8.39 美元、Claude Fable 5 21.63 美元、Kimi K3 4.65 美元、Kimi K2.7 Code 2.82 美元。",
      sourceUrl: deepSwe,
      accessedAt: "2026-07-19",
      sourceType: "independent-benchmark",
    },
    {
      id: "kimi-release-dates",
      text: "Kimi Code 更新记录显示 Kimi K2.7 Code 于 2026-06-12 发布，Kimi K3 于 2026-07-16 发布。",
      sourceUrl: officialKimiChanges,
      accessedAt: "2026-07-19",
      sourceType: "official-documentation",
    },
  ],
  materials: [
    {
      id: "deepswe-score-card",
      kind: "image",
      path: "regression-fixtures/topics/assets/deepswe-score-card.svg",
      sha256: "1400f6d427e1bb35ae67a6355c36c080735cd67091a620d65d37685d0d8644c5",
      description: "Project-authored factual rendering of selected DeepSWE v1.1 rows.",
      rights: "Original project layout containing attributed public benchmark facts; no third-party page artwork.",
      provenance: "Authored from the DeepSWE official leaderboard accessed 2026-07-19.",
      redistributable: true,
    },
  ],
  narration: makeNarration({
    title: "同一张榜单里，模型分数和成本怎么看",
    overview: "这次不凭印象聊模型，而是只看 DeepSWE 同一版榜单里的公开结果，再看看 Kimi K3 放在什么位置。",
    sections: [
      {
        id: "score-ranking",
        title: "同口径排名",
        narration:
          "按通过率从高到低看，GPT-5.6 Sol 是百分之七十三，Claude Fable 5 是百分之七十，Kimi K3 是百分之六十九，Kimi K2.7 Code 是百分之三十一。",
        visualIntent: "screenshot",
        visualOpportunities: [
          {
            form: "ranking-or-distribution",
            evidenceText:
              "按通过率从高到低看，GPT-5.6 Sol 是百分之七十三，Claude Fable 5 是百分之七十，Kimi K3 是百分之六十九，Kimi K2.7 Code 是百分之三十一。",
          },
        ],
        materialIds: ["deepswe-score-card"],
        recordingInstruction: "展示项目制作的 DeepSWE 数据卡，不展示第三方网页界面。",
      },
      {
        id: "cost-distribution",
        title: "成本差异",
        narration:
          "成本差异也很明显。每个任务的平均成本，Claude 是二十一点六三美元，GPT 是八点三九美元，Kimi K3 是四点六五美元，K2.7 是二点八二美元。",
        visualIntent: "semantic-visual",
        visualOpportunities: [
          {
            form: "ranking-or-distribution",
            evidenceText:
              "每个任务的平均成本，Claude 是二十一点六三美元，GPT 是八点三九美元，Kimi K3 是四点六五美元，K2.7 是二点八二美元。",
          },
        ],
        materialIds: [],
        recordingInstruction: null,
      },
      {
        id: "k3-key-stat",
        title: "关键数字",
        narration: "这里最值得单独记住的数字，是 Kimi K3 在这张榜单上拿到百分之六十九，和第一名只差四个百分点。",
        visualIntent: "semantic-visual",
        visualOpportunities: [
          { form: "number-focus", evidenceText: "Kimi K3 在这张榜单上拿到百分之六十九，和第一名只差四个百分点。" },
        ],
        materialIds: [],
        recordingInstruction: null,
      },
      {
        id: "kimi-version-change",
        title: "同口径版本变化",
        narration: "如果只看 Kimi 自己的两个连续版本，同一版 DeepSWE 里，K2.7 是百分之三十一，K3 是百分之六十九。",
        visualIntent: "semantic-visual",
        visualOpportunities: [
          { form: "change-over-time", evidenceText: "同一版 DeepSWE 里，K2.7 是百分之三十一，K3 是百分之六十九。" },
        ],
        materialIds: [],
        recordingInstruction: null,
      },
      {
        id: "release-milestones",
        title: "发布时间节点",
        narration: "时间上，K2.7 Code 是六月十二日发布，Kimi K3 是七月十六日发布，中间相隔大约一个月。",
        visualIntent: "semantic-visual",
        visualOpportunities: [
          {
            form: "dated-milestones",
            evidenceText: "K2.7 Code 是六月十二日发布，Kimi K3 是七月十六日发布，中间相隔大约一个月。",
          },
        ],
        materialIds: [],
        recordingInstruction: null,
      },
    ],
    conclusion: "所以分数、成本和发布时间要放在各自的口径里看，不能只截一个数字就宣布谁全面更强。",
  }),
  expectations: [
    expectation({
      id: "rank-models",
      sectionId: "score-ranking",
      form: "ranking-or-distribution",
      evidenceText:
        "按通过率从高到低看，GPT-5.6 Sol 是百分之七十三，Claude Fable 5 是百分之七十，Kimi K3 是百分之六十九，Kimi K2.7 Code 是百分之三十一。",
      sourceIds: ["deepswe-board"],
      expectedOneOf: ["ranked-metric-list"],
      expectedIconIds: ["brand.openai", "brand.anthropic", "brand.kimi"],
      materialId: "deepswe-score-card",
      forbidden: ["historical-timeline"],
    }),
    expectation({
      id: "compare-costs",
      sectionId: "cost-distribution",
      form: "ranking-or-distribution",
      evidenceText:
        "每个任务的平均成本，Claude 是二十一点六三美元，GPT 是八点三九美元，Kimi K3 是四点六五美元，K2.7 是二点八二美元。",
      sourceIds: ["deepswe-cost"],
      expectedOneOf: ["distribution-bars"],
      expectedIconIds: ["brand.openai", "brand.anthropic", "brand.kimi"],
    }),
    expectation({
      id: "focus-k3-score",
      sectionId: "k3-key-stat",
      form: "number-focus",
      evidenceText: "Kimi K3 在这张榜单上拿到百分之六十九，和第一名只差四个百分点。",
      sourceIds: ["deepswe-board"],
      expectedOneOf: ["key-stat-summary"],
      expectedIconIds: ["brand.kimi"],
    }),
    expectation({
      id: "show-version-change",
      sectionId: "kimi-version-change",
      form: "change-over-time",
      evidenceText: "同一版 DeepSWE 里，K2.7 是百分之三十一，K3 是百分之六十九。",
      sourceIds: ["deepswe-board"],
      expectedOneOf: ["market-cap-lines"],
      expectedIconIds: ["brand.kimi"],
    }),
    expectation({
      id: "show-release-dates",
      sectionId: "release-milestones",
      form: "dated-milestones",
      evidenceText: "K2.7 Code 是六月十二日发布，Kimi K3 是七月十六日发布，中间相隔大约一个月。",
      sourceIds: ["kimi-release-dates"],
      expectedOneOf: ["historical-timeline"],
      expectedIconIds: ["brand.kimi"],
    }),
  ],
};

const modelChoice: TopicRegressionFixture = {
  id: "model-choice-real",
  title: "基于真实参数和榜单的模型选择",
  purpose: "验证双向对比、条件分支、决策矩阵和取舍表达。",
  sourceFacts: [
    {
      id: "kimi-context",
      text: "Kimi Code 官方文档列出 Kimi K3 最高 1M 上下文，Kimi K2.7 Code 为 256k。",
      sourceUrl: officialKimiModels,
      accessedAt: "2026-07-19",
      sourceType: "official-documentation",
    },
    {
      id: "kimi-membership",
      text: "官方文档显示 Moderato 的 K3 上下文为 256k，Allegretto 及以上最高 1M。",
      sourceUrl: officialKimiModels,
      accessedAt: "2026-07-19",
      sourceType: "official-documentation",
    },
    {
      id: "model-score-cost",
      text: "DeepSWE v1.1 中 GPT-5.6 Sol max 为 73%且平均 8.39 美元，Claude Fable 5 max 为 70%且平均 21.63 美元，Kimi K3 max 为 69%且平均 4.65 美元。",
      sourceUrl: deepSwe,
      accessedAt: "2026-07-19",
      sourceType: "independent-benchmark",
    },
  ],
  materials: [],
  narration: makeNarration({
    title: "模型选择不是只看第一名",
    overview: "我们把任务长度、会员条件、通过率和平均成本放在一起，看看不同需求下怎么选。",
    sections: [
      {
        id: "context-contrast",
        title: "上下文对比",
        narration:
          "只看上下文上限，Kimi K3 最高可以到一百万，K2.7 Code 是二十五万六千。一个适合特别长的任务，一个更适合常规代码工作。",
        visualIntent: "semantic-visual",
        visualOpportunities: [
          {
            form: "two-way-contrast",
            evidenceText:
              "Kimi K3 最高可以到一百万，K2.7 Code 是二十五万六千。一个适合特别长的任务，一个更适合常规代码工作。",
          },
        ],
        materialIds: [],
        recordingInstruction: null,
      },
      {
        id: "membership-branches",
        title: "使用条件",
        narration: "如果是 Moderato 会员，K3 的上下文还是二十五万六千；只有 Allegretto 或更高等级，才开放最高一百万。",
        visualIntent: "semantic-visual",
        visualOpportunities: [
          {
            form: "conditional-outcomes",
            evidenceText:
              "如果是 Moderato 会员，K3 的上下文还是二十五万六千；只有 Allegretto 或更高等级，才开放最高一百万。",
          },
        ],
        materialIds: [],
        recordingInstruction: null,
      },
      {
        id: "decision-grid",
        title: "多维选择",
        narration: "要最高通过率，可以看 GPT；更在意同榜单成本，Kimi K3 更低；Claude 的分数接近，但这次平均成本最高。",
        visualIntent: "semantic-visual",
        visualOpportunities: [
          {
            form: "tradeoff-or-positioning",
            evidenceText:
              "要最高通过率，可以看 GPT；更在意同榜单成本，Kimi K3 更低；Claude 的分数接近，但这次平均成本最高。",
          },
        ],
        materialIds: [],
        recordingInstruction: null,
      },
      {
        id: "score-cost-tradeoff",
        title: "分数与成本",
        narration: "从百分之六十九提高到百分之七十三，只增加了四个百分点，但平均成本从四点六五美元变成八点三九美元。",
        visualIntent: "semantic-visual",
        visualOpportunities: [
          {
            form: "tradeoff-or-positioning",
            evidenceText:
              "从百分之六十九提高到百分之七十三，只增加了四个百分点，但平均成本从四点六五美元变成八点三九美元。",
          },
        ],
        materialIds: [],
        recordingInstruction: null,
      },
    ],
    conclusion: "这不是给模型排一个永久名次，而是把你的任务放进相同口径里做选择。",
  }),
  expectations: [
    expectation({
      id: "contrast-context",
      sectionId: "context-contrast",
      form: "two-way-contrast",
      evidenceText:
        "Kimi K3 最高可以到一百万，K2.7 Code 是二十五万六千。一个适合特别长的任务，一个更适合常规代码工作。",
      sourceIds: ["kimi-context"],
      expectedOneOf: ["binary-versus"],
      expectedIconIds: ["brand.kimi"],
    }),
    expectation({
      id: "branch-membership",
      sectionId: "membership-branches",
      form: "conditional-outcomes",
      evidenceText: "如果是 Moderato 会员，K3 的上下文还是二十五万六千；只有 Allegretto 或更高等级，才开放最高一百万。",
      sourceIds: ["kimi-membership"],
      expectedOneOf: ["scenario-branches"],
      expectedIconIds: ["brand.kimi"],
    }),
    expectation({
      id: "choose-by-needs",
      sectionId: "decision-grid",
      form: "tradeoff-or-positioning",
      evidenceText: "要最高通过率，可以看 GPT；更在意同榜单成本，Kimi K3 更低；Claude 的分数接近，但这次平均成本最高。",
      sourceIds: ["model-score-cost"],
      expectedOneOf: ["decision-matrix"],
      expectedIconIds: ["brand.openai", "brand.anthropic", "brand.kimi"],
    }),
    expectation({
      id: "balance-score-cost",
      sectionId: "score-cost-tradeoff",
      form: "tradeoff-or-positioning",
      evidenceText: "从百分之六十九提高到百分之七十三，只增加了四个百分点，但平均成本从四点六五美元变成八点三九美元。",
      sourceIds: ["model-score-cost"],
      expectedOneOf: ["tradeoff-scale"],
      expectedIconIds: ["brand.openai", "brand.kimi"],
    }),
  ],
};

const kimiArchitecture: TopicRegressionFixture = {
  id: "kimi-architecture-real",
  title: "Kimi K3 架构和能力分类",
  purpose: "验证分类地图与多维能力面板。",
  sourceFacts: [
    {
      id: "k3-architecture",
      text: "Kimi 官方发布页称 K3 为 2.8T 参数模型，使用 KDA、Attention Residuals 和 Stable LatentMoE，每次激活 896 个专家中的 16 个。",
      sourceUrl: officialKimiBlog,
      accessedAt: "2026-07-19",
      sourceType: "official-publisher",
    },
    {
      id: "k3-capabilities",
      text: "Kimi 官方将 K3 能力展示为长时编程、知识工作和原生视觉等方向，并列出最高 1M 上下文。",
      sourceUrl: officialKimiBlog,
      accessedAt: "2026-07-19",
      sourceType: "official-publisher",
    },
  ],
  materials: [
    {
      id: "kimi-k3-fact-card",
      kind: "image",
      path: "regression-fixtures/topics/assets/kimi-k3-fact-card.svg",
      sha256: "ae451cbaf429fbbdecd3fde8998a54bb0adb71fce9bca1fe564bd665032d1d34",
      description: "Project-authored Kimi K3 fact card.",
      rights: "Original project layout containing attributed official facts.",
      provenance: "Authored from Kimi official release and model documentation accessed 2026-07-19.",
      redistributable: true,
    },
  ],
  narration: makeNarration({
    title: "Kimi K3 到底把能力放在了哪里",
    overview: "我们不把参数规模直接等同于效果，只按官方资料拆开看它的结构和能力方向。",
    sections: [
      {
        id: "architecture-facts",
        title: "架构维度",
        narration: "Kimi K3 的总参数是二点八万亿，最高上下文是一百万，同时每次从八百九十六个专家里激活十六个。",
        visualIntent: "screenshot",
        visualOpportunities: [
          {
            form: "multi-dimension-comparison",
            evidenceText: "Kimi K3 的总参数是二点八万亿，最高上下文是一百万，同时每次从八百九十六个专家里激活十六个。",
          },
        ],
        materialIds: ["kimi-k3-fact-card"],
        recordingInstruction: "展示项目制作的 Kimi K3 官方事实卡。",
      },
      {
        id: "capability-categories",
        title: "能力分类",
        narration:
          "从官方案例来看，可以把它的能力分成三类：长时间编程、知识工作，还有文字和图像视频一起理解的原生视觉。",
        visualIntent: "semantic-visual",
        visualOpportunities: [
          {
            form: "category-map",
            evidenceText: "可以把它的能力分成三类：长时间编程、知识工作，还有文字和图像视频一起理解的原生视觉。",
          },
        ],
        materialIds: [],
        recordingInstruction: null,
      },
    ],
    conclusion: "这些是官方资料给出的能力边界，真正适不适合你的任务，还要回到同口径测试。",
  }),
  expectations: [
    expectation({
      id: "show-architecture-dimensions",
      sectionId: "architecture-facts",
      form: "multi-dimension-comparison",
      evidenceText: "Kimi K3 的总参数是二点八万亿，最高上下文是一百万，同时每次从八百九十六个专家里激活十六个。",
      sourceIds: ["k3-architecture"],
      expectedOneOf: ["capability-surface-grid"],
      expectedIconIds: ["brand.kimi"],
      materialId: "kimi-k3-fact-card",
    }),
    expectation({
      id: "classify-capabilities",
      sectionId: "capability-categories",
      form: "category-map",
      evidenceText: "可以把它的能力分成三类：长时间编程、知识工作，还有文字和图像视频一起理解的原生视觉。",
      sourceIds: ["k3-capabilities"],
      expectedOneOf: ["model-classification-map"],
      expectedIconIds: ["brand.kimi"],
    }),
  ],
};

const seanlabWorkflow: TopicRegressionFixture = {
  id: "seanlab-workflow-real",
  title: "SeanLab Video 真实本地工作流",
  purpose: "验证流程、因素、因果和核心定位结构，并确认 SeanLab 自有图标解析。",
  sourceFacts: [
    {
      id: "seanlab-stages",
      text: "README 将主流程描述为创建、写稿、拍摄、视频制作、审核和交付，并要求静态审核先于最终渲染。",
      sourceUrl: projectReadme,
      accessedAt: "2026-07-19",
      sourceType: "local-project",
    },
    {
      id: "seanlab-determinism",
      text: "README 说明 Agent 负责受约束的语义理解，本地系统负责组件选择后的物化、布局、QA、渲染和恢复。",
      sourceUrl: projectReadme,
      accessedAt: "2026-07-19",
      sourceType: "local-project",
    },
    {
      id: "seanlab-evidence",
      text: "README 要求图片和录屏先登记，静态风险帧先审核，连续 720p 预览用于检查节奏和时间对齐。",
      sourceUrl: projectReadme,
      accessedAt: "2026-07-19",
      sourceType: "local-project",
    },
  ],
  materials: [],
  narration: makeNarration({
    title: "SeanLab Video 为什么要把制作拆成一条流程",
    overview: "这套项目不是按一下就直接出片，而是把每个容易出错的位置都留下检查点。",
    sections: [
      {
        id: "workflow-stages",
        title: "完整流程",
        narration: "整个项目依次经过创建、写稿、拍摄、视频制作、审核和交付。前一步留下结果，后一步再继续使用。",
        visualIntent: "semantic-visual",
        visualOpportunities: [
          { form: "ordered-progression", evidenceText: "整个项目依次经过创建、写稿、拍摄、视频制作、审核和交付。" },
        ],
        materialIds: [],
        recordingInstruction: null,
      },
      {
        id: "quality-factors",
        title: "质量因素",
        narration: "一条视频能不能稳定完成，至少要同时看口播证据、素材登记、组件容量、画面安全和任务恢复。",
        visualIntent: "semantic-visual",
        visualOpportunities: [
          {
            form: "progressive-explanation",
            evidenceText: "至少要同时看口播证据、素材登记、组件容量、画面安全和任务恢复。",
          },
        ],
        materialIds: [],
        recordingInstruction: null,
      },
      {
        id: "approval-cause",
        title: "先审核再渲染",
        narration: "先检查静态风险帧，再看连续七百二十 P 预览，能在完整渲染之前发现布局和时间问题，也就减少了返工。",
        visualIntent: "semantic-visual",
        visualOpportunities: [
          {
            form: "cause-to-result",
            evidenceText:
              "先检查静态风险帧，再看连续七百二十 P 预览，能在完整渲染之前发现布局和时间问题，也就减少了返工。",
          },
        ],
        materialIds: [],
        recordingInstruction: null,
      },
      {
        id: "responsibility-core",
        title: "职责中心",
        narration:
          "它的中心原则是，Agent 负责理解内容，本地系统负责稳定完成制作。组件、布局、检查和渲染都不交给模型临场发挥。",
        visualIntent: "semantic-visual",
        visualOpportunities: [
          {
            form: "core-and-supports",
            evidenceText:
              "中心原则是，Agent 负责理解内容，本地系统负责稳定完成制作。组件、布局、检查和渲染都不交给模型临场发挥。",
          },
        ],
        materialIds: [],
        recordingInstruction: null,
      },
    ],
    conclusion: "所以 SeanLab Video 真正解决的不是某一个动画，而是让整条制作过程可检查、可恢复。",
  }),
  expectations: [
    expectation({
      id: "show-workflow",
      sectionId: "workflow-stages",
      form: "ordered-progression",
      evidenceText: "整个项目依次经过创建、写稿、拍摄、视频制作、审核和交付。",
      sourceIds: ["seanlab-stages"],
      expectedOneOf: ["process-steps"],
      expectedIconIds: ["system.flow"],
    }),
    expectation({
      id: "show-quality-factors",
      sectionId: "quality-factors",
      form: "progressive-explanation",
      evidenceText: "至少要同时看口播证据、素材登记、组件容量、画面安全和任务恢复。",
      sourceIds: ["seanlab-evidence"],
      expectedOneOf: ["factor-sequence"],
      expectedIconIds: ["system.flow"],
    }),
    expectation({
      id: "show-approval-cause",
      sectionId: "approval-cause",
      form: "cause-to-result",
      evidenceText: "先检查静态风险帧，再看连续七百二十 P 预览，能在完整渲染之前发现布局和时间问题，也就减少了返工。",
      sourceIds: ["seanlab-stages", "seanlab-evidence"],
      expectedOneOf: ["causal-chain"],
      expectedIconIds: ["system.flow"],
    }),
  ],
};

const evidenceMethods: TopicRegressionFixture = {
  id: "evidence-methods-real",
  title: "真实人物、官方来源与两类模型证据",
  purpose: "验证人物、图片、引用和登记录屏证据。",
  sourceFacts: [
    {
      id: "koch-record",
      text: "NASA 官方资料记载 Christina Koch 2013 年成为宇航员，并创下女性单次太空飞行 328 天纪录。",
      sourceUrl: nasaKoch,
      accessedAt: "2026-07-19",
      sourceType: "official-publisher",
    },
    {
      id: "koch-portrait",
      text: "NASA 图片页将 jsc2018e095073 标注为 Christina Koch 的官方肖像。",
      sourceUrl: nasaPortrait,
      accessedAt: "2026-07-19",
      sourceType: "official-publisher",
    },
    {
      id: "nasa-media-rights",
      text: "NASA 说明其内容通常可用于教育或信息用途，但必须注明来源、不得暗示 NASA 背书，并注意可识别人物的商业使用限制。",
      sourceUrl: nasaUsage,
      accessedAt: "2026-07-19",
      sourceType: "official-documentation",
    },
    {
      id: "two-model-sources",
      text: "Kimi 官方资料提供模型参数和产品信息，DeepSWE 独立榜单提供同一任务口径下的通过率和成本，两种证据不能互相替代。",
      sourceUrl: officialKimiBlog,
      accessedAt: "2026-07-19",
      sourceType: "official-publisher",
    },
    {
      id: "two-model-sources-benchmark",
      text: "DeepSWE 独立榜单统一使用 mini-swe-agent 运行 113 个任务。",
      sourceUrl: deepSwe,
      accessedAt: "2026-07-19",
      sourceType: "independent-benchmark",
    },
  ],
  materials: [
    {
      id: "koch-landing-photo",
      kind: "person",
      path: "regression-fixtures/topics/assets/christina-koch-landing-nasa.jpg",
      sha256: "a03c060e462d8c3c07a4b9a11505a3b8c2087c627a2cec2863e100166f70edc5",
      description: "NASA photograph of Christina Koch after returning from her 328-day mission.",
      rights: "NASA informational use only; credit NASA; no endorsement; not for promotional use.",
      provenance: "Ingested from the NASA official site on 2026-07-19; original photo credit NASA/Bill Ingalls.",
      redistributable: true,
    },
    {
      id: "koch-official-portrait",
      kind: "person",
      path: "regression-fixtures/topics/assets/christina-koch-nasa.jpg",
      sha256: "b7add233cec2b5810a7fc0d68d3af2e5a1a8feb90424081f486053cc6a3dd3a2",
      description: "NASA official portrait of Christina Koch.",
      rights: "NASA informational use only; credit NASA; no endorsement; not for promotional use.",
      provenance: "Ingested from the NASA official image page on 2026-07-19.",
      redistributable: true,
    },
    {
      id: "kimi-evidence-recording",
      kind: "screen-recording",
      path: "regression-fixtures/topics/assets/kimi-evidence-comparison.mp4",
      sha256: "ab2a6741eb0de1d826f1f40eaa5a1ae43ac3458dcb5de0ce3cc7827b4e371e4e",
      description: "Original 5.5-second transition between project-authored Kimi fact and DeepSWE score cards.",
      rights: "Original project recording containing attributed factual cards.",
      provenance: "Generated locally from project-authored SVG cards on 2026-07-19.",
      redistributable: true,
    },
  ],
  narration: makeNarration({
    title: "同一句结论，应该配什么证据",
    overview: "人物、官方说明和独立榜单证明的事情不同，素材不能因为好看就互相替代。",
    sections: [
      {
        id: "person-record",
        title: "人物证据",
        narration:
          "NASA 的官方资料写得很清楚，Christina Koch 完成了连续三百二十八天的太空任务，创下女性单次太空飞行纪录。",
        visualIntent: "screenshot",
        visualOpportunities: [
          {
            form: "source-backed-evidence",
            evidenceText:
              "NASA 的官方资料写得很清楚，Christina Koch 完成了连续三百二十八天的太空任务，创下女性单次太空飞行纪录。",
          },
        ],
        materialIds: ["koch-landing-photo"],
        recordingInstruction: "展示 NASA 官方返航照片，并保留 NASA/Bill Ingalls 来源标注。",
      },
      {
        id: "portrait-evidence",
        title: "图片证据",
        narration: "这张登记图片来自 NASA 的官方肖像页面，它能证明人物身份，但不能单独证明三百二十八天这个数字。",
        visualIntent: "screenshot",
        visualOpportunities: [
          {
            form: "source-backed-evidence",
            evidenceText:
              "这张登记图片来自 NASA 的官方肖像页面，它能证明人物身份，但不能单独证明三百二十八天这个数字。",
          },
        ],
        materialIds: ["koch-official-portrait"],
        recordingInstruction: "继续展示同一张授权肖像，强调图片证据边界。",
      },
      {
        id: "source-statement",
        title: "来源说明",
        narration:
          "NASA 的使用说明允许把相关内容用于信息展示，但要注明来源，也不能让观众误以为 NASA 在为这个项目背书。",
        visualIntent: "semantic-visual",
        visualOpportunities: [
          {
            form: "source-backed-evidence",
            evidenceText:
              "NASA 的使用说明允许把相关内容用于信息展示，但要注明来源，也不能让观众误以为 NASA 在为这个项目背书。",
          },
        ],
        materialIds: [],
        recordingInstruction: null,
      },
      {
        id: "media-comparison",
        title: "两类模型证据",
        narration:
          "Kimi 的官方资料告诉我们模型参数和产品能力，DeepSWE 榜单告诉我们同一批任务上的分数和成本。一个是产品事实，一个是独立测试，不能混成一张表。",
        visualIntent: "screen-recording",
        visualOpportunities: [
          {
            form: "source-backed-evidence",
            evidenceText:
              "Kimi 的官方资料告诉我们模型参数和产品能力，DeepSWE 榜单告诉我们同一批任务上的分数和成本。一个是产品事实，一个是独立测试，不能混成一张表。",
          },
        ],
        materialIds: ["kimi-evidence-recording"],
        recordingInstruction: "播放已登记的两张原创事实卡转场录屏。",
      },
    ],
    conclusion: "证据不是越多越好，而是每一份素材只负责证明它真正能证明的内容。",
  }),
  expectations: [
    expectation({
      id: "show-person-record",
      sectionId: "person-record",
      form: "source-backed-evidence",
      evidenceText:
        "NASA 的官方资料写得很清楚，Christina Koch 完成了连续三百二十八天的太空任务，创下女性单次太空飞行纪录。",
      sourceIds: ["koch-record"],
      expectedOneOf: ["person-evidence-card"],
      materialId: "koch-landing-photo",
    }),
    expectation({
      id: "show-portrait-boundary",
      sectionId: "portrait-evidence",
      form: "source-backed-evidence",
      evidenceText: "这张登记图片来自 NASA 的官方肖像页面，它能证明人物身份，但不能单独证明三百二十八天这个数字。",
      sourceIds: ["koch-portrait", "koch-record"],
      expectedOneOf: ["image-evidence-inset"],
      materialId: "koch-official-portrait",
    }),
    expectation({
      id: "show-source-rule",
      sectionId: "source-statement",
      form: "source-backed-evidence",
      evidenceText:
        "NASA 的使用说明允许把相关内容用于信息展示，但要注明来源，也不能让观众误以为 NASA 在为这个项目背书。",
      sourceIds: ["nasa-media-rights"],
      expectedOneOf: ["quote-source-card"],
    }),
    expectation({
      id: "compare-source-media",
      sectionId: "media-comparison",
      form: "source-backed-evidence",
      evidenceText:
        "Kimi 的官方资料告诉我们模型参数和产品能力，DeepSWE 榜单告诉我们同一批任务上的分数和成本。一个是产品事实，一个是独立测试，不能混成一张表。",
      sourceIds: ["two-model-sources", "two-model-sources-benchmark"],
      expectedOneOf: ["media-comparison"],
      expectedIconIds: ["brand.kimi"],
      materialId: "kimi-evidence-recording",
    }),
  ],
};

const benchmarkInterpretation: TopicRegressionFixture = {
  id: "benchmark-interpretation-real",
  title: "榜单结论的否定与强调",
  purpose: "验证明确否定只触发正确的文字标注，不把疑问误判成否定。",
  sourceFacts: [
    {
      id: "deepswe-scope",
      text: "DeepSWE 自述为长时软件工程基准，113 个任务覆盖 91 个仓库和 5 种语言，并提醒领先模型的置信区间可能重叠。",
      sourceUrl: deepSwe,
      accessedAt: "2026-07-19",
      sourceType: "independent-benchmark",
    },
  ],
  materials: [],
  narration: makeNarration({
    title: "一张编程榜单不能替你回答所有问题",
    overview: "DeepSWE 很适合看长时间软件工程任务，但它没有测完模型的所有能力。",
    sections: [
      {
        id: "not-universal",
        title: "明确否定",
        narration: "分数更高，不代表所有任务都更好。它测的是长时间软件工程，不是写作、搜索、视觉理解和日常对话的总分。",
        visualIntent: "semantic-visual",
        visualOpportunities: [{ form: "text-emphasis", evidenceText: "分数更高，不代表所有任务都更好。" }],
        materialIds: [],
        recordingInstruction: null,
      },
      {
        id: "question-not-negation",
        title: "疑问边界",
        narration: "那是不是应该永远选第一名？答案要看任务、成本和你使用的工具，不能只看一个百分比。",
        visualIntent: "semantic-visual",
        visualOpportunities: [{ form: "text-emphasis", evidenceText: "不能只看一个百分比。" }],
        materialIds: [],
        recordingInstruction: null,
      },
    ],
    conclusion: "榜单提供的是一块证据，不是一张永久有效的购买清单。",
  }),
  expectations: [
    expectation({
      id: "cross-out-universal-claim",
      sectionId: "not-universal",
      form: "text-emphasis",
      evidenceText: "分数更高，不代表所有任务都更好。",
      sourceIds: ["deepswe-scope"],
      expectedOneOf: ["rough-annotation"],
      polarity: "negated",
    }),
  ],
};

export const MULTI_TOPIC_REGRESSION_SUITE: TopicRegressionSuite = {
  schemaVersion: "1.0",
  suiteId: "multi-topic-0-2-16",
  status: "candidate",
  fixtures: [modelBenchmark, modelChoice, kimiArchitecture, seanlabWorkflow, evidenceMethods, benchmarkInterpretation],
};
