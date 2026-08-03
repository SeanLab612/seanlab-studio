export const animationTemplateRegistry = [
  {
    id: "paper-editorial",
    label: "手绘编辑风格",
    description: "纸张纹理、手绘连线与便签式信息结构，人物使用右上角圆形 PIP。",
    previewUrl: "/local-assets/assets/animation-templates/paper-editorial-preview-v1.mp4",
    previewSeconds: 10,
  },
  {
    id: "stop-motion-machine",
    label: "定格机械风格",
    description: "机械模块、传送带与逐格运动结构，阶段文字和功能图标根据口播语义动态生成。",
    previewUrl: "/local-assets/assets/animation-templates/stop-motion-machine-preview-v1.mp4",
    previewSeconds: 10,
  },
  {
    id: "research-archive",
    label: "实验室档案动态风",
    description: "研究档案、测量标记与物理运动隐喻，适合聚合拆解、尺度变焦、阈值落点和扩散汇流。",
    previewUrl: "/local-assets/assets/animation-templates/research-archive-preview-v1.mp4",
    previewSeconds: 10,
  },
] as const;

export type AnimationTemplateId = (typeof animationTemplateRegistry)[number]["id"];

export const animationTemplateIds = animationTemplateRegistry.map((item) => item.id) as AnimationTemplateId[];

export const resolveAnimationTemplate = (id: string | undefined) => {
  const template = animationTemplateRegistry.find((item) => item.id === id);
  if (!template) throw new Error("动画模板不在已批准列表中");
  return template;
};
