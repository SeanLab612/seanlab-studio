import type { TypographyProfileId, TypographyTextRole } from "./types.ts";

export const SYSTEM_BLACK_FAMILY =
  '"SF Pro Display", "PingFang SC", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif';
export const WENKAI_FAMILY = '"SeanLab WenKai GB Production", "PingFang SC", sans-serif';

export const typographyProfileRegistry = {
  "system-black": {
    id: "system-black",
    family: SYSTEM_BLACK_FAMILY,
    fontWeight: 700,
    source: "macOS system font chain",
    bundled: false,
  },
  "wenkai-narrative": {
    id: "wenkai-narrative",
    family: WENKAI_FAMILY,
    fontWeight: 500,
    source: "LXGW WenKai GB Medium v1.522",
    bundled: true,
    file: "fonts/production/LXGWWenKaiGB-Medium-v1.522.ttf",
    sha256: "b885c51ec0d3f325974013801dfcefda1a9ba0bf385c607cf5f2582dafa2e5ab",
    license: "SIL OFL 1.1",
  },
} as const satisfies Record<TypographyProfileId, Record<string, unknown>>;

export const typographyRoleRegistry: Record<
  TypographyTextRole,
  {
    label: string;
    maximumCharacters: number;
    maximumLines: number;
    minimumFontPx: number;
    maximumFontPx: number;
    allowedProfiles: TypographyProfileId[];
  }
> = {
  caption: {
    label: "字幕",
    maximumCharacters: 22,
    maximumLines: 2,
    minimumFontPx: 23,
    maximumFontPx: 38,
    allowedProfiles: ["system-black"],
  },
  "display-title": {
    label: "画面主标题",
    maximumCharacters: 26,
    maximumLines: 2,
    minimumFontPx: 36,
    maximumFontPx: 62,
    allowedProfiles: ["system-black", "wenkai-narrative"],
  },
  "component-title": {
    label: "组件标题",
    maximumCharacters: 22,
    maximumLines: 2,
    minimumFontPx: 30,
    maximumFontPx: 48,
    allowedProfiles: ["system-black", "wenkai-narrative"],
  },
  body: {
    label: "正文",
    maximumCharacters: 60,
    maximumLines: 4,
    minimumFontPx: 18,
    maximumFontPx: 30,
    allowedProfiles: ["system-black"],
  },
  metric: {
    label: "数字与指标",
    maximumCharacters: 24,
    maximumLines: 2,
    minimumFontPx: 20,
    maximumFontPx: 72,
    allowedProfiles: ["system-black"],
  },
  label: {
    label: "标签",
    maximumCharacters: 20,
    maximumLines: 1,
    minimumFontPx: 13,
    maximumFontPx: 24,
    allowedProfiles: ["system-black"],
  },
  source: {
    label: "来源",
    maximumCharacters: 36,
    maximumLines: 2,
    minimumFontPx: 12,
    maximumFontPx: 22,
    allowedProfiles: ["system-black"],
  },
  quote: {
    label: "引用",
    maximumCharacters: 44,
    maximumLines: 4,
    minimumFontPx: 28,
    maximumFontPx: 42,
    allowedProfiles: ["system-black", "wenkai-narrative"],
  },
  annotation: {
    label: "手写强调",
    maximumCharacters: 18,
    maximumLines: 1,
    minimumFontPx: 36,
    maximumFontPx: 58,
    allowedProfiles: ["system-black", "wenkai-narrative"],
  },
};
