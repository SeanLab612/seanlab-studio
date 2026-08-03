import { useCurrentFrame, useVideoConfig } from "remotion";
import {
  CapabilitySurfaceGrid,
  CorePositioningNode,
  DecisionMatrix,
  HistoricalTimeline,
  ModelClassificationMap,
  ReviewStage,
  TradeoffScale,
} from "../components/review";
import { Icon } from "../icons";
import { brandIconRegistry, systemIconRegistry } from "../icons/registry";

const useTime = () => ({ frame: useCurrentFrame(), fps: useVideoConfig().fps });
export const HistoricalTimelineReview = ({ backgroundSrc }: { backgroundSrc?: string }) => {
  const t = useTime();
  return (
    <ReviewStage
      eyebrow="AI INFRASTRUCTURE"
      title="AI 算力浪潮经历了四次关键跃迁"
      subtitleZh="从训练规模扩张到推理落地，产业重心正在变化"
      subtitleEn="The industry is shifting from training scale to inference deployment."
      accent="#F3B545"
      backgroundSrc={backgroundSrc}
      textEmphasis={[
        { phrase: "推理时代", color: "#B59CFF" },
        { phrase: "成本与效率", color: "#F3B545" },
      ]}
    >
      <HistoricalTimeline
        {...t}
        activeIndex={3}
        takeaway="下一阶段的核心变量，是推理成本与真实需求"
        items={[
          { id: "a", year: "2017", title: "架构突破", detail: "Transformer 奠定基础" },
          { id: "b", year: "2020", title: "规模扩张", detail: "参数量快速上升" },
          { id: "c", year: "2023", title: "应用爆发", detail: "生成式 AI 普及" },
          { id: "d", year: "2026", title: "推理时代", detail: "成本与效率成为重点" },
        ]}
      />
    </ReviewStage>
  );
};
export const DecisionMatrixReview = ({ backgroundSrc }: { backgroundSrc?: string }) => {
  const t = useTime();
  return (
    <ReviewStage
      eyebrow="PORTFOLIO DECISION"
      title="五条产品线，资源应该投向哪里？"
      subtitleZh="高增长且高协同的产品，应该成为下一轮重点投入"
      subtitleEn="Products with high growth and strategic fit deserve priority."
      accent="#6EA8FF"
      backgroundSrc={backgroundSrc}
      textEmphasis={[
        { phrase: "AI Agent", color: "#59D98E" },
        { phrase: "重点投入", color: "#6EA8FF" },
      ]}
    >
      <DecisionMatrix
        {...t}
        xLabel="市场增长"
        yLabel="战略协同"
        highlightIds={["agent"]}
        points={[
          { id: "agent", label: "AI Agent", x: 82, y: 84, color: "#59D98E" },
          { id: "cloud", label: "云服务", x: 70, y: 67 },
          { id: "office", label: "办公套件", x: 44, y: 72 },
          { id: "hardware", label: "硬件", x: 35, y: 34 },
          { id: "legacy", label: "传统业务", x: 18, y: 22 },
        ]}
      />
    </ReviewStage>
  );
};
export const ModelClassificationMapReview = ({ backgroundSrc }: { backgroundSrc?: string }) => {
  const t = useTime();
  return (
    <ReviewStage
      eyebrow="MODEL LANDSCAPE"
      title="模型能力可以拆成四种定位"
      subtitleZh="本地部署模型的优势，不只是成本，更是数据边界"
      subtitleEn="Local models compete on data boundaries as well as cost."
      accent="#6EA8FF"
      backgroundSrc={backgroundSrc}
      textEmphasis={[
        { phrase: "本地部署", color: "#59D98E" },
        { phrase: "隐私与可控性", color: "#6EA8FF" },
      ]}
    >
      <ModelClassificationMap
        {...t}
        selectedId="local"
        items={[
          { id: "general", title: "通用模型", detail: "覆盖广泛任务", iconId: "brand.chatgpt" },
          { id: "reason", title: "推理模型", detail: "复杂问题求解", iconId: "brand.deepseek", accent: "#B59CFF" },
          { id: "local", title: "本地部署", detail: "隐私与可控性", iconId: "system.security", accent: "#59D98E" },
          {
            id: "vertical",
            title: "行业模型",
            detail: "专业知识增强",
            iconId: "system.institution",
            accent: "#F3B545",
          },
        ]}
      />
    </ReviewStage>
  );
};
export const CorePositioningNodeReview = () => {
  const t = useTime();
  return (
    <ReviewStage
      eyebrow="CORE POSITIONING"
      title="真正的核心，不是单点能力"
      subtitleZh="数据、模型、工作流和安全共同决定系统价值"
      subtitleEn="Data, models, workflows and security jointly define the system."
      accent="#F3B545"
      textEmphasis={[
        { phrase: "企业智能中枢", color: "#6EA8FF" },
        { phrase: "AI OS", color: "#B59CFF" },
      ]}
    >
      <CorePositioningNode
        {...t}
        centerLabel="企业智能中枢"
        centerValue="AI OS"
        centerIcon="system.chip"
        nodes={[
          { id: "data", label: "数据", detail: "统一上下文", iconId: "system.database" },
          { id: "model", label: "模型", detail: "动态路由", iconId: "brand.claude" },
          { id: "flow", label: "工作流", detail: "自动执行", iconId: "system.flow" },
          { id: "safe", label: "安全", detail: "权限审计", iconId: "system.security" },
        ]}
      />
    </ReviewStage>
  );
};
export const CapabilitySurfaceGridReview = ({ backgroundSrc }: { backgroundSrc?: string }) => {
  const t = useTime();
  return (
    <ReviewStage
      eyebrow="CAPABILITY SURFACE"
      title="五种抗体在四项指标上的表现"
      subtitleZh="抗体 C 的主峰纯度最高，但稳定性仍需验证"
      subtitleEn="Antibody C leads in purity, while stability needs validation."
      accent="#59D98E"
      backgroundSrc={backgroundSrc}
      textEmphasis={[
        { phrase: "抗体 C", color: "#59D98E" },
        { phrase: "主峰纯度", color: "#6EA8FF" },
      ]}
    >
      <CapabilitySurfaceGrid
        {...t}
        rows={["抗体 A", "抗体 B", "抗体 C", "抗体 D", "抗体 E"]}
        columns={["主峰纯度", "回收率", "稳定性", "聚集体"]}
        highlight={{ row: 2, column: 0 }}
        legend="数值越高代表该项综合表现越好"
        values={[
          [0.84, 0.77, 0.91, 0.68],
          [0.88, 0.82, 0.75, 0.79],
          [0.96, 0.86, 0.72, 0.9],
          [0.81, 0.91, 0.85, 0.73],
          [0.9, 0.79, 0.88, 0.82],
        ]}
      />
    </ReviewStage>
  );
};
export const TradeoffScaleReview = ({ backgroundSrc }: { backgroundSrc?: string }) => {
  const t = useTime();
  return (
    <ReviewStage
      eyebrow="DESIGN TRADEOFF"
      title="速度、精度和成本无法同时最大化"
      subtitleZh="选择更高精度以后，响应时间和成本都会上升"
      subtitleEn="Higher accuracy usually increases both latency and cost."
      accent="#F3B545"
      backgroundSrc={backgroundSrc}
      textEmphasis={[
        { phrase: "结果精度", color: "#59D98E" },
        { phrase: "提升 19", color: "#6EA8FF" },
      ]}
    >
      <TradeoffScale
        {...t}
        highlightId="accuracy"
        items={[
          { id: "speed", label: "响应速度", value: 48, previousValue: 78, color: "#6EA8FF", note: "降低 30" },
          { id: "accuracy", label: "结果精度", value: 91, previousValue: 72, color: "#59D98E", note: "提升 19" },
          { id: "cost", label: "单位成本", value: 76, previousValue: 42, color: "#F3B545", note: "上升 34" },
        ]}
      />
    </ReviewStage>
  );
};
export const ProgressionTimelineReview = ({ backgroundSrc }: { backgroundSrc?: string }) => {
  const t = useTime();
  return (
    <ReviewStage
      eyebrow="CREATOR WORKFLOW"
      title="一条视频，从想法走到最终交付"
      subtitleZh="写稿、拍摄、制作、渲染、交付，按内容阶段逐步推进"
      subtitleEn="The video moves through five explicit production stages."
      accent="#F3B545"
      backgroundSrc={backgroundSrc}
    >
      <HistoricalTimeline
        {...t}
        mode="progression"
        activeIndex={4}
        takeaway="这里表达的是阶段递进，不需要虚构日期"
        items={[
          { id: "script", marker: "01", title: "写稿", detail: "确定口播与画面锚点" },
          { id: "shoot", marker: "02", title: "拍摄", detail: "录制真人口播原片" },
          { id: "edit", marker: "03", title: "制作", detail: "融合组件、动画和素材" },
          { id: "render", marker: "04", title: "渲染", detail: "生成完整视频文件" },
          { id: "deliver", marker: "05", title: "交付", detail: "检查并发布成片" },
        ]}
      />
    </ReviewStage>
  );
};

export const QualitativeDecisionMatrixReview = ({ backgroundSrc }: { backgroundSrc?: string }) => {
  const t = useTime();
  return (
    <ReviewStage
      eyebrow="DECISION MATRIX"
      title="没有分数，也能表达明确的选择"
      subtitleZh="只使用口播明确给出的高低关系，不把判断改写成虚构分数"
      subtitleEn="Explicit high-low evidence is shown without invented scores."
      accent="#6EA8FF"
      backgroundSrc={backgroundSrc}
    >
      <DecisionMatrix
        {...t}
        mode="qualitative"
        xLabel="实施难度"
        yLabel="业务价值"
        highlightIds={["quick-win"]}
        quadrants={["重点投入", "高价值攻坚", "快速补齐", "暂缓处理"]}
        points={[
          { id: "quick-win", label: "快速方案", xBand: "low", yBand: "high", color: "#59D98E" },
          { id: "strategic", label: "长期方案", xBand: "high", yBand: "high", color: "#6EA8FF" },
          { id: "basic", label: "基础优化", xBand: "low", yBand: "low", color: "#F3B545" },
          { id: "later", label: "后续探索", xBand: "high", yBand: "low", color: "#B59CFF" },
        ]}
      />
    </ReviewStage>
  );
};

export const QualitativeCapabilitySurfaceReview = ({ backgroundSrc }: { backgroundSrc?: string }) => {
  const t = useTime();
  return (
    <ReviewStage
      eyebrow="CAPABILITY MAP"
      title="定性信息，也可以形成能力矩阵"
      subtitleZh="支持、部分支持和不支持，全部来自已经明确说出的状态"
      subtitleEn="Every cell reflects an explicit qualitative state."
      accent="#59D98E"
      backgroundSrc={backgroundSrc}
    >
      <CapabilitySurfaceGrid
        {...t}
        mode="qualitative"
        rows={["真人口播", "纯口播", "录屏教程"]}
        columns={["组件", "动画", "录屏"]}
        states={[
          ["支持", "支持", "部分支持"],
          ["部分支持", "支持", "不支持"],
          ["部分支持", "部分支持", "支持"],
        ]}
        highlight={{ row: 1, column: 1 }}
        legend="定性矩阵只展示明确状态，不换算成数字评分"
      />
    </ReviewStage>
  );
};

export const DirectionalTradeoffReview = ({ backgroundSrc }: { backgroundSrc?: string }) => {
  const t = useTime();
  return (
    <ReviewStage
      eyebrow="TRADEOFF"
      title="只有方向，也能说明真实取舍"
      subtitleZh="加快制作以后，速度提高，但调整空间会减少"
      subtitleEn="Directional changes communicate the tradeoff without fake values."
      accent="#F3B545"
      backgroundSrc={backgroundSrc}
    >
      <TradeoffScale
        {...t}
        mode="directional"
        highlightId="speed"
        items={[
          { id: "speed", label: "制作速度", direction: "up", valueLabel: "更快", color: "#59D98E", note: "明显提高" },
          {
            id: "control",
            label: "调整空间",
            direction: "down",
            valueLabel: "更少",
            color: "#F3B545",
            note: "有所减少",
          },
          {
            id: "quality",
            label: "画面标准",
            direction: "stable",
            valueLabel: "保持",
            color: "#6EA8FF",
            note: "维持一致",
          },
        ]}
      />
    </ReviewStage>
  );
};
const IconGrid = ({ brand }: { brand: boolean }) => {
  const items = Object.values(brand ? brandIconRegistry : systemIconRegistry);
  return (
    <div
      style={{
        position: "absolute",
        left: 68,
        top: 220,
        width: 740,
        display: "grid",
        gridTemplateColumns: `repeat(${brand ? 4 : 5},1fr)`,
        gap: 10,
      }}
    >
      {items.map((x) => (
        <div
          key={x.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            padding: 9,
            borderRadius: 14,
            background: "rgba(10,12,16,.58)",
            border: "1px solid rgba(255,255,255,.11)",
          }}
        >
          <Icon id={x.id} size={brand ? 42 : 34} color="#59D98E" />
          <b style={{ fontSize: brand ? 14 : 11 }}>{x.label}</b>
        </div>
      ))}
    </div>
  );
};
export const ExpandedBrandIconsReview = () => (
  <ReviewStage
    eyebrow="ICON LIBRARY"
    title="品牌图标扩容 · 17 个"
    subtitleZh="只有口播明确提及品牌时，才选择对应图标"
    subtitleEn="Use a brand mark only when the narration names that brand."
    accent="#6EA8FF"
  >
    <IconGrid brand />
  </ReviewStage>
);

export const ExpandedSystemIconsReview = () => (
  <ReviewStage
    eyebrow="ICON LIBRARY"
    title="通用语义图标 · 23 个"
    subtitleZh="通用图标根据语义匹配，不依赖固定主题"
    subtitleEn="System icons are selected by meaning, not by a fixed topic."
    accent="#59D98E"
  >
    <IconGrid brand={false} />
  </ReviewStage>
);
