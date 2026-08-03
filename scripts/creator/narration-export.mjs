import { loadNarration } from "./narration.mjs";

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

export const narrationMarkdown = (narration) => `# ${narration.title}

## 口播稿

${narration.fullScript}

## 拍摄指导

${narration.shootingGuide.map((item) => `- ${item}`).join("\n")}
`;

export const narrationPlainText = (narration) =>
  `${narration.title}\n\n${narration.fullScript}\n\n拍摄指导\n${narration.shootingGuide.map((item, index) => `${index + 1}. ${item}`).join("\n")}\n`;

export const narrationPrintHtml = (narration) => `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>${escapeHtml(narration.title)}</title>
<style>@page{size:A4;margin:18mm}body{margin:0;color:#17201d;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;line-height:1.85}main{max-width:760px;margin:auto}h1{font-size:26px;margin:0 0 22px}h2{font-size:16px;margin:26px 0 8px;border-bottom:1px solid #dce6e1;padding-bottom:7px}.script{white-space:pre-wrap;font-size:15px}li{margin:6px 0}.meta{color:#708079;font-size:11px;margin-top:32px}@media print{button{display:none}}</style>
</head><body><main><button onclick="window.print()">打印或存储为 PDF</button><h1>${escapeHtml(narration.title)}</h1><h2>口播稿</h2><div class="script">${escapeHtml(narration.fullScript)}</div><h2>拍摄指导</h2><ol>${narration.shootingGuide.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol><p class="meta">由 SeanLab Studio 本地导出</p></main><script>window.addEventListener("load",()=>window.print())</script></body></html>`;

export const buildNarrationExport = async (projectId, format) => {
  const narration = await loadNarration(projectId);
  if (format === "md")
    return { contentType: "text/markdown; charset=utf-8", extension: "md", body: narrationMarkdown(narration) };
  if (format === "txt")
    return { contentType: "text/plain; charset=utf-8", extension: "txt", body: narrationPlainText(narration) };
  if (format === "json")
    return {
      contentType: "application/json; charset=utf-8",
      extension: "json",
      body: `${JSON.stringify(narration, null, 2)}\n`,
    };
  if (format === "pdf")
    return {
      contentType: "text/html; charset=utf-8",
      extension: "html",
      body: narrationPrintHtml(narration),
      print: true,
    };
  throw new Error("Unsupported narration export format");
};
