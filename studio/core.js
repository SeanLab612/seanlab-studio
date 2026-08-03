export const $ = (selector) => document.querySelector(selector);

export const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const agentAssets = {
  "codex-cli": { name: "Codex CLI", icon: "/assets/agent-icons/codex.svg" },
  "claude-code": { name: "Claude Code", icon: "/assets/agent-icons/claude.svg" },
};

export const agentAsset = (id) => agentAssets[id] ?? agentAssets["codex-cli"];

let studioToken;

export const api = async (path, options = {}) => {
  let response;
  try {
    response = await fetch(path, {
      ...options,
      headers: {
        "content-type": "application/json",
        ...(studioToken ? { "x-studio-token": studioToken } : {}),
        ...(options.headers ?? {}),
      },
      body: options.body && typeof options.body !== "string" ? JSON.stringify(options.body) : options.body,
    });
  } catch {
    throw new Error("Studio 服务连接已中断，请重新启动服务后再试");
  }
  const value = await response.json();
  if (!response.ok) throw new Error(value.error ?? `Request failed: ${response.status}`);
  if (typeof value.csrfToken === "string") studioToken = value.csrfToken;
  return value;
};

export const toast = (message) => {
  $("#toast").textContent = message;
  $("#toast").classList.add("show");
  setTimeout(() => $("#toast").classList.remove("show"), 2600);
};
