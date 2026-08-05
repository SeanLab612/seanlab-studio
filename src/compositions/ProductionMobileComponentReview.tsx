import type React from "react";
import { TalkingHeadOverlay } from "./TalkingHeadOverlay";
import { selectLayoutTemplate } from "../layout-templates";
import type { OverlayCue, OverlayProps } from "../data/sample-props";
import type { ApprovedVisualComponentId, GeneratedVisualBrief } from "../visual-brief/types";

export type ProductionMobileComponentReviewProps = {
  componentId: ApprovedVisualComponentId;
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

const briefFor = (componentId: ApprovedVisualComponentId): GeneratedVisualBrief => ({
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
  props: fixtureProps[componentId],
});

export const ProductionMobileComponentReview: React.FC<ProductionMobileComponentReviewProps> = ({ componentId }) => {
  const generatedVisual = briefFor(componentId);
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
