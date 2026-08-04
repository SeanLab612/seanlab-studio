export const animationTemplateRegistry = [
  {
    id: "paper-editorial",
    label: "手绘编辑风格",
    description: "纸张纹理、手绘连线与便签式信息结构，人物使用右上角圆形 PIP。",
    previewUrl: "/local-assets/assets/animation-templates/paper-editorial-preview-v1.mp4",
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
