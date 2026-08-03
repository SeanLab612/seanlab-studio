export type BrandIconId =
  | "brand.openai"
  | "brand.anthropic"
  | "brand.deepseek"
  | "brand.qwen"
  | "brand.kimi"
  | "brand.minimax"
  | "brand.github"
  | "brand.google-gemini"
  | "brand.chatgpt"
  | "brand.claude"
  | "brand.microsoft"
  | "brand.apple"
  | "brand.nvidia"
  | "brand.meta"
  | "brand.amazon"
  | "brand.doubao";

export type SystemIconId =
  | "system.gift"
  | "system.document"
  | "system.presentation"
  | "system.design"
  | "system.team"
  | "system.trophy"
  | "system.chip"
  | "system.globe"
  | "system.quote"
  | "system.ranking"
  | "system.flow"
  | "system.check"
  | "system.warning"
  | "system.clock"
  | "system.calendar"
  | "system.link"
  | "system.institution"
  | "system.currency"
  | "system.percentage"
  | "system.line-chart"
  | "system.database"
  | "system.laboratory"
  | "system.security"
  | "system.person"
  | "system.camera"
  | "system.microphone"
  | "system.video"
  | "system.image"
  | "system.animation"
  | "system.edit"
  | "system.search"
  | "system.upload"
  | "system.download"
  | "system.settings"
  | "system.layers";

export type IconId = BrandIconId | SystemIconId;

export type BrandIconDefinition = {
  id: BrandIconId;
  category: "brand";
  label: string;
  shortLabel: string;
  assetPath: string;
  source: string;
  accessedAt: string;
  usageNote: string;
  tileBackground: string;
};

export type SystemIconDefinition = {
  id: SystemIconId;
  category: "system";
  label: string;
};

export const brandIconRegistry: Record<BrandIconId, BrandIconDefinition> = {
  "brand.openai": {
    id: "brand.openai",
    category: "brand",
    label: "OpenAI",
    shortLabel: "OA",
    assetPath: "icons/brand/openai.svg",
    source: "https://openai.com/brand/",
    accessedAt: "2026-07-10",
    usageNote: "Official Blossom asset; preserve shape and monochrome treatment.",
    tileBackground: "#111318",
  },
  "brand.anthropic": {
    id: "brand.anthropic",
    category: "brand",
    label: "Anthropic",
    shortLabel: "AI",
    assetPath: "icons/brand/anthropic.png",
    source: "https://www.anthropic.com/",
    accessedAt: "2026-07-10",
    usageNote: "Official product-site webclip; do not recolor.",
    tileBackground: "#F2EFE7",
  },
  "brand.deepseek": {
    id: "brand.deepseek",
    category: "brand",
    label: "DeepSeek",
    shortLabel: "DS",
    assetPath: "icons/brand/deepseek.png",
    source: "https://www.deepseek.com/favicon.ico",
    accessedAt: "2026-07-10",
    usageNote: "Official site icon converted losslessly to PNG.",
    tileBackground: "#F5F7FF",
  },
  "brand.qwen": {
    id: "brand.qwen",
    category: "brand",
    label: "Qwen",
    shortLabel: "QW",
    assetPath: "icons/brand/qwen.png",
    source: "https://qwen.ai/",
    accessedAt: "2026-07-10",
    usageNote: "Official Qwen product-site icon; do not recolor.",
    tileBackground: "#F4F6FF",
  },
  "brand.kimi": {
    id: "brand.kimi",
    category: "brand",
    label: "Kimi",
    shortLabel: "KM",
    assetPath: "icons/brand/kimi.png",
    source: "https://www.kimi.com/favicon.ico",
    accessedAt: "2026-07-10",
    usageNote: "Official Kimi site icon converted losslessly to PNG.",
    tileBackground: "#111318",
  },
  "brand.minimax": {
    id: "brand.minimax",
    category: "brand",
    label: "MiniMax",
    shortLabel: "MM",
    assetPath: "icons/brand/minimax.png",
    source: "https://www.minimax.io/favicon.ico",
    accessedAt: "2026-07-10",
    usageNote: "Official MiniMax site icon converted losslessly to PNG.",
    tileBackground: "#FFF0F4",
  },
  "brand.github": {
    id: "brand.github",
    category: "brand",
    label: "GitHub",
    shortLabel: "GH",
    assetPath: "icons/brand/github.png",
    source: "https://github.com/favicon.ico",
    accessedAt: "2026-07-11",
    usageNote: "Official site icon; do not recolor.",
    tileBackground: "#F5F5F5",
  },
  "brand.google-gemini": {
    id: "brand.google-gemini",
    category: "brand",
    label: "Google Gemini",
    shortLabel: "GE",
    assetPath: "icons/brand/gemini.png",
    source: "https://gemini.google.com/favicon.ico",
    accessedAt: "2026-07-11",
    usageNote: "Official product-site icon; do not recolor.",
    tileBackground: "#F5F7FF",
  },
  "brand.chatgpt": {
    id: "brand.chatgpt",
    category: "brand",
    label: "ChatGPT",
    shortLabel: "CG",
    assetPath: "icons/brand/chatgpt.png",
    source: "https://chatgpt.com/favicon.ico",
    accessedAt: "2026-07-11",
    usageNote: "Official product-site icon; do not recolor.",
    tileBackground: "#F5F5F5",
  },
  "brand.claude": {
    id: "brand.claude",
    category: "brand",
    label: "Claude / Claude Code",
    shortLabel: "CL",
    assetPath: "icons/brand/claude.png",
    source: "https://claude.ai/favicon.ico",
    accessedAt: "2026-07-11",
    usageNote: "Official product-site icon; do not recolor.",
    tileBackground: "#F3EEE7",
  },
  "brand.microsoft": {
    id: "brand.microsoft",
    category: "brand",
    label: "Microsoft",
    shortLabel: "MS",
    assetPath: "icons/brand/microsoft.png",
    source: "https://www.microsoft.com/favicon.ico",
    accessedAt: "2026-07-11",
    usageNote: "Official site icon; do not recolor.",
    tileBackground: "#FFFFFF",
  },
  "brand.apple": {
    id: "brand.apple",
    category: "brand",
    label: "Apple",
    shortLabel: "AP",
    assetPath: "icons/brand/apple.png",
    source: "https://www.apple.com/favicon.ico",
    accessedAt: "2026-07-11",
    usageNote: "Official site icon; preserve monochrome mark.",
    tileBackground: "#F5F5F5",
  },
  "brand.nvidia": {
    id: "brand.nvidia",
    category: "brand",
    label: "NVIDIA",
    shortLabel: "NV",
    assetPath: "icons/brand/nvidia.png",
    source: "https://www.nvidia.com/favicon.ico",
    accessedAt: "2026-07-11",
    usageNote: "Official site icon; do not recolor.",
    tileBackground: "#FFFFFF",
  },
  "brand.meta": {
    id: "brand.meta",
    category: "brand",
    label: "Meta",
    shortLabel: "ME",
    assetPath: "icons/brand/meta.png",
    source: "https://about.meta.com/favicon.ico",
    accessedAt: "2026-07-11",
    usageNote: "Official company-site icon; do not recolor.",
    tileBackground: "#FFFFFF",
  },
  "brand.amazon": {
    id: "brand.amazon",
    category: "brand",
    label: "Amazon",
    shortLabel: "AZ",
    assetPath: "icons/brand/amazon.png",
    source: "https://www.amazon.com/favicon.ico",
    accessedAt: "2026-07-11",
    usageNote: "Official site icon; do not recolor.",
    tileBackground: "#FFFFFF",
  },
  "brand.doubao": {
    id: "brand.doubao",
    category: "brand",
    label: "ByteDance / Doubao",
    shortLabel: "DB",
    assetPath: "icons/brand/doubao.png",
    source: "https://www.doubao.com/favicon.ico",
    accessedAt: "2026-07-11",
    usageNote: "Official product-site icon; do not recolor.",
    tileBackground: "#F5F7FF",
  },
};

export const systemIconRegistry: Record<SystemIconId, SystemIconDefinition> = {
  "system.gift": { id: "system.gift", category: "system", label: "Gift / free" },
  "system.document": { id: "system.document", category: "system", label: "Document" },
  "system.presentation": { id: "system.presentation", category: "system", label: "Presentation" },
  "system.design": { id: "system.design", category: "system", label: "Design" },
  "system.team": { id: "system.team", category: "system", label: "Team" },
  "system.trophy": { id: "system.trophy", category: "system", label: "Trophy / winner" },
  "system.chip": { id: "system.chip", category: "system", label: "Chip / model" },
  "system.globe": { id: "system.globe", category: "system", label: "Globe / region" },
  "system.quote": { id: "system.quote", category: "system", label: "Quote / source" },
  "system.ranking": { id: "system.ranking", category: "system", label: "Ranking / chart" },
  "system.flow": { id: "system.flow", category: "system", label: "Flow / process" },
  "system.check": { id: "system.check", category: "system", label: "Check / approved" },
  "system.warning": { id: "system.warning", category: "system", label: "Warning / risk" },
  "system.clock": { id: "system.clock", category: "system", label: "Clock / duration" },
  "system.calendar": { id: "system.calendar", category: "system", label: "Calendar / date" },
  "system.link": { id: "system.link", category: "system", label: "Source link" },
  "system.institution": { id: "system.institution", category: "system", label: "Institution / company" },
  "system.currency": { id: "system.currency", category: "system", label: "Currency / price" },
  "system.percentage": { id: "system.percentage", category: "system", label: "Percentage / ratio" },
  "system.line-chart": { id: "system.line-chart", category: "system", label: "Line chart / trend" },
  "system.database": { id: "system.database", category: "system", label: "Database / dataset" },
  "system.laboratory": { id: "system.laboratory", category: "system", label: "Laboratory / experiment" },
  "system.security": { id: "system.security", category: "system", label: "Security / guardrail" },
  "system.person": { id: "system.person", category: "system", label: "Person / creator" },
  "system.camera": { id: "system.camera", category: "system", label: "Camera / shooting" },
  "system.microphone": { id: "system.microphone", category: "system", label: "Microphone / narration" },
  "system.video": { id: "system.video", category: "system", label: "Video / footage" },
  "system.image": { id: "system.image", category: "system", label: "Image / media" },
  "system.animation": { id: "system.animation", category: "system", label: "Animation / motion" },
  "system.edit": { id: "system.edit", category: "system", label: "Edit / revise" },
  "system.search": { id: "system.search", category: "system", label: "Search / inspect" },
  "system.upload": { id: "system.upload", category: "system", label: "Upload / import" },
  "system.download": { id: "system.download", category: "system", label: "Download / delivery" },
  "system.settings": { id: "system.settings", category: "system", label: "Settings / configuration" },
  "system.layers": { id: "system.layers", category: "system", label: "Layers / composition" },
};

export const iconRegistry = { ...brandIconRegistry, ...systemIconRegistry };

export const isIconId = (id: string): id is IconId => id in iconRegistry;
