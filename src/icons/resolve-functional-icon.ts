import type { SystemIconId } from "./registry";

const functionalFallbackIds: readonly SystemIconId[] = [
  "system.document",
  "system.presentation",
  "system.design",
  "system.flow",
  "system.check",
  "system.clock",
  "system.line-chart",
  "system.database",
  "system.camera",
  "system.microphone",
  "system.video",
  "system.image",
  "system.animation",
  "system.edit",
  "system.search",
  "system.layers",
];

const functionalKeywordIcons: ReadonlyArray<[RegExp, SystemIconId]> = [
  [/(人物|创作者|作者|用户|person|creator|speaker)/i, "system.person"],
  [/(错误|异常|缺失|故障|失败|风险|告警|警告|error|missing|failure|risk|warning)/i, "system.warning"],
  [/(理解|识别|发现|查找|检索|调研|研究|understand|identify|discover|find|research)/i, "system.search"],
  [/(锚点|对齐|绑定|关联|anchor|align|bind)/i, "system.link"],
  [/(分层|层级|图层|layer|hierarchy)/i, "system.layers"],
  [/(条件|门槛|放行|允许|准入|gate|allow|admission)/i, "system.security"],
  [/(拍摄|相机|镜头|camera|shoot)/i, "system.camera"],
  [/(口播|声音|语音|音频|mic|voice|audio)/i, "system.microphone"],
  [/(视频|录屏|素材|video|recording|footage)/i, "system.video"],
  [/(图片|截图|照片|image|photo|screenshot)/i, "system.image"],
  [/(动画|动效|motion|animation)/i, "system.animation"],
  [/(设计|视觉|排版|样式|配色|design|visual|layout|style|color)/i, "system.design"],
  [/(数据库|存储|记录|档案|表格|database|storage|record|table)/i, "system.database"],
  [/(分析|指标|趋势|排名|统计|测量|analysis|metric|trend|rank|statistic|measure)/i, "system.line-chart"],
  [/(输入|录入|填写|修订|校正|input|entry|fill|correct)/i, "system.edit"],
  [/(修改|编辑|返工|edit|revise)/i, "system.edit"],
  [/(搜索|检查|审核|search|inspect|review)/i, "system.search"],
  [/(上传|导入|upload|import)/i, "system.upload"],
  [/(下载|交付|导出|download|delivery|export)/i, "system.download"],
  [/(配置|设置|settings|config)/i, "system.settings"],
  [/(图层|组合|融合|layers|composition)/i, "system.layers"],
  [/(文档|口播稿|字幕|内容|写作|整理|document|script|caption|content|write|organize)/i, "system.document"],
  [/(制作|生产|执行|推进|make|produce|execute|advance)/i, "system.flow"],
  [/(流程|步骤|工作流|flow|process|workflow)/i, "system.flow"],
  [/(完成|通过|确认|成功|达成|complete|pass|confirm|success)/i, "system.check"],
  [/(数据|图表|data|chart)/i, "system.line-chart"],
];

export const resolveFunctionalIconId = (id?: string, label?: string): SystemIconId => {
  const source = `${id ?? ""} ${label ?? ""}`.trim();
  const keywordMatch = functionalKeywordIcons.find(([pattern]) => pattern.test(source));
  if (keywordMatch) return keywordMatch[1];

  let hash = 2166136261;
  for (const char of source || "functional-icon") {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return functionalFallbackIds[(hash >>> 0) % functionalFallbackIds.length];
};
