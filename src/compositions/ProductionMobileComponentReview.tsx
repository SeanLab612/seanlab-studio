import type React from "react";
import { TalkingHeadOverlay } from "./TalkingHeadOverlay";
import { selectLayoutTemplate } from "../layout-templates";
import type { OverlayCue, OverlayProps } from "../data/sample-props";
import { validateComponentProps } from "../visual-brief/generator";
import type { ApprovedVisualComponentId, GeneratedVisualBrief } from "../visual-brief/types";

export type ProductionMobileComponentReviewProps = {
  componentId: ApprovedVisualComponentId;
  stress?: boolean;
};

const fixtureProps: Record<ApprovedVisualComponentId, Record<string, unknown>> = {
  "distribution-bars": {},
  "scenario-branches": {},
  "market-cap-lines": {},
  "person-evidence-card": {
    name: "CREATOR",
    role: "本地视频创作者",
    quote: "我会把真实测试过程和最终结果完整展示出来",
    evidence: [
      { eyebrow: "EVIDENCE 01", title: "完成真实测试", meta: "本地记录 · 已验证" },
      { eyebrow: "RESULT 02", title: "产物可以复用", meta: "网页展示 · 已验证" },
    ],
    timeline: [{ label: "测试" }, { label: "验证" }, { label: "交付" }],
  },
  "factor-sequence": {
    items: [
      { id: "a", title: "素材理解", detail: "确认输入内容", iconId: "system.document" },
      { id: "b", title: "结构规划", detail: "安排表达顺序", iconId: "system.flow" },
      { id: "c", title: "视觉制作", detail: "匹配组件动画", iconId: "system.design" },
      { id: "d", title: "成片交付", detail: "完成审核发布", iconId: "system.trophy" },
    ],
    activeIndex: 2,
    headline: "从素材到成片",
    highlightedText: "四步完成",
    summary: "当前步骤保持清晰，讲过的内容自动降权",
  },
  "ranked-metric-list": {
    mode: "score",
    metricLabel: "综合评分",
    highlightId: "b",
    items: [
      { id: "a", label: "方案 A", sublabel: "稳定输出", value: 92 },
      { id: "b", label: "方案 B", sublabel: "当前推荐", value: 95 },
      { id: "c", label: "方案 C", sublabel: "速度优先", value: 88 },
      { id: "d", label: "方案 D", sublabel: "成本优先", value: 81 },
    ],
    takeaway: "总分不是唯一结论，还要结合实际约束",
  },
  "binary-versus": {
    items: [
      { id: "local", eyebrow: "CONTROL", label: "本地部署", metric: "数据可控", detail: "适合重视隐私与控制的场景" },
      { id: "cloud", eyebrow: "SPEED", label: "云端方案", metric: "上线更快", detail: "适合快速验证和弹性扩展" },
    ],
    relation: "VS",
    selectedId: "local",
    takeaway: "选择取决于当前最重要的约束",
  },
  "key-stat-summary": {
    items: [
      { id: "scale", value: "1,290万", label: "覆盖规模", detail: "来自真实统计口径" },
      { id: "share", value: "60%", label: "核心人群", detail: "占比超过一半" },
    ],
    conclusion: "两组数字共同支撑核心结论",
    chips: [{ id: "proof", text: "数据已经核对", iconId: "system.trophy" }],
  },
  "media-comparison": {
    items: [
      {
        id: "a",
        imageSrc: "review-assets/interface-codex.svg",
        label: "方案 A",
        source: "SOURCE A",
        caption: "工作区与任务管理",
      },
      {
        id: "b",
        imageSrc: "review-assets/interface-claude.svg",
        label: "方案 B",
        source: "SOURCE B",
        caption: "对话与协作界面",
      },
      {
        id: "c",
        imageSrc: "review-assets/interface-qwen.svg",
        label: "方案 C",
        source: "SOURCE C",
        caption: "快捷问答入口",
      },
    ],
    relation: "≠",
    takeaway: "相似界面不代表相同能力",
  },
  "image-evidence-inset": {
    assetId: "production-mobile-review",
    imageSrc: "review-assets/interface-codex.svg",
    orientation: "landscape",
    fit: "contain",
    caption: "从已登记素材中确定性引用，不由模型编造路径",
    sourceLabel: "SeanLab Studio",
  },
  "process-steps": {
    items: [
      { id: "a", title: "上传素材", detail: "登记图片和录屏", iconId: "system.document" },
      { id: "b", title: "理解内容", detail: "确认素材含义", iconId: "system.flow" },
      { id: "c", title: "制作画面", detail: "匹配视觉方案", iconId: "system.design" },
      { id: "d", title: "审核交付", detail: "检查后生成成片", iconId: "system.trophy" },
    ],
    activeIndex: 2,
    takeaway: "每一步都完成以后，再进入最终交付",
  },
  "causal-chain": {
    nodes: [
      { id: "a", label: "输入素材", detail: "真实证据", iconId: "system.document" },
      { id: "b", label: "内容理解", detail: "提取重点", iconId: "system.flow" },
      { id: "c", label: "视觉匹配", detail: "组件动画", iconId: "system.design" },
      { id: "d", label: "生成成片", detail: "完成交付", iconId: "system.trophy" },
    ],
    activeIndex: 2,
    takeaway: "前面的理解质量，决定后面的画面质量",
  },
  "quote-source-card": {
    quote: "真实测试不是只看结果，还要验证产物能不能继续使用。",
    sourceName: "SeanLab 测试记录",
    sourceRole: "项目实测",
    sourceKind: "report",
    date: "2026年7月",
    citation: "本地证据",
    iconId: "system.document",
    imageSrc: "review-assets/source-report.svg",
  },
  "historical-timeline": {
    mode: "progression",
    activeIndex: 3,
    items: [
      { id: "a", marker: "01", title: "准备素材", detail: "整理输入" },
      { id: "b", marker: "02", title: "生成模型", detail: "完成结构" },
      { id: "c", marker: "03", title: "验证交互", detail: "检查节点" },
      { id: "d", marker: "04", title: "实际使用", detail: "接入网页" },
    ],
    takeaway: "最终目标不是生成，而是让产物继续发挥作用",
  },
  "decision-matrix": {
    xLabel: "实施难度",
    yLabel: "实际价值",
    highlightIds: ["a"],
    quadrants: ["重点投入", "高价值攻坚", "快速补齐", "暂缓处理"],
    points: [
      { id: "a", label: "当前方案", x: 35, y: 82 },
      { id: "b", label: "快速方案", x: 62, y: 68 },
      { id: "c", label: "备选方案", x: 28, y: 35 },
      { id: "d", label: "后续探索", x: 75, y: 28 },
    ],
  },
  "model-classification-map": {
    headline: "四种能力定位",
    selectedId: "local",
    items: [
      { id: "general", title: "通用模型", detail: "覆盖广泛任务", iconId: "system.globe" },
      { id: "reasoning", title: "推理模型", detail: "复杂问题求解", iconId: "system.flow" },
      { id: "local", title: "本地部署", detail: "隐私与可控性", iconId: "system.chip" },
      { id: "industry", title: "行业模型", detail: "专业知识增强", iconId: "system.document" },
    ],
  },
  "capability-surface-grid": {
    mode: "qualitative",
    rows: ["真人口播", "纯口播", "录屏教程"],
    columns: ["组件", "动画", "录屏"],
    states: [
      ["支持", "支持", "部分支持"],
      ["部分支持", "支持", "不支持"],
      ["部分支持", "部分支持", "支持"],
    ],
    highlight: { row: 1, column: 1 },
    legend: "状态来自明确证据，不换算成虚构分数",
  },
  "tradeoff-scale": {
    mode: "directional",
    highlightId: "speed",
    items: [
      { id: "speed", label: "制作速度", direction: "up", valueLabel: "更快", note: "明显提高" },
      { id: "control", label: "调整空间", direction: "down", valueLabel: "更少", note: "有所减少" },
      { id: "quality", label: "画面标准", direction: "stable", valueLabel: "保持", note: "维持一致" },
    ],
  },
  "rough-annotation": {
    headline: "只标注口播证据支持的短语",
    items: [
      { id: "a", text: "真实测试", effect: "underline" },
      { id: "b", text: "可以继续使用", effect: "highlight" },
    ],
    activeIndex: 1,
  },
  "editorial-statement": {
    leadIn: "它不是从图片里",
    denied: "提取现成网格",
    prefix: "而是",
    emphasis: "用代码重新搭建",
    support: "模型仍可继续编辑、交互和动画",
  },
};

export const componentTextStressProps = (componentId: ApprovedVisualComponentId) => {
  const props = structuredClone(fixtureProps[componentId]);
  switch (componentId) {
    case "distribution-bars":
      return {
        bars: [
          { label: "资料理解完成", value: 42 },
          { label: "口播稿已确认", value: 58 },
          { label: "视觉方案已生成", value: 76 },
          { label: "自动审核已通过", value: 92, emphasized: true },
        ],
        annotation: "完整文字必须优先展示",
        populationRow: { label: "每一个阶段都保留可核验的完整结果", count: 12, highlightedCount: 4 },
      };
    case "scenario-branches":
      return {
        kicker: "下一步怎么选择",
        question: "面对复杂素材时工作流应该如何继续？",
        branches: [
          { label: "保留完整语义继续制作", detail: "自动换行并根据内容调整布局" },
          { label: "无法完整呈现时重新规划", detail: "减少密度或拆成连续画面" },
        ],
        activeBranch: 0,
      };
    case "market-cap-lines":
      return {
        series: [
          { name: "写稿 Agent", valueLabel: "92", points: [30, 45, 62, 78, 92] },
          { name: "制作 Agent", valueLabel: "88", points: [26, 40, 58, 72, 88] },
          { name: "审核 Agent", valueLabel: "84", points: [20, 38, 52, 69, 84] },
        ],
        groupLabel: "WORKFLOW AGENTS",
        totalValue: "3 个",
        totalCaption: "连续协作角色",
        takeaway: "每个阶段都读取完整上下文并保留可继续的结果",
      };
    case "person-evidence-card":
      return {
        ...props,
        name: "真实项目创作者",
        role: "负责确认口播文字并审核最终成片",
        quote: "我只需要确认文字与最后的成片，中间问题由制作 Agent 自主检查和修复。",
        evidence: [
          { eyebrow: "WORKFLOW EVIDENCE", title: "完整跑通真实制作流程", meta: "本地项目记录已经核验" },
          { eyebrow: "DELIVERY RESULT", title: "审核产物可以继续使用", meta: "静态审核与技术验收通过" },
        ],
      };
    case "factor-sequence":
      return {
        ...props,
        items: [
          { id: "a", title: "理解全部参考资料", detail: "读取文字、截图和录屏的真实内容" },
          { id: "b", title: "生成完整口播文稿", detail: "只让用户修改最终要说的文字" },
          { id: "c", title: "自主规划视觉方案", detail: "优先匹配组件并安排素材时间线" },
          { id: "d", title: "自动检查并完成交付", detail: "修复常规问题后等待最终审核" },
        ],
      };
    case "ranked-metric-list":
      return {
        ...props,
        items: [
          { id: "a", label: "资料理解完整度", sublabel: "全部输入已读取", value: 96 },
          { id: "b", label: "视觉内容覆盖率", sublabel: "组件与素材共同覆盖", value: 88 },
          { id: "c", label: "自动审核通过率", sublabel: "显示完整并保持可读", value: 91 },
          { id: "d", label: "最终交付稳定性", sublabel: "可以继续渲染成片", value: 94 },
        ],
        takeaway: "排名名称和补充说明必须完整显示，不能使用省略号代替",
      };
    case "binary-versus":
      return {
        items: [
          {
            id: "before",
            eyebrow: "BEFORE",
            label: "固定宽度直接截断文字",
            metric: "信息显示不完整",
            detail: "观众只能看到句子前半部分，无法理解真正要表达的内容",
          },
          {
            id: "after",
            eyebrow: "AFTER",
            label: "根据完整语义自动换行",
            metric: "全部信息清晰呈现",
            detail: "文字自动换行、调整密度，必要时拆成连续画面继续展示",
          },
        ],
        relation: "→",
        selectedId: "after",
        takeaway: "安全区域应该服务完整表达，而不是成为截断文字的理由",
      };
    case "key-stat-summary":
      return {
        items: [
          { id: "components", value: "20", label: "视觉组件完整回归", detail: "每一个组件都测试接近容量上限的文字" },
          { id: "data", value: "10", label: "数据组件同步验证", detail: "数值保持单行，解释文字允许自动换行" },
        ],
        conclusion: "三十种视觉效果都必须在安全区内完整显示",
      };
    case "media-comparison":
      return {
        ...props,
        items: [
          {
            id: "a",
            imageSrc: "review-assets/interface-codex.svg",
            label: "项目创建与资料登记界面",
            source: "CREATE",
            caption: "从写稿方向开始登记真实参考资料",
          },
          {
            id: "b",
            imageSrc: "review-assets/interface-claude.svg",
            label: "制作 Agent 工作台界面",
            source: "PRODUCE",
            caption: "自动规划组件、素材和完整时间线",
          },
        ],
        takeaway: "截图标题和说明都应完整换行显示",
      };
    case "image-evidence-inset":
      return {
        ...props,
        caption: "这张已登记截图直接证明工作流已经进入最终渲染规格选择阶段",
        sourceLabel: "SeanLab Studio 第一轮真实项目测试",
      };
    case "process-steps":
      return {
        items: [
          { id: "a", title: "创建项目并填写写稿方向", detail: "说明主题、素材和预期结果" },
          { id: "b", title: "确认资料理解与口播文字", detail: "用户唯一需要修改的内容" },
          { id: "c", title: "登记原片与全部视觉素材", detail: "图片和录屏成为制作硬约束" },
          { id: "d", title: "制作 Agent 自主规划并制作", detail: "组件优先，动画只做辅助" },
          { id: "e", title: "自动检查画面完整性", detail: "发现问题后从有效断点恢复" },
          { id: "f", title: "选择规格并渲染最终成片", detail: "用户只审核最后的交付结果" },
        ],
        activeIndex: 4,
      };
    case "causal-chain":
      return {
        nodes: [
          { id: "a", label: "素材理解不完整", detail: "上下文缺失" },
          { id: "b", label: "视觉选择发生偏差", detail: "组件不匹配" },
          { id: "c", label: "覆盖率无法达到目标", detail: "画面不足" },
          { id: "d", label: "工作流停在审核阶段", detail: "无法交付" },
        ],
        activeIndex: 3,
        takeaway: "保留完整上下文可以从源头降低后续返工",
      };
    case "quote-source-card":
      return {
        ...props,
        quote: "用户上传图片和录屏，就是希望这些素材在最终视频中被真正呈现，而不是只在写稿阶段被读取一次。",
        sourceName: "SeanLab Studio 真实项目测试记录",
        sourceRole: "工作流需求与验收结论",
      };
    case "historical-timeline":
      return {
        ...props,
        items: [
          { id: "a", marker: "07-09", title: "搭建第一版制作工作流", detail: "连接写稿、制作和渲染" },
          { id: "b", marker: "07-18", title: "加入素材理解与视觉规划", detail: "建立上下游交接约束" },
          { id: "c", marker: "07-28", title: "增加自动恢复和审核证据", detail: "减少用户处理中间错误" },
          { id: "d", marker: "08-06", title: "完成完整真实项目测试", detail: "工作流跑到最终渲染阶段" },
        ],
      };
    case "decision-matrix":
      return {
        ...props,
        xLabel: "实施与维护复杂度",
        yLabel: "用户获得的实际价值",
        points: [
          { id: "a", label: "完整文字自动换行", x: 35, y: 86 },
          { id: "b", label: "组件密度动态调整", x: 58, y: 78 },
          { id: "c", label: "超载内容拆分展示", x: 72, y: 91 },
          { id: "d", label: "继续使用省略号", x: 20, y: 18 },
        ],
      };
    case "model-classification-map":
      return {
        ...props,
        items: [
          { id: "structure", title: "结构化信息组件", detail: "用于步骤、对比、分类和因果关系" },
          { id: "evidence", title: "真实素材证据组件", detail: "用于截图、录屏和来源引用" },
          { id: "data", title: "数据表达组件", detail: "用于数值、趋势和分布关系" },
          { id: "general", title: "通用观点陈述组件", detail: "用于没有更强语义结构的完整表达" },
        ],
        selectedId: "general",
      };
    case "capability-surface-grid":
      return {
        mode: "qualitative",
        rows: ["完整中文长标题", "中英文混排标签", "移动端缩放检查", "多项目密度检查"],
        columns: ["自动换行能力", "字号适配能力", "拆分状态能力", "完整性审核"],
        states: [
          ["支持", "支持", "支持", "通过"],
          ["支持", "支持", "部分支持", "通过"],
          ["支持", "支持", "支持", "通过"],
          ["支持", "部分支持", "支持", "通过"],
        ],
        highlight: { row: 0, column: 0 },
        legend: "矩阵标题达到两行容量时仍需完整呈现",
      };
    case "tradeoff-scale":
      return {
        ...props,
        items: [
          { id: "coverage", label: "视觉内容覆盖完整程度", direction: "up", valueLabel: "更高", note: "允许连续三个" },
          { id: "readability", label: "移动端文字阅读清晰度", direction: "up", valueLabel: "更好", note: "自动换行" },
          { id: "fatigue", label: "相同组件连续出现频率", direction: "stable", valueLabel: "可接受", note: "覆盖优先" },
        ],
        highlightId: "coverage",
      };
    case "rough-annotation":
      return {
        headline: "手绘标注只接受完整短语，不自动截断",
        items: [
          { id: "a", text: "完整文字", effect: "underline" },
          { id: "b", text: "禁止省略号", effect: "highlight" },
          { id: "c", text: "超长就拆分", effect: "box" },
        ],
        activeIndex: 2,
      };
    case "editorial-statement":
      return {
        leadIn: "没有更强结构时",
        denied: "截断句子后半部分",
        prefix: "改为",
        emphasis: "利用完整安全区域自动换行展示全部观点",
        support: "如果文字仍然放不下，就缩减非必要模块或拆成连续画面，而不是用省略号掩盖信息损失。",
      };
  }
};

const briefFor = (componentId: ApprovedVisualComponentId, stress = false): GeneratedVisualBrief => ({
  schemaVersion: "1.0",
  segment: { id: `production-mobile-${componentId}`, start: 0, end: 10, text: "移动端生产路径验收" },
  analysis: {
    rhetoric:
      componentId === "rough-annotation"
        ? "rough-annotation"
        : componentId === "editorial-statement"
          ? "editorial-statement"
          : "comparison",
  },
  component: { id: componentId, status: "approved", selectionReason: "Production mobile regression fixture" },
  narrative: {
    eyebrow: "MOBILE PRODUCTION QA",
    title: "真实成片路径移动端验收",
    subtitleZh: "组件必须在手机屏幕上保持清晰",
    subtitleEn: "Components must remain readable on mobile screens.",
  },
  props: stress ? componentTextStressProps(componentId) : fixtureProps[componentId],
});

export const ProductionMobileComponentReview: React.FC<ProductionMobileComponentReviewProps> = ({
  componentId,
  stress = false,
}) => {
  const generatedVisual = briefFor(componentId, stress);
  if (stress) validateComponentProps(componentId, generatedVisual.props);
  const layoutTemplateId = selectLayoutTemplate({
    componentId,
    faceCenterX: 0.5,
    componentProps: generatedVisual.props,
  });
  const cue: OverlayCue = {
    start: 0,
    end: 10,
    eyebrow: "MOBILE PRODUCTION QA",
    title: "真实成片路径移动端验收",
    subtitle: "组件必须在手机屏幕上保持清晰",
    subtitleEn: "Components must remain readable on mobile screens.",
    accent: "#59D98E",
    layoutTemplateId,
    contentScale: 0.78,
    generatedVisual,
  };
  const props: OverlayProps = {
    headline: "真实成片路径移动端验收",
    chapter: "MOBILE PRODUCTION QA",
    speaker: "CREATOR",
    subtitle: "组件必须在手机屏幕上保持清晰",
    subtitleEn: "Components must remain readable on mobile screens.",
    timelineLabel: "20 COMPONENTS",
    cards: [],
    keywords: [],
    overlayCues: [cue],
    subtitleCues: [
      {
        start: 0,
        end: 10,
        zh: "组件必须在手机屏幕上保持清晰",
        en: "Components must remain readable on mobile screens.",
      },
    ],
    overlayScale: 0.78,
    overlaySide: "left",
    layoutTemplateId,
  };
  return <TalkingHeadOverlay {...props} />;
};
