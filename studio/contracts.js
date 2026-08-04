export const statusLabels = {
  intake: "资料收集",
  drafting: "正在写稿",
  "script-review": "稿件审核",
  "script-locked": "稿件已锁定",
  "awaiting-media": "等待拍摄",
  "video-ready": "视频就绪",
  "video-running": "视频制作",
  review: "Agent 自检",
  approved: "待审核成片",
  delivered: "已交付",
};

export const legacyCategoryLabels = {
  "tool-review": "工具测评（旧）",
  "model-review": "模型测评（旧）",
  "biopharma-extra": "生物医药番外（旧）",
  other: "其他（旧）",
};

export const intentLabels = {
  speaker: "人物口播",
  "screen-recording": "录屏展示",
  screenshot: "图片展示",
  "semantic-visual": "组件动效",
};

export const visualFormCatalog = {
  "two-way-contrast": { label: "双向对比", component: "双向对比", alternatives: ["取舍天平"] },
  "multi-dimension-comparison": { label: "多维比较", component: "能力网格", alternatives: ["决策矩阵"] },
  "ordered-progression": { label: "有序流程", component: "流程步骤", alternatives: ["因素序列"] },
  "progressive-explanation": { label: "逐项解释", component: "因素序列", alternatives: ["能力网格"] },
  "cause-to-result": { label: "因果链", component: "因果链", alternatives: [] },
  "conditional-outcomes": { label: "条件分支", component: "场景分支", alternatives: [] },
  "number-focus": { label: "重点数字", component: "重点数字", alternatives: [] },
  "ranking-or-distribution": { label: "排名或分布", component: "排行榜", alternatives: ["分布条"] },
  "change-over-time": { label: "趋势变化", component: "趋势折线", alternatives: [] },
  "dated-milestones": { label: "时间节点", component: "历史时间线", alternatives: [] },
  "category-map": { label: "分类关系", component: "分类图", alternatives: [] },
  "core-and-supports": { label: "核心与支撑", component: "暂无白名单组件", alternatives: [] },
  "tradeoff-or-positioning": { label: "取舍与定位", component: "决策矩阵", alternatives: ["取舍天平"] },
  "source-backed-evidence": { label: "来源证据", component: "证据展示", alternatives: ["引用来源"] },
  "text-emphasis": { label: "文字标注", component: "手绘标注", alternatives: [] },
};

export const visualComponentCatalog = [
  ["distribution-bars", "分布对比条", ["ranking-or-distribution"]],
  ["scenario-branches", "条件分支", ["conditional-outcomes"]],
  ["market-cap-lines", "趋势折线", ["change-over-time"]],
  ["person-evidence-card", "人物证据卡", ["source-backed-evidence"]],
  ["factor-sequence", "因素序列", ["progressive-explanation"]],
  ["ranked-metric-list", "指标排行榜", ["ranking-or-distribution"]],
  ["binary-versus", "双向对比", ["two-way-contrast"]],
  ["key-stat-summary", "重点数字", ["number-focus"]],
  ["media-comparison", "媒体对比", ["source-backed-evidence"]],
  ["image-evidence-inset", "截图证据", ["source-backed-evidence"]],
  ["process-steps", "流程步骤", ["ordered-progression"]],
  ["causal-chain", "因果链", ["cause-to-result"]],
  ["quote-source-card", "引用来源", ["source-backed-evidence"]],
  ["historical-timeline", "历史时间线", ["dated-milestones"]],
  ["decision-matrix", "决策矩阵", ["tradeoff-or-positioning"]],
  ["model-classification-map", "分类图", ["category-map"]],
  ["capability-surface-grid", "能力网格", ["multi-dimension-comparison"]],
  ["tradeoff-scale", "取舍天平", ["tradeoff-or-positioning"]],
  ["rough-annotation", "手绘标注", ["text-emphasis"]],
].map(([id, label, forms]) => ({
  id,
  label,
  forms,
  previewVariant: id,
}));

export const recutKindLabels = {
  "long-pause": "长停顿",
  filler: "口头语",
  "false-start": "重新起句",
  "duplicate-retake": "重复重录",
};

export const recutDispositionLabels = {
  recommended: "建议删除",
  protected: "受保护",
  rejected: "已排除",
  "too-long": "超出时长",
  "unsafe-boundary": "边界不安全",
  "low-confidence": "置信度不足",
  "overlap-suppressed": "与其他候选重叠",
};

export const workflowStatusLabels = {
  pending: "等待处理",
  running: "正在处理",
  succeeded: "已完成",
  approved: "已通过",
  failed: "需要处理",
  stale: "先前结果已过期",
  interrupted: "已取消，可继续",
};

export const sourceKindLabels = { url: "网址", file: "本地文件", note: "文字笔记" };
export const materialKindLabels = {
  "screen-recording": "录屏",
  screenshot: "截图",
  reference: "参考文件",
  "speaker-video": "人物原片",
};
export const revisionKindLabels = {
  translation: "修改英文字幕",
  "visual-copy": "修改组件展示文字",
  "visual-timing": "调整视觉出现区间",
  "visual-component": "修改组件或布局",
  "edit-removal": "增加人工删除区间",
  "caption-policy": "修改字幕断句策略",
  rejection: "仅记录驳回",
};

export const stepIndex = (status) =>
  ({
    intake: 0,
    drafting: 1,
    "script-review": 1,
    "script-locked": 2,
    "awaiting-media": 2,
    "video-ready": 3,
    "video-running": 3,
    review: 4,
    approved: 5,
    delivered: 5,
  })[status] ?? 0;

export const taskPresentations = {
  intake: {
    stage: "创建 · 方向与资料",
    summary: "先确认写作方向，再补齐参考资料和候选素材，然后生成第一版口播稿。",
  },
  drafting: {
    stage: "写稿 · Agent 处理中",
    summary: "Agent 正在根据已读取的资料生成口播稿，完成后会进入人工审核。",
  },
  "script-review": {
    stage: "写稿 · 口播稿审核",
    summary: "先把内容和拍摄提示改到满意，再锁定稿件进入拍摄。",
  },
  "script-locked": {
    stage: "拍摄 · 拍摄与素材",
    summary: "口播稿已经锁定。按拍摄交接完成录制，并登记人物原片和证据素材。",
  },
  "awaiting-media": {
    stage: "拍摄 · 等待素材",
    summary: "按拍摄指导准备原片、录屏和截图；素材齐备后再进入视频制作。",
  },
  "video-ready": {
    stage: "制作 · 视频制作",
    summary: "素材已经就绪。先审核连续 720p 粗剪，再推进语义理解和静态画面。",
  },
  "video-running": {
    stage: "制作 · 任务进行中",
    summary: "Studio 正在执行本地确定性工作流，可以安全离开并稍后继续。",
  },
  review: {
    stage: "制作 · Agent 自检",
    summary: "Agent 正在检查关键画面、字幕、证据和布局，通过后会自动渲染成片。",
  },
  approved: {
    stage: "审核 · 最终成片",
    summary: "Agent 制作、自检和技术验收已完成，等待创作者审核最终成片。",
  },
  delivered: {
    stage: "交付 · 已完成",
    summary: "成片已经交付并通过最终验收，项目证据和产物仍保留在本地。",
  },
};
