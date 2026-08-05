import {
  intentLabels,
  legacyCategoryLabels,
  materialKindLabels,
  recutDispositionLabels,
  recutKindLabels,
  revisionKindLabels,
  sourceKindLabels,
  statusLabels,
  stepIndex,
  taskPresentations,
  visualComponentCatalog,
  visualFormCatalog,
  workflowStatusLabels,
} from "./contracts.js";
import { $, agentAsset, api, escapeHtml, toast } from "./core.js";
import {
  formatDateTime,
  getLocale,
  localeButtonLabel,
  localeButtonTitle,
  startI18n,
  switchLocale,
  translateText,
} from "./i18n.js";

startI18n();

const state = {
  projects: [],
  invalidProjects: [],
  agents: [],
  providers: { environment: {}, providers: [] },
  selected: null,
  detail: null,
  projectLoadToken: 0,
  jobs: [],
  workflow: null,
  staticReview: null,
  delivery: null,
  deliveryProfileDraft: null,
  cover: null,
  workspaceMode: "video",
  coverIconIds: [],
  coverIconPickerOpen: false,
  operations: null,
  operationsTab: "content",
  recovery: null,
  revisionPreview: null,
  reviewFilter: "priority",
  reviewGalleryFrame: null,
  activeReviewFrame: null,
  reviewZoom: 100,
  viewStep: null,
  settingsTab: "health",
  resourceLibraryTab: "components",
  generatedAssets: [],
  imageAssets: [],
  selectedGeneratedAssetKeys: new Set(),
  selectedImageAssetIds: new Set(),
  editingImageAssetId: null,
  imageAssetMatchPreview: null,
  health: null,
  doctor: null,
  deleteTarget: null,
  metadata: { name: "SeanLab Studio", version: "0.1.0" },
  editorial: { categories: [], questionnaires: {}, editingProjectId: null },
  activeNarrationSection: 0,
};
let visualStoryboardAutosaveQueue = Promise.resolve();
let visualStoryboardAutosaveVersion = 0;
const setVisualSaveStatus = (projectId, message, stateName) => {
  if (state.selected !== projectId) return;
  document.querySelectorAll("[data-visual-save-status]").forEach((status) => {
    status.textContent = message;
    status.dataset.state = stateName;
  });
};
const autosaveVisualStoryboard = (projectId) => {
  const storyboard = structuredClone(state.detail?.visualStoryboard);
  if (!storyboard) return Promise.resolve(false);
  const version = ++visualStoryboardAutosaveVersion;
  setVisualSaveStatus(projectId, "正在保存…", "saving");
  visualStoryboardAutosaveQueue = visualStoryboardAutosaveQueue
    .catch(() => undefined)
    .then(() =>
      api(`/api/projects/${projectId}/visual-storyboard`, {
        method: "PUT",
        body: storyboard,
        keepalive: true,
      }),
    )
    .then(
      () => {
        if (version === visualStoryboardAutosaveVersion)
          setVisualSaveStatus(projectId, "已自动保存", "saved");
        return true;
      },
      (error) => {
        if (version === visualStoryboardAutosaveVersion)
          setVisualSaveStatus(projectId, "保存失败", "error");
        if (state.selected === projectId) toast(`视觉方案保存失败：${error.message}`);
        return false;
      },
    );
  return visualStoryboardAutosaveQueue;
};
const categoryLabel = (categoryId) =>
  state.editorial.categories.find((category) => category.id === categoryId)?.label ??
  legacyCategoryLabels[categoryId] ??
  categoryId;
const sidebarWidthStorageKey = "seanlab-studio-sidebar-width";
const sidebarCollapsedStorageKey = "seanlab-studio-sidebar-collapsed";
const clampSidebarWidth = (value) => Math.max(180, Math.min(420, Number(value) || 220));
const applySidebarWidth = (value, { persist = false } = {}) => {
  const width = clampSidebarWidth(value);
  document.documentElement.style.setProperty("--sidebar-width", `${width}px`);
  $("#sidebar-resizer")?.setAttribute("aria-valuenow", String(width));
  if (persist) {
    try {
      localStorage.setItem(sidebarWidthStorageKey, String(width));
    } catch {}
  }
  return width;
};
const setupSidebarResize = () => {
  const resizer = $("#sidebar-resizer");
  if (!resizer) return;
  let storedWidth = 220;
  try {
    storedWidth = clampSidebarWidth(localStorage.getItem(sidebarWidthStorageKey));
  } catch {}
  applySidebarWidth(storedWidth);
  let resizing = false;
  const finish = () => {
    if (!resizing) return;
    resizing = false;
    document.body.classList.remove("resizing-sidebar");
    applySidebarWidth(Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--sidebar-width")), {
      persist: true,
    });
  };
  resizer.addEventListener("pointerdown", (event) => {
    resizing = true;
    document.body.classList.add("resizing-sidebar");
    resizer.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  });
  window.addEventListener("pointermove", (event) => {
    if (resizing) applySidebarWidth(event.clientX);
  });
  window.addEventListener("pointerup", finish);
  window.addEventListener("pointercancel", finish);
  resizer.addEventListener("dblclick", () => applySidebarWidth(220, { persist: true }));
  resizer.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home"].includes(event.key)) return;
    const current = Number(resizer.getAttribute("aria-valuenow")) || 220;
    applySidebarWidth(event.key === "Home" ? 220 : current + (event.key === "ArrowLeft" ? -16 : 16), {
      persist: true,
    });
    event.preventDefault();
  });
};
const setSidebarCollapsed = (collapsed, { persist = false } = {}) => {
  const shell = $(".app-shell");
  const toggle = $("#sidebar-toggle");
  shell?.classList.toggle("sidebar-collapsed", collapsed);
  if (toggle) {
    toggle.setAttribute("aria-expanded", String(!collapsed));
    toggle.setAttribute("aria-label", collapsed ? "显示项目边栏" : "隐藏项目边栏");
    toggle.title = collapsed ? "显示项目边栏" : "隐藏项目边栏";
  }
  if (persist) {
    try {
      localStorage.setItem(sidebarCollapsedStorageKey, String(collapsed));
    } catch {}
  }
};
const setupSidebarToggle = () => {
  let collapsed = false;
  try {
    collapsed = localStorage.getItem(sidebarCollapsedStorageKey) === "true";
  } catch {}
  setSidebarCollapsed(collapsed);
  $("#sidebar-toggle")?.addEventListener("click", () => {
    const next = !$(".app-shell")?.classList.contains("sidebar-collapsed");
    setSidebarCollapsed(next, { persist: true });
  });
};
const latestJob = (projectId, kind) => state.jobs.filter((item) => item.projectId === projectId && (!kind || item.kind === kind)).at(-1);
const latestNarrationJob = (projectId) =>
  state.jobs
    .filter(
      (item) =>
        item.projectId === projectId &&
        ["editorial-inference", "material-understanding", "narration", "narration-rewrite", "visual-storyboard-seed"].includes(item.kind),
    )
    .at(-1);
const slug = (value) => {
  const latin = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return (latin || `seanlab-${Date.now().toString().slice(-8)}`).slice(0, 63);
};
const refresh = async () => {
  const [agents, inventory, jobs, metadata, providers, editorial, generatedAssets, imageAssets] = await Promise.all([
    api("/api/agents"),
    api("/api/project-inventory"),
    api("/api/jobs"),
    api("/api/app"),
    api("/api/providers"),
    api("/api/editorial-questions"),
    api("/api/generated-assets"),
    api("/api/image-assets"),
  ]);
  state.agents = agents;
  state.projects = inventory.projects;
  state.invalidProjects = inventory.invalidProjects;
  state.jobs = jobs;
  state.metadata = metadata;
  state.providers = providers;
  state.editorial = editorial;
  state.generatedAssets = generatedAssets;
  state.imageAssets = imageAssets;
  const candidateKeys = new Set(generatedAssets.map((asset) => `${asset.projectId}/${asset.id}`));
  state.selectedGeneratedAssetKeys = new Set(
    [...state.selectedGeneratedAssetKeys].filter((key) => candidateKeys.has(key)),
  );
  const imageAssetIds = new Set(imageAssets.map((asset) => asset.id));
  state.selectedImageAssetIds = new Set([...state.selectedImageAssetIds].filter((id) => imageAssetIds.has(id)));
  if (state.editingImageAssetId && !imageAssetIds.has(state.editingImageAssetId)) {
    state.editingImageAssetId = null;
    state.imageAssetMatchPreview = null;
  }
  renderSidebar();
  renderAgentOptions();
  renderResourceLibrary();
  renderTopbar();
  if (state.selected) await selectProject(state.selected);
};
const renderSidebar = () => {
  const projects = state.projects.map((item) => `
    <div class="project-list-row ${item.project.id === state.selected ? "active" : ""}">
      <button class="project-item" data-project="${item.project.id}">
        <span class="project-item-mark">${escapeHtml(item.project.title.slice(0, 1).toUpperCase())}</span>
        <span class="project-item-copy"><strong>${escapeHtml(item.project.title)}</strong><span>${statusLabels[item.project.status]}</span></span>
      </button>
      <details class="project-actions">
        <summary aria-label="打开 ${escapeHtml(item.project.title)} 的项目操作">更多</summary>
        <div><button type="button" data-delete-project="${item.project.id}">删除项目</button></div>
      </details>
    </div>`).join("");
  const invalidProjects = state.invalidProjects
    .map(
      (item) => `<div class="invalid-project" role="status">
        <strong>${escapeHtml(item.id)}</strong>
        <span>项目文件需要修复</span>
        <small title="${escapeHtml(item.path)}">${escapeHtml(item.error)}</small>
      </div>`,
    )
    .join("");
  $("#project-list").innerHTML =
    projects || invalidProjects
      ? `${projects}${invalidProjects}`
      : '<p class="muted" style="padding:8px">还没有项目</p>';
  document.querySelectorAll("[data-project]").forEach((button) => button.onclick = () => selectProject(button.dataset.project));
  document.querySelectorAll("[data-delete-project]").forEach((button) => button.onclick = () => openDeleteDialog(button.dataset.deleteProject));
};
const renderAgentOptions = () => {
  const firstAvailableAgent = state.agents.find((agent) => agent.available)?.id;
  const select = $("#agent-options");
  select.innerHTML = state.agents
    .filter((agent) => agent.available)
    .map((agent) => `<option value="${escapeHtml(agent.id)}" ${agent.id === firstAvailableAgent ? "selected" : ""}>${escapeHtml(agent.displayName)}</option>`)
    .join("");
  select.disabled = !firstAvailableAgent;
  select.onchange = renderAgentModelOptions;
  renderAgentModelOptions();
};
const renderAgentModelOptions = () => {
  const selectedAgentId = $("#agent-options").value;
  const icon = $("#project-agent-icon");
  icon.src = agentAsset(selectedAgentId).icon;
  icon.hidden = !selectedAgentId;
  const approvedModels =
    state.agents.find((agent) => agent.id === selectedAgentId)?.governance?.approvedModels ?? [];
  const select = $("#agent-model");
  select.disabled = approvedModels.length === 0;
  select.innerHTML = approvedModels
    .map((model) => `<option value="${escapeHtml(model)}">${escapeHtml(model)}</option>`)
    .join("");
};
const resourceLibraryTabs = [
  { id: "components", label: "组件", count: () => state.metadata.componentIds?.length ?? 0 },
  { id: "animations", label: "动画模板", count: () => state.metadata.animationTemplates?.length ?? 0 },
  { id: "images", label: "图片素材", count: () => state.imageAssets.length },
  { id: "icons", label: "图标", count: () => state.metadata.icons?.length ?? 0 },
  { id: "generated", label: "待入库素材", count: () => state.generatedAssets.length },
];
const generatedAssetKey = (asset) => `${asset.projectId}/${asset.id}`;
const splitMetadataValues = (value) =>
  String(value ?? "")
    .split(/[,，\n]/)
    .map((item) => item.normalize("NFKC").trim())
    .filter(Boolean);
const metadataListValue = (asset, field) => (Array.isArray(asset?.[field]) ? asset[field].join("，") : "");
const refreshImageAssetState = async () => {
  const [generatedAssets, imageAssets] = await Promise.all([
    api("/api/generated-assets"),
    api("/api/image-assets"),
  ]);
  state.generatedAssets = generatedAssets;
  state.imageAssets = imageAssets;
  const candidateKeys = new Set(generatedAssets.map(generatedAssetKey));
  state.selectedGeneratedAssetKeys = new Set(
    [...state.selectedGeneratedAssetKeys].filter((key) => candidateKeys.has(key)),
  );
  const imageAssetIds = new Set(imageAssets.map((asset) => asset.id));
  state.selectedImageAssetIds = new Set([...state.selectedImageAssetIds].filter((id) => imageAssetIds.has(id)));
};
const resourceIconMarkup = (icon) =>
  icon.category === "brand"
    ? `<span class="brand-text-badge" aria-hidden="true">${escapeHtml(icon.textBadge)}</span>`
    : `<svg viewBox="0 0 24 24" aria-hidden="true"><use href="/local-assets/icons/system/sprite.svg#${escapeHtml(icon.symbolId)}"></use></svg>`;
const bindResourceLibraryActions = () => {
  document.querySelectorAll("[data-resource-library-tab]").forEach((button) =>
    button.addEventListener("click", () => {
      state.resourceLibraryTab = button.dataset.resourceLibraryTab;
      renderResourceLibrary();
    }),
  );
  $("#resource-library-close")?.addEventListener("click", () => {
    $("#resource-library-panel").hidden = true;
    $("#resource-library-toggle").setAttribute("aria-expanded", "false");
  });
  document.querySelectorAll("[data-select-generated]").forEach((input) =>
    input.addEventListener("change", () => {
      if (input.checked) state.selectedGeneratedAssetKeys.add(input.dataset.selectGenerated);
      else state.selectedGeneratedAssetKeys.delete(input.dataset.selectGenerated);
      renderResourceLibrary();
    }),
  );
  $("#select-all-generated")?.addEventListener("click", () => {
    state.selectedGeneratedAssetKeys = new Set(state.generatedAssets.map(generatedAssetKey));
    renderResourceLibrary();
  });
  $("#clear-generated-selection")?.addEventListener("click", () => {
    state.selectedGeneratedAssetKeys.clear();
    renderResourceLibrary();
  });
  document.querySelectorAll("[data-select-image-asset]").forEach((input) =>
    input.addEventListener("change", () => {
      if (input.checked) state.selectedImageAssetIds.add(input.dataset.selectImageAsset);
      else state.selectedImageAssetIds.delete(input.dataset.selectImageAsset);
      renderResourceLibrary();
    }),
  );
  $("#select-all-image-assets")?.addEventListener("click", () => {
    state.selectedImageAssetIds = new Set(state.imageAssets.map((asset) => asset.id));
    renderResourceLibrary();
  });
  $("#clear-image-asset-selection")?.addEventListener("click", () => {
    state.selectedImageAssetIds.clear();
    renderResourceLibrary();
  });
  $("#image-asset-batch-tags")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const tags = splitMetadataValues(new FormData(form).get("tags"));
    if (!tags.length || !state.selectedImageAssetIds.size) return;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      await api("/api/image-assets/metadata/batch-tags", {
        method: "POST",
        body: {
          confirmation: "human-add-image-asset-tags-batch",
          assetIds: [...state.selectedImageAssetIds],
          tags,
        },
      });
      await refreshImageAssetState();
      renderResourceLibrary();
      toast(`已为 ${state.selectedImageAssetIds.size} 项图片素材追加标签`);
    } catch (error) {
      button.disabled = false;
      toast(error.message);
    }
  });
  document.querySelectorAll("[data-edit-image-asset]").forEach((button) =>
    button.addEventListener("click", () => {
      state.editingImageAssetId = button.dataset.editImageAsset;
      state.imageAssetMatchPreview = null;
      renderResourceLibrary();
      $("#image-asset-metadata-form")?.scrollIntoView({ block: "nearest" });
    }),
  );
  document.querySelectorAll("[data-cancel-image-asset-metadata]").forEach((button) =>
    button.addEventListener("click", () => {
      state.editingImageAssetId = null;
      state.imageAssetMatchPreview = null;
      renderResourceLibrary();
    }),
  );
  $("#image-asset-metadata-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      await api(`/api/image-assets/${encodeURIComponent(state.editingImageAssetId)}/metadata`, {
        method: "PUT",
        body: {
          confirmation: "human-update-image-asset-metadata",
          metadata: {
            displayName: data.get("displayName"),
            subject: data.get("subject"),
            description: data.get("description"),
            style: data.get("style"),
            aliases: splitMetadataValues(data.get("aliases")),
            keywords: splitMetadataValues(data.get("keywords")),
            tags: splitMetadataValues(data.get("tags")),
            applicableScenes: splitMetadataValues(data.get("applicableScenes")),
            excludedTerms: splitMetadataValues(data.get("excludedTerms")),
          },
        },
      });
      await refreshImageAssetState();
      renderResourceLibrary();
      toast("图片素材元数据已保存");
    } catch (error) {
      button.disabled = false;
      toast(error.message);
    }
  });
  $("#image-asset-match-preview-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const text = new FormData(form).get("text");
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      state.imageAssetMatchPreview = await api(
        `/api/image-assets/${encodeURIComponent(state.editingImageAssetId)}/match-preview`,
        { method: "POST", body: { text } },
      );
      renderResourceLibrary();
    } catch (error) {
      button.disabled = false;
      toast(error.message);
    }
  });
  $("#promote-selected-generated")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const selections = state.generatedAssets
      .filter((asset) => state.selectedGeneratedAssetKeys.has(generatedAssetKey(asset)))
      .map((asset) => ({ projectId: asset.projectId, assetId: asset.id }));
    if (!selections.length) return;
    button.disabled = true;
    try {
      await api("/api/generated-assets/promote-batch", {
        method: "POST",
        body: { confirmation: "human-promote-generated-assets-batch", selections },
      });
      state.selectedGeneratedAssetKeys.clear();
      await refreshImageAssetState();
      renderResourceLibrary();
      toast(`已将 ${selections.length} 项素材加入图片素材库`);
    } catch (error) {
      button.disabled = false;
      toast(error.message);
    }
  });
  document.querySelectorAll("[data-promote-generated]").forEach((button) =>
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        await api(
          `/api/projects/${encodeURIComponent(button.dataset.projectId)}/generated-assets/${encodeURIComponent(button.dataset.promoteGenerated)}/promote`,
          { method: "POST", body: { confirmation: "human-promote-generated-asset" } },
        );
        state.selectedGeneratedAssetKeys.delete(`${button.dataset.projectId}/${button.dataset.promoteGenerated}`);
        await refreshImageAssetState();
        renderResourceLibrary();
        toast("素材已加入图片素材库");
      } catch (error) {
        button.disabled = false;
        toast(error.message);
      }
    }),
  );
};
const renderResourceLibrary = () => {
  const panel = $("#resource-library-panel");
  if (!panel) return;
  const tabs = resourceLibraryTabs
    .map(
      (tab) =>
        `<button type="button" class="${state.resourceLibraryTab === tab.id ? "active" : ""}" data-resource-library-tab="${tab.id}">${tab.label}<span>${tab.count()}</span></button>`,
    )
    .join("");
  let body = "";
  if (state.resourceLibraryTab === "generated") {
    const selectedCount = state.selectedGeneratedAssetKeys.size;
    body = state.generatedAssets.length
      ? `<div class="resource-generated-toolbar">
          <div><button type="button" id="select-all-generated">全选</button><button type="button" id="clear-generated-selection" ${selectedCount ? "" : "disabled"}>清空选择</button><span>已选择 ${selectedCount} 项</span></div>
          <button type="button" class="primary" id="promote-selected-generated" ${selectedCount ? "" : "disabled"}>确认入库 ${selectedCount} 项</button>
        </div><div class="resource-generated-grid">${state.generatedAssets
          .map(
            (asset) => `<article class="resource-generated-card ${state.selectedGeneratedAssetKeys.has(generatedAssetKey(asset)) ? "selected" : ""}">
              <label class="resource-generated-check"><input type="checkbox" data-select-generated="${escapeHtml(generatedAssetKey(asset))}" ${state.selectedGeneratedAssetKeys.has(generatedAssetKey(asset)) ? "checked" : ""}/><span>选择</span></label>
              <img src="/api/projects/${encodeURIComponent(asset.projectId)}/generated-assets/${encodeURIComponent(asset.id)}/preview" alt="${escapeHtml(asset.subject)}"/>
              <div><strong>${escapeHtml(asset.subject)}</strong><small>${escapeHtml(asset.templateId)} · ${escapeHtml(asset.projectId)}</small><button type="button" class="primary" data-promote-generated="${escapeHtml(asset.id)}" data-project-id="${escapeHtml(asset.projectId)}">加入素材库</button></div>
            </article>`,
          )
          .join("")}</div>`
      : '<div class="resource-empty"><strong>暂无待入库素材</strong><p>真实项目生成的图片会先保存在项目内，由你确认后再加入全局素材库。</p></div>';
  } else if (state.resourceLibraryTab === "images") {
    const selectedCount = state.selectedImageAssetIds.size;
    const editingAsset = state.imageAssets.find((asset) => asset.id === state.editingImageAssetId);
    const editor = editingAsset
      ? `<section class="resource-image-editor">
          <header><div><small>人工整理元数据</small><h3>${escapeHtml(editingAsset.displayName ?? editingAsset.subject ?? editingAsset.id)}</h3><p>这些字段只影响本地素材检索，不会自动改变项目视觉方案。</p></div><button type="button" data-cancel-image-asset-metadata aria-label="关闭编辑">×</button></header>
          <form id="image-asset-metadata-form" class="resource-image-metadata-form">
            <label>显示名称<input name="displayName" maxlength="80" value="${escapeHtml(editingAsset.displayName ?? editingAsset.subject ?? "")}"/></label>
            <label>主体<input name="subject" maxlength="120" value="${escapeHtml(editingAsset.subject ?? "")}"/></label>
            <label>风格<input name="style" maxlength="80" value="${escapeHtml(editingAsset.style ?? editingAsset.templateId ?? "")}"/></label>
            <label class="wide">描述<textarea name="description" maxlength="500">${escapeHtml(editingAsset.description ?? "")}</textarea></label>
            <label>别名<textarea name="aliases" placeholder="用逗号或换行分隔">${escapeHtml(metadataListValue(editingAsset, "aliases"))}</textarea></label>
            <label>关键词<textarea name="keywords" placeholder="用逗号或换行分隔">${escapeHtml(metadataListValue(editingAsset, "keywords"))}</textarea></label>
            <label>标签<textarea name="tags" placeholder="用逗号或换行分隔">${escapeHtml(metadataListValue(editingAsset, "tags"))}</textarea></label>
            <label>适用场景<textarea name="applicableScenes" placeholder="例如：播客录音、声音处理">${escapeHtml(metadataListValue(editingAsset, "applicableScenes"))}</textarea></label>
            <label class="wide">排除词<textarea name="excludedTerms" placeholder="命中这些词时不推荐此素材">${escapeHtml(metadataListValue(editingAsset, "excludedTerms"))}</textarea></label>
            <div class="resource-image-editor-actions"><button type="button" data-cancel-image-asset-metadata>取消</button><button type="submit" class="primary">保存元数据</button></div>
          </form>
          <form id="image-asset-match-preview-form" class="resource-image-match-preview">
            <label>试匹配一段口播<textarea name="text" maxlength="2000" required placeholder="输入一段真实口播，检查这张素材是否会被推荐"></textarea></label>
            <button type="submit">运行本地匹配</button>
            ${
              state.imageAssetMatchPreview
                ? state.imageAssetMatchPreview.kind === "image"
                  ? `<output class="matched"><b>会进入图片候选 · ${state.imageAssetMatchPreview.recommended.score} 分</b><span>命中：${escapeHtml(state.imageAssetMatchPreview.recommended.matchedTerms.join(" · "))}</span></output>`
                  : `<output><b>不会进入图片候选</b><span>${escapeHtml(state.imageAssetMatchPreview.reason)}</span></output>`
                : ""
            }
          </form>
        </section>`
      : "";
    body = state.imageAssets.length
      ? `<div class="resource-image-toolbar">
          <div><button type="button" id="select-all-image-assets">全选</button><button type="button" id="clear-image-asset-selection" ${selectedCount ? "" : "disabled"}>清空选择</button><span>已选择 ${selectedCount} 项</span></div>
          <form id="image-asset-batch-tags"><input name="tags" placeholder="批量追加标签，逗号分隔" ${selectedCount ? "" : "disabled"}/><button type="submit" ${selectedCount ? "" : "disabled"}>追加到所选素材</button></form>
        </div>${editor}<div class="resource-image-grid">${state.imageAssets
          .map(
            (asset) => `<article class="resource-image-card ${state.selectedImageAssetIds.has(asset.id) ? "selected" : ""}">
              <label class="resource-image-check"><input type="checkbox" data-select-image-asset="${escapeHtml(asset.id)}" ${state.selectedImageAssetIds.has(asset.id) ? "checked" : ""}/><span>选择</span></label>
              <img src="/api/image-assets/${encodeURIComponent(asset.id)}/preview" alt="${escapeHtml(asset.displayName ?? asset.subject ?? "图片素材")}"/>
              <div><strong>${escapeHtml(asset.displayName ?? asset.subject ?? asset.id)}</strong><small>${escapeHtml(asset.style ?? asset.templateId ?? "图片素材")} · ${escapeHtml(asset.sourceProjectId ?? asset.projectId ?? "共享素材库")}</small><span>${asset.origin === "generated" ? "项目生成后人工入库" : "共享图片素材"}</span>${asset.duplicateAssetIds?.length ? `<em>检测到完全重复：${escapeHtml(asset.duplicateAssetIds.join("、"))}</em>` : ""}<button type="button" data-edit-image-asset="${escapeHtml(asset.id)}">整理元数据</button></div>
            </article>`,
          )
          .join("")}</div>`
      : '<div class="resource-empty"><strong>图片素材库还是空的</strong><p>在“待入库素材”中确认的图片会显示在这里，供后续工作流匹配使用。</p></div>';
  } else if (state.resourceLibraryTab === "animations") {
    body = `<div class="resource-animation-grid">${(state.metadata.animationTemplates ?? [])
      .map(
        (template) => `<article class="resource-animation-card">
          <video controls muted loop playsinline preload="metadata" src="${escapeHtml(template.previewUrl)}" aria-label="${escapeHtml(template.label)} 预览"></video>
          <div><strong>${escapeHtml(template.label)}</strong><p>${escapeHtml(template.description)}</p><span>${template.previewSeconds} 秒预览</span></div>
        </article>`,
      )
      .join("")}</div>`;
  } else if (state.resourceLibraryTab === "icons") {
    body = `<div class="resource-icon-grid">${(state.metadata.icons ?? [])
      .map(
        (icon) => `<article class="resource-icon-card"><span>${resourceIconMarkup(icon)}</span><b>${escapeHtml(icon.label)}</b><small>${icon.category === "brand" ? "品牌" : "功能"}</small></article>`,
      )
      .join("")}</div>`;
  } else {
    const registered = new Set(state.metadata.componentIds ?? []);
    body = `<div class="resource-component-grid">${visualComponentCatalog
      .filter((component) => registered.has(component.id))
      .map(
        (component) => `<article class="resource-component-card">${componentPreviewMarkup(component)}<div><b>${escapeHtml(component.label)}</b><small>${escapeHtml(component.forms.map((form) => visualFormCatalog[form]?.label ?? form).join(" · "))}</small></div></article>`,
      )
      .join("")}</div>`;
  }
  panel.innerHTML = `<header><div><small>RESOURCE LIBRARY</small><h2>视觉资源库</h2><p>浏览已注册资源；项目新生成的图片只有经你确认后才会加入全局素材库。</p></div><button type="button" id="resource-library-close" aria-label="关闭视觉资源库">×</button></header><nav class="resource-library-tabs" aria-label="资源分类">${tabs}</nav><div class="resource-library-content">${body}</div>`;
  bindResourceLibraryActions();
};
const shortVersion = () => {
  const [major = "0", minor = "1"] = String(state.metadata.version ?? "0.1.0").split(".");
  return `v${major}.${minor}`;
};
const renderTopbar = () => {
  $("#studio-version").textContent = shortVersion();
  const titleButton = $("#project-title-button");
  const selectedProject = state.detail?.project;
  titleButton.textContent = selectedProject?.project.title ?? "未选择项目";
  titleButton.disabled = !selectedProject;
  const switcher = $("#workspace-switcher");
  switcher.hidden = !selectedProject;
  document.querySelectorAll("[data-workspace-mode]").forEach((button) => {
    const active = button.dataset.workspaceMode === state.workspaceMode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  const pinnedAgentId = selectedProject?.agent.id;
  const detectedAgent = state.agents.find((agent) => agent.id === pinnedAgentId);
  const asset = agentAsset(pinnedAgentId);
  $("#topbar-agent").classList.toggle("topbar-agent-warning", Boolean(pinnedAgentId && !detectedAgent?.available));
  $("#topbar-agent-icon").src = asset.icon;
  $("#topbar-agent-icon").hidden = !pinnedAgentId;
  $("#topbar-agent-name").textContent = pinnedAgentId ? asset.name : "未固定";
  $("#topbar-agent-status").textContent = pinnedAgentId
    ? detectedAgent?.available
      ? "已认证"
      : "当前不可用"
    : "等待选择项目";
  const languageToggle = $("#language-toggle");
  languageToggle.textContent = localeButtonLabel();
  languageToggle.title = localeButtonTitle();
  languageToggle.setAttribute("aria-label", localeButtonTitle());
};
const setFormError = (selector, message = "") => {
  const element = $(selector);
  element.textContent = message;
  element.hidden = !message;
};
const openDialog = () => {
  setFormError("#project-form-error");
  $("#project-dialog").showModal();
};
const closeProjectDialog = () => {
  $("#project-dialog").close();
  $("#project-form").reset();
  renderAgentOptions();
  setFormError("#project-form-error");
};
const openDeleteDialog = (id) => {
  const project = state.projects.find((item) => item.project.id === id);
  if (!project) return;
  state.deleteTarget = id;
  $("#delete-project-name").textContent = project.project.title;
  $("#delete-project-folder").textContent = `projects/${project.project.id}/`;
  $("#delete-project-confirmation").value = "";
  $("#delete-project-confirmation").placeholder = project.project.title;
  setFormError("#delete-project-error");
  $("#delete-project-dialog").showModal();
};
const closeDeleteDialog = () => {
  $("#delete-project-dialog").close();
  state.deleteTarget = null;
  $("#delete-project-form").reset();
  setFormError("#delete-project-error");
};
const renderSettingsPanel = () => {
  const panel = $("#settings-panel");
  document.querySelectorAll("[data-settings-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.settingsTab === state.settingsTab);
  });
  if (state.settingsTab === "health") {
    const report = state.doctor;
    const queue = state.health?.jobs;
    const disk = report?.checks?.find((item) => item.id === "disk");
    const python = report?.checks?.find((item) => item.id === "python");
    const ffmpeg = report?.checks?.find((item) => item.id === "ffmpeg");
    const doctorLabel = !report
      ? "正在检查"
      : report.status === "passed"
        ? "运行正常"
        : report.status === "warning"
          ? "有待处理项"
          : "需要修复";
    panel.innerHTML = `
      <div class="settings-toolbar">
        <div><h3>设置与健康状态</h3></div>
        <button type="button" class="secondary" id="run-doctor">${report ? "重新检查" : "检查中…"}</button>
      </div>
      <div class="health-hero ${escapeHtml(report?.status ?? "loading")}">
        <span class="health-orb"></span>
        <div><small>STUDIO HEALTH</small><h4>${doctorLabel}</h4><p>${report ? `${report.summary.passed} 项通过${report.summary.warnings ? `，${report.summary.warnings} 项提醒` : ""}${report.summary.failed ? `，${report.summary.failed} 项失败` : ""}` : "正在读取本机环境和服务状态…"}</p></div>
      </div>
      <div class="health-grid">
        <article><span>任务队列</span><b>${queue ? `${queue.running.length} 运行 · ${queue.queued.length} 排队` : "读取中"}</b><small>全局最多同时运行 ${queue?.maxConcurrent ?? 1} 个重任务</small></article>
        <article><span>本地空间</span><b>${escapeHtml(disk?.summary ?? "读取中")}</b><small>低于安全空间时 Doctor 会阻止生产</small></article>
        <article><span>视频环境</span><b>${ffmpeg?.status === "passed" ? "FFmpeg 正常" : "等待检查"}</b><small>H.264、HEVC、AAC 与完整解码</small></article>
        <article><span>分析环境</span><b>${python?.status === "passed" ? "Python 正常" : "等待检查"}</b><small>使用仓库本地 .venv</small></article>
      </div>
      ${report?.checks?.some((item) => ["warning", "failed"].includes(item.status)) ? `<div class="health-findings"><h4>需要留意</h4>${report.checks.filter((item) => ["warning", "failed"].includes(item.status)).map((item) => `<div><span class="health-state ${item.status}"></span><p><b>${escapeHtml(item.label)}</b><small>${escapeHtml(item.summary)}</small></p></div>`).join("")}</div>` : ""}
      <p class="provider-security-note">健康检查不会生成内容、执行翻译或启动渲染，也不会读取密钥正文。</p>`;
    $("#run-doctor")?.addEventListener("click", loadStudioHealth);
    return;
  }
  if (state.settingsTab === "agent") {
    const pinnedAgentId = state.detail?.project.agent.id;
    panel.innerHTML = `
      <div class="settings-toolbar">
        <div><h3>Agent 与模型</h3></div>
        <button type="button" class="secondary" id="rescan-agents">重新扫描</button>
      </div>
      <div class="agent-settings-list">
        ${state.agents.map((agent) => {
          const asset = agentAsset(agent.id);
          const status = agent.available ? "已安装并认证" : "当前不可用";
          const approvedModels = agent.governance?.approvedModels ?? [];
          const candidates = agent.governance?.candidates ?? [];
          return `<article class="agent-settings-card ${agent.id === pinnedAgentId ? "current" : ""}">
            <div class="agent-icon-box"><img class="agent-logo" src="${asset.icon}" alt=""/></div>
            <div>
              <div class="agent-card-name"><span class="agent-state-dot ${agent.available ? "available" : ""}"></span>${escapeHtml(agent.displayName)}</div>
              <div class="agent-card-meta">${escapeHtml(agent.version ?? agent.remediation ?? "未检测到版本")} · 已通过 ${approvedModels.length} · 待审核 ${candidates.length}</div>
            </div>
            <div class="agent-card-state"><span>${status}</span><span class="current-badge">已适配</span>${agent.id === pinnedAgentId ? '<span class="current-badge">当前项目</span>' : ""}</div>
          </article>`;
        }).join("")}
      </div>`;
    $("#rescan-agents").addEventListener("click", async (event) => {
      const button = event.currentTarget;
      button.disabled = true;
      button.textContent = "扫描中…";
      try {
        state.agents = await api(`/api/agents?scan=${Date.now()}`);
        renderSidebar();
        renderAgentOptions();
        renderTopbar();
        renderSettingsPanel();
        toast("Agent 扫描已更新");
      } catch (error) {
        button.disabled = false;
        button.textContent = "重新扫描";
        toast(error.message);
      }
    });
    return;
  }
  if (state.settingsTab === "typography") {
    const project = state.detail?.project;
    const currentMode = project?.typography?.mode ?? "system-only";
    const locked = ["approved", "delivered"].includes(project?.project.status);
    const modes = [
      {
        id: "auto",
        name: "自动搭配",
        summary: "默认使用系统黑体；仅在引用、批注和全片标题等适合的场景使用霞鹜文楷。",
      },
      {
        id: "system-only",
        name: "统一黑体",
        summary: "所有画面保持系统黑体，适合技术内容、数据画面和最稳妥的历史项目。",
      },
      {
        id: "wenkai-emphasis",
        name: "文楷强调",
        summary: "在自动搭配基础上，允许更多合适的组件标题使用霞鹜文楷；正文、数字和字幕仍保持黑体。",
      },
    ];
    panel.innerHTML = `
      <div class="settings-toolbar"><div><h3>文字与样式</h3></div></div>
      <div class="typography-policy-note">
        <strong>字体由本地规则决定</strong>
        <span>Agent 只输出语义证据和表达意图，不直接选择字体。系统会检查文字角色、组件、长度、技术字符和字形覆盖，再确定字体或安全回退。</span>
      </div>
      <div class="typography-settings-list">
        ${modes.map((mode) => `<label class="typography-mode-card ${currentMode === mode.id ? "current" : ""}">
          <input type="radio" name="typography-mode" value="${mode.id}" ${currentMode === mode.id ? "checked" : ""} ${project && !locked ? "" : "disabled"}/>
          <span class="typography-mode-sample ${mode.id}">字 Aa</span>
          <span><strong>${mode.name}</strong><small>${mode.summary}</small></span>
          ${currentMode === mode.id ? '<span class="current-badge">当前</span>' : ""}
        </label>`).join("")}
      </div>
      <div class="typography-settings-footer">
        <span>${!project ? "请先选择一个项目。" : locked ? "当前项目已批准，字体变更必须进入返修版本。" : "修改后会重新校验组件及静态审核阶段，不会重跑 Agent 或字幕理解。"}</span>
        <button type="button" class="primary" id="save-typography-mode" ${!project || locked ? "disabled" : ""}>保存字体模式</button>
      </div>`;
    $("#save-typography-mode")?.addEventListener("click", async (event) => {
      const selected = document.querySelector('input[name="typography-mode"]:checked')?.value;
      if (!selected || !state.selected) return;
      const button = event.currentTarget;
      button.disabled = true;
      button.textContent = "保存中…";
      try {
        await api(`/api/projects/${state.selected}/typography`, { method: "PATCH", body: { mode: selected } });
        await selectProject(state.selected);
        renderSettingsPanel();
        toast("字体模式已保存，已有进度已重新校验");
      } catch (error) {
        button.disabled = false;
        button.textContent = "保存字体模式";
        toast(error.message);
      }
    });
    return;
  }
  if (state.settingsTab === "llm") {
    const providers = state.providers.providers ?? [];
    panel.innerHTML = `
      <div class="settings-toolbar">
        <div><h3>翻译接口</h3></div>
        <button type="button" class="secondary" id="reload-provider-environment">重新读取 zshrc</button>
      </div>
      <div class="provider-settings-list">
        ${providers.map((provider) => `<article class="provider-settings-card ${provider.configured ? "configured" : ""}">
          <div class="provider-card-head"><div><span class="provider-state-dot ${provider.configured ? "available" : ""}"></span><h4>${escapeHtml(provider.displayName)}</h4><span class="provider-type">${escapeHtml(provider.interface)}</span></div><span class="current-badge ${provider.configured ? "" : "provider-missing"}">${provider.configured ? "已连接" : provider.credential ? "缺少密钥" : "不可用"}</span></div>
          <div class="provider-purpose"><strong>当前用途</strong><p>${escapeHtml(provider.primaryUse)}</p><small>${escapeHtml(provider.optionalUse)}</small></div>
          ${provider.credential ? `<div class="provider-details">
            <div><span>模型</span><code>${escapeHtml(provider.model)}</code></div>
            <div><span>API 地址</span><code>${escapeHtml(provider.endpoint)}</code></div>
            <div><span>密钥变量</span><code>${escapeHtml(provider.credential.environmentVariable)}</code></div>
            <div><span>读取来源</span><b>${escapeHtml(provider.credential.source)}</b></div>
          </div>` : `<div class="provider-details"><div><span>英文翻译</span><b>支持</b></div><div><span>原生生图</span><b>${provider.capabilities?.imageGeneration ? "支持" : "不支持"}</b></div><div><span>外部生图服务</span><b>${provider.capabilities?.imageProviderOrchestration ? "可调度" : "不支持"}</b></div></div>`}
        </article>`).join("")}
      </div>
      <p class="provider-security-note"><strong>安全说明：</strong>Studio 只显示“已配置/未配置”，不会读取或返回密钥正文。启动视频任务时，密钥只作为子进程环境变量传给原有工作流。</p>`;
    $("#reload-provider-environment").addEventListener("click", async (event) => {
      const button = event.currentTarget;
      button.disabled = true;
      button.textContent = "读取中…";
      try {
        state.providers = await api("/api/providers/reload", { method: "POST" });
        renderSettingsPanel();
        toast("已重新读取本地 zsh 环境");
      } catch (error) {
        button.disabled = false;
        button.textContent = "重新读取 zshrc";
        toast(error.message);
      }
    });
    return;
  }
  if (state.settingsTab === "storage") {
    panel.innerHTML = `
      <h3>存储与诊断</h3>
      <div class="storage-settings-grid">
        <article><span>当前项目</span><b>${escapeHtml(state.detail?.project.project.title ?? "未选择项目")}</b><small>${state.detail?.project.video.manifest ? "可查看项目占用、任务历史和安全清理" : "进入视频制作后显示项目运行详情"}</small></article>
        <article><span>备份策略</span><b>保留 3 份本地备份</b><small>恢复前验证 SHA-256，并保留被替换版本用于回滚</small></article>
      </div>
      <div class="settings-action-card"><div><h4>项目高级详情</h4></div><button type="button" class="secondary" id="settings-open-operations" ${state.detail?.project.video.manifest ? "" : "disabled"}>打开高级详情</button></div>
      <p class="provider-security-note">CLI 备份和恢复仍要求先停止默认端口上的 Studio，避免与运行中的任务竞争。</p>`;
    $("#settings-open-operations")?.addEventListener("click", () => {
      $("#settings-dialog").close();
      openOperations();
    });
    return;
  }
  panel.innerHTML = `
    <h3>关于</h3>
    <div class="about-card"><img class="brand-logo" src="/assets/seanlab-logo-white.svg" alt="SeanLab 标识"/><div><h4>${escapeHtml(state.metadata.name)}</h4></div></div>
    <div class="about-list">
      <div class="about-row"><span>版本</span><strong>${shortVersion()}</strong></div>
      <div class="about-row"><span>工作模式</span><strong>本地优先</strong></div>
      <div class="about-row"><span>界面语言</span><strong>${getLocale() === "en" ? "English" : "简体中文"}</strong></div>
      <div class="about-row"><span>已适配 Agent</span><strong>Codex CLI、Claude Code</strong></div>
    </div>`;
};
const loadStudioHealth = async () => {
  const button = $("#run-doctor");
  if (button) {
    button.disabled = true;
    button.textContent = "检查中…";
  }
  try {
    const agentId = state.detail?.project.agent.id ?? "codex-cli";
    [state.health, state.doctor] = await Promise.all([
      api("/api/health"),
      api(`/api/doctor?agent=${encodeURIComponent(agentId)}`),
    ]);
    if (state.settingsTab === "health") renderSettingsPanel();
  } catch (error) {
    toast(error.message);
    if (button) {
      button.disabled = false;
      button.textContent = "重新检查";
    }
  }
};
const openSettings = () => {
  state.settingsTab = "health";
  renderSettingsPanel();
  $("#settings-dialog").showModal();
  loadStudioHealth();
};
const startRename = () => {
  const project = state.detail?.project;
  if (!project) return;
  $("#project-title-button").hidden = true;
  $("#rename-form").hidden = false;
  $("#rename-input").value = project.project.title;
  $("#rename-input").focus();
  $("#rename-input").select();
};
const stopRename = () => {
  $("#rename-form").hidden = true;
  $("#project-title-button").hidden = false;
};
const selectProject = async (id) => {
  if (state.selected !== id) {
    closeProjectInspector();
    state.viewStep = null;
    state.reviewFilter = "priority";
    state.reviewGalleryFrame = null;
    state.activeReviewFrame = null;
    state.activeNarrationSection = 0;
    state.workspaceMode = "video";
    state.coverIconPickerOpen = false;
    state.deliveryProfileDraft = null;
  }
  const loadToken = ++state.projectLoadToken;
  state.selected = id;
  const detail = await api(`/api/projects/${id}`);
  const hasManifest = Boolean(detail.project.video.manifest);
  const [workflow, staticReview, delivery, cover] = await Promise.all([
    hasManifest ? api(`/api/projects/${id}/workflow/status`).catch(() => null) : null,
    hasManifest ? api(`/api/projects/${id}/workflow/static-review`).catch(() => null) : null,
    hasManifest ? api(`/api/projects/${id}/workflow/delivery`).catch(() => null) : null,
    api(`/api/projects/${id}/cover`).catch(() => null),
  ]);
  if (loadToken !== state.projectLoadToken || state.selected !== id) return;
  state.detail = detail;
  state.workflow = workflow;
  state.staticReview = staticReview;
  state.delivery = delivery;
  state.cover = cover;
  if (workflow?.creatorStatus) {
    detail.project.project.status = workflow.creatorStatus;
    const listed = state.projects.find((item) => item.project.id === id);
    if (listed) listed.project.status = workflow.creatorStatus;
  }
  state.coverIconIds = cover?.selection?.iconIds ?? (cover?.selection?.iconId ? [cover.selection.iconId] : []);
  renderSidebar();
  renderTopbar();
  renderWorkspace();
};
const renderSteps = (status, viewedStep) => {
  const labels = [
    ["创建", "方向与资料"],
    ["写稿", "口播稿"],
    ["拍摄", "拍摄与素材"],
    ["制作", "视频制作"],
    ["自检", "Agent 自动审核"],
    ["审核", "最终成片"],
  ];
  const current = stepIndex(status);
  $("#steps").innerHTML = labels.map(([label, description], index) => {
    const canView =
      index === 0 ||
      (index === 1 && current >= 1 && state.detail?.narration) ||
      (index === 2 && current >= 2) ||
      (index === 3 && Boolean(state.detail?.project.video.manifest)) ||
      (index === 5 && Boolean(state.delivery?.approval?.approved));
    const className = `${index < current ? "done" : ""} ${index === viewedStep ? "active" : ""} ${canView ? "clickable" : ""}`;
    const content = `<span class="step-number">${index < current ? "✓" : index + 1}</span><span class="step-copy"><b>${label}</b><small>${description}</small></span>`;
    return canView
      ? `<button class="step ${className}" data-view-step="${index}" ${index === viewedStep ? 'aria-current="step"' : ""}>${content}</button>`
      : `<div class="step ${className}">${content}</div>`;
  }).join("");
};
const projectContext = (project) => {
  const task = latestJob(project.project.id);
  const running = task && (!task.completedAt || task.completedAt >= project.project.updatedAt) ? task : null;
  return `
    <div class="panel"><h3>创作设置</h3><div class="metric-grid"><div class="metric"><b>${categoryLabel(project.brief.category)}</b><span>内容分类</span></div><div class="metric"><b>${project.agent.id === "codex-cli" ? "Codex" : "Claude"}</b><span>全局 Agent</span></div><div class="metric"><b>${project.sources.length}</b><span>参考资料</span></div><div class="metric"><b>${project.materials.length}</b><span>已登记素材</span></div></div></div>
    <div class="panel"><h3>流程状态</h3><div class="timeline">${["项目创建", "口播稿审核", "稿件锁定", "Agent 制作与自检", "Agent 技术验收", "最终成片审核"].map((label,index) => `<div class="timeline-row ${index === stepIndex(project.project.status) ? "active" : ""}"><span class="timeline-dot"></span><div><b>${label}</b><span>${index < stepIndex(project.project.status) ? "已完成" : index === stepIndex(project.project.status) ? "当前阶段" : "等待上一步"}</span></div></div>`).join("")}</div></div>
    ${running ? `<div class="panel"><h3>最近任务</h3><p><span class="badge">${escapeHtml(running.status)}</span> ${escapeHtml(running.kind)}</p><p class="muted">${escapeHtml(running.error ?? running.logs?.at(-1) ?? "任务已进入队列")}</p></div>` : ""}
  `;
};
const jobFeedback = (project) => {
  const task = latestNarrationJob(project.project.id);
  if (!task || task.status === "completed") return "";
  const percent = Math.max(0, Math.min(100, Number(task.progress?.percent ?? 0)));
  if (["queued", "running"].includes(task.status)) return `
    <div class="job-banner" role="status" aria-live="polite">
      <div class="job-banner-head"><div><span class="job-spinner"></span><strong>${task.status === "queued" ? "等待前一个任务完成" : task.kind === "editorial-inference" ? "正在理解你的创作需求" : task.kind === "material-understanding" ? "正在读取资料、图片和录屏" : task.kind === "visual-storyboard-seed" ? "正在继续生成视觉方案" : task.kind === "narration-rewrite" ? "正在按意见重写口播稿" : "正在生成口播稿"}</strong></div><b>${percent}%</b></div>
      <p>${escapeHtml(task.progress?.message ?? "Agent 正在处理")}</p>
      <div class="progress-track" aria-label="口播稿生成进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><span style="width:${percent}%"></span></div>
      <small>可以停留在当前页面，完成后会自动进入稿件审核。</small>
    </div>`;
  if (task.status === "failed") return `
    <div class="job-banner job-banner-error" role="alert">
      <div class="job-banner-head"><strong>${task.kind === "editorial-inference" ? "创作需求理解失败" : task.kind === "material-understanding" ? "素材理解失败" : task.kind === "visual-storyboard-seed" ? "视觉方案生成失败" : task.kind === "narration-rewrite" ? "口播稿重写失败" : "口播稿生成失败"}</strong><span class="badge">可重试</span></div>
      <p>${escapeHtml(task.error ?? "任务未完成")}</p>
      <details><summary>查看技术详情</summary><pre>${escapeHtml(task.errorDetail ?? task.error ?? "没有更多信息")}</pre></details>
    </div>`;
  return "";
};
const intakeInventory = (items, kindLabels, noun, projectId, allowMaterialDelete = false) => {
  return `<div class="intake-inventory" aria-live="polite">
    <div class="intake-inventory-summary"><strong>已添加 ${items.length} ${noun}</strong><span>${items.length ? "按添加顺序排列" : "尚未添加"}</span></div>
    ${items.length ? `<ol>${items.map((item, index) => `<li><span class="intake-index">${index + 1}.</span>${item.kind === "screenshot" && item.assetId && projectId ? `<img class="material-thumb" src="/api/projects/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(item.assetId)}" alt="${escapeHtml(item.label)}"/>` : ""}<span>${escapeHtml(item.label)}${item.description ? `<small>${escapeHtml(item.description)}</small>` : ""}</span><small>${escapeHtml(kindLabels[item.kind] ?? item.kind)}</small>${allowMaterialDelete ? `<button type="button" class="material-delete-button" data-delete-material="${escapeHtml(item.id)}" data-material-label="${escapeHtml(item.label)}" aria-label="删除素材 ${escapeHtml(item.label)}">删除</button>` : ""}</li>`).join("")}</ol>` : ""}
  </div>`;
};
const authoredMaterialPanel = (project, narration) => {
  const materials = project.materials.filter((item) => ["screenshot", "screen-recording"].includes(item.kind));
  if (!materials.length) return "";
  const bindings = new Map();
  narration.sections.forEach((section, index) => section.materialIds.forEach((materialId) => {
    const sectionIndexes = bindings.get(materialId) ?? [];
    sectionIndexes.push(index);
    bindings.set(materialId, sectionIndexes);
  }));
  const placementCount = [...bindings.values()].reduce((sum, indexes) => sum + indexes.length, 0);
  const missingSections = narration.sections.filter(
    (section) => ["screenshot", "screen-recording"].includes(section.visualIntent) && section.materialIds.length === 0,
  );
  return `<div class="panel material-binding-panel"><div class="material-binding-summary"><div><div class="eyebrow">MATERIAL PLACEMENT</div><h3>素材与口播段落</h3></div><div><span>出现场次 <b>${placementCount}</b></span><span>未使用素材 <b>${materials.length - bindings.size}</b></span><span>待补位 <b>${missingSections.length}</b></span></div></div><ul>${materials.map((material) => {
    const sectionIndexes = bindings.get(material.id) ?? [];
    const placementLabel = sectionIndexes.length === 0 ? "候选素材" : sectionIndexes.length === 1 ? `已用于 ${String(sectionIndexes[0] + 1).padStart(2, "0")} · ${escapeHtml(narration.sections[sectionIndexes[0]].title)}` : `已安排 ${sectionIndexes.length} 个出现场次`;
    return `<li><div>${material.assetId && material.kind === "screenshot" ? `<img class="material-thumb" src="/api/projects/${encodeURIComponent(project.project.id)}/assets/${encodeURIComponent(material.assetId)}" alt="${escapeHtml(material.label)}"/>` : ""}<span><b>${escapeHtml(material.label)}</b><small>${escapeHtml(materialKindLabels[material.kind])}</small></span></div><span class="binding-state ${sectionIndexes.length === 0 ? "candidate" : "bound"}">${placementLabel}</span></li>`;
  }).join("")}</ul><p class="hint">素材上传时只是候选。同一份素材可在不同口播位置重复出现；锁稿时系统会为每个场次生成独立口播锚点。</p></div>`;
};
const materialSelectForSection = (project, section, index) => {
  const materials = project.materials.filter((item) => ["screenshot", "screen-recording"].includes(item.kind));
  if (!materials.length) return "";
  const selected = storyboardReview(section)?.materialId ?? section.materialIds[0] ?? "";
  return `<div class="section-material-binding"><label>绑定素材<select data-section-material="${index}" data-initial-material="${escapeHtml(selected)}"><option value="">不绑定素材</option>${materials.map((material) => `<option value="${escapeHtml(material.id)}" ${material.id === selected ? "selected" : ""}>${escapeHtml(material.label)} · ${escapeHtml(materialKindLabels[material.kind])}</option>`).join("")}</select></label><small>${selected ? "已选择；锁稿后会成为必须使用的素材。" : "可稍后选择；现在不会要求你填写口播锚点。"}</small></div>`;
};
const materialDisplayLabels = { full: "完整展示", crop: "局部放大", annotate: "标注重点" };
const primaryVisualTypeLabels = {
  speaker: "人物",
  component: "信息组件",
  image: "图片",
  "screen-demo": "录屏",
  animation: "动画",
};
const annotationEffectLabels = {
  highlight: "高亮",
  underline: "下划线",
  circle: "圆圈",
  box: "方框",
  "crossed-off": "叉掉",
  "strike-through": "删除线",
  bracket: "括号",
};
const animationPrototypeLabels = {
  "process-flow": "流程推进",
  "state-transition": "状态变化",
  "evidence-gate": "证据闸门",
  "causal-chain": "因果链",
  "before-after": "前后对照",
  "layered-system": "分层系统",
};
const animationPrototypeStageMaximums = {
  "process-flow": 6,
  "state-transition": 5,
  "evidence-gate": 5,
  "causal-chain": 5,
  "before-after": 4,
  "layered-system": 6,
};
const animationPrototypeForForm = {
  "ordered-progression":"process-flow",
  "progressive-explanation":"process-flow",
  "cause-to-result":"causal-chain",
  "change-over-time":"state-transition",
  "dated-milestones":"state-transition",
  "category-map":"layered-system",
  "core-and-supports":"layered-system",
};
const animationPrototypeAlternatives = {
  "process-flow":["state-transition", "layered-system"],
  "state-transition":["before-after", "process-flow"],
  "evidence-gate":["process-flow", "causal-chain"],
  "causal-chain":["state-transition", "process-flow"],
  "before-after":["state-transition", "process-flow"],
  "layered-system":["process-flow", "state-transition"],
};
const animationStructureFor = (prototypeId) =>
  state.metadata.animationStructures?.find((item) => item.id === prototypeId);
const animationTemplateFor = (styleProfileId) =>
  state.metadata.animationTemplates?.find((item) => item.id === styleProfileId);
const recommendedAnimationStyleId = () => "paper-editorial";
const cleanAnimationStage = (value) => value.trim().replace(/^[：:，,。；;、\s]+|[：:，,。；;、\s]+$/g, "").replace(/^(然后|接着|再|最后|并且|以及|同时|会|要|让|把)/, "").trim();
const recommendedAnimationIntent = (section, overrides = {}) => {
  const opportunity = section.visualOpportunities?.find((item) => animationPrototypeForForm[item.form]);
  if (!opportunity || !section.narration?.trim()) return undefined;
  let prototypeId = overrides.prototypeId ?? animationPrototypeForForm[opportunity.form];
  const evidence = opportunity.evidenceText?.trim() || section.narration.trim();
  if (
    !overrides.prototypeId &&
    /(必须|只有|通过以后|审核|放行)/.test(evidence) &&
    /(通过|进入|才能|才会)/.test(evidence)
  )
    prototypeId = "evidence-gate";
  const afterColon = evidence.includes("：") ? evidence.slice(evidence.indexOf("：") + 1) : evidence;
  let fragments = afterColon.split(/(?:、|，|；|。|\n|最后)/).map(cleanAnimationStage).filter((item) => [...item].length >= 2 && [...item].length <= 28 && section.narration.includes(item));
  if (fragments.length < 2) fragments = evidence.split(/[，；。！？\n]/).map(cleanAnimationStage).filter((item) => [...item].length >= 2 && [...item].length <= 32 && section.narration.includes(item));
  fragments = fragments.slice(0, animationPrototypeStageMaximums[prototypeId]);
  if (fragments.length < 2) return undefined;
  const actionFor = (index) => {
    if (prototypeId === "evidence-gate") return index === fragments.length - 1 ? "审核后放行" : index === 0 ? "送达门前" : "核验条件";
    if (prototypeId === "causal-chain") return index === 0 ? "起因" : index === fragments.length - 1 ? "形成结果" : "继续传导";
    if (prototypeId === "state-transition") return index === 0 ? "进入初态" : index === fragments.length - 1 ? "到达新状态" : "发生变化";
    if (prototypeId === "layered-system") return index === 0 ? "建立底层" : "叠加职责";
    return index === 0 ? "写入起点" : index === fragments.length - 1 ? "到达终点" : "向前推进";
  };
  return {
    prototypeId,
    styleProfileId:overrides.styleProfileId ?? recommendedAnimationStyleId(section, prototypeId),
    takeaway:section.title || evidence.slice(0,36),
    stages:fragments.map((spokenQuote,index) => ({
      id:`stage-${index + 1}`,
      spokenQuote,
      action:actionFor(index),
      label:[...spokenQuote].slice(0,12).join(""),
    })),
  };
};
const alternativeAnimationIntents = (section, primary) => {
  if (!primary) return [];
  const alternatives = [];
  const structure = animationStructureFor(primary.prototypeId);
  for (const styleProfileId of structure?.compatibleStyleIds ?? []) {
    if (styleProfileId === primary.styleProfileId) continue;
    const intent = recommendedAnimationIntent(section, { prototypeId:primary.prototypeId, styleProfileId });
    if (intent) alternatives.push(intent);
  }
  for (const prototypeId of animationPrototypeAlternatives[primary.prototypeId] ?? []) {
    const intent = recommendedAnimationIntent(section, { prototypeId });
    if (intent) alternatives.push(intent);
  }
  return alternatives
    .filter(
      (intent, index, values) =>
        values.findIndex(
          (item) => item.prototypeId === intent.prototypeId && item.styleProfileId === intent.styleProfileId,
        ) === index,
    )
    .slice(0, 2);
};
const storyboardReview = (section) =>
  state.detail?.visualStoryboard?.sections?.[section.id];
const setStoryboardReview = (section, review) => {
  state.detail.visualStoryboard ??= { schemaVersion: "2.0", sections: {} };
  state.detail.visualStoryboard.sections ??= {};
  state.detail.visualStoryboard.sections[section.id] = review;
  return review;
};
const structuralStoryboardConfig = {
  "-4": { id:"conclusion", title:"结尾总结", field:"conclusion" },
  "-3": { id:"opening", title:"开场", field:"opening" },
  "-1": { id:"overview", title:"本期概述", field:"overview" },
};
const inferStructuralVisualForm = (text) => {
  const value = text.trim();
  if (/\d|[一二三四五六七八九十]+(?:个|项|种|步)|百分之|%/.test(value)) return "number-focus";
  if (/(?:如果|只要|只有|否则|条件).*(?:就|才|会|结果)/.test(value)) return "conditional-outcomes";
  if (/(?:因为|由于|原因|导致|带来|所以|因此|从而)/.test(value)) return "cause-to-result";
  if (/(?:对比|相比|不同|区别|而不是|前后|优点|缺点)/.test(value)) return "two-way-contrast";
  if (/(?:第一|首先|然后|接着|随后|最后|流程|步骤|阶段)/.test(value)) return "ordered-progression";
  if (/(?:分为|分成|类型|类别|包括).*(?:、|，)/.test(value)) return "category-map";
  return "text-emphasis";
};
const structuralStoryboardSection = (narration, index) => {
  const config = structuralStoryboardConfig[String(index)];
  const review = state.detail?.visualStoryboard?.sections?.[config.id];
  const material = state.detail?.project?.materials?.find((item) => item.id === review?.materialId);
  const narrationText = narration[config.field] ?? "";
  return {
    id: config.id,
    title: config.title,
    narration: narrationText,
    visualIntent:
      review?.mode === "material" ? (material?.kind ?? review.materialKind ?? "screenshot") : "semantic-visual",
    materialIds: review?.materialId ? [review.materialId] : [],
    visualOpportunities: [{ form:inferStructuralVisualForm(narrationText), evidenceText:narrationText }],
    recordingInstruction:null,
  };
};
const storyboardEntries = (narration) => [
  { index:-3, section:structuralStoryboardSection(narration,-3) },
  { index:-1, section:structuralStoryboardSection(narration,-1) },
  ...narration.sections.map((section,index) => ({ index, section })),
  { index:-4, section:structuralStoryboardSection(narration,-4) },
];
const storyboardSectionAt = (narration, index) =>
  index < 0 ? structuralStoryboardSection(narration,index) : narration.sections[index];
const updateStructuralNarration = (narration, index, spokenText) => {
  const config = structuralStoryboardConfig[String(index)];
  if (config) narration[config.field] = spokenText;
};
const recommendedVisualMode = (section) => {
  if (section.visualIntent === "screen-recording") return "material";
  if (recommendedAnimationIntent(section)) return "animation";
  if (section.materialIds.length || section.visualIntent === "screenshot") return "material";
  if (section.visualOpportunities?.some((item) => item.form)) return "information";
  return "speaker";
};
const reviewedVisualMode = (section) =>
  storyboardReview(section)?.mode && storyboardReview(section).mode !== "auto"
    ? storyboardReview(section).mode
    : recommendedVisualMode(section);
const reviewedVisualForm = (section) =>
  storyboardReview(section)?.form ?? section.visualOpportunities?.[0]?.form ?? "text-emphasis";
const compatibleComponents = (form) => visualComponentCatalog.filter((item) => item.forms.includes(form));
const componentPreviewMarkup = (component, compact = false) => {
  const line = (width = 72) => `<i class="schematic-line" style="--line-width:${width}%"></i>`;
  const textBlock = (title = 72, detail = 48) => `<span class="schematic-copy">${line(title)}${line(detail)}</span>`;
  const card = (content = textBlock()) => `<span class="schematic-card">${content}</span>`;
  const nodes = (count, active = 0) => Array.from({ length: count }, (_, index) => `<span class="schematic-node ${index === active ? "active" : ""}">${String(index + 1).padStart(2, "0")}</span>`).join("");
  const bars = (values) => values.map((value, index) => `<span class="schematic-bar ${index === 1 ? "active" : ""}" style="--bar-size:${value}%"></span>`).join("");
  const previews = {
    "distribution-bars": `<div class="schematic-bars">${bars([48,88,64,35])}</div>`,
    "scenario-branches": `<div class="schematic-branch"><span class="schematic-node active">IF</span><span>${card(line(58))}${card(line(72))}</span></div>`,
    "market-cap-lines": `<div class="schematic-chart"><span class="chart-grid"></span><b class="chart-line first"></b><b class="chart-line second"></b><i class="chart-dot"></i></div>`,
    "person-evidence-card": `<div class="schematic-person"><span class="person-avatar"></span>${textBlock(78,54)}<b>来源</b></div>`,
    "factor-sequence": `<div class="schematic-sequence">${nodes(5,1)}<span class="sequence-copy">${textBlock(76,44)}</span></div>`,
    "ranked-metric-list": `<div class="schematic-ranking"><span>01</span>${line(88)}<span>02</span>${line(66)}<span>03</span>${line(44)}</div>`,
    "binary-versus": `<div class="schematic-versus">${card(textBlock(72,48))}<b>VS</b>${card(textBlock(72,48))}</div>`,
    "key-stat-summary": `<div class="schematic-stat"><strong>86%</strong><span>${line(64)}${line(42)}</span></div>`,
    "media-comparison": `<div class="schematic-media-compare"><span></span><i class="schematic-connector double"></i><span></span></div>`,
    "image-evidence-inset": `<div class="schematic-image"><span class="image-window"></span><span class="image-focus"></span><b>证据</b></div>`,
    "process-steps": `<div class="schematic-process">${nodes(4,1)}<span>${textBlock(84,46)}</span></div>`,
    "causal-chain": `<div class="schematic-causal">${card(line(54))}<i class="schematic-connector"></i>${card(line(54))}<i class="schematic-connector"></i>${card(line(54))}</div>`,
    "quote-source-card": `<div class="schematic-quote"><strong>“</strong>${textBlock(82,66)}<span>— 来源</span></div>`,
    "historical-timeline": `<div class="schematic-timeline">${nodes(4,2)}<span class="timeline-rule"></span></div>`,
    "decision-matrix": `<div class="schematic-matrix"><span></span><span class="active"></span><span></span><span></span></div>`,
    "model-classification-map": `<div class="schematic-map"><span class="map-root">A</span><span class="map-children">${card(line(46))}${card(line(62))}${card(line(38))}</span></div>`,
    "core-positioning-node": `<div class="schematic-core"><span>${card(line(52))}${card(line(62))}</span><b>核心</b><span>${card(line(52))}${card(line(62))}</span></div>`,
    "capability-surface-grid": `<div class="schematic-grid">${Array.from({ length: 6 }, (_, index) => card(`<b>${index + 1}</b>${line(62)}`)).join("")}</div>`,
    "tradeoff-scale": `<div class="schematic-scale"><span>${line(64)}</span><b></b><span>${line(78)}</span></div>`,
    "rough-annotation": `<div class="schematic-annotation"><span>${line(84)}${line(68)}</span><b></b><i></i></div>`,
  };
  return `<div class="component-schematic ${compact ? "compact" : ""}" role="img" aria-label="${escapeHtml(component.label)} UI 示意预览"><span class="schematic-kicker">${escapeHtml(component.label)}</span><div class="schematic-canvas">${previews[component.previewVariant] ?? textBlock()}</div></div>`;
};
const recommendedComponent = (section, form, candidates) => {
  if (form !== "source-backed-evidence") return candidates[0];
  const evidence = `${section.title ?? ""} ${section.narration ?? ""} ${reviewedOpportunity(section)?.evidenceText ?? ""}`;
  if (/[\u201c”「」『』"]|\bREADME\b|\bquote\b|引用|原话|写着/i.test(evidence))
    return candidates.find((item) => item.id === "quote-source-card") ?? candidates[0];
  if (section.materialIds?.length)
    return candidates.find((item) => item.id === "image-evidence-inset") ?? candidates[0];
  if (/我叫|由我|作者|创始人|开发者|持续开发/.test(evidence))
    return candidates.find((item) => item.id === "person-evidence-card") ?? candidates[0];
  return candidates[0];
};
const reviewedComponent = (section) => {
  const review = storyboardReview(section);
  const candidates = compatibleComponents(reviewedVisualForm(section));
  return (
    candidates.find((item) => item.id === review?.componentId) ??
    recommendedComponent(section, reviewedVisualForm(section), candidates)
  );
};
const reviewedOpportunity = (section) => {
  const form = reviewedVisualForm(section);
  return section.visualOpportunities?.find((item) => item.form === form) ?? section.visualOpportunities?.[0];
};
const visualSummary = (project, section) => {
  const beats = storyboardReview(section)?.beats ?? [];
  if (beats.length) {
    const counts = beats.reduce((map, beat) => {
      map[beat.primaryVisualType] = (map[beat.primaryVisualType] ?? 0) + 1;
      return map;
    }, {});
    const detail = Object.entries(counts)
      .map(([type, count]) => `${primaryVisualTypeLabels[type] ?? type} ${count}`)
      .join(" · ");
    return `${beats.length} 个视觉节拍 · ${detail}`;
  }
  const mode = reviewedVisualMode(section);
  if (mode === "material") {
    const material = project.materials.find((item) => item.id === section.materialIds[0]);
    const visualType = material?.kind === "screen-recording" || section.visualIntent === "screen-recording" ? "录屏" : "图片";
    return material ? `${visualType} · ${material.label}` : `${visualType} · 待选择`;
  }
  if (mode === "information") {
    const component = reviewedComponent(section);
    return component ? `信息组件 · ${component.label}` : "信息组件 · 待建议";
  }
  if (mode === "animation") {
    const animation = storyboardReview(section)?.animationIntent ?? recommendedAnimationIntent(section);
    const style = animation ? animationTemplateFor(animation.styleProfileId) : undefined;
    return animation
      ? `动画 · ${animationPrototypeLabels[animation.prototypeId]} · ${style?.label ?? animation.styleProfileId}`
      : "动画 · 待建议";
  }
  return "人物画面";
};
const sectionPrimaryVisualType = (project, section) => {
  const mode = reviewedVisualMode(section);
  if (mode === "information") return "component";
  if (mode === "animation") return "animation";
  if (mode === "material") {
    const material = project.materials.find((item) => item.id === section.materialIds[0]);
    return material?.kind === "screen-recording" || section.visualIntent === "screen-recording"
      ? "screen-demo"
      : "image";
  }
  return "speaker";
};
const modeSelector = (project, section, index, mode) => {
  const primaryVisualType = sectionPrimaryVisualType(project, section);
  const label = section.title;
  return `<div class="visual-choice-system"><div class="visual-strategy-selector"><button type="button" class="${mode === "auto" ? "active" : ""}" data-visual-mode="auto" data-section-index="${index}">自动</button><b>${mode === "auto" ? `系统推荐 · ${primaryVisualTypeLabels[primaryVisualType]}` : `当前选择 · ${primaryVisualTypeLabels[primaryVisualType]}`}</b></div><div class="visual-type-selector" role="group" aria-label="${label}主视觉类型">${Object.entries(primaryVisualTypeLabels).map(([value,typeLabel]) => {
    const active = primaryVisualType === value;
    return `<button type="button" class="${active ? "active" : ""}" data-visual-mode="${value}" data-section-index="${index}"><strong>${typeLabel}</strong></button>`;
  }).join("")}</div></div>`;
};
const nextAnnotationId = (annotations) => {
  let index = annotations.length + 1;
  while (annotations.some((annotation) => annotation.id === `annotation-${index}`)) index += 1;
  return `annotation-${index}`;
};
const textAnnotationEditor = (section, index) => {
  const review = storyboardReview(section);
  const annotations = review?.annotations ?? [];
  return `<section class="text-annotation-editor"><div class="text-annotation-heading"><div><b>重点文字标注</b><span>在左侧选中 2–24 个字符，再选择一种手绘效果；它会与上方主视觉同时出现。</span></div><button type="button" data-add-text-annotation="${index}">标注选中文字</button></div>${annotations.length ? `<div class="text-annotation-list">${annotations.map((annotation,annotationIndex) => `<article class="text-annotation-card"><div><q>${escapeHtml(annotation.exactSpokenQuote)}</q><button type="button" data-remove-text-annotation="${annotationIndex}" data-annotation-section="${index}" aria-label="删除文字标注">×</button></div><div class="annotation-effect-picker" role="group" aria-label="文字标注效果">${Object.entries(annotationEffectLabels).map(([value,label]) => `<button type="button" class="${annotation.effect === value ? "active" : ""}" data-annotation-effect="${value}" data-annotation-section="${index}" data-annotation-index="${annotationIndex}">${label}</button>`).join("")}</div></article>`).join("")}</div>` : `<p class="text-annotation-empty">可选功能：没有需要特别强调的短语时保持为空。</p>`}</section>`;
};
const animationAssetMatchFor = (sectionId, stageId, beatId) =>
  (state.detail?.imageAssetMatches ?? []).find(
    (item) =>
      item.sectionId === sectionId &&
      item.stageId === stageId &&
      (beatId ? item.beatId === beatId : !item.beatId),
  );
const applyAnimationAssetMatches = (section, animation, beatId) => ({
  ...animation,
  stages:animation.stages.map((stage) => {
    const match = animationAssetMatchFor(section.id, stage.id, beatId);
    if (!match || match.styleProfileId !== animation.styleProfileId) return stage;
    if (stage.imageAssetId) return { ...stage, iconId:match.decision.fallbackIconId };
    if (match.decision.kind === "icon")
      return { ...stage, iconId:match.decision.fallbackIconId };
    return { ...stage, iconId:match.decision.fallbackIconId };
  }),
});
const animationAssetMatchMarkup = (sectionId, stageId, beatId) => {
  const match = animationAssetMatchFor(sectionId, stageId, beatId);
  if (!match) return "";
  if (match.decision.kind === "icon") {
    const symbolId = match.decision.fallbackIconId.replace(/^system\./, "");
    return `<div class="image-asset-fallback"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="/local-assets/icons/system/sprite.svg#${escapeHtml(symbolId)}"></use></svg><div><b>动画阶段使用图标</b><small>${escapeHtml(match.decision.reason)}</small></div></div>`;
  }
  const selected = match.selectedAsset;
  return `<section class="image-asset-match"><div class="image-asset-match-heading"><div><span>动画图片素材</span><b>${selected ? `Agent 已选择 ${escapeHtml(selected.subject ?? selected.id)}` : "Agent 未选择图片，使用图标兜底"}</b></div><small>图片只作为这个动画阶段的制作素材；整体视觉确认后才会锁定。</small></div><div class="image-asset-match-options">${match.decision.alternatives
    .map(
      (candidate, index) => `<article class="${candidate.asset.id === match.selectedAssetId ? "recommended" : ""}">
        <img src="/api/image-assets/${encodeURIComponent(candidate.asset.id)}/preview" alt="${escapeHtml(candidate.asset.subject ?? "图片素材")}"/>
        <div><span>${candidate.asset.id === match.selectedAssetId ? "Agent 已选" : `匹配参考 ${index + 1}`}</span><strong>${escapeHtml(candidate.asset.subject ?? candidate.asset.id)}</strong><small>命中：${escapeHtml(candidate.matchedTerms.join(" · "))} · ${candidate.score} 分</small></div>
      </article>`,
    )
    .join("")}</div><div class="image-asset-fallback-note">没有合适图片时，动画内部自动使用图标：${escapeHtml(match.decision.fallbackIconId)}</div></section>`;
};
const visualBeatPlanMarkup = (project, section, index, review) => {
  const beats = review?.beats ?? [];
  return `<div class="visual-beat-plan">
    <div class="visual-beat-plan-heading"><div><span>章节内视觉节拍</span><strong>${beats.length} 个画面按口播顺序出现</strong></div><small>没有节拍覆盖的句子自动回到人物画面；录屏只覆盖对应短句，不再占满整个章节。</small></div>
    <div class="visual-beat-list">${beats.map((beat, beatIndex) => {
      const materialIds = [...new Set([...(beat.materialIds ?? []), ...(beat.materialId ? [beat.materialId] : [])])];
      const materials = materialIds.map((materialId) => project.materials.find((item) => item.id === materialId)).filter(Boolean);
      const formLabel = beat.semanticForm ? (visualFormCatalog[beat.semanticForm]?.label ?? beat.semanticForm) : "";
      const animationIntent = beat.animationIntent
        ? applyAnimationAssetMatches(section, beat.animationIntent, beat.id)
        : undefined;
      const animationLabel = animationIntent ? (animationPrototypeLabels[animationIntent.prototypeId] ?? animationIntent.prototypeId) : "";
      const componentCandidates =
        beat.primaryVisualType === "component" && beat.semanticForm ? compatibleComponents(beat.semanticForm) : [];
      const selectedComponentId = beat.componentId ?? componentCandidates[0]?.id;
      const animationStructure = animationIntent ? animationStructureFor(animationIntent.prototypeId) : undefined;
      const animationStyles = animationIntent
        ? (state.metadata.animationTemplates ?? []).filter((item) =>
            (animationStructure?.compatibleStyleIds ?? []).includes(item.id),
          )
        : [];
      const beatControls = animationIntent
        ? `<div class="animation-choice-grid visual-beat-controls">
            <label>动画结构<select data-beat-animation-prototype="${beatIndex}" data-visual-beat-section="${index}">${(state.metadata.animationStructures ?? []).map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === animationIntent.prototypeId ? "selected" : ""}>${escapeHtml(item.label)}</option>`).join("")}</select></label>
            <label>动画模板<select data-beat-animation-style="${beatIndex}" data-visual-beat-section="${index}">${animationStyles.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === animationIntent.styleProfileId ? "selected" : ""}>${escapeHtml(item.label)}</option>`).join("")}</select></label>
          </div>`
        : componentCandidates.length
          ? `<div class="compatible-components visual-beat-controls"><span>组件备选</span>${componentCandidates.map((item) => `<button type="button" class="component-alternative ${item.id === selectedComponentId ? "active" : ""}" data-beat-component-choice="${item.id}" data-beat-component-index="${beatIndex}" data-visual-beat-section="${index}">${componentPreviewMarkup(item,true)}<b>${escapeHtml(item.label)}</b></button>`).join("")}</div>`
          : "";
      const detail = materials.length
        ? materials.map((item) => item.label).join(" ＋ ")
        : animationLabel || formLabel || primaryVisualTypeLabels[beat.primaryVisualType] || beat.primaryVisualType;
      return `<article class="visual-beat-card">
        <div class="visual-beat-order">${String(beatIndex + 1).padStart(2,"0")}</div>
        <div class="visual-beat-copy"><div><b>${escapeHtml(primaryVisualTypeLabels[beat.primaryVisualType] ?? beat.primaryVisualType)}</b><span>${escapeHtml(detail)}</span></div><q>${escapeHtml(beat.exactSpokenQuote)}</q>${materials.length ? `<div class="visual-beat-materials">${materials.map((material) => material.kind === "screenshot" && material.assetId ? `<figure><img src="/api/projects/${encodeURIComponent(project.project.id)}/assets/${encodeURIComponent(material.assetId)}" alt="${escapeHtml(material.label)}"/><figcaption>${escapeHtml(material.label)}</figcaption></figure>` : `<span>${escapeHtml(material.label)}</span>`).join("")}</div>` : ""}${animationIntent ? animationIntent.stages.map((stage) => animationAssetMatchMarkup(section.id,stage.id,beat.id)).join("") : ""}${beatControls}</div>
        <button type="button" data-remove-visual-beat="${beatIndex}" data-visual-beat-section="${index}" aria-label="删除这个视觉节拍">×</button>
      </article>`;
    }).join("")}</div>
  </div>`;
};
const animationReviewMarkup = (section, animation, mode, evidence, index) => {
  const structure = animationStructureFor(animation.prototypeId);
  const template = animationTemplateFor(animation.styleProfileId);
  const alternatives = alternativeAnimationIntents(section, animation);
  const backupForm = reviewedVisualForm(section);
  const backupCandidates = compatibleComponents(backupForm);
  const componentBackup = recommendedComponent(section, backupForm, backupCandidates);
  const structures = state.metadata.animationStructures ?? Object.entries(animationPrototypeLabels).map(([id, label]) => ({ id, label }));
  return `<div class="visual-recommendation"><span>${mode === "auto" ? "首选动画 · 系统推荐" : "当前动画 · 人工选择"}</span><strong>${escapeHtml(animationPrototypeLabels[animation.prototypeId] ?? animation.prototypeId)}＋${escapeHtml(template?.label ?? animation.styleProfileId)}</strong></div>
    <div class="visual-recommendation-stack">
      ${alternatives.map((intent, alternativeIndex) => {
        const alternativeTemplate = animationTemplateFor(intent.styleProfileId);
        return `<button type="button" data-animation-option-prototype="${escapeHtml(intent.prototypeId)}" data-animation-option-style="${escapeHtml(intent.styleProfileId)}" data-animation-option-section="${index}"><span>备选动画 ${alternativeIndex + 1}</span><b>${escapeHtml(animationPrototypeLabels[intent.prototypeId] ?? intent.prototypeId)}＋${escapeHtml(alternativeTemplate?.label ?? intent.styleProfileId)}</b><small>点击后作为当前方案，仍需整体确认</small></button>`;
      }).join("")}
      ${componentBackup ? `<button type="button" class="component-backup" data-animation-component-backup="${escapeHtml(componentBackup.id)}" data-animation-component-form="${escapeHtml(backupForm)}" data-animation-option-section="${index}"><span>第二优先级 · 组件备选</span><b>${escapeHtml(componentBackup.label)}</b><small>动画与组件都能表达时，组件保留给人工选择</small></button>` : ""}
    </div>
    <div class="animation-choice-grid">
      <label>语义结构<select data-animation-prototype="${index}">${structures.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === animation.prototypeId ? "selected" : ""}>${escapeHtml(item.label)}</option>`).join("")}</select><small>决定这段内容用流程、因果、状态或分层等哪种关系表达。</small></label>
      <label>表现风格<div class="fixed-animation-style">手绘编辑风格</div><small>默认使用统一的手绘视觉语言，下游 Agent 仍可自主规划信息结构。</small></label>
    </div>
    <div class="animation-section-preview">
      <div><b>${escapeHtml(animation.takeaway)}</b><span>${escapeHtml(template?.label ?? animation.styleProfileId)} · 人物右上角圆形 PIP</span></div>
      <ol>${animation.stages.map((stage) => `<li><span>${escapeHtml(stage.label)}</span><small>${escapeHtml(stage.action)}</small>${animationAssetMatchMarkup(section.id,stage.id)}</li>`).join("")}</ol>
    </div>
    ${template?.previewUrl ? `<div class="animation-style-preview"><video controls muted loop playsinline preload="metadata" src="${escapeHtml(template.previewUrl)}" aria-label="${escapeHtml(template.label)} 预览"></video><div><b>${escapeHtml(template.label)}</b><p>${escapeHtml(template.description)}</p></div></div>` : ""}
    <div class="visual-evidence"><span>动画依据（来自口播文案）</span><p>“${escapeHtml(evidence)}”</p></div>`;
};
const visualArrangementCard = (project, section, index) => {
  const review = storyboardReview(section);
  if (review?.beats?.length) {
    const confirmed = review.status === "confirmed";
    return `<aside class="visual-arrangement-card multi-beat-arrangement">
      <div class="visual-arrangement-head"><div><span>自动视觉编排 · 制作参考</span><b class="visual-status ${confirmed ? "confirmed" : ""}">${confirmed ? "已确认参考" : "等待确认参考"}</b></div><strong>${review.beats.length} 个视觉节拍</strong></div>
      ${visualBeatPlanMarkup(project,section,index,review)}
      ${textAnnotationEditor(section,index)}
    </aside>`;
  }
  const mode = review?.mode ?? "auto";
  const effectiveMode = mode === "auto" ? recommendedVisualMode(section) : mode;
  const opportunity = reviewedOpportunity(section);
  const form = opportunity ? visualFormCatalog[opportunity.form] : undefined;
  const material = project.materials.find((item) => item.id === section.materialIds[0]);
  const desiredMaterialKind = material?.kind ?? (section.visualIntent === "screen-recording" ? "screen-recording" : "screenshot");
  const materials = project.materials.filter((item) => item.kind === desiredMaterialKind);
  const confirmed = review?.status === "confirmed";
  const evidence = opportunity?.evidenceText ?? section.narration.slice(0, 96);
  let body = "";
  if (effectiveMode === "material") {
    body = `<div class="visual-recommendation"><span>${desiredMaterialKind === "screen-recording" ? "录屏画面" : "图片画面"}</span><strong>${material ? escapeHtml(material.label) : `请选择要展示的${desiredMaterialKind === "screen-recording" ? "录屏" : "图片"}`}</strong></div>
      <div class="storyboard-material-row">${material?.kind === "screenshot" && material.assetId ? `<img src="/api/projects/${encodeURIComponent(project.project.id)}/assets/${encodeURIComponent(material.assetId)}" alt="${escapeHtml(material.label)}"/>` : `<div class="material-file-kind">${material ? escapeHtml(materialKindLabels[material.kind]) : "素材"}</div>`}<div><label>绑定素材<select data-section-material="${index}" data-initial-material="${escapeHtml(section.materialIds[0] ?? "")}"><option value="">请选择</option>${materials.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === material?.id ? "selected" : ""}>${escapeHtml(item.label)} · ${escapeHtml(materialKindLabels[item.kind])}</option>`).join("")}</select></label><label>展示方式<select data-material-display="${index}">${Object.entries(materialDisplayLabels).map(([value,label]) => `<option value="${value}" ${value === (review?.materialDisplay ?? "full") ? "selected" : ""}>${label}</option>`).join("")}</select></label></div></div>`;
  } else if (effectiveMode === "information") {
    const availableForms = section.visualOpportunities?.length
      ? [...new Set(section.visualOpportunities.map((item) => item.form))]
      : Object.keys(visualFormCatalog);
    const selectedForm = reviewedVisualForm(section) ?? availableForms[0];
    const candidates = compatibleComponents(selectedForm);
    const component = reviewedComponent({ ...section, id: section.id });
    body = component ? `<div class="visual-recommendation"><span>${mode === "auto" ? "自动推荐" : "当前选择"}</span><strong>${escapeHtml(component.label)}</strong></div>
      <div class="component-preview-layout"><figure class="component-preview">${componentPreviewMarkup(component)}<figcaption><b>${escapeHtml(component.label)}</b><span>${escapeHtml(visualFormCatalog[selectedForm]?.label ?? selectedForm)}</span></figcaption></figure><div class="compatible-components"><span>兼容备选</span>${candidates.map((item) => `<button type="button" class="component-alternative ${item.id === component.id ? "active" : ""}" data-component-choice="${item.id}" data-section-index="${index}">${componentPreviewMarkup(item,true)}<b>${escapeHtml(item.label)}</b></button>`).join("")}<button type="button" class="catalog-link" data-open-component-catalog="${index}">查看全部 ${visualComponentCatalog.length} 个组件</button></div></div>
      <div class="visual-evidence"><span>依据（来自口播文案）</span><p>“${escapeHtml(evidence)}”</p></div>
      <label class="visual-form-select">信息关系<select data-visual-form="${index}">${availableForms.map((formId) => `<option value="${formId}" ${formId === selectedForm ? "selected" : ""}>${escapeHtml(visualFormCatalog[formId]?.label ?? formId)}</option>`).join("")}</select><small>决定画面用对比、流程、因果、数字或强调等方式表达，不会修改口播文案。</small></label>` : `<div class="visual-empty"><strong>当前没有可用组件</strong><p>请选择另一种信息关系，或保留人物画面。</p></div>`;
  } else if (effectiveMode === "animation") {
    const rawAnimation = review?.animationIntent ?? recommendedAnimationIntent(section);
    const animation = rawAnimation ? applyAnimationAssetMatches(section, rawAnimation) : undefined;
    body = animation
      ? animationReviewMarkup(section, animation, mode, evidence, index)
      : `<div class="visual-empty"><strong>这段没有稳定的动画参考</strong><p>制作 Agent 会结合全文重新选择人物、组件、图片、录屏或其他动画方案。</p></div>`;
  } else {
    body = `<div class="visual-recommendation"><span>${mode === "auto" ? "系统建议" : "已选择"}</span><strong>人物画面</strong></div><div class="visual-evidence"><span>判断依据</span><p>${section.visualOpportunities?.length ? "当前不使用结构组件，保留人物表达。" : "这段没有必须展示的素材或明确信息关系。"}</p></div>`;
  }
  return `<aside class="visual-arrangement-card"><div class="visual-arrangement-head"><div><span>主视觉参考</span><b class="visual-status ${confirmed ? "confirmed" : ""}">${confirmed ? "已确认参考" : "等待确认参考"}</b></div>${modeSelector(project,section,index,mode)}</div>${body}${index === -2 ? "" : textAnnotationEditor(section,index)}</aside>`;
};
const animationAssetTargetCount = () =>
  Object.values(state.detail?.visualStoryboard?.sections ?? {}).reduce(
    (count, review) =>
      count +
      (review.animationIntent?.stages?.length ?? 0) +
      (review.beats ?? []).reduce(
        (beatCount, beat) =>
          beatCount +
          (beat.primaryVisualType === "animation" ? (beat.animationIntent?.stages?.length ?? 0) : 0),
        0,
      ),
    0,
  );
const animationAssetBindingLabel = (binding) =>
  binding.imageAssetLabel
    ? `图片：${binding.imageAssetLabel}`
    : binding.imageAssetId
      ? `图片：${binding.imageAssetId}`
      : `图标：${binding.iconId ?? "自动兜底"}`;
const animationAssetReplanPanel = (project) => {
  const targetCount = animationAssetTargetCount();
  if (!targetCount || project.authoring.state !== "drafted") return "";
  const task = latestJob(project.project.id, "animation-asset-replan");
  const running = ["queued", "running"].includes(task?.status);
  const replanning = state.detail?.animationAssetReplanning;
  const draft = replanning?.draft;
  const changes = draft?.changes ?? [];
  const changed = changes.filter((change) => change.changed);
  const status =
    draft?.status === "suggested"
      ? `<span class="animation-asset-replan-status waiting">等待确认</span>`
      : draft?.status === "confirmed"
        ? `<span class="animation-asset-replan-status confirmed">已确认</span>`
        : "";
  const comparison = draft
    ? `<div class="animation-asset-replan-result"><div><b>最近一次规划</b>${status}<small>${draft.changedCount} 个阶段变化 · 共检查 ${draft.targetCount} 个阶段 · 历史记录 ${replanning.attempts?.length ?? 0} 次</small></div>${
        changed.length
          ? `<details><summary>查看新旧差异（${changed.length}）</summary><div class="animation-asset-replan-diff">${changed
              .map(
                (change) =>
                  `<article><div><b>${escapeHtml(change.stageLabel)}</b><small>${escapeHtml(change.spokenQuote)}</small></div><p><span>${escapeHtml(animationAssetBindingLabel(change.previous))}</span><i aria-hidden="true">→</i><strong>${escapeHtml(animationAssetBindingLabel(change.proposed))}</strong></p></article>`,
              )
              .join("")}</div></details>`
          : `<p class="animation-asset-replan-unchanged">Agent 检查后认为当前图片与图标安排无需改变。</p>`
      }${
        draft.status === "suggested"
          ? `<button type="button" class="primary" id="confirm-animation-asset-replan" data-attempt-id="${escapeHtml(draft.attemptId)}" data-candidate-sha="${escapeHtml(draft.candidateStoryboardSha256)}">确认使用这次规划</button>`
          : ""
      }</div>`
    : "";
  return `<section class="animation-asset-replan-panel"><div class="animation-asset-replan-head"><div><span>动画图片素材</span><b>由固定 Agent 自动匹配</b><small>动画结构或风格调整后，可重新检查图片；候选不会直接覆盖当前分镜。</small></div><button type="button" class="secondary" id="replan-animation-assets" ${running ? "disabled" : ""}>${running ? "Agent 正在规划…" : "重新规划动画素材"}</button></div>${comparison}</section>`;
};
const visualStoryboard = (project, narration) => {
  const entries = storyboardEntries(narration);
  const active = Math.min(state.activeNarrationSection, entries.length - 1);
  const confirmed = entries.filter(({section}) => storyboardReview(section)?.status === "confirmed").length;
  const annotations = entries.flatMap(({section}) => storyboardReview(section)?.annotations ?? []);
  const styleCounts = new Map();
  entries.forEach(({ section }) => {
    for (const beat of storyboardReview(section)?.beats ?? []) {
      if (beat.primaryVisualType !== "animation" || !beat.animationIntent) continue;
      styleCounts.set(beat.animationIntent.styleProfileId, (styleCounts.get(beat.animationIntent.styleProfileId) ?? 0) + 1);
    }
    if (storyboardReview(section)?.beats?.length) return;
    if (reviewedVisualMode(section) !== "animation") return;
    const intent = storyboardReview(section)?.animationIntent ?? recommendedAnimationIntent(section);
    if (intent) styleCounts.set(intent.styleProfileId, (styleCounts.get(intent.styleProfileId) ?? 0) + 1);
  });
  const styleSummary = [...styleCounts.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([styleId, count], index) => `${index === 0 ? "主" : "辅"}：${animationTemplateFor(styleId)?.label ?? styleId} ${count}段`)
    .join(" · ");
  return `<div class="storyboard-heading"><div><h3>口播稿与视觉方案 · 分镜脚本（${entries.length} 段）</h3><p>这里的视觉方案供你预览方向，也供制作 Agent 参考；下游可以按全文重新规划。只有你亲手添加的文字标注会作为必须保留项。</p></div><div class="storyboard-heading-meta"><span data-visual-save-status data-state="saved">视觉修改自动保存</span><span>当前已确认参考 ${confirmed}/${entries.length}</span></div></div>${animationAssetReplanPanel(project)}${annotations.length || styleSummary ? `<details class="storyboard-summary-details"><summary>查看分镜统计</summary><p>用户文字标注 ${annotations.length}${styleSummary ? ` · 参考动画风格 ${escapeHtml(styleSummary)}` : ""}</p></details>` : ""}<div id="section-editor" class="visual-storyboard">${entries.map(({section,index},itemIndex) => {
    const number = String(itemIndex + 1).padStart(2,"0");
    const narrationControl = `<textarea data-section-narration="${index}">${escapeHtml(section.narration)}</textarea>`;
    return itemIndex === active
      ? `<article class="storyboard-active" data-section="${index}"><div class="narration-edit-card"><div class="storyboard-section-title"><span>${number}</span><strong>${escapeHtml(section.title)}</strong></div><label>旁白文案${narrationControl}</label></div>${visualArrangementCard(project,section,index)}</article>`
      : `<button type="button" class="storyboard-collapsed" data-open-narration-section="${itemIndex}"><span>${number}</span><strong>${escapeHtml(section.title)}</strong><p>${escapeHtml(section.narration)}</p><b>${escapeHtml(visualSummary(project,section))}</b><i class="${storyboardReview(section)?.status === "confirmed" ? "confirmed" : ""}">${storyboardReview(section)?.status === "confirmed" ? "参考已确认" : "参考待确认"}</i><span aria-hidden="true">⌄</span></button>`;
  }).join("")}</div>`;
};
const postDraftMaterialForm = () => `
  <details class="review-details post-draft-material-form">
    <summary>写稿后补充截图或录屏</summary>
    <div class="post-draft-material-body">
      <div class="asset-browser-row"><label>图片适配方式<select id="asset-fit"><option value="contain">完整显示</option><option value="cover">填满裁切</option></select></label><button class="secondary" id="browse-assets" type="button">浏览并加入（可多选）</button></div>
      <details class="advanced-path-entry"><summary>也可以手动填写路径</summary><div class="intake-form-grid"><label class="wide">素材绝对路径<input id="asset-path" placeholder="/Users/.../截图.png 或 录屏.mp4"/></label><label>素材类型<select id="asset-kind"><option value="screenshot">截图</option><option value="screen-recording">录屏</option></select></label><label>名称（可选）<input id="asset-label" placeholder="默认使用文件名"/></label></div><div class="intake-form-actions"><button class="secondary" id="add-asset" type="button">加入素材库</button></div></details>
      <p class="hint">Agent 会读取并理解素材内容；这里只需要选择图片的适配方式。</p>
    </div>
  </details>`;
const editorialQuestionField = (question, answer = "") => {
  const id = `editorial-${question.id}`;
  if (question.type === "select") {
    return `<label>${escapeHtml(question.label)}${question.required ? "<span class=\"required-mark\">必填</span>" : ""}<select id="${escapeHtml(id)}" data-editorial-question="${escapeHtml(question.id)}"><option value="">请选择</option>${question.options.map((option) => `<option value="${escapeHtml(option.value)}" ${answer === option.value ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}</select></label>`;
  }
  const attributes = `id="${escapeHtml(id)}" data-editorial-question="${escapeHtml(question.id)}" placeholder="${escapeHtml(question.placeholder ?? "")}"`;
  return question.type === "textarea"
    ? `<label>${escapeHtml(question.label)}${question.required ? "<span class=\"required-mark\">必填</span>" : ""}<textarea ${attributes}>${escapeHtml(answer)}</textarea></label>`
    : `<label>${escapeHtml(question.label)}${question.required ? "<span class=\"required-mark\">必填</span>" : ""}<input ${attributes} value="${escapeHtml(answer)}"/></label>`;
};
const editorialAnswerLabel = (question, answer) =>
  question.options?.find((option) => option.value === answer)?.label ?? answer;
const creatorFacingEditorialQuestionIds = ["relationship-detail", "audience", "takeaway"];
const creatorFacingEditorialQuestions = (questionnaire) => {
  const questions = [...questionnaire.universal, ...questionnaire.categorySpecific];
  return creatorFacingEditorialQuestionIds
    .map((id) => questions.find((question) => question.id === id))
    .filter(Boolean);
};
const editorialBriefSummary = (project, questionnaire, answers, step = "04") => {
  const answered = creatorFacingEditorialQuestions(questionnaire)
    .filter((question) => answers[question.id]?.trim());
  return `<div class="panel intake-panel editorial-brief-panel editorial-brief-summary">
    <div class="intake-section-heading"><span>${step}</span><div><h3>创作方向</h3></div><div class="editorial-summary-actions"><strong class="editorial-status ready">已理解</strong><button class="secondary compact" id="edit-editorial-brief">修改</button></div></div>
    <div class="editorial-summary-grid">${answered
      .map(
        (question) =>
          `<article class="editorial-summary-card"><small>${escapeHtml(question.label)}</small><p>${escapeHtml(editorialAnswerLabel(question, answers[question.id]))}</p></article>`,
      )
      .join("")}</div>
  </div>`;
};
const editorialBriefView = (project, step = "04") => {
  const questionnaire = state.editorial.questionnaires?.[project.brief.category];
  if (!questionnaire)
    return `<div class="panel intake-panel legacy-editorial-brief"><div class="intake-section-heading"><span>${step}</span><div><h3>写作方向</h3></div></div><p>这是旧分类项目，继续沿用原有写稿合同；如需使用结构化写作方向，请新建三类项目之一。</p></div>`;
  const brief = project.brief.editorialBrief;
  const answers = brief?.answers ?? {};
  const questions = creatorFacingEditorialQuestions(questionnaire);
  const missing = questions.filter((question) => question.required && !answers[question.id]?.trim());
  const editing = state.editorial.editingProjectId === project.project.id;
  if (brief?.status === "ready" && !editing) return editorialBriefSummary(project, questionnaire, answers, step);
  const visibleQuestions = editing ? questions : missing;
  const inferredAnswers = questions.filter((question) => answers[question.id]?.trim());
  return `<div class="panel intake-panel editorial-brief-panel">
    <div class="intake-section-heading"><span>${step}</span><div><h3>${brief?.status === "ready" ? "修改创作方向" : "确认创作方向"}</h3></div><strong class="editorial-status ${brief?.status === "ready" ? "ready" : ""}">${brief?.status === "ready" ? "已理解" : `还差 ${missing.length} 项`}</strong></div>
    <div class="editorial-inferred-summary"><strong>${inferredAnswers.length ? "Studio 已理解你的描述" : "可选：补充三项创作方向"}</strong><span>${missing.length ? "不填写也可以继续；填写后只用于调整受众、角度和结论。" : "这些内容只影响写法，不会改变素材理解状态。"}</span><button type="button" class="secondary compact" id="infer-editorial-brief">重新整理</button></div>
    <div class="editorial-question-group"><div class="editorial-question-grid">${visibleQuestions.map((question) => editorialQuestionField(question, answers[question.id])).join("")}</div></div>
    <div class="intake-form-actions"><button class="primary" id="save-editorial-brief">确认创作方向</button>${brief?.status === "ready" ? '<button class="secondary" id="cancel-editorial-edit">取消</button>' : ""}</div>
  </div>`;
};
const materialUnderstandingView = (project) => {
  const report = state.detail?.materialUnderstanding ?? { status:"missing" };
  const running = ["queued","running"].includes(latestJob(project.project.id,"material-understanding")?.status);
  const status = running ? "running" : report.status;
  const presentation = {
    missing:{ label:"尚未理解", tone:"", action:"开始理解资料与素材" },
    running:{ label:"正在理解…", tone:"", action:"正在理解…" },
    stale:{ label:"素材有变化", tone:"stale", action:"重新理解" },
    suggested:{ label:"素材已理解", tone:"ready" },
    confirmed:{ label:"素材已理解", tone:"ready" },
  }[status] ?? { label:"尚未理解", tone:"", action:"开始理解资料与素材" };
  return `<div class="panel intake-panel material-understanding-panel">
    <div class="intake-section-heading"><span>03</span><div><h3>素材理解</h3></div></div>
    <div class="understanding-state ${escapeHtml(presentation.tone)}"><span class="understanding-state-icon" aria-hidden="true">${status === "suggested" || status === "confirmed" ? "✓" : status === "stale" ? "!" : "·"}</span><strong>${escapeHtml(presentation.label)}</strong></div>
    ${presentation.action || report.status === "suggested" ? `<div class="intake-form-actions">${presentation.action ? `<button class="secondary" id="analyze-materials" ${running ? "disabled" : ""}>${escapeHtml(presentation.action)}</button>` : ""}${report.status === "suggested" && !running ? `<button class="primary" id="confirm-material-understanding" data-input-sha="${escapeHtml(report.inputSha256)}">确认素材理解</button>` : ""}</div>` : ""}
  </div>`;
};
const postProductionIntakeView = (project) => {
  const understandingReady = state.detail?.materialUnderstanding?.status === "confirmed";
  const hasScript = Boolean(project.authoring.inputScript);
  const hasSpeakerVideo = Boolean(project.video.sourceAssetId);
  const canContinue = understandingReady && hasScript && hasSpeakerVideo;
  return `
  ${jobFeedback(project)}
  <div class="intake-stack">
    <div class="panel intake-panel"><div class="intake-section-heading"><span>01</span><div><h3>选择已有口播内容</h3><p>口播文字不会被 Agent 重写。</p></div></div><div class="existing-input-grid"><button class="secondary" id="pick-input-script" type="button">${hasScript ? "重新选择口播稿" : "选择口播稿或字幕稿"}</button><span class="${hasScript ? "ready" : ""}">${hasScript ? `✓ ${escapeHtml(project.authoring.inputScript)}` : "支持 TXT、Markdown、SRT、VTT"}</span><button class="secondary" id="pick-speaker-video" type="button">${hasSpeakerVideo ? "重新选择口播原片" : "选择已经录制的视频"}</button><span class="${hasSpeakerVideo ? "ready" : ""}">${hasSpeakerVideo ? "✓ 已加入人物口播原片" : "视频将作为后续制作原片"}</span></div></div>
    <div class="panel intake-panel"><div class="intake-section-heading"><span>02</span><div><h3>补充图片、录屏与素材</h3></div></div><div class="asset-browser-row"><label>图片适配方式<select id="asset-fit"><option value="contain">完整显示</option><option value="cover">填满裁切</option></select></label><button class="secondary" id="browse-assets" type="button">浏览并加入（可多选）</button></div>${intakeInventory(project.materials.filter((item) => item.kind !== "speaker-video"), materialKindLabels, "份辅助素材", project.project.id, project.authoring.state === "not-started")}<p class="hint">Agent 会理解素材内容，并在视觉方案中选择合适的图片、录屏、动画或图标。</p></div>
    <div class="panel intake-panel"><div class="intake-section-heading"><span>03</span><div><h3>补充网站与参考资料</h3></div></div><div class="intake-form-grid"><label>名称<input id="source-label" placeholder="例如项目官网"/></label><label>网址、文件路径或笔记<input id="source-value" placeholder="https://... 或绝对路径"/></label></div><div class="intake-form-actions"><button class="secondary" id="add-source">加入项目资料</button></div>${intakeInventory(project.sources.filter((item) => item.id !== "source-input-script"), sourceKindLabels, "份参考资料", project.project.id)}<p class="hint">网站会被实际读取；只有读取成功并冻结的正文会交给 Agent。</p></div>
    ${materialUnderstandingView(project)}
  </div>
  <div class="actions"><button class="primary" id="prepare-existing-narration" ${canContinue ? "" : "disabled"}>${!hasScript ? "先选择口播稿" : !hasSpeakerVideo ? "先选择口播原片" : !understandingReady ? "先完成素材理解" : "进入口播审核与视觉方案"}</button></div>`;
};
const visualStoryboardMissing = () =>
  Boolean(state.detail?.narration) && Object.keys(state.detail?.visualStoryboard?.sections ?? {}).length === 0;
const visualPlanningRecoveryPanel = () =>
  visualStoryboardMissing()
    ? `<div class="panel visual-planning-recovery"><div><strong>口播稿已安全保存</strong><p>逐段视觉方案还没有生成完成。可以从这一步继续，不会重新调用 Agent 写稿。</p></div><button type="button" class="primary" id="resume-visual-storyboard">继续生成视觉方案</button></div>`
    : "";
const intakeView = (project) => {
  if ((project.project.workflowMode ?? "script-first") === "visual-post-production") return postProductionIntakeView(project);
  const running = ["queued", "running"].includes(latestNarrationJob(project.project.id)?.status);
  const editorialReady = !project.brief.editorialBrief || project.brief.editorialBrief.status === "ready";
  const understandingReady = state.detail?.materialUnderstanding?.status === "confirmed";
  const generateLabel = running
    ? "任务处理中，请稍候…"
    : !understandingReady
      ? "先完成素材理解"
      : !editorialReady
        ? "先完成并保存写作方向"
        : `由 ${project.agent.id === "codex-cli" ? "Codex CLI" : "Claude Code"} 生成口播稿与逐段视觉方案`;
  return `
  ${jobFeedback(project)}
  ${visualPlanningRecoveryPanel()}
  <div class="intake-stack">
    <div class="panel intake-panel"><div class="intake-section-heading"><span>01</span><div><h3>上传图片、录屏与素材</h3></div></div><div class="asset-browser-row"><label>图片适配方式<select id="asset-fit"><option value="contain">完整显示</option><option value="cover">填满裁切</option></select></label><button class="secondary" id="browse-assets" type="button">浏览并加入（可多选）</button></div><details class="advanced-path-entry"><summary>也可以手动填写路径</summary><div class="intake-form-grid"><label class="wide">素材绝对路径<input id="asset-path" placeholder="/Users/.../录屏.mp4"/></label><label>素材类型<select id="asset-kind"><option value="screen-recording">录屏</option><option value="screenshot">图片或截图</option><option value="reference">参考文件</option><option value="speaker-video">人物口播原片</option></select></label><label>名称（可选）<input id="asset-label" placeholder="默认使用文件名"/></label></div><div class="intake-form-actions"><button class="secondary" id="add-asset" type="button">加入素材库</button></div></details>${intakeInventory(project.materials, materialKindLabels, "份素材", project.project.id, project.authoring.state === "not-started")}<p class="hint">Agent 会读取图片原图、录屏代表画面和参考文件，并在视觉规划时决定如何使用。</p></div>
    <div class="panel intake-panel"><div class="intake-section-heading"><span>02</span><div><h3>补充网页、文档与文字资料</h3></div></div><div class="intake-form-grid"><label>名称<input id="source-label" placeholder="例如 GitHub 仓库"/></label><label>网址、文件路径或笔记<input id="source-value" placeholder="https://... 或绝对路径"/></label></div><div class="intake-form-actions"><button class="secondary" id="add-source">加入项目资料</button></div>${intakeInventory(project.sources, sourceKindLabels, "份参考资料", project.project.id)}<p class="hint">资料用来核实项目能力、新闻事实和教程步骤，不替你决定稿件立场。</p></div>
    ${materialUnderstandingView(project)}
    ${editorialBriefView(project,"04")}
  </div>
  <div class="actions"><button class="primary" id="generate-script" ${running || !editorialReady || !understandingReady ? "disabled" : ""}>${generateLabel}</button></div>`;
};
const sourceEvidenceView = (project, sourceContext = []) => {
  if (!project.sources.length) return `<div class="source-evidence source-evidence-empty"><strong>资料依据</strong><span>没有登记外部资料，本稿仅根据选题和已有素材生成。</span></div>`;
  const byId = new Map(sourceContext.map((item) => [item.id, item]));
  return `<div class="source-evidence"><div><strong>资料读取结果</strong><span>只有读取成功的资料会交给 Agent</span></div><ul>${project.sources.map((source) => {
    const context = byId.get(source.id);
    const resolved = context?.status === "resolved";
    const failed = context?.status === "failed";
    const stateClass = resolved ? "resolved" : failed ? "failed" : "pending";
    const stateLabel = resolved
      ? (context.cached ? "使用已冻结缓存" : "读取成功")
      : failed
        ? `读取失败：${escapeHtml(context.error ?? "未知错误")}`
        : "未保存读取记录（不代表读取失败）";
    return `<li class="${stateClass}"><b>${escapeHtml(source.label)}</b><span>${stateLabel}</span></li>`;
  }).join("")}</ul></div>`;
};
const narrationExportControls = () => `
  <details class="export-menu">
    <summary class="secondary compact">导出口播稿</summary>
    <div class="export-menu-popover">
      <button data-export-narration="pdf">PDF</button>
      <button data-export-narration="md">Markdown</button>
      <button data-export-narration="txt">纯文本</button>
      <button data-export-narration="json">结构化 JSON</button>
    </div>
  </details>`;
const narrationHistory = (project) => {
  const attempts = state.detail?.narrationHistory ?? [];
  if (!attempts.length) return "";
  const labels = {
    initial:"初稿",
    rewrite:"Agent 重写",
    "evidence-review-input":"Agent 事实审稿前版本",
    "automatic-repair":"Agent 内部修复版本",
    "manual-save":"人工保存",
    restore:"历史恢复"
  };
  const statusLabel = (attempt) =>
    attempt.status === "succeeded" ? "可用" : attempt.status === "superseded" ? "已完成内部审核" : "内部未采用";
  const changeLabel = (attempt) => {
    const summary = attempt.changeSummary;
    if (!summary) return "";
    const delta = summary.fullScriptCharacterDelta;
    const parts = [`改动 ${summary.changedSectionIds.length} 段`, `口播字数 ${delta >= 0 ? "+" : ""}${delta}`];
    if (summary.titleChanged) parts.unshift("标题已改");
    return ` · ${parts.join(" · ")}`;
  };
  return `<details class="review-details history-panel"><summary>版本历史 · ${attempts.length}</summary><div class="history-list">${attempts.map((attempt) => `
    <div class="history-row ${attempt.attemptId === project.authoring.currentAttemptId ? "current" : ""}">
      <div><strong>${escapeHtml(labels[attempt.kind] ?? attempt.kind)}</strong><span>${formatDateTime(attempt.createdAt)} · ${statusLabel(attempt)}${escapeHtml(changeLabel(attempt))}</span></div>
      ${attempt.status === "succeeded" && attempt.attemptId !== project.authoring.currentAttemptId && project.authoring.state === "drafted" ? `<button class="secondary compact" data-restore-narration="${escapeHtml(attempt.attemptId)}">恢复为新版本</button>` : attempt.attemptId === project.authoring.currentAttemptId ? `<span class="badge">当前版本</span>` : ""}
    </div>`).join("")}</div></details>`;
};
const narrationView = (project, narration, sourceContext) => `
  ${jobFeedback(project)}
  ${visualPlanningRecoveryPanel()}
  <div class="panel review-header"><div><div class="eyebrow">SCRIPT REVIEW</div><h2 style="margin-top:6px">${escapeHtml(narration.title)}</h2></div>${narrationExportControls()}</div>
  <details class="review-details narration-support-details">
    <summary>本期依据与素材</summary>
    <div class="narration-support-body">
      ${sourceEvidenceView(project, sourceContext)}
      ${postDraftMaterialForm()}
      ${authoredMaterialPanel(project, narration)}
    </div>
  </details>
  ${visualStoryboard(project, narration)}
  <dialog id="component-catalog-dialog" class="component-catalog-dialog"><div class="dialog-head"><div><div class="eyebrow">COMPONENT CATALOG</div><h2>${visualComponentCatalog.length} 个组件预览</h2></div><button type="button" class="icon-button" data-close-component-catalog aria-label="关闭">×</button></div><p class="hint">预览展示组件的结构和动效逻辑，不绑定任何历史视频画面；只有与当前口播关系兼容的组件可以确认。</p><div class="component-catalog-grid">${visualComponentCatalog.map((item) => `<button type="button" class="component-catalog-card" data-catalog-component="${item.id}">${componentPreviewMarkup(item)}<span><b>${escapeHtml(item.label)}</b><small>${escapeHtml(item.id)}</small></span></button>`).join("")}</div></dialog>
  <details class="review-details rewrite-panel"><summary>需要 Agent 重写</summary><div class="rewrite-panel-body"><label>修改意见<textarea id="rewrite-instructions" maxlength="2000" placeholder="写下需要调整的内容和表达方式。"></textarea></label><div class="actions"><button class="secondary" id="rewrite-script">交给 ${project.agent.id === "codex-cli" ? "Codex CLI" : "Claude Code"} 重写</button></div></div></details>
  ${narrationHistory(project)}
  <div class="actions"><button class="secondary" id="save-script">保存修改</button><button class="primary" id="lock-script">确认最终稿并锁定</button></div>`;
const shootingGuide = (narration) => `
  <ol class="guide-list">${narration.shootingGuide.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>
  <p class="guide-note"><strong>用途说明：</strong>这份指导主要给你拍摄时查看。视频工作流使用的是锁稿后生成的结构化录屏场景计划，两者来自同一份最终稿。</p>`;
const scriptReader = (narration) => `
  <article class="script-reader">
    <div class="script-block"><span>开场</span><p>${escapeHtml(narration.opening)}</p></div>
    <div class="script-block"><span>本期概述</span><p>${escapeHtml(narration.overview)}</p></div>
    ${narration.sections.map((section, index) => `<section class="script-block"><div class="script-section-head"><span>${String(index + 1).padStart(2, "0")} · ${escapeHtml(section.title)}</span><span class="badge">${escapeHtml(intentLabels[section.visualIntent])}</span></div><p>${escapeHtml(section.narration)}</p>${section.recordingInstruction ? `<aside><strong>对应画面：</strong>${escapeHtml(section.recordingInstruction)}</aside>` : ""}</section>`).join("")}
    <div class="script-block"><span>结尾总结</span><p>${escapeHtml(narration.conclusion)}</p></div>
  </article>`;
const writingLearningPanel = (project) => {
  const task = latestJob(project.project.id, "writing-learning");
  const learning = state.detail?.writingLearning;
  const profileCount = state.detail?.writingProfile?.lessons?.length ?? 0;
  if (task && ["queued", "running"].includes(task.status)) {
    const percent = Math.max(0, Math.min(100, Number(task.progress?.percent ?? 0)));
    return `<div class="panel writing-learning-panel"><div><div class="eyebrow">CREATOR LEARNING</div><h3>正在总结本期写稿经验</h3><p>${escapeHtml(task.progress?.message ?? "正在比较初稿和最终稿")}</p></div><b>${percent}%</b></div>`;
  }
  if (learning?.status === "suggested") {
    return `<div class="panel writing-learning-panel"><div><div class="eyebrow">CREATOR LEARNING</div><h3>把本期经验用于以后项目</h3><p>${escapeHtml(learning.summary)}</p><small>只保存表达方式，不保存本期项目事实。当前已有 ${profileCount} 条长期偏好。</small></div><fieldset><legend>确认要长期保留的经验</legend>${learning.lessons.map((lesson) => `<label><input type="checkbox" data-writing-lesson="${escapeHtml(lesson.id)}" checked/><span>${escapeHtml(lesson.guidance)}</span></label>`).join("")}</fieldset><div class="actions"><button type="button" class="primary" id="accept-writing-lessons">确认并用于以后项目</button></div></div>`;
  }
  if (learning?.status === "accepted") {
    return `<div class="panel writing-learning-panel accepted"><div><div class="eyebrow">CREATOR LEARNING</div><h3>本期经验已沉淀</h3><p>已将 ${learning.acceptedLessonIds?.length ?? 0} 条审核通过的表达偏好加入创作者档案，未来同类写稿会自动参考。</p></div><span class="badge">累计 ${profileCount} 条</span></div>`;
  }
  return `<div class="panel writing-learning-panel"><div><div class="eyebrow">CREATOR LEARNING</div><h3>总结本期写稿经验</h3><p>比较初稿、修改意见和最终审核稿，提炼可复用的表达方式；结果仍由你确认。</p></div><button type="button" class="secondary" id="suggest-writing-lessons">开始提炼</button></div>`;
};
const lockedNarrationView = (project, narration) => `
  <div class="panel review-header"><div><div class="eyebrow">LOCKED SCRIPT</div><h2>最终口播稿</h2></div>${narrationExportControls()}</div>
  ${writingLearningPanel(project)}
  <details class="review-details" open><summary>最终口播稿 · ${escapeHtml(narration.title)}</summary>${scriptReader(narration)}</details>
  <details class="review-details" open><summary>拍摄指导</summary>${shootingGuide(narration)}</details>`;
const mediaView = (project, narration) => `
  <div class="panel review-header"><div><div class="eyebrow">SHOOTING HANDOFF</div><h2>最终稿已锁定</h2></div><div class="header-actions">${narrationExportControls()}</div></div>
  ${writingLearningPanel(project)}
  <div class="field-row"><div class="panel"><h3>拍摄原片</h3><label>原片绝对路径<input id="asset-path" placeholder="/Users/.../speaker.MOV"/></label><input id="asset-label" value="最终人物口播原片"/><input type="hidden" id="asset-kind" value="speaker-video"/><button class="secondary" id="add-asset">登记原片</button>${intakeInventory(project.materials.filter((item) => item.kind === "speaker-video"), materialKindLabels, "份人物原片")}</div><div class="panel"><h3>拍摄指导</h3>${shootingGuide(narration)}</div></div>
  <details class="review-details" open><summary>拍摄用最终口播稿 · ${escapeHtml(narration.title)}</summary>${scriptReader(narration)}</details>
  <div class="panel hash-panel"><span>最终稿 SHA-256</span><code>${escapeHtml(project.authoring.finalScriptSha256 ?? "—")}</code></div>
  <div class="actions"><button class="primary" id="create-handoff">生成视频工作流交接包</button></div>`;
const workflowStageLabels = {
  preflight: "检查本机环境", ingest: "准备人物原片", probe: "读取视频信息", "supplemental-probe": "检查录屏素材", "image-probe": "检查图片证据", transcribe: "识别口播内容", "transcript-conformance": "对照定稿校对转录",
  terminology: "校对专有名词", layout: "分析人物位置", "recut-plan": "理解口播节奏", "edit-plan": "生成粗剪方案", "recut-review": "生成 720p 审核预览",
  "recut-approval": "制作 Agent 审核粗剪", "edit-promote": "应用已通过的粗剪", "brand-align": "安排 SeanLab 品牌片头", captions: "生成中文字幕", "visual-input-preflight": "预检录屏与视觉锚点", translate: "翻译英文字幕", "scene-align": "对齐录屏和图片",
  "semantic-plan": "理解内容重点", "component-props": "准备视觉组件", "visual-direction": "安排画面节奏", validate: "检查视觉方案", "review-base": "准备审核画面", "brand-review": "检查片头与音效", "qa-capture": "生成静态审核图", "visual-qa": "检查显示完整性", "visual-pacing-review": "按需生成动画片段预览", "review-evidence": "整理审核画廊", "regression-fixtures": "检查已批准风格", "agent-review": "制作 Agent 自主复核", "human-approval": "制作 Agent 锁定审核证据", "delivery-render": "渲染最终成片", "delivery-validate": "验收成片文件",
};
const friendlyWorkflowFailure = (failure) => {
  if (!failure) return "";
  const messages = {
    INPUT_SCENE_DURATION_UNSAFE: "这段录屏短于对应口播，继续会让录屏速度低于安全范围。请缩短展示区间、换更长录屏，或明确改用人物画面。",
    BINDING_ANCHOR_NOT_FOUND: "系统没有在当前字幕中找到已确认画面的口播定位句，因此不会猜测插入位置。请检查对应口播并重新绑定，或改用人物画面。",
    REGISTRY_CONTRACT_INVALID: "这是 Studio 自身的视觉资源契约问题，不是你的素材问题。继续重试不会解决，需要修复指定的组件或动效登记。",
    VISUAL_PROPS_INVALID: "有一个自动视觉候选不符合组件要求。系统已在渲染前停止，请修复或替换这一项，不需要重跑已经有效的口播和粗剪。",
    QA_CONTRACT_MISSING: "这是 Studio 自身缺少审核边界配置，已经在渲染前停止。需要补齐指定组件的审核范围后再继续。",
    CAPTION_NORMALIZATION_FAILED: "专有名词替换后出现了相邻重复。请只修正对应字幕，不需要重新理解整期内容。",
    DELIVERY_VISUAL_PARITY_FAILED: "审核版本与成片版本的画面清单不一致，系统已阻止交付。请恢复缺失画面，或明确记录替代画面和原因。",
    STATE_ARTIFACT_CONFLICT: "本地成片文件与正式工作流状态不一致。Studio 不会仅凭文件存在判断已经交付，也不会自动覆盖。",
    PROVIDER_REQUEST_TIMEOUT: "内容服务本次请求超时。可以重试同一个请求，前面已经完成的口播、字幕和审核结果会保留。",
  };
  if (messages[failure.code]) return messages[failure.code];
  if (failure.code === "SEMANTIC_REPLAN_REQUIRED")
    return "英文字幕已经更新，先前的内容理解结果不再对应当前字幕。请点击顶部的“重新理解并继续”，系统会保留旧版本并生成一份可比较的新计划。";
  if (failure.stage === "brand-align") return "人物原片中没有找到口播稿里的转场句，品牌动画无法按原计划插入。";
  if (failure.stage === "scene-align") return "人物原片的实际口播和锁定稿不一致，系统没有在原片中找到录屏素材的定位句。已保留前面的制作进度，不会猜测插入位置。";
  return failure.message ?? "当前步骤未完成，可以从已保存的进度继续。";
};
const protectedRangeLabel = (item) => item.matchedText?.replace(/[()]/g, "") || (item.id?.startsWith("audio-event") ? "录制现场声音" : "已锁定口播内容");
const unresolvedAnchorLabel = (item) => item.id?.startsWith("brand-") ? "品牌动画的转场句未在原片中找到" : item.id?.startsWith("scene-") ? "一段录屏或图片的口播定位句未找到" : "一处原计划的保护位置未找到";
const workflowFeedback = (project) => {
  const task = latestJob(project.project.id, "video-workflow");
  if (!task || !["queued", "running"].includes(task.status)) return "";
  if (["queued", "running"].includes(task.status)) return `<div class="job-banner" role="status"><div class="job-banner-head"><div><span class="job-spinner"></span><strong>${task.status === "queued" ? "视频任务正在排队" : "视频工作流正在运行"}</strong></div><button class="ghost" id="cancel-workflow" data-job-id="${escapeHtml(task.id)}">取消</button></div><p>${escapeHtml(task.progress?.message ?? task.logs?.at(-1) ?? "已进入队列")}</p><small>页面刷新不会取消任务，完成后会自动刷新审核内容。</small></div>`;
  return "";
};
const stageTimeline = (workflow) => `<div class="workflow-stage-grid">${workflow.stages.map((stage) => `<div class="workflow-stage ${escapeHtml(stage.status)}"><span></span><div><b>${escapeHtml(workflowStageLabels[stage.name] ?? "处理视频")}</b><small>${escapeHtml(workflowStatusLabels[stage.status] ?? stage.status)}${stage.elapsedMs ? ` · ${(stage.elapsedMs / 1000).toFixed(1)} 秒` : ""}</small></div></div>`).join("")}</div>`;
const workflowWarningCount = (project, workflow) => {
  return workflow?.recut?.unresolvedProtectedAnchors.length ?? 0;
};
const workflowProgressContent = (project, workflow) => `
  ${workflowFeedback(project)}
  ${workflow ? stageTimeline(workflow) : '<div class="workflow-info-empty"><h3>还没有制作进度</h3></div>'}
`;
const recutCandidatesView = (recut) => `
  <div class="panel workflow-candidates"><h3>建议调整的片段 · ${recut.candidates.length}</h3><div class="candidate-list">${recut.candidates.map((item, index) => `<button class="candidate-card ${escapeHtml(item.disposition)}" data-seek="${Number(item.start)}"><div><b>片段 ${index + 1}</b><span class="badge">${escapeHtml(recutKindLabels[item.kind] ?? "口播调整")}</span></div><p>${escapeHtml(item.quote || "这一处是纯停顿，没有口播文字")}</p><small>${Number(item.start).toFixed(1)}–${Number(item.end).toFixed(1)} 秒 · ${escapeHtml(recutDispositionLabels[item.disposition] ?? "待审核")}</small><em>${item.kind === "long-pause" ? "仅缩短中间的静音，不删除前后口播" : escapeHtml(item.reason ?? "")}</em></button>`).join("")}</div></div>
`;
const workflowWarningContent = (project, workflow) => {
  const recut = workflow?.recut;
  const task = latestJob(project.project.id, "video-workflow");
  const stopped = Boolean(workflow?.currentFailure || ["failed", "interrupted", "cancelled"].includes(task?.status));
  if (!recut && !stopped)
    return '<div class="workflow-info-empty"><h3>目前没有需要留意的内容</h3></div>';
  return `
    ${stopped ? '<div class="job-banner"><div class="job-banner-head"><strong>制作 Agent 正在处理</strong><span class="badge">已保留进度</span></div><p>技术诊断和恢复会在后台进行，不需要你处理错误信息。</p></div>' : ""}
    ${recut ? `<div class="workflow-warning-grid"><div class="panel"><h3>系统保证不会误删</h3><p>${recut.protectedRanges.length ? `已锁定 ${recut.protectedRanges.length} 段需要保留的原始内容。` : "没有需要额外锁定的片段。"}</p>${recut.protectedRanges.length ? `<ul class="compact-list">${recut.protectedRanges.map((item) => `<li><b>${escapeHtml(protectedRangeLabel(item))}</b><span>${Number(item.start).toFixed(1)}–${Number(item.end).toFixed(1)} 秒</span></li>`).join("")}</ul>` : ""}</div><div class="panel"><h3>需要你留意</h3>${recut.unresolvedProtectedAnchors.length ? `<p>原片中有 ${recut.unresolvedProtectedAnchors.length} 处没有匹配到口播稿的定位句。这不会造成误删，但后续的片头或录屏对齐可能会改用备用位置。</p><ul class="compact-list">${[...new Set(recut.unresolvedProtectedAnchors.map(unresolvedAnchorLabel))].map((label) => `<li><b>${escapeHtml(label)}</b></li>`).join("")}</ul>` : "<p>口播稿中的所有定位句都已在原片中找到。</p>"}</div></div>${recutCandidatesView(recut)}` : ""}
  `;
};
const recutReviewView = (project, workflow) => {
  const recut = workflow.recut;
  if (!recut) return "";
  const summary = recut.summary ?? {};
  const rejected = recut.decision?.decision === "rejected";
  const staticReviewReady = workflow.reviewReady;
  return `<section class="recut-review">
    <div class="panel review-header"><div><div class="eyebrow">INTELLIGENT RECUT 2.0</div><h2>粗剪审核</h2></div><span class="status-pill">${workflow.recutApproved ? "已批准" : rejected ? "已驳回" : "待审核"}</span></div>
    <div class="recut-metrics"><div><b>${Number(summary.originalDurationSeconds ?? 0).toFixed(1)}s</b><span>原始口播</span></div><div><b>${Number(summary.proposedDurationSeconds ?? 0).toFixed(1)}s</b><span>建议成片</span></div><div><b>${Number(summary.proposedSavingsSeconds ?? 0).toFixed(1)}s</b><span>预计节省</span></div><div><b>${summary.removalCount ?? 0}</b><span>建议删除</span></div></div>
    <div class="panel recut-player"><video id="recut-preview" controls preload="metadata" src="${escapeHtml(recut.previewUrl)}"></video><details class="technical-details"><summary>查看审核版本标识</summary><code>${escapeHtml(recut.screenSha256)}</code></details></div>
    ${workflow.recutApproved ? `<div class="panel approval-success"><h3>${staticReviewReady ? "Agent 质检证据已生成" : "制作 Agent 已通过粗剪"}</h3><p>${staticReviewReady ? "已完成字幕、录屏、视觉组件和显示完整性检查。" : "Agent 会继续完成视觉制作、自检和渲染。"}</p></div>` : `<div class="panel recut-actions-panel"><h3>制作 Agent 正在审核粗剪</h3><p>安全删减、口播锚点和连续预览由 Agent 内部核对；未通过时会自动重新规划，不会把中间审批交给你。</p></div>`}
  </section>`;
};
const workflowProductionProgress = (workflow) => {
  const stages = workflow?.stages ?? [];
  const reviewBoundary = stages.findIndex(({ name }) => name === "delivery-validate");
  const productionStages = reviewBoundary >= 0 ? stages.slice(0, reviewBoundary + 1) : stages;
  const completed = productionStages.filter(({ status }) => ["succeeded", "approved"].includes(status)).length;
  return {
    completed,
    total: productionStages.length,
    percent: productionStages.length ? Math.round((completed / productionStages.length) * 100) : 0,
  };
};
const workflowNextRun = (workflow) => {
  if (!workflow || workflow.reviewApproved) return undefined;
  const started = workflow.stages.some((stage) => stage.status !== "pending");
  return {
    action: "production",
    targetGate: "delivery-acceptance",
    label: started ? "由 Agent 继续制作" : "开始制作并生成成片",
  };
};
const latestWorkflowReadiness = (projectId, targetGate, profile) =>
  state.jobs
    .filter(
      (item) =>
        item.projectId === projectId &&
        item.kind === "video-workflow" &&
        item.action === "readiness" &&
        item.status === "completed" &&
        item.readiness?.nextHumanGate === targetGate &&
        (!profile ||
          (item.readinessProfile?.resolution === profile.resolution &&
            String(item.readinessProfile?.frameRate) === String(profile.frameRate))),
    )
    .at(-1)?.readiness;
const readinessStatusLabel = (status) =>
  ({
    blocked: "需要先修复",
    warning: "可以继续，但请留意",
    ready: "可以安全继续",
    "up-to-date": "已经到达下一审核点",
  })[status] ?? "等待检查";
const estimatedRemainingLabel = (task, percent) => {
  if (!task || task.status === "queued") return "等待开始后估算";
  if (task.status === "completed" || percent >= 100) return "已完成";
  const startedAt = Date.parse(task.startedAt ?? "");
  if (!Number.isFinite(startedAt) || percent < 2) return "运行一段时间后估算";
  const elapsedMs = Math.max(0, Date.now() - startedAt);
  const remainingMs = Math.round((elapsedMs / percent) * (100 - percent));
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return "即将完成";
  const remainingMinutes = Math.max(1, Math.ceil(remainingMs / 60000));
  return remainingMinutes < 60
    ? `约 ${remainingMinutes} 分钟`
    : `约 ${Math.floor(remainingMinutes / 60)} 小时 ${remainingMinutes % 60} 分钟`;
};
const workflowReadinessCard = (project, workflow) => {
  const next = workflowNextRun(workflow);
  const task = latestJob(project.project.id, "video-workflow");
  const workflowProgress = workflowProductionProgress(workflow);
  const taskPercent = Math.max(0, Math.min(100, Number(task?.progress?.percent ?? 0)));
  const percent = ["queued", "running"].includes(task?.status)
    ? Math.max(workflowProgress.percent, taskPercent)
    : workflowProgress.percent;
  const failed = workflow?.currentFailure || ["failed", "interrupted", "cancelled"].includes(task?.status);
  const recoveryTask = state.jobs
    .filter((item) => item.projectId === project.project.id && ["production-agent-recovery", "production-baseline"].includes(item.kind))
    .at(-1);
  const recovering = failed && ["queued", "running"].includes(recoveryTask?.status);
  const readiness = next ? latestWorkflowReadiness(project.project.id, next.targetGate) : undefined;
  const blocked = readiness?.readinessStatus === "blocked";
  const status = failed || blocked
    ? recovering
      ? "制作中"
      : "未生成结果"
    : workflow?.reviewApproved
      ? "可以审核"
      : ["queued", "running"].includes(task?.status)
        ? "制作中"
        : "准备中";
  const message = failed
    ? recovering
      ? "制作 Agent 正在后台诊断、修改并重新检查。"
      : "本次暂未生成可审核版本，所有有效进度已保留。"
    : blocked
      ? "开始前还有一项需要处理，打开故障恢复查看解决办法。"
      : workflow?.reviewApproved
      ? "制作、Agent 自检和成片技术验收已完成，请审核最终成片。"
      : task?.status === "queued"
        ? "任务已经进入队列，开始后会自动更新进度。"
        : task?.status === "running"
          ? "正在制作、自检并渲染本期视频，完成后只需你审核最终成片。"
          : "先做一次快速检查，之后制作 Agent 会连续完成制作、自检与渲染。";
  const action = failed
    ? '<p class="guide-note">无需处理技术错误；详细诊断仅保留在高级详情中。</p>'
    : workflow?.reviewApproved
      ? '<button type="button" class="primary" id="open-delivery">审核最终成片</button>'
        : next && !readiness
          ? '<button type="button" class="primary" id="workflow-readiness-check">检查并继续</button>'
          : blocked
            ? '<p class="guide-note">制作 Agent 会先校验现有产物，不会覆盖有效结果。</p>'
            : next && readiness
              ? `<label class="confirmation-row"><input type="checkbox" id="workflow-readiness-confirm"/><span>确认继续“${escapeHtml(next.label)}”</span></label><button type="button" class="primary" id="workflow-readiness-start" data-action="${escapeHtml(next.action)}" data-readiness-sha="${escapeHtml(readiness.readinessSha256)}">${escapeHtml(next.label)}</button>`
              : "";
  return `<section class="panel workflow-creator-status ${failed || blocked ? "needs-attention" : ""}">
    <div class="workflow-creator-status-head"><div><span class="creator-state">${escapeHtml(status)}</span><h3>${escapeHtml(message)}</h3></div><b>${percent}%</b></div>
    <div class="progress-track" aria-label="视频制作总体进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><span style="width:${percent}%"></span></div>
    <div class="workflow-creator-status-foot"><span>总体进度 ${percent}%</span><span>预计剩余：${failed || blocked ? "等待问题解决" : escapeHtml(estimatedRemainingLabel(task, percent))}</span><div class="actions">${action}</div></div>
  </section>`;
};
const workflowTopActions = (project, workflow) => {
  const refresh = `<button type="button" class="workflow-refresh-icon refresh-help" id="workflow-refresh" aria-label="重新校验已有进度" aria-describedby="workflow-refresh-tip"><img src="/assets/icons/refresh.svg" alt=""/><span class="workflow-hover-tip" id="workflow-refresh-tip" role="tooltip">重新读取并校验已有步骤，不会启动工作流，也不会重新调用 Agent、翻译或渲染。</span></button>`;
  const task = latestJob(project.project.id, "video-workflow");
  const { percent: progressPercent } = workflowProductionProgress(workflow);
  const progress = `<button type="button" class="workflow-refresh-icon progress ${["queued", "running"].includes(task?.status) ? "active" : ""}" id="workflow-progress-open" aria-label="查看制作进度，已完成 ${progressPercent}%" title="制作进度 ${progressPercent}%"><img src="/assets/icons/progress.svg" alt=""/><span class="workflow-progress-badge" style="--workflow-progress:${progressPercent * 3.6}deg">${progressPercent}%</span></button>`;
  const warningCount = workflowWarningCount(project, workflow);
  const warning = `<button type="button" class="workflow-refresh-icon warning ${warningCount ? "active" : ""}" id="workflow-warning-open" aria-label="查看粗剪提示" title="粗剪提示"><img src="/assets/icons/warning.svg" alt=""/>${warningCount ? `<span>${warningCount}</span>` : ""}</button>`;
  return `${refresh}${progress}${warning}`;
};
const productionBaselineReviewView = (workflow) => {
  const baseline = workflow?.productionBaseline;
  if (!baseline) return "";
  if (baseline.status === "delivered")
    return `<section class="static-review"><div class="panel approval-success"><div class="eyebrow">SAFE BASELINE DELIVERY</div><h2>基础版本成片已生成</h2><p>最终成片与已通过的审核版本内容一致。</p></div><div class="panel delivery-player"><video controls preload="metadata" src="${escapeHtml(baseline.deliveryUrl)}"></video><div class="actions"><a class="button secondary" href="${escapeHtml(baseline.deliveryUrl)}" download>下载最终成片</a></div></div></section>`;
  if (baseline.status === "approved")
    return `<section class="static-review"><div class="panel approval-success"><div class="eyebrow">SAFE BASELINE</div><h2>基础审核版本已通过</h2><p>增强视觉未能完成时，系统保留了人物主画面和已批准的剪辑结果。</p><div class="actions"><button type="button" class="primary" id="deliver-production-baseline">生成最终成片</button></div></div></section>`;
  return `<section class="static-review production-baseline-review">
    <div class="panel review-header"><div><div class="eyebrow">SAFE BASELINE</div><h2>增强制作未完成 · 保底预览</h2><p>Agent 已保留人物主画面和已批准的粗剪；这不是增强制作成功的结果，仅在自动修复达到上限后供你选择。</p></div><span class="status-pill">等待选择</span></div>
    <div class="panel recut-player"><video controls preload="metadata" src="${escapeHtml(baseline.reviewUrl)}"></video></div>
    <div class="panel recut-actions-panel"><label class="confirmation-row"><input type="checkbox" id="production-baseline-confirm"/><span>我接受放弃本次增强视觉，并确认保底版本可作为最终结果</span></label><div class="actions"><button type="button" class="secondary" id="approve-production-baseline">接受保底版本</button></div></div>
  </section>`;
};
const videoView = (project, workflow) => `
  <div class="panel workflow-workbench-header"><div><div class="eyebrow">VIDEO WORKFLOW</div><h2>视频制作工作台</h2></div><div class="workflow-workbench-actions">${workflowTopActions(project, workflow)}</div></div>
  ${workflowReadinessCard(project, workflow)}
  ${workflow?.productionBaseline ? productionBaselineReviewView(workflow) : ""}
  ${workflow?.recutReady ? recutReviewView(project, workflow) : workflow?.recutApprovalStatus === "stale" ? `<div class="panel recut-actions-panel"><h3>需重新审核粗剪</h3><p>录屏定位句或粗剪保护范围已变化，上一次的 720p 审核结果不再适用。系统只会重新生成粗剪预览，不会重做转写和 Agent 理解。</p></div>` : `<div class="panel"><h3>智能粗剪 2.0</h3><p>就绪检查会同时展示执行计划，因此不再需要先启动一个独立的预览任务。</p></div>`}`;

const componentDisplayLabels = {
  "distribution-bars": "分布对比",
  "scenario-branches": "情景分支",
  "market-cap-lines": "趋势对比",
  "person-evidence-card": "人物观点",
  "factor-sequence": "关键因素",
  "ranked-metric-list": "指标排行",
  "binary-versus": "双向对比",
  "key-stat-summary": "核心数据",
  "media-comparison": "媒体对比",
  "image-evidence-inset": "图片证据",
  "process-steps": "流程步骤",
  "causal-chain": "因果关系",
  "quote-source-card": "引用来源",
  "historical-timeline": "历史时间线",
  "decision-matrix": "决策矩阵",
  "model-classification-map": "模型分类",
  "core-positioning-node": "核心定位",
  "capability-surface-grid": "能力矩阵",
  "tradeoff-scale": "取舍权衡",
  "rough-annotation": "手绘语义标注",
};
const formatReviewTime = (seconds) => {
  const value = Math.max(0, Number(seconds ?? 0));
  return `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, "0")}`;
};
const reviewFrames = () => {
  const review = state.staticReview;
  if (!review?.available) return [];
  if (state.reviewFilter === "priority") {
    const findings = review.frames.filter((frame) => frame.findingIds.length > 0);
    if (findings.length) return findings;
    const representative = new Map();
    review.frames
      .filter((frame) => frame.visualCategory !== "speaker-only")
      .forEach((frame) => {
        const key = `${frame.chapterId ?? frame.cueId ?? "uncategorized"}:${frame.visualCategory}`;
        const current = representative.get(key);
        if (!current || (current.phase !== "stable" && frame.phase === "stable")) representative.set(key, frame);
      });
    return representative.size ? [...representative.values()] : review.frames.slice(0, 1);
  }
  return review.frames.filter((frame) => {
    return state.reviewFilter === "all" ||
      (state.reviewFilter === "issues" ? frame.findingIds.length > 0 : frame.visualCategory === state.reviewFilter);
  });
};
const directionSummary = (review) => {
  const summary = review.summary ?? {};
  const componentUsage = Object.entries(review.direction?.componentUsage ?? {});
  const importanceUsage = Object.entries(review.direction?.importanceUsage ?? {});
  return `<div class="review-summary-grid">
    <div><b>${summary.chapterCount ?? 0}</b><span>内容章节</span></div>
    <div><b>${summary.selectedCount ?? 0} / ${(summary.selectedCount ?? 0) + (summary.skippedCount ?? 0)}</b><span>采用的候选画面</span></div>
    <div><b>${(Number(summary.visualCoverageRatio ?? 0) * 100).toFixed(1)}%</b><span>视觉画面覆盖</span></div>
    <div><b>${Number(summary.visualsPerMinute ?? 0).toFixed(2)}</b><span>每分钟视觉画面</span></div>
    <div><b>${summary.authoredScenes ?? 0}</b><span>录屏与图片场景</span></div>
    <div><b>${summary.speakerOnlyFrames ?? 0}</b><span>纯口播检查画面</span></div>
  </div>
  <div class="direction-breakdown">
    <div><strong>画面层级</strong><p>${importanceUsage.length ? importanceUsage.map(([key, value]) => `${key === "hero" ? "重点" : key === "support" ? "辅助" : "点缀"} ${value}`).join(" · ") : "本期没有额外视觉层级"}</p></div>
    <div><strong>组件使用</strong><p>${componentUsage.length ? componentUsage.map(([key, value]) => `${escapeHtml(componentDisplayLabels[key] ?? "视觉组件")} × ${value}`).join(" · ") : "本期没有选择语义组件"}</p></div>
    <div><strong>标题连续性</strong><p>${review.direction?.titleCues?.length ?? 0} 处总结标题，用于保持纯口播段落的画面信息。</p></div>
  </div>`;
};
const qaSummary = (review) => {
  const qa = review.qa ?? {};
  const findings = qa.findings ?? [];
  const errors = findings.filter((item) => item.severity === "error");
  const warnings = findings.filter((item) => item.severity === "warning");
  return `<div class="qa-overview ${errors.length ? "blocked" : "passed"}">
    <div><span class="qa-state-dot"></span><div><b>${errors.length ? `发现 ${errors.length} 个必须处理的问题` : warnings.length ? `没有阻断问题，另有 ${warnings.length} 条建议` : "所有自动检查均已通过"}</b><p>已检查文字清晰度、人物遮挡、字幕安全区、画面裁切、录屏可读性、PIP 和场景对齐。</p></div></div>
    <span class="status-pill">${escapeHtml(qa.status === "passed" ? "已通过" : qa.status === "warning" ? "建议复核" : "需处理")}</span>
  </div>
  ${findings.length ? `<div class="qa-finding-list">${findings.map((item) => `<article class="qa-finding ${escapeHtml(item.severity)}"><div><span>${escapeHtml(item.severityLabel)}</span><b>${escapeHtml(item.ruleLabel)}</b></div><p>${escapeHtml(item.message)}</p>${item.cueId ? `<small>对应画面：${escapeHtml(item.cueId)}</small>` : ""}</article>`).join("")}</div>` : ""}
  <div class="qa-detail-grid">
    <div><span>专有名词</span><b>${qa.terminology?.entryCount ?? 0} 组已校对</b></div>
    <div><span>项目自定义术语</span><b>${qa.terminology?.projectOverrideCount ?? 0} 组</b></div>
    <div><span>风格回归检查</span><b>${qa.regression?.status === "passed" ? "通过" : qa.regression?.status === "skipped" ? "本项目未启用" : "需要查看"}</b></div>
    <div><span>录屏定位</span><b>${qa.sceneAlignment?.resolved ?? 0} 已对齐 · ${qa.sceneAlignment?.requiredUnresolved ?? 0} 未对齐</b></div>
    <div><span>图片完整性</span><b>${qa.imageMetrics?.checked ?? 0} 张已检查 · ${qa.imageMetrics?.missing ?? 0} 张缺失</b></div>
    <div><span>最低清晰度指标</span><b>${Number(qa.imageMetrics?.minimumSharpness ?? 0).toFixed(1)}</b></div>
  </div>`;
};
const reviewInfoContent = (review) => {
  const provenance = review.provenance ?? {};
  const provenanceTime = provenance.evidenceGeneratedAt ? formatDateTime(provenance.evidenceGeneratedAt) : "时间未知";
  return `
    <section class="review-info-section">
      <h3>证据状态</h3>
      <div class="review-provenance ${review.evidenceValid ? "current" : "historical"}"><div><span>证据状态</span><b>${review.evidenceValid ? "本次有效结果" : "上一次历史结果"}</b></div><div><span>理解 Agent</span><b>${escapeHtml(provenance.agentId ?? "未知")}${provenance.model ? ` · ${escapeHtml(provenance.model)}` : ""}</b></div><div><span>生成时间</span><b>${escapeHtml(provenanceTime)}</b></div><div><span>理解范围</span><b>${provenance.plannedSegmentCount ?? "-"} 段 · ${provenance.captionCount ?? "-"} 条字幕</b></div></div>
    </section>
    <section class="review-info-section">
      <h3>画面节奏概览</h3>
      ${directionSummary(review)}
    </section>
    <section class="review-info-section">
      <h3>质量检查结果</h3>
      ${qaSummary(review)}
    </section>`;
};
const coverflowOffset = (index, selectedIndex, total) => {
  if (total < 2) return 0;
  const half = Math.floor(total / 2);
  let offset = index - selectedIndex;
  if (offset > half) offset -= total;
  if (offset < -half) offset += total;
  return offset;
};
const coverflowDotIndices = (total, selectedIndex) => {
  const count = Math.min(7, total);
  if (!count) return [];
  const start = selectedIndex - Math.floor(count / 2);
  return Array.from({ length: count }, (_, index) => (start + index + total) % total);
};
const galleryMarkup = (review) => {
  const frames = reviewFrames();
  const findingCount = review.frames.filter((frame) => frame.findingIds.length > 0).length;
  const selectedIndex = Math.max(0, frames.findIndex((frame) => frame.id === state.reviewGalleryFrame));
  const current = frames[selectedIndex] ?? frames[0];
  if (current) state.reviewGalleryFrame = current.id;
  const scales = [1, 0.86, 0.74, 0.64];
  const dots = coverflowDotIndices(frames.length, selectedIndex);
  return `<div class="review-toolbar">
    <div class="review-filters" role="group" aria-label="画面类型">${[
      ["priority", "重点审核"], ["issues", "有问题"], ["all", "全部"], ["semantic-component", "视觉组件"], ["authored-screen", "录屏"], ["authored-image", "图片"], ["animation", "动画"], ["text-annotation", "文字标注"], ["title-continuity", "总结标题"], ["speaker-only", "纯口播"],
    ].map(([value, label]) => `<button type="button" class="review-filter ${state.reviewFilter === value ? "active" : ""}" data-review-filter="${value}">${label}</button>`).join("")}</div>
  </div>
  ${state.reviewFilter === "priority" ? `<p class="review-priority-note">${findingCount ? `优先展示 ${findingCount} 张有问题画面。` : "自动挑选需要确认的关键画面。"}完整证据仍可切换“全部”查看。</p>` : ""}
  <div class="review-gallery-count"><span>当前分组 ${frames.length} 张 · 全部 ${review.frames.length} 张</span><small>${current ? `${selectedIndex + 1} / ${frames.length}` : "0 / 0"}</small></div>
  ${current ? `<div class="review-coverflow-shell">
    <div class="review-coverflow-stage" data-review-coverflow-stage tabindex="0" role="group" aria-label="审核画廊：拖动、点击或使用左右方向键切换">
      ${frames.map((frame, index) => {
        const offset = coverflowOffset(index, selectedIndex, frames.length);
        const distance = Math.abs(offset);
        const focused = offset === 0;
        const hidden = distance > 3;
        const scale = scales[distance] ?? 0.58;
        const offsetClass = offset < 0 ? `offset-n${distance}` : offset > 0 ? `offset-p${distance}` : "offset-0";
        return `<button type="button" class="review-coverflow-card ${offsetClass} distance-${distance} ${focused ? "is-focused" : ""} ${frame.findingIds.length ? "has-finding" : ""}" data-review-coverflow-index="${index}" data-review-frame-id="${escapeHtml(frame.id)}" aria-label="${escapeHtml(frame.categoryLabel)} ${escapeHtml(frame.phaseLabel)}${focused ? "，当前画面，点击放大" : "，点击切换"}" aria-hidden="${hidden}" tabindex="${focused ? 0 : -1}" style="--coverflow-y:${distance * 10}px;--coverflow-rotate:${offset * -14}deg;--coverflow-scale:${scale};--coverflow-z:${frames.length - distance};--breath-duration:${7 + (index % 7) * 0.55}s;--breath-delay:${-(index % 7) * 0.62}s;">
          <span class="review-coverflow-visual">
            <img loading="${focused ? "eager" : "lazy"}" src="${escapeHtml(frame.url)}" alt="${escapeHtml(frame.categoryLabel)} ${escapeHtml(frame.phaseLabel)}"/>
            <span class="review-coverflow-shade" aria-hidden="true"></span>
            ${frame.findingIds.length ? `<b class="review-coverflow-finding">${frame.findingIds.length} 个问题</b>` : ""}
            <span class="review-coverflow-caption"><strong>${escapeHtml(frame.categoryLabel)}</strong><small>${formatReviewTime(frame.timeSeconds)} · ${escapeHtml(frame.phaseLabel)}</small></span>
          </span>
        </button>`;
      }).join("")}
    </div>
    <div class="review-coverflow-dots" role="group" aria-label="画面位置">
      ${dots.map((index) => {
        const frame = frames[index];
        return `<button type="button" class="${index === selectedIndex ? "active" : ""}" data-review-coverflow-dot="${index}" aria-label="切换到 ${escapeHtml(frame.categoryLabel)}" title="${escapeHtml(frame.categoryLabel)}"></button>`;
      }).join("")}
    </div>
    <p class="review-coverflow-hint">拖动、点击侧图，或使用左右方向键</p>
  </div>` : `<div class="review-empty"><b>当前分组没有画面</b><p>切换其他画面类型后再查看。</p></div>`}`;
};
const reviewDecisionPanel = (review) => {
  if (review.approval.approved)
    return `<div class="panel approval-success"><h3>制作 Agent 自检已通过</h3><p>当前证据包已锁定，批准时间：${escapeHtml(review.approval.approvedAt ?? "已记录")}。这里仅供查看审计证据，不是用户必经审批点。</p><div class="actions"><button type="button" class="primary" id="open-delivery">审核最终成片</button></div></div>`;
  return `<div class="panel static-approval-panel"><div class="eyebrow">AGENT SELF REVIEW</div><h3>制作 Agent 正在自检</h3><p>${review.evidenceValid ? "审核画廊、动画节奏、视觉 QA 和回归证据会在内部自动核对。" : escapeHtml(review.staleReason ?? "审核证据已变化，Agent 会重新生成。")}</p></div>`;
};
const staticReviewView = (project, review) => {
  if (!review?.available) return `<div class="panel"><h2>静态审核资料尚未生成</h2><p class="muted">返回视频制作，完成字幕、画面节奏和显示完整性检查后，这里会自动出现审核画廊。</p><button type="button" class="primary" id="back-to-video-workflow">返回视频制作</button></div>`;
  return `<section class="static-review">
    ${!review.evidenceValid ? `<div class="review-alert"><strong>历史审核资料，不代表本次运行</strong><span>${escapeHtml(review.staleReason)}</span></div>` : ""}
    <div class="panel review-header"><div><div class="eyebrow">STATIC-FIRST REVIEW</div><h2>静态审核画廊</h2></div><div class="review-header-actions"><button type="button" class="workflow-refresh-icon" id="review-info-open" aria-label="查看审核信息" title="审核信息"><img src="/assets/icons/info.svg" alt=""/></button><span class="status-pill">${review.approval.approved ? "已批准" : review.evidenceValid ? "等待审核" : "证据已过期"}</span></div></div>
    ${review.artifacts.reviewVideo ? `<div class="panel recut-player"><h3>已有连续审核视频</h3><video controls preload="metadata" src="${escapeHtml(review.artifacts.reviewVideo)}"></video></div>` : ""}
    ${review.artifacts.visualPacingReview ? `<div class="panel recut-player"><h3>连续 720p 画面节奏审核</h3><video controls preload="metadata" src="${escapeHtml(review.artifacts.visualPacingReview)}"></video><p class="muted">请完整播放，检查组件是否跟随口播出现、逐项推进，并在讲完后自然退出。</p></div>` : ""}
    ${review.artifacts.motionRiskReview ? `<div class="panel recut-player"><h3>动画风险片段 · 540p</h3><video controls preload="metadata" src="${escapeHtml(review.artifacts.motionRiskReview)}"></video><p class="muted">这里只包含需要连续观看的动画段落。请检查进入、逐项推进和退出节奏；其他静态组件以审核帧为准。</p></div>` : review.summary.motionReviewMode === "conditional-excerpts" && review.summary.motionRiskReviewRequired === false ? `<div class="panel"><h3>本次无需动态片段</h3><p class="muted">当前没有需要连续判断的动画，静态风险帧审核通过后即可批准进入成片。</p></div>` : ""}
    ${review.artifacts.mediaTransitionEntry || review.artifacts.mediaTransitionExit ? `<div class="panel"><div class="review-section-head"><div><h3>录屏与图片转场</h3></div></div><div class="field-row">${review.artifacts.mediaTransitionEntry ? `<div class="recut-player"><h4>进入画面</h4><video controls preload="metadata" src="${escapeHtml(review.artifacts.mediaTransitionEntry)}"></video></div>` : ""}${review.artifacts.mediaTransitionExit ? `<div class="recut-player"><h4>退出画面</h4><video controls preload="metadata" src="${escapeHtml(review.artifacts.mediaTransitionExit)}"></video></div>` : ""}</div></div>` : ""}
    <div class="panel gallery-panel"><div class="review-section-head"><div><h3>逐帧审核</h3></div><div class="review-contact-actions">${review.artifacts.contactSheet ? `<a class="secondary review-contact-link" href="${escapeHtml(review.artifacts.contactSheet)}" target="_blank" rel="noopener">查看总览大图</a>` : ""}${review.artifacts.titleContactSheet ? `<a class="secondary review-contact-link" href="${escapeHtml(review.artifacts.titleContactSheet)}" target="_blank" rel="noopener">查看标题连续性</a>` : ""}</div></div><div id="review-gallery-content">${galleryMarkup(review)}</div></div>
    ${review.notes.length ? `<div class="panel"><h3>已记录意见 · ${review.notes.length}</h3><div class="review-note-list">${review.notes.map((note) => `<article><span>${formatDateTime(note.createdAt)}</span><p>${escapeHtml(note.text)}</p></article>`).join("")}</div></div>` : ""}
    ${reviewDecisionPanel(review)}
    <details class="technical-details"><summary>查看审核版本标识</summary><code>${escapeHtml(review.approvalBindingSha256)}</code></details>
  </section>`;
};

const formatBytes = (bytes) => {
  const value = Number(bytes ?? 0);
  if (!value) return "0 MB";
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(2)} GB`;
  return `${(value / 1024 ** 2).toFixed(1)} MB`;
};
const formatElapsed = (milliseconds) => {
  const seconds = Math.max(0, Math.floor(Number(milliseconds ?? 0) / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${minutes} 分 ${String(seconds % 60).padStart(2, "0")} 秒`;
};
const deliveryStatusLabels = {
  "waiting-approval": "等待静态审核",
  ready: "可以开始渲染",
  rendering: "正在渲染",
  validating: "正在技术验收",
  failed: "需要处理",
  conflict: "状态与文件冲突",
  "awaiting-acceptance": "等待最终确认",
  returned: "已退回修改",
  delivered: "已完成交付",
};
const deliveryJob = (projectId) =>
  state.jobs.filter((item) => item.projectId === projectId && item.kind === "video-workflow" && item.action === "delivery").at(-1);
const deliveryProgressView = (project, delivery) => {
  const task = deliveryJob(project.project.id);
  const percent = Math.max(0, Math.min(100, Number(task?.progress?.percent ?? (delivery.status === "validating" ? 88 : 8))));
  return `<div class="panel delivery-progress-panel" role="status" aria-live="polite">
    <div class="delivery-progress-head"><div><span class="job-spinner"></span><div><h3>${delivery.status === "validating" ? "正在验收最终成片" : "正在渲染最终成片"}</h3><p>${escapeHtml(task?.progress?.message ?? "已从批准快照开始处理")}</p></div></div><b>${percent}%</b></div>
    <div class="progress-track" aria-label="最终成片制作进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><span style="width:${percent}%"></span></div>
    <div class="delivery-live-metrics"><div><span>总体进度</span><b>${percent}%</b></div><div><span>预计剩余</span><b>${escapeHtml(estimatedRemainingLabel(task, percent))}</b></div><div><span>当前状态</span><b>${delivery.status === "validating" ? "正在验收" : "正在生成成片"}</b></div></div>
    <div class="actions"><button type="button" class="secondary" id="cancel-delivery" data-job-id="${escapeHtml(task?.id ?? "")}">取消任务</button></div>
    <p class="hint">可以关闭页面或切换项目。任务状态保存在本机，再次打开时会继续显示。</p>
  </div>`;
};
const deliveryValidationView = (delivery) => {
  const validation = delivery.validation;
  if (!validation) return "";
  const media = validation.media ?? {};
  const expected = validation.expected ?? {};
  return `<div class="panel delivery-validation-panel"><div class="review-section-head"><div><h3>成片检查</h3><p>发布所需的关键信息已经确认。</p></div><span class="status-pill">${validation.status === "passed" ? "已通过" : "需要处理"}</span></div>
    <div class="delivery-validation-grid">
      <div><span>分辨率</span><b>${media.width ?? "-"} × ${media.height ?? "-"}</b></div>
      <div><span>帧率</span><b>${media.fps ?? "-"} fps</b></div>
      <div><span>文件大小</span><b>${formatBytes(validation.output?.bytes)}</b></div>
    </div>
    <details class="technical-details"><summary>查看技术验收详情</summary>
      <div class="delivery-technical-summary">
        <p><span>视频编码</span><b>${escapeHtml(media.videoCodec ?? "未知")}</b></p>
        <p><span>音频</span><b>${media.hasAudio ? escapeHtml(media.audioCodec ?? "包含音频") : "没有音频"}</b></p>
        <p><span>成片时长</span><b>${Number(media.durationSeconds ?? 0).toFixed(2)} 秒（预期 ${Number(expected.durationSeconds ?? 0).toFixed(2)} 秒）</b></p>
        <p><span>完整解码</span><b>${validation.decode?.status === "passed" ? "通过" : "失败"}</b></p>
      </div>
      ${validation.findings?.length ? `<div class="delivery-findings">${validation.findings.map((item) => `<p><strong>${escapeHtml(item.rule)}</strong><span>${escapeHtml(item.actual ?? "未通过")}</span></p>`).join("")}</div>` : ""}
      <code>${escapeHtml(validation.output?.sha256 ?? "")}</code>
    </details>
  </div>`;
};
const deliveryActivityView = (delivery) => delivery.progress.activity?.length
  ? `<div class="panel"><h3>最近处理记录</h3><div class="delivery-activity">${delivery.progress.activity.map((item) => `<div><span></span><p><b>${escapeHtml(item.label)}</b><small>${escapeHtml(item.message)} · ${formatDateTime(item.at)}</small></p></div>`).join("")}</div></div>`
  : "";
const deliveryDecisionView = (delivery) => {
  if (delivery.status === "delivered") return `<div class="panel delivery-complete"><div class="eyebrow">DELIVERY COMPLETE</div><h2>项目已经完成交付</h2><p>${delivery.summary ? `最终成片 ${formatBytes(delivery.summary.finalVideo?.bytes)}，已经通过检查并完成登记。` : "最终成片已经通过检查并完成登记。"}</p>${delivery.decision?.note ? `<p class="decision-record">交付备注：${escapeHtml(delivery.decision.note)}</p>` : ""}</div>`;
  if (delivery.status === "returned") return `<div class="panel review-stale"><h3>当前成片已退回修改</h3><p>${escapeHtml(delivery.decision?.reason ?? "已记录返修要求")}</p><p>本分支会保留成片、验收和退回记录。结构化返修将在下一阶段接入。</p></div>`;
  if (delivery.status !== "awaiting-acceptance") return "";
  return `<div class="panel final-acceptance-panel"><div class="eyebrow">FINAL ACCEPTANCE</div><h3>最终成片确认</h3><p>请完整播放成片，并结合上方技术验收结果做最终决定。</p>
    <label>交付备注（可选）<textarea id="delivery-acceptance-note" maxlength="2000" placeholder="例如：确认作为本期最终发布版本。"></textarea></label>
    <label class="confirmation-row"><input type="checkbox" id="delivery-accept-confirm"/><span>我已播放并检查最终成片，确认当前文件可以完成交付</span></label>
    <label>如果退回，请填写具体原因<textarea id="delivery-return-reason" maxlength="2000" placeholder="例如：第 1 分 20 秒的录屏停留时间过短，需要返修后重新生成。"></textarea></label>
    <div class="actions"><button type="button" class="secondary" id="return-delivery">退回修改</button><button type="button" class="primary" id="accept-delivery">通过并完成交付</button></div>
  </div>`;
};
const coverIconPreview = (icon) =>
  icon.category === "brand"
    ? `<svg viewBox="0 0 24 24" role="img" aria-label="${escapeHtml(icon.label)}" style="background:${escapeHtml(icon.tileBackground ?? "#f0f4f2")}"><path d="${escapeHtml(icon.svgPath)}" fill="#${escapeHtml(icon.hex)}"></path></svg>`
    : `<svg viewBox="0 0 24 24" aria-hidden="true"><use href="/local-assets/icons/system/sprite.svg#${escapeHtml(icon.id.replace("system.", ""))}"></use></svg>`;
const coverIconPickerView = (cover) => {
  const icons = cover.catalog.icons ?? [];
  const selectedIds = state.coverIconIds;
  const selected = selectedIds.map((iconId) => icons.find((item) => item.id === iconId)).filter(Boolean);
  const groups = [
    { id: "brand", label: "公司与平台" },
    { id: "system", label: "功能图标" },
  ];
  return `<section class="cover-icon-picker">
    <div class="cover-icon-picker-head"><h4>封面主题图标</h4><span>已选择 ${selected.length}/4 个</span></div>
    <div class="cover-icon-select">
      <div class="cover-icon-selected-row">
        <div class="cover-icon-selected-items">
          ${selected.length ? selected.map((icon) => `<div class="cover-icon-selected-chip">${coverIconPreview(icon)}<span>${escapeHtml(icon.label)}</span><button type="button" data-remove-cover-icon="${escapeHtml(icon.id)}" aria-label="移除 ${escapeHtml(icon.label)}">×</button></div>`).join("") : `<span class="cover-icon-placeholder">点击右侧按钮，从图标库中选择一个或多个图标</span>`}
        </div>
        <button type="button" class="cover-icon-toggle" id="cover-icon-toggle" aria-expanded="${state.coverIconPickerOpen}">${state.coverIconPickerOpen ? "收起图标库" : "选择图标"}</button>
      </div>
      <div class="cover-icon-dropdown" id="cover-icon-dropdown" ${state.coverIconPickerOpen ? "" : "hidden"}>
        <div class="cover-icon-dropdown-head"><small>最多选择 4 个</small></div>
        ${groups.map((group) => {
          const groupIcons = icons.filter((icon) => icon.category === group.id);
          return `<section class="cover-icon-category-group"><div class="cover-icon-group-head"><h5>${group.label}</h5><span>${groupIcons.length} 个</span></div><div class="cover-icon-grid">${groupIcons.map((icon) => `<button type="button" class="cover-icon-choice ${selectedIds.includes(icon.id) ? "active" : ""}" data-add-cover-icon="${escapeHtml(icon.id)}" ${selectedIds.includes(icon.id) ? "disabled" : ""}>${coverIconPreview(icon)}<span>${escapeHtml(icon.label)}</span>${selectedIds.includes(icon.id) ? "<small>已选</small>" : ""}</button>`).join("")}</div></section>`;
        }).join("")}
      </div>
    </div>
  </section>`;
};
const coverStudioView = (project, cover) => {
  if (!cover) return `<div class="panel job-banner-error"><h3>封面工作台暂不可用</h3><p>请刷新 Studio 后重试。</p></div>`;
  const selection = cover.selection;
  const background = cover.catalog.backgrounds.find((item) => item.id === selection.backgroundId) ?? cover.catalog.backgrounds[0];
  const cache = encodeURIComponent(cover.generatedAt ?? "draft");
  const landscape = cover.outputs.landscape
    ? `<img src="${escapeHtml(cover.outputs.landscape.url)}?v=${cache}" alt="横屏视频抖音封面预览"/>`
    : `<div class="cover-empty-preview"><b>4:3</b><span>生成横版抖音封面</span></div>`;
  const portrait = cover.outputs.portrait
    ? `<img src="${escapeHtml(cover.outputs.portrait.url)}?v=${cache}" alt="竖屏视频抖音封面预览"/>`
    : `<div class="cover-empty-preview"><b>3:4</b><span>生成竖屏视频的抖音封面</span></div>`;
  const landscapeDownload = cover.outputs.landscape
    ? `<a class="cover-download" href="/api/projects/${encodeURIComponent(project.project.id)}/cover/download/landscape">下载横屏视频构图 PNG</a>`
    : "";
  const portraitDownload = cover.outputs.portrait
    ? `<a class="cover-download" href="/api/projects/${encodeURIComponent(project.project.id)}/cover/download/portrait">下载竖屏视频构图 PNG</a>`
    : "";
  return `<div class="panel cover-studio-panel">
    <div class="review-section-head"><div><div class="eyebrow">COVER STUDIO</div><h3>视频封面</h3></div><span class="status-pill">${cover.status === "generated" ? "已生成" : "待生成"}</span></div>
    <p class="cover-studio-intro">从三套已入库背景中选一套，再导入你自己的透明人物抠图，由本地 Remotion 生成 4:3 横版和 3:4 竖版封面。人物素材只复制到当前本地项目，不会提交到代码仓库，也不会调用 Agent 或生图模型。</p>
    <section class="cover-portrait-setup">
      <div class="cover-portrait-guide"><h4>1. 导入自己的人物抠图</h4><p>请先准备透明背景的 PNG 或 WebP；Studio 只负责本地排版，不会替你上传或生成人像。</p></div>
      <label class="cover-portrait-path">抠图路径<input id="cover-portrait-path" placeholder="/Users/you/Pictures/portrait-cutout.png"/></label>
      <div class="cover-crop-controls">
        <label>水平位置 <input id="cover-crop-x" type="range" min="0" max="100" step="1" value="${Number(selection.portraitCrop?.x ?? 64)}"/></label>
        <label>垂直位置 <input id="cover-crop-y" type="range" min="0" max="100" step="1" value="${Number(selection.portraitCrop?.y ?? 42)}"/></label>
        <label>人物缩放 <input id="cover-crop-zoom" type="range" min="1" max="2.5" step="0.05" value="${Number(selection.portraitCrop?.zoom ?? 1)}"/></label>
      </div>
      <div class="actions"><button type="button" class="secondary" id="save-cover-portrait">${cover.portraitConfigured ? "更新照片或裁剪" : "导入照片并保存裁剪"}</button></div>
    </section>
    <div class="cover-control-grid">
      <label>封面模板<select id="cover-template">${cover.catalog.templates.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === selection.templateId ? "selected" : ""}>${escapeHtml(item.label)}</option>`).join("")}</select></label>
      <label>背景主题<select id="cover-background">${cover.catalog.backgrounds.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === selection.backgroundId ? "selected" : ""}>${escapeHtml(item.label)}</option>`).join("")}</select></label>
    </div>
    <div class="cover-source-preview">
      <div><span>人物抠图</span>${cover.portraitConfigured ? `<img id="cover-person-thumb" src="/api/projects/${encodeURIComponent(project.project.id)}/cover/catalog-asset/person/user-portrait?v=${cache}" alt="用户导入的透明人物抠图"/>` : `<div class="cover-empty-preview"><b>待导入</b><span>使用你自己的透明抠图</span></div>`}</div>
      <div><span>背景模板</span><img src="/local-assets/${escapeHtml(background.landscape)}" alt="${escapeHtml(background.label)} 背景预览"/></div>
    </div>
    ${coverIconPickerView(cover)}
    <div class="cover-copy-grid">
      <label>标题第一行<input id="cover-title-1" maxlength="12" value="${escapeHtml(selection.titleLines[0] ?? "")}"/></label>
      <label>标题第二行<input id="cover-title-2" maxlength="12" value="${escapeHtml(selection.titleLines[1] ?? "")}"/></label>
      <label>标题第三行（可选）<input id="cover-title-3" maxlength="12" value="${escapeHtml(selection.titleLines[2] ?? "")}"/></label>
      <label>创作者或频道名（可选）<input id="cover-brand-name" maxlength="20" value="${escapeHtml(selection.brandName ?? "")}" placeholder="留空则不显示品牌"/></label>
      <label>频道标签<input id="cover-badge" maxlength="16" value="${escapeHtml(selection.badge ?? "CREATOR VIDEO")}"/></label>
      <label>英文副标<input id="cover-kicker" maxlength="24" value="${escapeHtml(selection.kicker ?? "LOCAL CREATOR VIDEO")}"/></label>
    </div>
    <div class="actions"><button type="button" class="primary" id="generate-cover" ${cover.portraitConfigured ? "" : "disabled"}>${cover.portraitConfigured ? "生成 4:3 横版与 3:4 竖版封面" : "请先导入自己的照片"}</button></div>
    <div class="cover-output-grid"><figure class="landscape">${landscape}<figcaption><span>4:3 · 横版</span>${landscapeDownload}</figcaption></figure><figure class="portrait">${portrait}<figcaption><span>3:4 · 竖版</span>${portraitDownload}</figcaption></figure></div>
    ${cover.generatedAt ? `<p class="hint">最后生成：${formatDateTime(cover.generatedAt)}。每次重新生成会覆盖当前封面预览，不影响成片。</p>` : ""}
  </div>`;
};
const deliveryView = (project, delivery) => {
  if (!delivery?.approval?.approved) return `<div class="panel"><h2>等待静态审核批准</h2><p class="muted">只有当前静态审核证据明确通过后，才能生成最终成片。</p><button type="button" class="secondary" id="back-to-static-review">返回静态审核</button></div>`;
  const canStart = ["ready", "failed"].includes(delivery.status) && delivery.canStart;
  return `<section class="delivery-workspace">
    <div class="panel review-header"><div><div class="eyebrow">FINAL DELIVERY</div><h2>成片与交付</h2></div><span class="status-pill">${escapeHtml(deliveryStatusLabels[delivery.status] ?? delivery.status)}</span></div>
    ${delivery.status === "rendering" || delivery.status === "validating" ? deliveryProgressView(project, delivery) : ""}
    ${delivery.status === "failed" ? '<div class="panel creator-failure"><h3>成片尚未完成</h3><p>制作 Agent 已保留通过审核的版本和有效渲染分段，将从最近断点继续。</p></div>' : ""}
    ${delivery.status === "conflict" ? `<div class="panel job-banner-error creator-failure"><h3>成片状态需要确认</h3><p>本地文件与工作流记录不一致，Studio 不会覆盖现有文件，等待制作 Agent 校验。</p></div>` : ""}
    ${canStart ? deliveryStartView(delivery) : ""}
    ${delivery.video ? `<div class="panel delivery-player"><h3>最终成片</h3><video id="delivery-video" controls preload="metadata" src="${escapeHtml(delivery.video.url)}"></video><div class="actions"><button type="button" class="secondary" id="reveal-delivery">在 Finder 中显示成片</button><button type="button" class="secondary" id="reveal-delivery-workspace">打开产物目录</button></div></div>` : ""}
    ${deliveryValidationView(delivery)}
    ${deliveryDecisionView(delivery)}
  </section>`;
};

const deliveryStartView = (delivery) => {
  const selected = state.deliveryProfileDraft ?? delivery.export?.selectedProfile ?? { resolution:"source", frameRate:"source" };
  const readiness = latestWorkflowReadiness(state.selected, "delivery-acceptance", selected);
  const blocked = readiness?.readinessStatus === "blocked";
  const profileLabel = `${selected.resolution === "source" ? "跟随原片" : String(selected.resolution).toUpperCase()} / ${selected.frameRate === "source" ? "跟随原片帧率" : `${selected.frameRate} fps`}`;
  const readinessView = !readiness
    ? '<div class="delivery-readiness"><p>开始前先快速确认成片规格和可用空间。</p><button type="button" class="primary" id="delivery-readiness-check">检查并继续</button></div>'
    : `<div class="delivery-readiness ${escapeHtml(readiness.readinessStatus)}">${blocked ? `<p>${escapeHtml(readiness.issues?.[0]?.message ?? "当前规格暂时不能开始渲染。")} 制作 Agent 会检查可恢复范围。</p>` : `<p class="readiness-clear">当前规格可以安全生成成片。</p><label class="confirmation-row"><input type="checkbox" id="delivery-start-confirm"/><span>确认生成 ${escapeHtml(profileLabel)} 成片</span></label><div class="actions"><button type="button" class="primary" id="start-delivery" data-readiness-sha="${escapeHtml(readiness.readinessSha256)}">开始渲染</button></div>`}</div>`;
  return `<div class="panel delivery-start-panel"><h3>${delivery.status === "failed" ? "从已保存进度继续" : "开始最终成片渲染"}</h3><p>只运行最终渲染和技术验收，不会重新调用 Agent、翻译或语义理解。高于原片的规格会自动回退，避免无意义放大或补帧。</p>
    <div class="delivery-profile-grid"><label>清晰度<select id="delivery-resolution"><option value="source" ${selected.resolution === "source" ? "selected" : ""}>跟随原片</option><option value="1080p" ${selected.resolution === "1080p" ? "selected" : ""}>1080p</option><option value="2k" ${selected.resolution === "2k" ? "selected" : ""}>2K</option><option value="4k" ${selected.resolution === "4k" ? "selected" : ""}>4K</option></select></label><label>帧率<select id="delivery-frame-rate"><option value="source" ${selected.frameRate === "source" ? "selected" : ""}>跟随原片</option><option value="30" ${selected.frameRate === 30 ? "selected" : ""}>30 fps</option><option value="60" ${selected.frameRate === 60 ? "selected" : ""}>60 fps</option></select></label></div>
    <div id="delivery-estimate" class="delivery-estimate"></div>
    ${readinessView}</div>`;
};
const updateDeliveryEstimate = () => {
  const target = $("#delivery-estimate");
  if (!target) return;
  const resolution = $("#delivery-resolution")?.value ?? "source";
  const frameRate = $("#delivery-frame-rate")?.value ?? "source";
  const match = state.delivery?.export?.estimates?.find((item) => item.key === `${resolution}-${frameRate}`);
  if (!match) { target.textContent = "读取原片信息后显示预估时间和空间"; return; }
  const value = match.estimate;
  target.innerHTML = `<b>实际输出 ${value.effective.width}×${value.effective.height} · ${value.effective.fps} fps</b><br>预计 ${value.renderMinutes.low}–${value.renderMinutes.high} 分钟 · 成片约 ${formatBytes(value.finalBytes.low)}–${formatBytes(value.finalBytes.high)} · 中间文件约 ${formatBytes(value.intermediateBytes)}${value.effective.warnings.length ? `<br><span>${escapeHtml(value.effective.warnings.join(" "))}</span>` : ""}`;
};
const artifactStatus = (artifact) => artifact.available
  ? `<span class="current-badge">当前有效</span>`
  : `<span class="muted">尚未生成</span>`;
const operationsContentView = (operations) => {
  const data = operations.inspectors;
  const provider = data.semantic.provider ?? {};
  return `<div class="operations-grid">
    <article class="operations-card wide"><h3>证据来源</h3><p class="card-meta">Studio 只读取项目目录里的现有产物，不重新运行 Agent。</p><div class="artifact-table">${data.artifacts.map((item) => `<div class="artifact-row"><b>${escapeHtml(item.kind)}</b><code>${escapeHtml(item.path ?? "—")}</code>${artifactStatus(item)}</div>`).join("")}</div></article>
    <article class="operations-card"><h3>人物口播转写</h3><p class="card-meta">${data.transcript.wordCount} 个词 · 中文事实来源</p><pre>${escapeHtml(data.transcript.text || "尚未生成转写")}${data.transcript.truncated ? "\n…内容过长，界面已截断" : ""}</pre></article>
    <article class="operations-card"><h3>理解层来源</h3><p class="card-meta">执行器、底层模型和运行版本分别记录</p><div class="about-list"><div class="about-row"><span>执行器</span><strong>${escapeHtml(provider.executor ?? "未知")}</strong></div><div class="about-row"><span>底层模型</span><strong>${escapeHtml(provider.model ?? "未登记")}</strong></div><div class="about-row"><span>CLI 版本</span><strong>${escapeHtml(provider.cliVersion ?? "未知")}</strong></div><div class="about-row"><span>输出哈希</span><code>${escapeHtml(provider.outputHash ?? "—")}</code></div></div></article>
    <article class="operations-card wide"><h3>双语字幕</h3><p class="card-meta">中文语义字幕保留理解标点；显示字幕与英文翻译共享时间。</p><div class="evidence-list">${data.displayCaptions.slice(0,120).map((cue) => `<div class="evidence-row"><b>${cue.index + 1}<small>${Number(cue.start).toFixed(1)}s</small></b><span>${escapeHtml(cue.zh)}</span><span>${escapeHtml(cue.en ?? "未翻译")}</span></div>`).join("") || '<div class="evidence-row">尚未生成字幕</div>'}</div></article>
    <article class="operations-card wide"><h3>粗剪时间线</h3><p class="card-meta">成片口播约 ${Number(data.edl.totalDurationS ?? 0).toFixed(1)} 秒 · ${data.edl.ranges.length} 个保留区间</p><pre>${escapeHtml(JSON.stringify(data.edl.ranges.slice(0,80), null, 2))}</pre></article>
  </div>`;
};
const operationsVisualView = (operations) => {
  const data = operations.inspectors;
  return `<div class="operations-grid">
    <article class="operations-card wide"><h3>已物化视觉组件</h3><p class="card-meta">每一项都显示组件、布局、出现区间和最终参数。</p><div class="evidence-list">${data.visuals.map((cue) => `<div class="evidence-row"><b>#${cue.index + 1}<small>${Number(cue.start).toFixed(1)}–${Number(cue.end).toFixed(1)}s</small></b><span><strong>${escapeHtml(cue.title)}</strong><br><small>${escapeHtml(cue.componentId)} · ${escapeHtml(cue.layoutTemplateId)}</small></span><code>${escapeHtml(JSON.stringify(cue.props))}</code></div>`).join("") || '<div class="evidence-row">尚未生成视觉组件</div>'}</div></article>
    <article class="operations-card wide"><h3>视觉导演决策</h3><p class="card-meta">“跳过”不是错误；这里显示选择、压缩或跳过的具体原因。</p><div class="evidence-list">${data.direction.map((item) => `<div class="evidence-row"><b>${item.action === "show" ? "展示" : "跳过"}<small>${escapeHtml(item.importance)}</small></b><span>${escapeHtml(item.componentId ?? item.rhetoric ?? "纯口播")}</span><span>${escapeHtml((item.reasons ?? []).join("；"))}</span></div>`).join("") || '<div class="evidence-row">尚未生成导演计划</div>'}</div></article>
  </div>`;
};
const revisionFieldsView = (kind, operations) => {
  const captions = operations.inspectors.displayCaptions;
  const visuals = operations.inspectors.visuals;
  const visualComponentIds = state.metadata.componentIds ?? [];
  const layoutTemplateIds = state.metadata.layoutTemplateIds ?? [];
  const captionSelect = `<label>字幕条目<select id="revision-cue-index">${captions.map((cue) => `<option value="${cue.index}">${cue.index + 1} · ${escapeHtml(cue.zh.slice(0,30))}</option>`).join("")}</select></label>`;
  const visualSelect = `<label>视觉条目<select id="revision-cue-index">${visuals.map((cue) => `<option value="${cue.index}">${cue.index + 1} · ${escapeHtml(cue.title ?? cue.componentId)}</option>`).join("")}</select></label>`;
  if (kind === "translation") return `${captionSelect}<label>新的英文字幕<textarea id="revision-en" rows="3"></textarea></label>`;
  if (kind === "visual-copy") return `${visualSelect}<label>新标题<input id="revision-title"/></label><label>中文补充文字<input id="revision-subtitle"/></label><label>英文补充文字<input id="revision-subtitle-en"/></label>`;
  if (kind === "visual-timing") return `${visualSelect}<div class="field-row"><label>开始秒数<input id="revision-start" type="number" min="0" step="0.01"/></label><label>结束秒数<input id="revision-end" type="number" min="0" step="0.01"/></label></div>`;
  if (kind === "visual-component") return `${visualSelect}<label>组件<select id="revision-component-id">${visualComponentIds.map((id) => `<option value="${id}">${id}</option>`).join("")}</select></label><label>布局<select id="revision-layout-id"><option value="">保持不变</option>${layoutTemplateIds.map((id) => `<option value="${id}">${id}</option>`).join("")}</select></label><label>组件参数 JSON<textarea id="revision-props-json" rows="8" spellcheck="false">{}</textarea></label>`;
  if (kind === "edit-removal") return `<div class="field-row"><label>删除开始秒数<input id="revision-start" type="number" min="0" step="0.01"/></label><label>删除结束秒数<input id="revision-end" type="number" min="0" step="0.01"/></label></div><label>删除原因<input id="revision-removal-reason"/></label>`;
  if (kind === "caption-policy") return `<div class="field-row"><label>单条最多字数<input id="revision-max-characters" type="number" min="4"/></label><label>单条最长秒数<input id="revision-max-duration" type="number" min="0.5" step="0.1"/></label></div><label>显示标点<select id="revision-punctuation"><option value="">保持不变</option><option value="source">保留原始标点</option><option value="none">隐藏句读标点</option></select></label>`;
  return `<p class="muted">只记录本次驳回和原因，不修改文件，也不会自动重跑工作流。</p>`;
};
const revisionPreviewView = (preview) => {
  if (!preview) return `<div class="revision-preview"><h3>影响预览</h3><p class="muted">填写修改内容后先生成预览。系统会显示审批撤销、重新调用 Agent 和需要重做的阶段。</p></div>`;
  const impact = preview.impact;
  const calls = [impact.providerCalls.recutAgent ? "粗剪 Agent" : null, impact.providerCalls.translation ? "字幕翻译" : null, impact.providerCalls.semanticAgent ? "语义 Agent" : null].filter(Boolean);
  return `<div class="revision-preview"><h3>影响预览</h3><div class="revision-impact"><div><span>最早重做步骤</span><b>${escapeHtml(impact.earliestStage)}</b></div><div><span>Agent / API</span><b>${calls.length ? escapeHtml(calls.join("、")) : "不会重新调用"}</b></div><div><span>静态审核</span><b>${impact.outputs.staticReview ? "需要重新生成" : "保持现有证据"}</b></div></div><p><strong>将过期：</strong>${escapeHtml(impact.staleStages.join(" → "))}</p><details class="technical-details"><summary>查看 typed revision 请求</summary><pre>${escapeHtml(JSON.stringify(preview.request, null, 2))}</pre></details><label class="confirmation-row"><input type="checkbox" id="revision-apply-confirm"/><span>我确认撤销旧审批，并只重跑上面列出的受影响步骤</span></label><div class="actions"><button type="button" class="primary" id="apply-revision">应用返修并继续</button></div></div>`;
};
const operationsRevisionView = (operations) => {
  const kind = state.revisionKind ?? "translation";
  return `<div class="revision-builder"><form class="revision-form" id="revision-form"><h3>创建返修请求</h3><label>返修类型<select id="revision-kind">${Object.entries(revisionKindLabels).map(([id,label]) => `<option value="${id}" ${id === kind ? "selected" : ""}>${label}</option>`).join("")}</select></label><label>具体原因<textarea id="revision-reason" rows="3" maxlength="1000" placeholder="说明哪里不对，以及期望改成什么"></textarea></label><div class="revision-fields">${revisionFieldsView(kind, operations)}</div><button type="submit" class="secondary">预览影响</button></form>${revisionPreviewView(state.revisionPreview)}</div><div class="operations-card wide" style="margin-top:14px"><h3>返修审计记录</h3><div class="revision-history">${operations.revisions.map((item) => `<div class="revision-row"><b>${escapeHtml(item.revisionId)}</b><span>${escapeHtml(item.reason)}<br><small>${escapeHtml((item.changed ?? []).join("、"))}</small></span><span>${escapeHtml(item.earliestStaleStage)}<br><small>${formatDateTime(item.appliedAt)}</small></span></div>`).join("") || '<div class="revision-row">尚无返修记录</div>'}</div></div>`;
};
const operationsRuntimeView = (operations) => {
  const latestJob = operations.operations.jobs[0];
  const canResume = latestJob && ["failed", "interrupted", "cancelled"].includes(latestJob.status);
  const readinessJob = operations.operations.jobs.find((job) => job.action === "readiness" && job.readiness);
  const readiness = readinessJob?.readiness;
  const readinessView = readiness
    ? `<article class="operations-card wide"><h3>下一审核门检查</h3><p class="card-meta">${readiness.readinessStatus === "blocked" ? "存在阻塞项" : readiness.readinessStatus === "up-to-date" ? "已经到达下一审核门" : "可以安全继续"} · 目标 ${escapeHtml(readiness.nextHumanGate)}</p><div class="about-list"><div class="about-row"><span>需要运行</span><strong>${readiness.plannedStages.length} 个阶段</strong></div><div class="about-row"><span>直接复用</span><strong>${readiness.reusedStages.length} 个阶段</strong></div><div class="about-row"><span>视频渲染</span><strong>${readiness.execution.videoRenderStages}</strong></div><div class="about-row"><span>Agent / 翻译</span><strong>${readiness.execution.agentCalls} / ${readiness.execution.translationCalls}</strong></div></div>${readiness.blockedStages.length ? `<p class="job-banner-error">阻塞阶段：${escapeHtml(readiness.blockedStages.join("、"))}</p>` : ""}${readiness.avoidedExpensiveStages.length ? `<p class="hint">本次可复用的高成本阶段：${escapeHtml(readiness.avoidedExpensiveStages.join("、"))}</p>` : ""}</article>`
    : "";
  const disk = operations.operations.disk;
  return `<div class="operations-grid">${readinessView}<article class="operations-card wide"><h3>任务历史</h3><p class="card-meta">刷新页面或重启 Studio 后仍可核对任务状态和最近技术记录。</p><div class="job-history">${operations.operations.jobs.map((job) => `<div class="job-row"><b>${escapeHtml(job.kind)}<small>${escapeHtml(job.action ?? "")}</small></b><span class="status-pill">${escapeHtml(job.status)}</span><span>${escapeHtml(job.progress?.message ?? job.error ?? "—")}</span><small>${job.startedAt ? formatDateTime(job.startedAt) : job.queuedAt ? `${formatDateTime(job.queuedAt)} 排队` : "—"}</small></div>`).join("") || '<div class="job-row">尚无任务历史</div>'}</div><div class="actions"><button type="button" class="secondary" id="operations-readiness">检查下一步是否可安全运行</button>${canResume ? '<button type="button" class="secondary" id="operations-retry">检查后从当前有效断点继续</button>' : ""}</div></article><article class="operations-card"><h3>项目磁盘占用</h3><p><strong>${formatBytes(disk.project.bytes)}</strong> · ${disk.project.files} 个文件</p><p class="muted">本地上限 ${formatBytes(disk.project.quotaBytes)} · ${disk.project.status === "over-quota" ? "已超过项目配额" : "配额内"}</p></article><article class="operations-card"><h3>安全清理</h3>${disk.cleanupPreview.map((item) => `<label class="cleanup-row"><span><input type="checkbox" data-cleanup-candidate="${escapeHtml(item.id)}"/><span><b>${escapeHtml(item.label)}</b><small>${escapeHtml(item.reason)}</small></span></span><strong>${formatBytes(item.bytes)}</strong></label>`).join("") || '<p class="muted">当前没有明确可重建的缓存。</p>'}<p class="hint">只允许删除上述可再生成目录，人物原片、登记素材、审批快照和最终成片始终受保护。</p>${disk.cleanupPreview.length ? `<label class="confirmation-row"><input type="checkbox" id="cleanup-confirm"/><span>我确认删除选中的可再生成缓存</span></label><div class="actions"><button type="button" class="secondary" id="operations-cleanup" data-plan-sha="${escapeHtml(disk.planSha256)}">执行安全清理</button></div>` : ""}</article></div>`;
};
const latestRecoveryDiagnosis = (projectId, recoverySha256) =>
  state.jobs
    .filter(
      (item) =>
        item.projectId === projectId &&
        item.kind === "recovery-diagnosis" &&
        item.status === "completed" &&
        item.result?.recoverySha256 === recoverySha256,
    )
    .at(-1)?.result;
const recoveryStatusLabel = (status) =>
  ({
    healthy: "状态正常",
    busy: "任务运行中",
    recoverable: "可以恢复",
    blocked: "需要先修复",
  })[status] ?? status;
const recoveryExecutionView = (readiness) => {
  if (!readiness)
    return '<article class="recovery-card"><h3>还没有最新安全检查</h3><p>先检查下一审核点。检查只读取状态，不调用 Agent、不翻译、也不渲染。</p></article>';
  const execution = readiness.execution ?? {};
  return `<article class="recovery-card">
    <div class="recovery-card-head"><div><h3>本次恢复范围</h3><p>${escapeHtml(readiness.nextHumanGate ?? readiness.targetStage)}</p></div><span class="status-pill">${escapeHtml(readinessStatusLabel(readiness.readinessStatus))}</span></div>
    <div class="recovery-metrics"><div><b>${readiness.plannedStages.length}</b><span>需要运行</span></div><div><b>${readiness.reusedStages.length}</b><span>直接复用</span></div><div><b>${Number(execution.agentCalls ?? 0) + Number(execution.translationCalls ?? 0)}</b><span>Agent / API</span></div><div><b>${Number(execution.videoRenderStages ?? 0) + Number(execution.staticRenderStages ?? 0)}</b><span>渲染阶段</span></div></div>
    ${readiness.avoidedExpensiveStages.length ? `<p class="recovery-preserved">避免重跑：${escapeHtml(readiness.avoidedExpensiveStages.join("、"))}</p>` : ""}
    ${readiness.issues.length ? `<div class="readiness-issues">${readiness.issues.map((issue) => `<div class="${escapeHtml(issue.severity)}"><b>${escapeHtml(issue.label)}</b><span>${escapeHtml(issue.message)}</span>${issue.remediation ? `<small>${escapeHtml(issue.remediation)}</small>` : ""}</div>`).join("")}</div>` : ""}
  </article>`;
};
const recoveryDiagnosisView = (projectId, recovery) => {
  const running = state.jobs
    .filter((item) => item.projectId === projectId && item.kind === "recovery-diagnosis")
    .findLast((item) => ["queued", "running"].includes(item.status));
  if (running)
    return `<article class="recovery-card diagnosis"><div class="job-banner-head"><div><span class="job-spinner"></span><h3>Agent 正在只读诊断</h3></div><span class="status-pill">${escapeHtml(running.status)}</span></div><p>${escapeHtml(running.progress?.message ?? "正在分析故障证据")}</p></article>`;
  const result = latestRecoveryDiagnosis(projectId, recovery.recoverySha256);
  if (!result)
    return `<article class="recovery-card diagnosis"><h3>Ask Agent</h3><p>把当前阶段、错误码、保留产物和最近技术记录交给本项目固定 Agent。Agent 只能诊断和建议，不能自行改文件或重启任务。</p><button type="button" class="secondary" id="recovery-ask-agent" ${recovery.actions.askAgent.enabled ? "" : "disabled"}>Ask Agent 诊断</button></article>`;
  const diagnosis = result.diagnosis;
  return `<article class="recovery-card diagnosis"><div class="recovery-card-head"><div><h3>Agent 诊断结果</h3><p>${escapeHtml(diagnosis.summary)}</p></div><span class="status-pill">${diagnosis.safeToResume ? "建议恢复" : "先处理原因"}</span></div><p><strong>判断：</strong>${escapeHtml(diagnosis.rootCause)}</p><p>${escapeHtml(diagnosis.userMessage)}</p>${diagnosis.evidence.length ? `<ul class="compact-list">${diagnosis.evidence.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}<details class="technical-details"><summary>查看技术说明</summary><pre>${escapeHtml(diagnosis.technicalNotes.join("\n"))}</pre></details></article>`;
};
const recoveryContentView = (recovery) => {
  const latest = recovery.latestJob;
  const readinessReady = recovery.readiness && recovery.readiness.readinessStatus !== "blocked";
  const canResume = recovery.actions.resume.enabled && readinessReady;
  return `<div class="recovery-layout">
    <section class="recovery-hero ${escapeHtml(recovery.status)}"><div><span class="status-pill">${escapeHtml(recoveryStatusLabel(recovery.status))}</span><h3>${escapeHtml(recovery.headline)}</h3><p>${escapeHtml(recovery.summary)}</p></div><div class="recovery-stage"><small>停止阶段</small><strong>${escapeHtml(workflowStageLabels[recovery.stage] ?? recovery.stage ?? "无")}</strong></div></section>
    <div class="recovery-grid">
      <article class="recovery-card"><h3>已经保留</h3><div class="recovery-metrics three"><div><b>${recovery.preserved.completedStages.length}</b><span>完成步骤</span></div><div><b>${recovery.preserved.approvedStages.length}</b><span>人工批准</span></div><div><b>${recovery.preserved.artifactCount}</b><span>有效产物</span></div></div><p class="recovery-preserved">恢复不会删除这些内容，也不会默认重跑已完成的 Agent、字幕或渲染阶段。</p></article>
      <article class="recovery-card"><h3>建议下一步</h3><p>${recovery.status === "recoverable" ? `从“${escapeHtml(workflowStageLabels[recovery.resume.stage] ?? recovery.resume.stage)}”继续，到下一个人工审核点停止。` : recovery.status === "blocked" ? escapeHtml(recovery.failure?.remediation ?? "先修复原因，再重新检查。") : escapeHtml(recovery.summary)}</p><div class="actions"><button type="button" class="secondary" id="recovery-recheck" ${recovery.actions.recheck.enabled ? "" : "disabled"}>重新安全检查</button></div></article>
    </div>
    ${recoveryExecutionView(recovery.readiness)}
    ${recoveryDiagnosisView(recovery.projectId, recovery)}
    ${latest?.technicalTail?.length ? `<details class="recovery-card technical-details"><summary>最近技术记录</summary><pre>${escapeHtml(latest.technicalTail.join("\n"))}</pre></details>` : ""}
    ${canResume ? `<section class="recovery-resume"><label class="confirmation-row"><input type="checkbox" id="recovery-resume-confirm"/><span>我已查看故障原因、保留产物和本次运行范围，确认从有效断点继续</span></label><button type="button" class="primary" id="recovery-resume" data-recovery-sha="${escapeHtml(recovery.recoverySha256)}" data-readiness-sha="${escapeHtml(recovery.readiness.readinessSha256)}">确认恢复工作流</button></section>` : recovery.status === "recoverable" ? '<p class="recovery-footnote">完成最新安全检查后，才会显示“确认恢复工作流”。</p>' : ""}
  </div>`;
};
const bindRecoveryActions = () => {
  $("#recovery-recheck")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    try {
      button.disabled = true;
      const task = await api(`/api/projects/${state.selected}/workflow`, { method:"POST", body:{ action:"readiness" } });
      state.jobs.push(task);
      toast("正在只读检查有效断点和下一审核点");
      renderRecovery();
      pollRecoveryJob(state.selected, task.id);
    } catch(error) { button.disabled = false; toast(error.message); }
  });
  $("#recovery-ask-agent")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    try {
      button.disabled = true;
      const task = await api(`/api/projects/${state.selected}/workflow/recovery/ask`, { method:"POST", body:{} });
      state.jobs.push(task);
      toast("已交给本项目固定 Agent 只读诊断");
      renderRecovery();
      pollRecoveryJob(state.selected, task.id);
    } catch(error) { button.disabled = false; toast(error.message); }
  });
  $("#recovery-resume")?.addEventListener("click", async (event) => {
    if (!$("#recovery-resume-confirm")?.checked) return toast("请先确认本次恢复范围");
    const button = event.currentTarget;
    try {
      button.disabled = true;
      const task = await api(`/api/projects/${state.selected}/workflow/recovery/resume`, {
        method:"POST",
        body:{
          confirmation:"human-recovery-resume",
          recoverySha256:button.dataset.recoverySha,
          readinessSha256:button.dataset.readinessSha,
        },
      });
      state.jobs.push(task);
      $("#recovery-dialog").close();
      toast("已从当前有效断点恢复，到下一人工审核点会自动停止");
      pollUntilDone(state.selected);
    } catch(error) { button.disabled = false; toast(error.message); }
  });
};
const renderRecovery = () => {
  const body = $("#recovery-body");
  if (!state.recovery) {
    body.innerHTML = '<p class="muted">正在校验任务状态和已保留产物…</p>';
    return;
  }
  body.innerHTML = recoveryContentView(state.recovery);
  bindRecoveryActions();
};
const openRecovery = async () => {
  if (!state.selected) return;
  state.recovery = null;
  $("#recovery-project-label").textContent = state.detail.project.project.title;
  $("#recovery-dialog").showModal();
  renderRecovery();
  try {
    state.recovery = await api(`/api/projects/${state.selected}/workflow/recovery`);
    renderRecovery();
  } catch(error) {
    $("#recovery-body").innerHTML = `<div class="job-banner job-banner-error"><h3>无法读取恢复状态</h3><p>${escapeHtml(error.message)}</p></div>`;
  }
};
const pollRecoveryJob = async (projectId, jobId) => {
  for (let count = 0; count < 1800; count++) {
    await new Promise((done) => setTimeout(done, 2000));
    state.jobs = await api("/api/jobs");
    const task = state.jobs.find((item) => item.id === jobId);
    if (state.selected === projectId && $("#recovery-dialog")?.open) renderRecovery();
    if (!task || !["queued", "running"].includes(task.status)) {
      await selectProject(projectId);
      if ($("#recovery-dialog")?.open) {
        state.recovery = await api(`/api/projects/${projectId}/workflow/recovery`).catch(() => state.recovery);
        renderRecovery();
      }
      toast(task?.status === "completed" ? "检查完成" : task?.error ?? "任务已停止");
      return;
    }
  }
};
const renderOperations = () => {
  document.querySelectorAll("[data-operations-tab]").forEach((button) => button.classList.toggle("active", button.dataset.operationsTab === state.operationsTab));
  const body = $("#operations-body");
  if (!state.operations) { body.innerHTML = '<p class="muted">正在读取项目证据…</p>'; return; }
  body.innerHTML = state.operationsTab === "content" ? operationsContentView(state.operations) : state.operationsTab === "visual" ? operationsVisualView(state.operations) : state.operationsTab === "revision" ? operationsRevisionView(state.operations) : operationsRuntimeView(state.operations);
  bindOperationsActions();
};
const openOperations = async () => {
  if (!state.selected) return;
  state.operations = null;
  state.revisionPreview = null;
  $("#operations-project-label").textContent = state.detail.project.project.title;
  $("#operations-dialog").showModal();
  renderOperations();
  try { state.operations = await api(`/api/projects/${state.selected}/workflow/operations`); renderOperations(); }
  catch (error) { $("#operations-body").innerHTML = `<div class="job-banner-error panel"><h3>无法读取项目证据</h3><p>${escapeHtml(error.message)}</p></div>`; }
};
const revisionDraftValues = () => ({ cueIndex:Number($("#revision-cue-index")?.value ?? 0), en:$("#revision-en")?.value.trim(), title:$("#revision-title")?.value.trim(), subtitle:$("#revision-subtitle")?.value.trim(), subtitleEn:$("#revision-subtitle-en")?.value.trim(), start:$("#revision-start")?.value, end:$("#revision-end")?.value, componentId:$("#revision-component-id")?.value, layoutTemplateId:$("#revision-layout-id")?.value, propsJson:$("#revision-props-json")?.value, removalReason:$("#revision-removal-reason")?.value.trim(), maximumCharacters:$("#revision-max-characters")?.value, maximumDurationSeconds:$("#revision-max-duration")?.value, displayPunctuation:$("#revision-punctuation")?.value });
const populateRevisionCueFields = () => {
  if (!state.operations) return;
  const kind = state.revisionKind ?? "translation";
  const cueIndex = Number($("#revision-cue-index")?.value ?? 0);
  const caption = state.operations.inspectors.displayCaptions.find((cue) => cue.index === cueIndex);
  const visual = state.operations.inspectors.visuals.find((cue) => cue.index === cueIndex);
  if (kind === "translation" && $("#revision-en")) $("#revision-en").value = caption?.en ?? "";
  if (kind === "visual-copy") {
    if ($("#revision-title")) $("#revision-title").value = visual?.title ?? "";
    if ($("#revision-subtitle")) $("#revision-subtitle").value = visual?.subtitle ?? "";
    if ($("#revision-subtitle-en")) $("#revision-subtitle-en").value = visual?.subtitleEn ?? "";
  }
  if (kind === "visual-timing") {
    if ($("#revision-start")) $("#revision-start").value = visual?.start ?? "";
    if ($("#revision-end")) $("#revision-end").value = visual?.end ?? "";
  }
  if (kind === "visual-component") {
    if ($("#revision-component-id") && visual?.componentId) $("#revision-component-id").value = visual.componentId;
    if ($("#revision-layout-id")) $("#revision-layout-id").value = visual?.layoutTemplateId ?? "";
    if ($("#revision-props-json")) $("#revision-props-json").value = JSON.stringify(visual?.props ?? {}, null, 2);
  }
};
const bindOperationsActions = () => {
  $("#revision-kind")?.addEventListener("change", (event) => { state.revisionKind = event.currentTarget.value; state.revisionPreview = null; renderOperations(); });
  $("#revision-cue-index")?.addEventListener("change", populateRevisionCueFields);
  populateRevisionCueFields();
  $("#revision-form")?.addEventListener("submit", async (event) => { event.preventDefault(); const reason = $("#revision-reason").value.trim(); if (!reason) return toast("请填写具体返修原因"); try { state.revisionPreview = await api(`/api/projects/${state.selected}/workflow/revisions/preview`, { method:"POST", body:{ reviewer:"Sean", reason, kind:state.revisionKind ?? "translation", values:revisionDraftValues() } }); renderOperations(); } catch(error){ toast(error.message); } });
  $("#apply-revision")?.addEventListener("click", async () => { if (!$("#revision-apply-confirm")?.checked) return toast("请确认返修影响后再应用"); try { const result = await api(`/api/projects/${state.selected}/workflow/revisions/apply`, { method:"POST", body:{ request:state.revisionPreview.request } }); if (result.task) state.jobs.push(result.task); toast(result.task ? "返修已应用，正在从受影响步骤继续" : "驳回记录已保存"); $("#operations-dialog").close(); state.operations = null; await selectProject(state.selected); if (result.task) pollUntilDone(state.selected); } catch(error){ toast(error.message); } });
  $("#operations-retry")?.addEventListener("click", async () => { try { const task = await api(`/api/projects/${state.selected}/workflow`, { method:"POST", body:{ action:"readiness" } }); state.jobs.push(task); toast("先重新检查有效断点与下一审核门"); $("#operations-dialog").close(); pollUntilDone(state.selected); } catch(error){ toast(error.message); } });
  $("#operations-readiness")?.addEventListener("click", async () => { try { const task = await api(`/api/projects/${state.selected}/workflow`, { method:"POST", body:{ action:"readiness" } }); state.jobs.push(task); toast("正在检查下一审核门，不会调用 Agent 或开始渲染"); $("#operations-dialog").close(); pollUntilDone(state.selected); } catch(error){ toast(error.message); } });
  $("#operations-cleanup")?.addEventListener("click", async (event) => {
    const candidateIds = [...document.querySelectorAll("[data-cleanup-candidate]:checked")].map((item) => item.dataset.cleanupCandidate);
    if (!candidateIds.length) return toast("请先选择需要清理的缓存");
    if (!$("#cleanup-confirm")?.checked) return toast("请确认只删除选中的可再生成缓存");
    try {
      const result = await api(`/api/projects/${state.selected}/workflow/cleanup`, { method:"POST", body:{ planSha256:event.currentTarget.dataset.planSha, candidateIds, confirmation:"delete-regenerable-cache", reviewer:"Sean" } });
      toast(`安全清理完成，释放 ${formatBytes(result.record.reclaimedBytes)}`);
      state.operations = await api(`/api/projects/${state.selected}/workflow/operations`);
      renderOperations();
    } catch(error){ toast(error.message); }
  });
};
const renderWorkspace = () => {
  if (!state.detail?.project || state.detail.project.project.id !== state.selected) return;
  const { project, narration } = state.detail;
  const currentStep = stepIndex(project.project.status);
  const viewedStep = state.viewStep ?? currentStep;
  if (state.workspaceMode === "cover") {
    $("#workspace-stage").textContent = "COVER STUDIO";
    $("#workspace-title").textContent = `${project.project.title} · 封面制作`;
    $("#project-context-toggle").hidden = false;
    const pinnedAgent = agentAsset(project.agent.id);
    $("#status-pill").textContent = statusLabels[project.project.status];
    $("#open-operations").hidden = true;
    $("#open-recovery").hidden = true;
    $("#steps").innerHTML = "";
    $("#inspector-body").innerHTML = projectContext(project);
    $("#workspace-body").innerHTML = `<section class="cover-workspace">${coverStudioView(project, state.cover)}</section>`;
    bindWorkspaceActions();
    return;
  }
  const presentation = taskPresentations[project.project.status] ?? taskPresentations.intake;
  $("#workspace-stage").textContent = presentation.stage;
  $("#workspace-title").textContent = project.project.title;
  $("#project-context-toggle").hidden = false;
  $("#status-pill").textContent = statusLabels[project.project.status];
  $("#open-operations").hidden = !project.video.manifest;
  $("#open-recovery").hidden = true;
  renderSteps(project.project.status, viewedStep);
  $("#inspector-body").innerHTML = projectContext(project);
  if (viewedStep === 0) $("#workspace-body").innerHTML = intakeView(project);
  else if (viewedStep === 1 && currentStep >= 2 && narration) $("#workspace-body").innerHTML = lockedNarrationView(project, narration);
  else if (project.authoring.state === "drafted" && narration) $("#workspace-body").innerHTML = narrationView(project, narration, state.detail.sourceContext);
  else if (project.authoring.state === "locked" && !project.video.manifest) $("#workspace-body").innerHTML = mediaView(project, narration);
  else if (viewedStep === 4)
    $("#workspace-body").innerHTML = state.workflow?.productionBaseline
      ? productionBaselineReviewView(state.workflow)
      : staticReviewView(project, state.staticReview);
  else if (viewedStep === 5) $("#workspace-body").innerHTML = deliveryView(project, state.delivery);
  else if (project.video.manifest) $("#workspace-body").innerHTML = videoView(project, state.workflow);
  else $("#workspace-body").innerHTML = intakeView(project);
  bindWorkspaceActions();
  updateDeliveryEstimate();
};
const openProjectInspector = () => {
  if (!state.detail) return;
  $("#project-inspector").classList.add("open");
  $("#inspector-backdrop").hidden = false;
  document.body.classList.add("inspector-open");
};
const closeProjectInspector = () => {
  $("#project-inspector")?.classList.remove("open");
  if ($("#inspector-backdrop")) $("#inspector-backdrop").hidden = true;
  document.body.classList.remove("inspector-open");
};
const editedNarration = () => {
  const value = structuredClone(state.detail.narration);
  document.querySelectorAll("[data-field]").forEach((input) => value[input.dataset.field] = input.value);
  document.querySelectorAll("[data-section-narration]").forEach((input) => {
    const index = Number(input.dataset.sectionNarration);
    if (index < 0) {
      const section = structuralStoryboardSection(value,index);
      if (section.narration !== input.value) {
        const review = storyboardReview(section);
        setStoryboardReview(
          section,
          review
            ? { ...review, status:"suggested", annotations:review.annotations?.map((annotation) => ({ ...annotation, status:"suggested" })) }
            : { mode:"auto", status:"suggested" },
        );
      }
      updateStructuralNarration(value,index,input.value);
      return;
    }
    const section = value.sections[index];
    if (section.narration !== input.value) {
      section.visualOpportunities = [];
      const review = storyboardReview(section);
      setStoryboardReview(
        section,
        review
          ? { ...review, status:"suggested", annotations:review.annotations?.map((annotation) => ({ ...annotation, status:"suggested" })) }
          : { mode:"auto", status:"suggested" },
      );
    }
    section.narration = input.value;
  });
  document.querySelectorAll("[data-section-material]").forEach((select) => {
    const index = Number(select.dataset.sectionMaterial);
    if (index < 0) return;
    const section = value.sections[index];
    const material = state.detail.project.materials.find((item) => item.id === select.value);
    if (material) {
      section.materialIds = [material.id];
      section.visualIntent = material.kind;
      section.recordingInstruction = material.description
        ? `展示${material.label}：${material.description}`
        : `展示${material.label}`;
    } else if (select.dataset.initialMaterial) {
      section.materialIds = [];
      section.visualIntent = "speaker";
      section.recordingInstruction = null;
    }
  });
  document.querySelectorAll("[data-visual-form]").forEach((select) => {
    const index = Number(select.dataset.visualForm);
    if (index < 0) return;
    const section = value.sections[index];
    section.visualIntent = "semantic-visual";
    section.materialIds = [];
    section.recordingInstruction = null;
    const selected = section.visualOpportunities?.find((item) => item.form === select.value);
    if (selected) section.visualOpportunities = [selected, ...section.visualOpportunities.filter((item) => item !== selected)];
  });
  delete value.transitionAnchor;
  value.fullScript = [value.opening,value.overview,...value.sections.map(item=>item.narration),value.conclusion].map(item=>item.trim()).filter(Boolean).join("\n\n");
  return value;
};
const renderReviewLightbox = () => {
  const frame = state.staticReview?.frames.find((item) => item.id === state.activeReviewFrame);
  if (!frame) return;
  const frames = reviewFrames();
  const index = frames.findIndex((item) => item.id === frame.id);
  $("#review-lightbox-title").textContent = `${frame.categoryLabel} · ${frame.phaseLabel}`;
  const chapter = state.staticReview?.chapters.find((item) => item.id === frame.chapterId);
  $("#review-lightbox-meta").textContent = `${formatReviewTime(frame.timeSeconds)} · ${chapter?.label ?? "审核画面"}`;
  const image = $("#review-lightbox-image");
  image.src = frame.url;
  image.alt = `${frame.categoryLabel} ${frame.phaseLabel}`;
  image.style.width = `${state.reviewZoom}%`;
  $("#review-zoom-value").textContent = `${state.reviewZoom}%`;
  $("#review-prev").disabled = index <= 0;
  $("#review-next").disabled = index < 0 || index >= frames.length - 1;
  $("#review-note-text").value = "";
  $("#review-note-text").placeholder = `记录对 ${frame.categoryLabel} ${formatReviewTime(frame.timeSeconds)} 的具体意见`;
  $("#review-note-text").disabled = Boolean(state.staticReview?.approval.approved);
  $("#save-review-note").disabled = Boolean(state.staticReview?.approval.approved);
};
const openReviewLightbox = (frameId) => {
  state.activeReviewFrame = frameId;
  state.reviewZoom = 100;
  renderReviewLightbox();
  $("#review-lightbox").showModal();
};
const moveReviewLightbox = (offset) => {
  const frames = reviewFrames();
  const index = frames.findIndex((item) => item.id === state.activeReviewFrame);
  const next = frames[index + offset];
  if (!next) return;
  state.activeReviewFrame = next.id;
  state.reviewZoom = 100;
  renderReviewLightbox();
};
const renderReviewGallery = () => {
  const container = $("#review-gallery-content");
  if (!container || !state.staticReview?.available) return;
  container.innerHTML = galleryMarkup(state.staticReview);
  bindReviewGalleryActions();
};
const moveReviewCoverflow = (offset) => {
  const frames = reviewFrames();
  if (frames.length < 2) return;
  const index = Math.max(0, frames.findIndex((frame) => frame.id === state.reviewGalleryFrame));
  state.reviewGalleryFrame = frames[(index + offset + frames.length) % frames.length].id;
  renderReviewGallery();
  requestAnimationFrame(() => $("[data-review-coverflow-stage]")?.focus({ preventScroll: true }));
};
const bindReviewGalleryActions = () => {
  document.querySelectorAll("[data-review-filter]").forEach((button) => button.addEventListener("click", () => {
    state.reviewFilter = button.dataset.reviewFilter;
    state.reviewGalleryFrame = null;
    renderReviewGallery();
  }));
  document.querySelectorAll("[data-review-coverflow-dot]").forEach((button) => button.addEventListener("click", () => {
    const frame = reviewFrames()[Number(button.dataset.reviewCoverflowDot)];
    if (!frame) return;
    state.reviewGalleryFrame = frame.id;
    renderReviewGallery();
  }));
  const stage = $("[data-review-coverflow-stage]");
  if (!stage) return;
  let pointerId;
  let startX = 0;
  let currentX = 0;
  let dragging = false;
  stage.addEventListener("click", (event) => {
    const button = event.target.closest("[data-review-coverflow-index]");
    if (!button || !stage.contains(button) || stage.dataset.dragged === "true") return;
    const frame = reviewFrames()[Number(button.dataset.reviewCoverflowIndex)];
    if (!frame) return;
    if (frame.id === state.reviewGalleryFrame) {
      openReviewLightbox(frame.id);
      return;
    }
    state.reviewGalleryFrame = frame.id;
    renderReviewGallery();
  });
  stage.addEventListener("pointerdown", (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    pointerId = event.pointerId;
    startX = event.clientX;
    currentX = startX;
    dragging = false;
    stage.dataset.dragged = "false";
    stage.focus({ preventScroll: true });
  });
  stage.addEventListener("pointermove", (event) => {
    if (event.pointerId !== pointerId) return;
    currentX = event.clientX;
    const distance = Math.max(-110, Math.min(110, currentX - startX));
    if (Math.abs(distance) > 8 && !dragging) {
      dragging = true;
      stage.dataset.dragged = "true";
      stage.setPointerCapture?.(pointerId);
      stage.classList.add("is-dragging");
    }
    if (!dragging) return;
    stage.style.setProperty("--coverflow-drag-x", `${distance}px`);
  });
  const finishDrag = (event, cancelled = false) => {
    if (event.pointerId !== pointerId) return;
    const distance = event.clientX - startX;
    if (stage.hasPointerCapture?.(pointerId)) stage.releasePointerCapture(pointerId);
    stage.classList.remove("is-dragging");
    stage.style.setProperty("--coverflow-drag-x", "0px");
    pointerId = undefined;
    if (!cancelled && dragging && Math.abs(distance) > 70) moveReviewCoverflow(distance < 0 ? 1 : -1);
    setTimeout(() => {
      if (stage.isConnected) stage.dataset.dragged = "false";
    }, 0);
  };
  stage.addEventListener("pointerup", finishDrag);
  stage.addEventListener("pointercancel", (event) => finishDrag(event, true));
  stage.addEventListener("keydown", (event) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    moveReviewCoverflow(event.key === "ArrowRight" ? 1 : -1);
    event.preventDefault();
  });
};
const bindWorkspaceActions = () => {
  const id = state.selected;
  document.querySelectorAll("[data-view-step]").forEach((button) => {
    button.addEventListener("click", () => {
      state.viewStep = Number(button.dataset.viewStep);
      renderWorkspace();
    });
  });
  $("#save-editorial-brief")?.addEventListener("click", async () => {
    const button = $("#save-editorial-brief");
    const answers = {
      ...(state.detail.project.brief.editorialBrief?.answers ?? {}),
      ...Object.fromEntries(
        [...document.querySelectorAll("[data-editorial-question]")]
          .map((field) => [field.dataset.editorialQuestion, field.value.trim()]),
      ),
    };
    button.disabled = true;
    try {
      const updated = await api(`/api/projects/${id}/editorial-brief`, {
        method: "PUT",
        body: { editorialBrief: { version: "1.0", status: "draft", answers } },
      });
      state.editorial.editingProjectId = null;
      toast(updated.brief.editorialBrief.status === "ready" ? "写作方向已确认" : "已保存，请继续补齐必填问题");
      await selectProject(id);
    } catch (error) {
      button.disabled = false;
      toast(error.message);
    }
  });
  $("#infer-editorial-brief")?.addEventListener("click", async () => {
    try {
      const task = await api(`/api/projects/${id}/editorial-brief/infer`, { method: "POST", body: {} });
      state.jobs.push(task);
      renderWorkspace();
      toast("Studio 正在从完整描述中整理写作方向");
      pollUntilDone(id);
    } catch (error) {
      toast(error.message);
    }
  });
  $("#edit-editorial-brief")?.addEventListener("click", () => {
    state.editorial.editingProjectId = id;
    renderWorkspace();
  });
  $("#cancel-editorial-edit")?.addEventListener("click", () => {
    state.editorial.editingProjectId = null;
    renderWorkspace();
  });
  $("#add-source")?.addEventListener("click", async () => {
    const button = $("#add-source");
    button.disabled = true;
    try { const updated = await api(`/api/projects/${id}/sources`, { method:"POST", body:{ label:$("#source-label").value, value:$("#source-value").value } }); toast(`已添加 ${updated.sources.length} 份参考资料：${updated.sources.map((item) => item.label).join(" / ")}`); await refresh(); } catch(error){ button.disabled = false; toast(error.message); }
  });
  $("#add-asset")?.addEventListener("click", async () => {
    const button = $("#add-asset");
    button.disabled = true;
    try { const result = await api(`/api/projects/${id}/assets`, { method:"POST", body:{ sourcePath:$("#asset-path").value, kind:$("#asset-kind").value, label:$("#asset-label").value, fit:$("#asset-fit")?.value } }); const labels = [...state.detail.project.materials, result.material].map((item) => item.label).join(" / "); toast(`已添加 ${result.materialCount} 份素材：${labels}`); await refresh(); } catch(error){ button.disabled = false; toast(error.message); }
  });
  $("#browse-assets")?.addEventListener("click", async () => {
    const button = $("#browse-assets");
    button.disabled = true;
    try {
      const result = await api(`/api/projects/${id}/assets/pick`, { method:"POST", body:{ multiple:true, fit:$("#asset-fit")?.value } });
      if (!result.materials.length) { button.disabled = false; return; }
      toast(`已加入 ${result.materials.length} 份素材`);
      await refresh();
    } catch(error) { button.disabled = false; toast(error.message); }
  });
  document.querySelectorAll("[data-delete-material]").forEach((button) => {
    button.addEventListener("click", async () => {
      const label = button.dataset.materialLabel || "这份素材";
      if (!window.confirm(translateText(`确认从当前项目移除“${label}”？原文件会保留在项目回收目录中。`))) return;
      button.disabled = true;
      try {
        const result = await api(`/api/projects/${id}/materials/${encodeURIComponent(button.dataset.deleteMaterial)}`, {
          method: "DELETE",
          body: {},
        });
        toast(result.recoverable ? "素材已移除，原文件仍可恢复" : "素材已移除");
        await refresh();
      } catch (error) {
        button.disabled = false;
        toast(error.message);
      }
    });
  });
  $("#resume-visual-storyboard")?.addEventListener("click", async () => {
    const button = $("#resume-visual-storyboard");
    button.disabled = true;
    try {
      const task = await api(`/api/projects/${id}/visual-storyboard/seed`, { method: "POST", body: {} });
      state.jobs.push(task);
      toast("已从保存的口播稿继续，不会重新写稿");
      renderWorkspace();
      pollUntilDone(id);
    } catch (error) {
      button.disabled = false;
      toast(error.message);
    }
  });
  $("#pick-input-script")?.addEventListener("click", async () => {
    const button = $("#pick-input-script");
    button.disabled = true;
    try {
      const result = await api(`/api/projects/${id}/input-script/pick`, { method:"POST", body:{} });
      if (result.cancelled) { button.disabled = false; return; }
      toast(`已导入口播稿：${result.fileName}`);
      await refresh();
    } catch(error) { button.disabled = false; toast(error.message); }
  });
  $("#pick-speaker-video")?.addEventListener("click", async () => {
    const button = $("#pick-speaker-video");
    button.disabled = true;
    try {
      const result = await api(`/api/projects/${id}/assets/pick`, { method:"POST", body:{ multiple:false, kind:"speaker-video" } });
      if (result.cancelled) { button.disabled = false; return; }
      toast("已加入人物口播原片");
      await refresh();
    } catch(error) { button.disabled = false; toast(error.message); }
  });
  $("#prepare-existing-narration")?.addEventListener("click", async () => {
    const button = $("#prepare-existing-narration");
    button.disabled = true;
    try {
      await api(`/api/projects/${id}/existing-narration/prepare`, { method:"POST", body:{} });
      toast("已保留原口播文字并生成逐段视觉方案");
      await selectProject(id);
    } catch(error) { button.disabled = false; toast(error.message); }
  });
  $("#analyze-materials")?.addEventListener("click", async () => {
    const button = $("#analyze-materials");
    button.disabled = true;
    try {
      const task = await api(`/api/projects/${id}/material-understanding/analyze`, { method:"POST", body:{} });
      state.jobs.push(task);
      renderWorkspace();
      toast("素材理解任务已开始，完成后请确认");
      pollUntilDone(id);
    } catch(error) {
      button.disabled = false;
      toast(error.message);
    }
  });
  $("#confirm-material-understanding")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      await api(`/api/projects/${id}/material-understanding/confirm`, {
        method:"POST",
        body:{ inputSha256:button.dataset.inputSha },
      });
      toast((state.detail.project.project.workflowMode ?? "script-first") === "visual-post-production" ? "素材理解已确认，现在可以进入视觉方案" : "素材理解已确认，现在可以生成口播稿");
      await selectProject(id);
    } catch(error) {
      button.disabled = false;
      toast(error.message);
    }
  });
  const updateNarrationSection = (index, mutate) => {
    const draft = editedNarration();
    const section = storyboardSectionAt(draft,index);
    if (!section) return;
    mutate(section);
    if (index < 0) updateStructuralNarration(draft,index,section.narration);
    state.detail.narration = draft;
    renderWorkspace();
    void autosaveVisualStoryboard(id);
  };
  const confirmVisualReview = (section) => {
    const review = storyboardReview(section) ?? { mode:"auto", status:"suggested" };
    if (review.beats?.length) {
      for (const beat of review.beats) {
        if (!section.narration.includes(beat.exactSpokenQuote))
          return { error:`${section.title} 的视觉节拍已不在当前口播中，请重新生成视觉方案` };
        const materialIds = [...new Set([...(beat.materialIds ?? []), ...(beat.materialId ? [beat.materialId] : [])])];
        if (["image","screen-demo"].includes(beat.primaryVisualType) && !materialIds.length)
          return { error:`${section.title} 有视觉节拍尚未选择素材` };
        if (materialIds.some((materialId) => !state.detail.project.materials.some((item) => item.id === materialId)))
          return { error:`${section.title} 有视觉节拍引用了不存在的素材` };
      }
      return {
        review: {
          ...review,
          status:"confirmed",
          beats:review.beats.map((beat) => ({
            ...beat,
            status:"confirmed",
            ...(beat.primaryVisualType === "animation" && beat.animationIntent
              ? { animationIntent:applyAnimationAssetMatches(section,beat.animationIntent,beat.id) }
              : {}),
          })),
          ...((review.annotations?.length ?? 0) ? { annotations:review.annotations.map((annotation) => ({ ...annotation, status:"confirmed" })) } : {}),
        },
      };
    }
    const effectiveMode = review.mode === "auto" ? recommendedVisualMode(section) : review.mode;
    const selectedMaterialId = review.materialId ?? section.materialIds[0];
    if (effectiveMode === "material" && !selectedMaterialId)
      return { error:`${section.title} 还没有选择素材` };
    const component = effectiveMode === "information" ? reviewedComponent(section) : undefined;
    if (effectiveMode === "information" && !component)
      return { error:`${section.title} 还没有兼容的信息组件` };
    const rawAnimationIntent = effectiveMode === "animation"
      ? (review.animationIntent ?? recommendedAnimationIntent(section))
      : undefined;
    const animationIntent = rawAnimationIntent
      ? applyAnimationAssetMatches(section,rawAnimationIntent)
      : undefined;
    if (effectiveMode === "animation" && !animationIntent)
      return { error:`${section.title} 暂时无法生成稳定动画` };
    const ranges = [];
    for (const annotation of review.annotations ?? []) {
      const target = annotation.exactSpokenQuote?.trim();
      if (!target || [...target].length < 2 || [...target].length > 24 || /[\r\n]/.test(target))
        return { error:`${section.title} 的文字标注必须是 2–24 个字符` };
      let from = 0;
      let start = -1;
      for (let occurrence = 0; occurrence < (annotation.quoteOccurrence ?? 1); occurrence += 1) {
        start = section.narration.indexOf(target, from);
        if (start < 0) break;
        from = start + target.length;
      }
      if (start < 0) return { error:`${section.title} 有一处文字标注已不在当前口播中` };
      if (!annotation.quoteOccurrence && section.narration.indexOf(target, from) >= 0)
        return { error:`${section.title} 的“${target}”重复出现，请重新从左侧选中目标位置` };
      const end = start + target.length;
      if (ranges.some((range) => start < range.end && end > range.start))
        return { error:`${section.title} 有重叠的文字标注` };
      ranges.push({ start, end });
    }
    return {
      review: {
        mode:review.mode,
        status:"confirmed",
        ...(effectiveMode === "information" ? { form:reviewedVisualForm(section), componentId:component.id } : {}),
        ...(effectiveMode === "material" ? { materialKind:review.materialKind ?? section.visualIntent, materialId:selectedMaterialId, materialDisplay:review.materialDisplay ?? "full" } : {}),
        ...(effectiveMode === "animation" && animationIntent ? { animationIntent } : {}),
        ...((review.annotations?.length ?? 0) ? { annotations:review.annotations.map((annotation) => ({ ...annotation, status:"confirmed" })) } : {}),
      },
    };
  };
  document.querySelectorAll("[data-open-narration-section]").forEach((button) => button.addEventListener("click", () => {
    state.detail.narration = editedNarration();
    state.activeNarrationSection = Number(button.dataset.openNarrationSection);
    renderWorkspace();
  }));
  document.querySelectorAll("[data-remove-visual-beat]").forEach((button) => button.addEventListener("click", () => {
    const index = Number(button.dataset.visualBeatSection);
    const beatIndex = Number(button.dataset.removeVisualBeat);
    updateNarrationSection(index, (section) => {
      const review = storyboardReview(section);
      if (!review?.beats?.length) return;
      review.beats.splice(beatIndex,1);
      review.status = "suggested";
    });
  }));
  document.querySelectorAll("[data-beat-component-choice]").forEach((button) => button.addEventListener("click", () => {
    const index = Number(button.dataset.visualBeatSection);
    const beatIndex = Number(button.dataset.beatComponentIndex);
    updateNarrationSection(index, (section) => {
      const beat = storyboardReview(section)?.beats?.[beatIndex];
      if (!beat || beat.primaryVisualType !== "component") return;
      beat.componentId = button.dataset.beatComponentChoice;
      beat.status = "suggested";
      storyboardReview(section).status = "suggested";
      toast("已切换组件备选，整体确认后才会锁定");
    });
  }));
  document.querySelectorAll("[data-beat-animation-style]").forEach((select) => select.addEventListener("change", () => {
    const index = Number(select.dataset.visualBeatSection);
    const beatIndex = Number(select.dataset.beatAnimationStyle);
    updateNarrationSection(index, (section) => {
      const beat = storyboardReview(section)?.beats?.[beatIndex];
      if (!beat?.animationIntent) return;
      const structure = animationStructureFor(beat.animationIntent.prototypeId);
      if (!structure?.compatibleStyleIds?.includes(select.value)) return toast("当前动画结构不支持这个模板");
      beat.animationIntent = { ...beat.animationIntent, styleProfileId:select.value };
      beat.status = "suggested";
      storyboardReview(section).status = "suggested";
      toast("已切换动画模板，整体确认后才会锁定");
    });
  }));
  document.querySelectorAll("[data-beat-animation-prototype]").forEach((select) => select.addEventListener("change", () => {
    const index = Number(select.dataset.visualBeatSection);
    const beatIndex = Number(select.dataset.beatAnimationPrototype);
    updateNarrationSection(index, (section) => {
      const beat = storyboardReview(section)?.beats?.[beatIndex];
      if (!beat?.animationIntent) return;
      const structure = animationStructureFor(select.value);
      if (!structure) return;
      const stages = beat.animationIntent.stages.slice(0,structure.maximumStages ?? beat.animationIntent.stages.length);
      if (stages.length < (structure.minimumStages ?? 2)) return toast("当前节拍的阶段数量不适合这个动画结构");
      const styleProfileId = structure.compatibleStyleIds.includes(beat.animationIntent.styleProfileId)
        ? beat.animationIntent.styleProfileId
        : structure.defaultStyleId;
      beat.animationIntent = { ...beat.animationIntent, prototypeId:select.value, styleProfileId, stages };
      beat.status = "suggested";
      storyboardReview(section).status = "suggested";
      toast("已切换动画结构，整体确认后才会锁定");
    });
  }));
  document.querySelectorAll("[data-visual-mode]").forEach((button) => button.addEventListener("click", () => {
    const index = Number(button.dataset.sectionIndex);
    const requestedMode = button.dataset.visualMode;
    const mode = requestedMode === "component"
      ? "information"
      : ["image", "screen-demo"].includes(requestedMode)
        ? "material"
        : requestedMode;
    updateNarrationSection(index, (section) => {
      const previousReview = storyboardReview(section);
      const annotations = previousReview?.annotations ?? [];
      if (requestedMode === "auto") {
        setStoryboardReview(section, { mode:"auto", status:"suggested", ...(annotations.length ? { annotations } : {}) });
        return;
      }
      const requiredMaterialKind = requestedMode === "image" ? "screenshot" : requestedMode === "screen-demo" ? "screen-recording" : undefined;
      const previousMaterial = state.detail.project.materials.find((item) => item.id === previousReview?.materialId);
      const material = requiredMaterialKind && previousMaterial?.kind === requiredMaterialKind ? previousMaterial : undefined;
      const review = setStoryboardReview(section, {
        mode,
        status:"suggested",
        ...(annotations.length ? { annotations } : {}),
        ...(previousReview?.componentId ? { componentId:previousReview.componentId } : {}),
        ...(previousReview?.form ? { form:previousReview.form } : {}),
        ...(mode === "material" && material ? { materialId:material.id } : {}),
        ...(mode === "material" ? { materialKind:requiredMaterialKind, materialDisplay:previousReview?.materialDisplay ?? "full" } : {}),
        ...(mode === "animation" && recommendedAnimationIntent(section) ? { animationIntent:recommendedAnimationIntent(section) } : {}),
      });
      if (mode === "speaker" || mode === "speaker-only") {
        section.visualIntent = "speaker";
        section.materialIds = [];
        section.recordingInstruction = null;
      } else if (mode === "information") {
        section.visualIntent = "semantic-visual";
        section.materialIds = [];
        section.recordingInstruction = null;
        review.form ??= section.visualOpportunities?.[0]?.form ?? "two-way-contrast";
        review.componentId = compatibleComponents(review.form)[0]?.id;
      } else if (mode === "animation") {
        const animationIntent = recommendedAnimationIntent(section);
        if (!animationIntent) {
          toast("这段没有足够明确的流程、因果、状态或分层关系，暂时不能选择动画");
          setStoryboardReview(section, { mode:"auto", status:"suggested", ...(annotations.length ? { annotations } : {}) });
          return;
        }
        review.animationIntent = animationIntent;
        section.visualIntent = "semantic-visual";
        section.materialIds = [];
        section.recordingInstruction = null;
      } else if (mode === "material") {
        section.visualIntent = requiredMaterialKind;
        section.materialIds = material ? [material.id] : [];
        section.recordingInstruction = material?.description
          ? "展示" + material.label + "：" + material.description
          : material
            ? "展示" + material.label
            : null;
      }
    });
  }));
  document.querySelectorAll("[data-section-material]").forEach((select) => select.addEventListener("change", () => {
    const index = Number(select.dataset.sectionMaterial);
    updateNarrationSection(index, (section) => {
      const material = state.detail.project.materials.find((item) => item.id === select.value);
      const previousReview = storyboardReview(section);
      setStoryboardReview(section, {
        mode:"material",
        status:"suggested",
        ...(previousReview?.annotations?.length ? { annotations:previousReview.annotations } : {}),
        ...(material ? { materialId:material.id, materialKind:material.kind } : { materialKind:section.visualIntent }),
        materialDisplay:previousReview?.materialDisplay ?? "full",
      });
      if (index < 0) return;
      if (material) {
        section.materialIds = [material.id];
        section.visualIntent = material.kind;
        section.recordingInstruction = material.description
          ? "展示" + material.label + "：" + material.description
          : "展示" + material.label;
      } else {
        section.materialIds = [];
        section.recordingInstruction = null;
      }
    });
  }));
  document.querySelectorAll("[data-visual-form]").forEach((select) => select.addEventListener("change", () => {
    const index = Number(select.dataset.visualForm);
    updateNarrationSection(index, (section) => {
      const previousReview = storyboardReview(section);
      setStoryboardReview(section, {
        mode:"information",
        status:"suggested",
        ...(previousReview?.annotations?.length ? { annotations:previousReview.annotations } : {}),
        form:select.value,
        componentId:compatibleComponents(select.value)[0]?.id,
      });
      if (index < 0) return;
      section.visualIntent = "semantic-visual";
      section.materialIds = [];
      section.recordingInstruction = null;
      const selected = section.visualOpportunities?.find((item) => item.form === select.value);
      if (selected) section.visualOpportunities = [selected, ...section.visualOpportunities.filter((item) => item !== selected)];
    });
  }));
  document.querySelectorAll("[data-animation-prototype]").forEach((select) => select.addEventListener("change", () => {
    const index = Number(select.dataset.animationPrototype);
    updateNarrationSection(index, (section) => {
      const review = storyboardReview(section) ?? { mode:"animation", status:"suggested" };
      const current = review.animationIntent ?? recommendedAnimationIntent(section);
      const structure = animationStructureFor(select.value);
      const retainedStyle = structure?.compatibleStyleIds?.includes(current?.styleProfileId)
        ? current.styleProfileId
        : recommendedAnimationStyleId(section, select.value);
      const animationIntent = recommendedAnimationIntent(section, {
        prototypeId:select.value,
        styleProfileId:retainedStyle,
      });
      if (!animationIntent) return toast("当前口播无法生成这个动画结构所需的有效阶段");
      setStoryboardReview(section, { ...review, mode:"animation", status:"suggested", animationIntent });
    });
  }));
  document.querySelectorAll("[data-animation-option-prototype]").forEach((button) => button.addEventListener("click", () => {
    const index = Number(button.dataset.animationOptionSection);
    updateNarrationSection(index, (section) => {
      const review = storyboardReview(section) ?? { mode:"animation", status:"suggested" };
      const animationIntent = recommendedAnimationIntent(section, {
        prototypeId:button.dataset.animationOptionPrototype,
        styleProfileId:button.dataset.animationOptionStyle,
      });
      if (!animationIntent) return toast("当前口播无法生成这个备选动画");
      setStoryboardReview(section, { ...review, mode:"animation", status:"suggested", animationIntent });
      toast("已切换为备选动画，整体确认后才会锁定");
    });
  }));
  document.querySelectorAll("[data-animation-component-backup]").forEach((button) => button.addEventListener("click", () => {
    const index = Number(button.dataset.animationOptionSection);
    updateNarrationSection(index, (section) => {
      const review = storyboardReview(section) ?? { mode:"animation", status:"suggested" };
      const rest = { ...review };
      delete rest.animationIntent;
      setStoryboardReview(section, {
        ...rest,
        mode:"information",
        status:"suggested",
        form:button.dataset.animationComponentForm,
        componentId:button.dataset.animationComponentBackup,
      });
      if (index >= 0) {
        section.visualIntent = "semantic-visual";
        section.materialIds = [];
        section.recordingInstruction = null;
      }
      toast("已切换为组件备选，整体确认后才会锁定");
    });
  }));
  document.querySelectorAll("[data-material-display]").forEach((select) => select.addEventListener("change", () => {
    const index = Number(select.dataset.materialDisplay);
    updateNarrationSection(index, (section) => {
      setStoryboardReview(section, {
        ...(storyboardReview(section) ?? { mode:"material" }),
        mode:"material",
        status:"suggested",
        materialDisplay:select.value,
      });
    });
  }));
  const updateTextAnnotation = (sectionIndex, annotationIndex, mutate) => {
    updateNarrationSection(sectionIndex, (section) => {
      const review = storyboardReview(section) ?? { mode:"auto", status:"suggested" };
      const annotations = [...(review.annotations ?? [])];
      if (!annotations[annotationIndex]) return;
      const annotation = { ...annotations[annotationIndex] };
      mutate(annotation, section);
      annotation.status = "confirmed";
      annotation.origin = "user";
      annotation.executionPolicy = "locked";
      annotations[annotationIndex] = annotation;
      setStoryboardReview(section, { ...review, annotations });
    });
  };
  document.querySelectorAll("[data-add-text-annotation]").forEach((button) => button.addEventListener("click", () => {
    const index = Number(button.dataset.addTextAnnotation);
    const narrationField = document.querySelector(`[data-section-narration="${index}"]`);
    const selectionStart = narrationField?.selectionStart ?? 0;
    const selectedQuote = (narrationField?.value.slice(selectionStart, narrationField.selectionEnd) ?? "").trim();
    if ([...selectedQuote].length < 2 || [...selectedQuote].length > 24 || /[\r\n]/.test(selectedQuote))
      return toast("请先在左侧选中 2–24 个字符的单行短语");
    updateNarrationSection(index, (section) => {
      const review = storyboardReview(section) ?? { mode:"auto", status:"suggested" };
      const annotations = [...(review.annotations ?? [])];
      const occurrence = section.narration.slice(0, selectionStart).split(selectedQuote).length;
      const start = section.narration.indexOf(selectedQuote, selectionStart);
      if (start < 0) return toast("选中的文字必须来自当前口播稿");
      const end = start + selectedQuote.length;
      const overlaps = annotations.some((item) => {
        let from = 0;
        let itemStart = -1;
        for (let count = 0; count < (item.quoteOccurrence ?? 1); count += 1) {
          itemStart = section.narration.indexOf(item.exactSpokenQuote, from);
          if (itemStart < 0) return false;
          from = itemStart + item.exactSpokenQuote.length;
        }
        return itemStart < end && itemStart + item.exactSpokenQuote.length > start;
      });
      if (overlaps) return toast("这段文字已经包含在另一处标注中");
      annotations.push({ id:nextAnnotationId(annotations), exactSpokenQuote:selectedQuote, ...(occurrence > 1 ? { quoteOccurrence:occurrence } : {}), status:"confirmed", origin:"user", executionPolicy:"locked", effect:"highlight" });
      setStoryboardReview(section, { ...review, annotations });
    });
  }));
  document.querySelectorAll("[data-annotation-effect]").forEach((button) => button.addEventListener("click", () => {
    updateTextAnnotation(Number(button.dataset.annotationSection), Number(button.dataset.annotationIndex), (annotation) => {
      annotation.effect = button.dataset.annotationEffect;
    });
  }));
  document.querySelectorAll("[data-remove-text-annotation]").forEach((button) => button.addEventListener("click", () => {
    const sectionIndex = Number(button.dataset.annotationSection);
    const annotationIndex = Number(button.dataset.removeTextAnnotation);
    updateNarrationSection(sectionIndex, (section) => {
      const review = storyboardReview(section) ?? { mode:"auto", status:"suggested" };
      const annotations = (review.annotations ?? []).filter((_, index) => index !== annotationIndex);
      setStoryboardReview(section, { ...review, ...(annotations.length ? { annotations } : { annotations:[] }) });
    });
  }));
  $("#replan-animation-assets")?.addEventListener("click", async () => {
    const button = $("#replan-animation-assets");
    button.disabled = true;
    try {
      await autosaveVisualStoryboard(id);
      const task = await api(`/api/projects/${id}/animation-assets/replan`, { method:"POST", body:{} });
      state.jobs.push(task);
      renderWorkspace();
      toast("固定 Agent 正在重新匹配动画图片素材");
      pollUntilDone(id);
    } catch(error) {
      button.disabled = false;
      toast(error.message);
    }
  });
  $("#confirm-animation-asset-replan")?.addEventListener("click", async (event) => {
    if (!window.confirm(translateText("确认后，这次 Agent 规划会替换当前动画阶段的图片与图标安排。继续吗？"))) return;
    const button = event.currentTarget;
    button.disabled = true;
    try {
      await api(`/api/projects/${id}/animation-assets/replan/confirm`, {
        method:"POST",
        body:{
          attemptId:button.dataset.attemptId,
          candidateStoryboardSha256:button.dataset.candidateSha,
          confirmation:"human-confirm-animation-asset-replan",
        },
      });
      toast("动画图片素材规划已确认");
      await selectProject(id);
    } catch(error) {
      button.disabled = false;
      toast(error.message);
    }
  });
  document.querySelectorAll("[data-component-choice]").forEach((button) => button.addEventListener("click", () => {
    const index = Number(button.dataset.sectionIndex);
    updateNarrationSection(index, (section) => {
      const review = storyboardReview(section) ?? { mode:"information", status:"suggested" };
      setStoryboardReview(section, { ...review, mode:"information", status:"suggested", componentId:button.dataset.componentChoice });
    });
  }));
  document.querySelectorAll("[data-open-component-catalog]").forEach((button) => button.addEventListener("click", () => {
    const index = Number(button.dataset.openComponentCatalog);
    const draft = editedNarration();
    const section = storyboardSectionAt(draft,index);
    const compatible = new Set(compatibleComponents(reviewedVisualForm(section)).map((item) => item.id));
    const dialog = $("#component-catalog-dialog");
    dialog.dataset.sectionIndex = String(index);
    dialog.querySelectorAll("[data-catalog-component]").forEach((card) => {
      card.classList.toggle("compatible", compatible.has(card.dataset.catalogComponent));
      card.classList.toggle("incompatible", !compatible.has(card.dataset.catalogComponent));
      card.disabled = !compatible.has(card.dataset.catalogComponent);
      card.title = card.disabled ? "当前口播关系与这个组件不兼容" : "选择这个组件";
    });
    dialog.showModal();
  }));
  document.querySelector("[data-close-component-catalog]")?.addEventListener("click", () => $("#component-catalog-dialog").close());
  document.querySelectorAll("[data-catalog-component]").forEach((card) => card.addEventListener("click", () => {
    const dialog = $("#component-catalog-dialog");
    const index = Number(dialog.dataset.sectionIndex);
    dialog.close();
    updateNarrationSection(index, (section) => {
      const review = storyboardReview(section) ?? { mode:"information", status:"suggested" };
      setStoryboardReview(section, { ...review, mode:"information", status:"suggested", componentId:card.dataset.catalogComponent });
    });
  }));
  $("#generate-script")?.addEventListener("click", async () => {
    try {
      const task = await api(`/api/projects/${id}/draft`, { method:"POST", body:{} });
      state.jobs.push(task);
      renderWorkspace();
      toast("口播稿任务已开始，页面会持续显示进度");
      pollUntilDone(id);
    } catch(error){ toast(error.message); }
  });
  $("#save-script")?.addEventListener("click", async () => {
    try {
      await api(`/api/projects/${id}/narration`, { method:"PUT", body:editedNarration() });
      await api(`/api/projects/${id}/visual-storyboard`, { method:"PUT", body:state.detail.visualStoryboard });
      toast("口播与分镜安排已保存");
      await selectProject(id);
    } catch(error){ toast(error.message); }
  });
  document.querySelectorAll("[data-export-narration]").forEach((button) => button.addEventListener("click", () => {
    const format = button.dataset.exportNarration;
    const url = `/api/projects/${id}/narration/export?format=${encodeURIComponent(format)}`;
    if (format === "pdf") window.open(url, "_blank", "noopener");
    else window.location.assign(url);
  }));
  document.querySelectorAll("[data-restore-narration]").forEach((button) => button.addEventListener("click", async () => {
    if (!window.confirm(translateText("恢复后会创建一个新版本，当前版本和历史版本都会保留。继续吗？"))) return;
    try {
      await api(`/api/projects/${id}/narration/restore`, { method:"POST", body:{ attemptId:button.dataset.restoreNarration } });
      toast("历史稿件已恢复为新的当前版本");
      await selectProject(id);
    } catch(error) { toast(error.message); }
  }));
  $("#rewrite-script")?.addEventListener("click", async () => {
    const button = $("#rewrite-script");
    const instructions = $("#rewrite-instructions").value.trim();
    if (!instructions) return toast("请先填写具体修改意见");
    button.disabled = true;
    try {
      await api(`/api/projects/${id}/narration`, { method: "PUT", body: editedNarration() });
      await api(`/api/projects/${id}/visual-storyboard`, { method:"PUT", body:state.detail.visualStoryboard });
      const task = await api(`/api/projects/${id}/rewrite`, { method:"POST", body:{ instructions } });
      state.jobs.push(task);
      renderWorkspace();
      toast("已把当前稿、资料和修改意见交给固定 Agent");
      pollUntilDone(id);
    } catch(error){ button.disabled = false; toast(error.message); }
  });
  $("#lock-script")?.addEventListener("click", async () => {
    try {
      const narration = editedNarration();
      const sections = storyboardEntries(narration).map(({section}) => section);
      const planned = sections.map((section) => ({ section, result:confirmVisualReview(section) }));
      const blocked = planned.find(({ result }) => result.error);
      if (blocked) return toast(blocked.result.error);
      planned.forEach(({ section, result }) => setStoryboardReview(section, result.review));
      await api(`/api/projects/${id}/visual-storyboard`, { method:"PUT", body:state.detail.visualStoryboard });
      await api(`/api/projects/${id}/lock`, { method:"POST", body:narration });
      await refresh();
      toast("最终稿与当前完整视觉方案已锁定");
    } catch(error){ toast(error.message); }
  });
  $("#suggest-writing-lessons")?.addEventListener("click", async () => {
    try {
      const task = await api(`/api/projects/${id}/writing-learning/suggest`, { method:"POST", body:{} });
      state.jobs.push(task);
      renderWorkspace();
      toast("正在比较写稿版本并提炼长期经验");
      pollUntilDone(id);
    } catch (error) {
      toast(error.message);
    }
  });
  $("#accept-writing-lessons")?.addEventListener("click", async () => {
    const lessonIds = [...document.querySelectorAll("[data-writing-lesson]:checked")].map(
      (field) => field.dataset.writingLesson,
    );
    try {
      await api(`/api/projects/${id}/writing-learning/accept`, { method:"POST", body:{ lessonIds } });
      toast(`已确认 ${lessonIds.length} 条写稿经验，未来同类项目会自动参考`);
      await selectProject(id);
      renderWorkspace();
    } catch (error) {
      toast(error.message);
    }
  });
  $("#create-handoff")?.addEventListener("click", async () => {
    const speaker = state.detail.project.materials.filter(item=>item.kind==="speaker-video" && item.assetId).at(-1);
    if (!speaker) return toast("请先登记人物口播原片");
    try { await api(`/api/projects/${id}/handoff`, { method:"POST", body:{ speakerAssetId:speaker.assetId } }); toast("交接包已生成"); await refresh(); } catch(error){ toast(error.message); }
  });
  document.querySelectorAll("#workflow-readiness-check").forEach((button) => button.addEventListener("click", async () => { try { button.disabled = true; const task = await api(`/api/projects/${id}/workflow`, { method:"POST", body:{ action:"readiness" } }); state.jobs.push(task); toast("正在检查原片、服务、视觉规则和完整制作路径"); pollUntilDone(id); } catch(error){ button.disabled = false; toast(error.message); } }));
  $("#workflow-readiness-start")?.addEventListener("click", async (event) => {
    if (!$("#workflow-readiness-confirm")?.checked) return toast("请先确认本次运行与复用范围");
    const button = event.currentTarget;
    try {
      button.disabled = true;
      const task = await api(`/api/projects/${id}/workflow`, {
        method:"POST",
        body:{ action:button.dataset.action, readinessSha256:button.dataset.readinessSha },
      });
      state.jobs.push(task);
      toast(button.dataset.action === "production" ? "制作 Agent 已开始连续制作、自检与渲染" : "已开始处理");
      pollUntilDone(id);
    } catch(error) {
      button.disabled = false;
      toast(error.message);
    }
  });
  $("#cancel-workflow")?.addEventListener("click", async (event) => { try { await api(`/api/projects/${id}/jobs/${event.currentTarget.dataset.jobId}/cancel`, { method:"POST" }); toast("已取消当前任务"); await selectProject(id); } catch(error){ toast(error.message); } });
  document.querySelectorAll("[data-seek]").forEach((button) => button.addEventListener("click", () => { const player = $("#recut-preview"); if (player) { player.currentTime = Number(button.dataset.seek); player.play().catch(() => {}); } }));
  $("#reject-recut")?.addEventListener("click", async () => { const note = $("#recut-feedback")?.value.trim() ?? ""; if (!note) return toast("请先填写具体修改意见"); try { await api(`/api/projects/${id}/workflow/recut-decision`, { method:"POST", body:{ decision:"rejected", note, screenSha256:state.workflow.recut.screenSha256 } }); toast("已保存意见并驳回当前方案"); await selectProject(id); } catch(error){ toast(error.message); } });
  $("#reopen-recut")?.addEventListener("click", async () => { try { await api(`/api/projects/${id}/workflow/recut-decision`, { method:"POST", body:{ decision:"reopened", screenSha256:state.workflow.recut.screenSha256 } }); toast("已重新打开当前提案"); await selectProject(id); } catch(error){ toast(error.message); } });
  $("#approve-recut")?.addEventListener("click", async () => { if (!$("#approve-confirm")?.checked) return toast("请先确认已完成连续预览审核"); try { await api(`/api/projects/${id}/workflow`, { method:"POST", body:{ action:"approve-recut", screenSha256:state.workflow.recut.screenSha256 } }); toast("粗剪批准已提交，正在提升 EDL"); pollUntilDone(id); } catch(error){ toast(error.message); } });
  $("#replan-recut")?.addEventListener("click", async () => { if (!window.confirm(translateText("确认把上述意见交给 Agent 重新规划？当前版本会保留为历史记录。"))) return; try { await api(`/api/projects/${id}/workflow`, { method:"POST", body:{ action:"replan-recut", confirmation:"human-recut-replan", screenSha256:state.workflow.recut.screenSha256 } }); toast("已按修改意见重新规划粗剪"); pollUntilDone(id); } catch(error){ toast(error.message); } });
  $("#workflow-refresh")?.addEventListener("click", async () => { try { const result = await api(`/api/projects/${id}/workflow/refresh`, { method:"POST", body:{} }); const restored = result.changed?.filter((item) => item.status === "succeeded").length ?? 0; toast(restored ? `已恢复 ${restored} 个有效步骤` : "已有进度已校验"); await selectProject(id); state.viewStep = 3; renderWorkspace(); } catch(error){ toast(error.message); } });
  $("#workflow-progress-open")?.addEventListener("click", () => {
    $("#workflow-progress-body").innerHTML = workflowProgressContent(state.detail.project, state.workflow);
    $("#workflow-progress-dialog").showModal();
    $("#cancel-workflow")?.addEventListener("click", async (event) => {
      try {
        await api(`/api/projects/${id}/jobs/${event.currentTarget.dataset.jobId}/cancel`, { method:"POST" });
        $("#workflow-progress-dialog").close();
        toast("已取消当前任务");
        await selectProject(id);
      } catch(error) {
        toast(error.message);
      }
    });
  });
  $("#workflow-warning-open")?.addEventListener("click", () => {
    $("#workflow-warning-body").innerHTML = workflowWarningContent(state.detail.project, state.workflow);
    $("#workflow-warning-dialog").showModal();
    $("#workflow-warning-body").querySelectorAll("[data-seek]").forEach((button) => button.addEventListener("click", () => {
      const player = $("#recut-preview");
      if (player) {
        player.currentTime = Number(button.dataset.seek);
        player.play().catch(() => {});
      }
      $("#workflow-warning-dialog").close();
    }));
  });
  $("#open-static-review")?.addEventListener("click", () => { state.viewStep = 4; renderWorkspace(); });
  $("#approve-production-baseline")?.addEventListener("click", async () => {
    if (!$("#production-baseline-confirm")?.checked) return toast("请先完整播放并确认基础版本");
    try {
      await api(`/api/projects/${id}/workflow/production-baseline/approve`, {
        method:"POST",
        body:{
          confirmation:"human-production-baseline-approved",
          inputSha256:state.workflow.productionBaseline.inputSha256,
        },
      });
      toast("基础版本已通过");
      await selectProject(id);
    } catch(error){ toast(error.message); }
  });
  $("#deliver-production-baseline")?.addEventListener("click", async () => {
    try {
      await api(`/api/projects/${id}/workflow/production-baseline/deliver`, {
        method:"POST",
        body:{
          confirmation:"human-production-baseline-delivery",
          inputSha256:state.workflow.productionBaseline.inputSha256,
        },
      });
      toast("基础版本最终成片已生成");
      await selectProject(id);
      state.viewStep = 4;
      renderWorkspace();
    } catch(error){ toast(error.message); }
  });
  $("#open-delivery")?.addEventListener("click", async () => {
    state.delivery = await api(`/api/projects/${id}/workflow/delivery`).catch(() => state.delivery);
    state.viewStep = 5;
    renderWorkspace();
  });
  $("#replan-semantic-workflow")?.addEventListener("click", async () => { if (!window.confirm(translateText("英文字幕已经更新，需要由当前项目的 Agent 重新理解内容。旧计划会保留用于比较，是否继续？"))) return; try { await api(`/api/projects/${id}/workflow`, { method:"POST", body:{ action:"replan-semantic", confirmation:"human-semantic-replan" } }); toast("正在重新理解内容，已完成的上游步骤会自动跳过"); pollUntilDone(id); } catch(error){ toast(error.message); } });
  $("#back-to-video-workflow")?.addEventListener("click", () => { state.viewStep = 3; renderWorkspace(); });
  $("#back-to-static-review")?.addEventListener("click", () => { state.viewStep = 4; renderWorkspace(); });
  bindReviewGalleryActions();
  $("#review-info-open")?.addEventListener("click", () => {
    $("#review-info-body").innerHTML = reviewInfoContent(state.staticReview);
    $("#review-info-dialog").showModal();
  });
  $("#reject-static-review")?.addEventListener("click", async () => {
    const reason = $("#static-review-feedback")?.value.trim() ?? "";
    if (!reason) return toast("请先填写具体驳回原因");
    try {
      await api(`/api/projects/${id}/workflow/static-review/reject`, { method:"POST", body:{ approvalBindingSha256:state.staticReview.approvalBindingSha256, reason } });
      toast("已保存意见并驳回当前静态审核版本");
      await selectProject(id);
      state.viewStep = 4;
      renderWorkspace();
    } catch(error){ toast(error.message); }
  });
  $("#approve-static-review")?.addEventListener("click", async () => {
    const findingIds = [...document.querySelectorAll("[data-waiver-finding]:checked")].map((item) => item.dataset.waiverFinding);
    const hasBlockers = state.staticReview.approval.blockingFindingIds.length > 0;
    if (!hasBlockers && !$("#static-approve-confirm")?.checked) return toast("请先确认已完成全部静态画面审核");
    const waiverReason = $("#static-waiver-reason")?.value.trim() ?? "";
    try {
      const task = await api(`/api/projects/${id}/workflow/static-review/approve`, { method:"POST", body:{
        approvalBindingSha256:state.staticReview.approvalBindingSha256,
        confirmation:"human-review-approved",
        findingIds,
        waiverReason,
      } });
      state.jobs.push(task);
      toast("静态审核批准已提交，正在锁定当前证据");
      pollUntilDone(id);
    } catch(error){ toast(error.message); }
  });
  $("#start-delivery")?.addEventListener("click", async () => {
    if (!$("#delivery-start-confirm")?.checked) return toast("请先确认使用当前批准版本生成成片");
    try {
      const rawRate = $("#delivery-frame-rate")?.value ?? "source";
      const task = await api(`/api/projects/${id}/workflow/delivery/start`, { method:"POST", body:{ confirmation:"human-delivery-start", readinessSha256:$("#start-delivery").dataset.readinessSha, profile:{ resolution:$("#delivery-resolution")?.value ?? "source", frameRate:rawRate === "source" ? "source" : Number(rawRate) } } });
      state.jobs.push(task);
      state.viewStep = 5;
      toast("最终成片渲染已经开始");
      pollUntilDone(id);
    } catch(error){ toast(error.message); }
  });
  $("#delivery-readiness-check")?.addEventListener("click", async () => {
    const rawRate = $("#delivery-frame-rate")?.value ?? "source";
    const profile = {
      resolution: $("#delivery-resolution")?.value ?? "source",
      frameRate: rawRate === "source" ? "source" : Number(rawRate),
    };
    try {
      const task = await api(`/api/projects/${id}/workflow`, {
        method:"POST",
        body:{ action:"readiness", profile },
      });
      state.jobs.push(task);
      toast("正在检查当前成片规格，不会开始渲染");
      pollUntilDone(id);
    } catch(error) {
      toast(error.message);
    }
  });
  const updateDeliveryProfileDraft = () => {
    const rawRate = $("#delivery-frame-rate")?.value ?? "source";
    state.deliveryProfileDraft = {
      resolution: $("#delivery-resolution")?.value ?? "source",
      frameRate: rawRate === "source" ? "source" : Number(rawRate),
    };
    renderWorkspace();
    updateDeliveryEstimate();
  };
  $("#delivery-resolution")?.addEventListener("change", updateDeliveryProfileDraft);
  $("#delivery-frame-rate")?.addEventListener("change", updateDeliveryProfileDraft);
  $("#save-cover-portrait")?.addEventListener("click", async (event) => {
    const sourcePath = $("#cover-portrait-path")?.value.trim() ?? "";
    if (!sourcePath && !state.cover?.portraitConfigured) return toast("请先填写人物照片的绝对路径");
    const button = event.currentTarget;
    button.disabled = true;
    try {
      state.cover = await api(`/api/projects/${id}/cover/portrait`, {
        method: "POST",
        body: {
          sourcePath,
          crop: {
            x: Number($("#cover-crop-x")?.value ?? 64),
            y: Number($("#cover-crop-y")?.value ?? 42),
            zoom: Number($("#cover-crop-zoom")?.value ?? 1),
          },
        },
      });
      toast("人物照片和裁剪位置已保存到当前本地项目");
      state.workspaceMode = "cover";
      renderWorkspace();
    } catch (error) {
      button.disabled = false;
      toast(error.message);
    }
  });
  const refreshCoverIconPicker = () => {
    const picker = $(".cover-icon-picker");
    if (!picker || !state.cover) return;
    picker.outerHTML = coverIconPickerView(state.cover);
    bindCoverIconPickerActions();
  };
  function bindCoverIconPickerActions() {
    $("#cover-icon-toggle")?.addEventListener("click", () => {
      state.coverIconPickerOpen = !state.coverIconPickerOpen;
      refreshCoverIconPicker();
    });
    document.querySelectorAll("[data-remove-cover-icon]").forEach((button) =>
      button.addEventListener("click", () => {
        state.coverIconIds = state.coverIconIds.filter((iconId) => iconId !== button.dataset.removeCoverIcon);
        refreshCoverIconPicker();
      }),
    );
    document.querySelectorAll("[data-add-cover-icon]").forEach((button) =>
      button.addEventListener("click", () => {
        const iconId = button.dataset.addCoverIcon;
        if (!iconId || state.coverIconIds.includes(iconId)) return;
        if (state.coverIconIds.length >= 4) return toast("封面最多选择 4 个图标");
        state.coverIconIds = [...state.coverIconIds, iconId];
        refreshCoverIconPicker();
      }),
    );
  }
  bindCoverIconPickerActions();
  $("#generate-cover")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = "正在生成横竖两版…";
    try {
      state.cover = await api(`/api/projects/${id}/cover/render`, {
        method: "POST",
        body: {
          selection: {
            templateId: $("#cover-template").value,
            personId: "user-portrait",
            backgroundId: $("#cover-background").value,
            iconIds: state.coverIconIds,
            titleLines: [$("#cover-title-1").value, $("#cover-title-2").value, $("#cover-title-3").value],
            portraitCrop: {
              x: Number($("#cover-crop-x")?.value ?? 64),
              y: Number($("#cover-crop-y")?.value ?? 42),
              zoom: Number($("#cover-crop-zoom")?.value ?? 1),
            },
            brandName: $("#cover-brand-name")?.value ?? "",
            badge: $("#cover-badge").value,
            kicker: $("#cover-kicker").value,
          },
        },
      });
      toast("横版和竖版封面已生成");
      state.workspaceMode = "cover";
      renderWorkspace();
    } catch (error) {
      button.disabled = false;
      button.textContent = "生成横竖两版封面";
      toast(error.message);
    }
  });
  $("#cancel-delivery")?.addEventListener("click", async (event) => {
    const jobId = event.currentTarget.dataset.jobId;
    if (!jobId) return toast("任务连接已经中断，请刷新状态后继续");
    try {
      await api(`/api/projects/${id}/jobs/${jobId}/cancel`, { method:"POST" });
      toast("已取消最终成片任务，完成进度会保留");
      await selectProject(id);
      state.viewStep = 5;
      renderWorkspace();
    } catch(error){ toast(error.message); }
  });
  $("#accept-delivery")?.addEventListener("click", async () => {
    if (!$("#delivery-accept-confirm")?.checked) return toast("请先确认已经播放并检查最终成片");
    try {
      await api(`/api/projects/${id}/workflow/delivery/accept`, { method:"POST", body:{
        confirmation:"human-delivery-accepted",
        note:$("#delivery-acceptance-note")?.value.trim() ?? "",
      } });
      toast("最终成片已批准，项目完成交付");
      await refresh();
      state.viewStep = 5;
      renderWorkspace();
    } catch(error){ toast(error.message); }
  });
  $("#return-delivery")?.addEventListener("click", async () => {
    const reason = $("#delivery-return-reason")?.value.trim() ?? "";
    if (!reason) return toast("请填写退回修改的具体原因");
    try {
      await api(`/api/projects/${id}/workflow/delivery/return`, { method:"POST", body:{ reason } });
      toast("已记录退回修改要求，当前成片和验收报告会保留");
      await selectProject(id);
      state.viewStep = 5;
      renderWorkspace();
    } catch(error){ toast(error.message); }
  });
  $("#reveal-delivery")?.addEventListener("click", async () => {
    try { await api(`/api/projects/${id}/workflow/delivery/reveal`, { method:"POST", body:{ target:"video" } }); toast("已在 Finder 中显示最终成片"); } catch(error){ toast(error.message); }
  });
  $("#reveal-delivery-workspace")?.addEventListener("click", async () => {
    try { await api(`/api/projects/${id}/workflow/delivery/reveal`, { method:"POST", body:{ target:"workspace" } }); toast("已打开项目产物目录"); } catch(error){ toast(error.message); }
  });
};
const pollUntilDone = async (id) => {
  for (let count=0; count<1800; count++) { await new Promise(done=>setTimeout(done,2000)); state.jobs=await api("/api/jobs"); const latest=state.jobs.filter(item=>item.projectId===id).at(-1); if (!latest || !["queued", "running"].includes(latest.status)) { await refresh(); toast(latest?.status==="completed"?"任务完成":latest?.error??"任务已停止"); return; } if (state.selected===id) { if (state.viewStep===5) state.delivery=await api(`/api/projects/${id}/workflow/delivery`).catch(()=>state.delivery); renderWorkspace(); } }
};
$("#new-project").onclick = openDialog;
$("#empty-create").onclick = openDialog;
$("#refresh").onclick = refresh;
$("#settings-open").onclick = openSettings;
$("#language-toggle").onclick = switchLocale;
$("#settings-close").onclick = () => $("#settings-dialog").close();
$("#review-lightbox-close").onclick = () => $("#review-lightbox").close();
$("#operations-close").onclick = () => $("#operations-dialog").close();
$("#recovery-close").onclick = () => $("#recovery-dialog").close();
$("#workflow-progress-close").onclick = () => $("#workflow-progress-dialog").close();
$("#workflow-warning-close").onclick = () => $("#workflow-warning-dialog").close();
$("#review-info-close").onclick = () => $("#review-info-dialog").close();
$("#open-operations").onclick = openOperations;
$("#open-recovery").onclick = openRecovery;
$("#project-context-toggle").onclick = openProjectInspector;
$("#inspector-close").onclick = closeProjectInspector;
$("#inspector-backdrop").onclick = closeProjectInspector;
document.querySelectorAll("[data-operations-tab]").forEach((button) => button.addEventListener("click", () => { state.operationsTab = button.dataset.operationsTab; renderOperations(); }));
$("#review-prev").onclick = () => moveReviewLightbox(-1);
$("#review-next").onclick = () => moveReviewLightbox(1);
$("#review-zoom-out").onclick = () => { state.reviewZoom = Math.max(50, state.reviewZoom - 25); renderReviewLightbox(); };
$("#review-zoom-in").onclick = () => { state.reviewZoom = Math.min(200, state.reviewZoom + 25); renderReviewLightbox(); };
$("#save-review-note").onclick = async () => {
  const frame = state.staticReview?.frames.find((item) => item.id === state.activeReviewFrame);
  const text = $("#review-note-text").value.trim();
  if (!frame || !text) return toast("请先填写审核意见");
  try {
    await api(`/api/projects/${state.selected}/workflow/static-review/notes`, { method:"POST", body:{
      approvalBindingSha256:state.staticReview.approvalBindingSha256,
      artifactId:frame.id,
      cueId:frame.cueId,
      text,
    } });
    toast("审核意见已记录");
    $("#review-lightbox").close();
    await selectProject(state.selected);
    state.viewStep = 4;
    renderWorkspace();
  } catch(error){ toast(error.message); }
};
$("#review-lightbox").addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") moveReviewLightbox(-1);
  if (event.key === "ArrowRight") moveReviewLightbox(1);
});
$("#settings-dialog").addEventListener("click", (event) => {
  if (event.target === event.currentTarget) $("#settings-dialog").close();
});
document.querySelectorAll("[data-settings-tab]").forEach((button) => {
  button.addEventListener("click", () => {
    state.settingsTab = button.dataset.settingsTab;
    renderSettingsPanel();
  });
});
$("#project-title-button").onclick = startRename;
document.querySelectorAll("[data-workspace-mode]").forEach((button) => {
  button.addEventListener("click", () => {
    if (!state.detail) return;
    state.workspaceMode = button.dataset.workspaceMode;
    renderTopbar();
    renderWorkspace();
  });
});
$("#rename-cancel").onclick = stopRename;
$("#rename-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const title = $("#rename-input").value.trim();
  if (!title) return toast("项目名称不能为空");
  try {
    await api(`/api/projects/${state.selected}`, { method: "PATCH", body: { title } });
    stopRename();
    toast("项目名称已更新");
    await refresh();
  } catch (error) {
    toast(error.message);
  }
});
document.querySelectorAll("[data-close-project-dialog]").forEach((button) => {
  button.addEventListener("click", closeProjectDialog);
});
document.querySelectorAll("[data-close-delete-dialog]").forEach((button) => {
  button.addEventListener("click", closeDeleteDialog);
});
$("#copy-delete-project-name").addEventListener("click", async () => {
  const projectName = $("#delete-project-name").textContent;
  if (!projectName) return;
  try {
    await navigator.clipboard.writeText(projectName);
    toast("项目名称已复制，请粘贴到下方确认框");
  } catch {
    toast("复制失败，请手动选择项目名称");
  }
});
$("#delete-project-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = state.deleteTarget;
  if (!id) return;
  const confirmation = $("#delete-project-confirmation").value.trim();
  try {
    await api(`/api/projects/${id}`, { method: "DELETE", body: { confirmation } });
    closeDeleteDialog();
    if (state.selected === id) {
      state.selected = null;
      state.detail = null;
      state.workflow = null;
      state.staticReview = null;
      state.delivery = null;
      state.cover = null;
      state.workspaceMode = "video";
      state.coverIconIds = [];
      state.coverIconPickerOpen = false;
      state.viewStep = null;
    }
    toast("项目及其本地产物已删除");
    await refresh();
  } catch (error) {
    setFormError("#delete-project-error", error.message);
  }
});
$("#project-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  let project;
  try {
    const creatorNotes = String(data.get("creatorNotes") ?? "").trim();
    const topic = creatorNotes.split(/\r?\n/).find((line) => line.trim())?.trim().slice(0, 240) || data.get("title");
    project = await api("/api/projects", { method:"POST", body:{ id:slug(data.get("title")), title:data.get("title"), topic, creatorNotes, category:data.get("category"), workflowMode:data.get("workflowMode"), agentId:data.get("agentId"), model:data.get("model") || undefined } });
  } catch(error){ setFormError("#project-form-error", error.message); return; }
  $("#project-dialog").close();
  await refresh();
  await selectProject(project.project.id);
  if ((project.project.workflowMode ?? "script-first") === "visual-post-production") {
    toast("项目已创建，请选择口播稿、口播原片和辅助素材");
    return;
  }
  toast("项目已创建，正在自动理解你的创作需求");
  try {
    const task = await api(`/api/projects/${project.project.id}/editorial-brief/infer`, { method:"POST", body:{} });
    state.jobs.push(task);
    renderWorkspace();
    pollUntilDone(project.project.id);
  } catch(error){ toast(`项目已创建；自动整理未开始：${error.message}`); }
});
const requestedProjectId = new URLSearchParams(window.location.search).get("project");
const requestedStep = Number(new URLSearchParams(window.location.search).get("step"));
$("#resource-library-toggle")?.addEventListener("click", (event) => {
  event.stopPropagation();
  const panel = $("#resource-library-panel");
  panel.hidden = !panel.hidden;
  $("#resource-library-toggle").setAttribute("aria-expanded", String(!panel.hidden));
  if (!panel.hidden) renderResourceLibrary();
});
$("#resource-library-panel")?.addEventListener("click", (event) => event.stopPropagation());
document.addEventListener("click", () => {
  const panel = $("#resource-library-panel");
  if (!panel || panel.hidden) return;
  panel.hidden = true;
  $("#resource-library-toggle").setAttribute("aria-expanded", "false");
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  const panel = $("#resource-library-panel");
  if (!panel || panel.hidden) return;
  panel.hidden = true;
  $("#resource-library-toggle").setAttribute("aria-expanded", "false");
});
setupSidebarToggle();
setupSidebarResize();
refresh()
  .then(async () => {
    if (!requestedProjectId || !state.projects.some((item) => item.project.id === requestedProjectId)) return;
    await selectProject(requestedProjectId);
    if (Number.isInteger(requestedStep) && requestedStep >= 1 && requestedStep <= 6) {
      state.viewStep = requestedStep - 1;
      renderWorkspace();
    }
  })
  .catch((error)=>toast(error.message));
const events = new EventSource("/api/events");
events.addEventListener("open", () => {
  const reconnected = state.connectionLost;
  state.connectionLost = false;
  if (reconnected) refresh().catch((error) => toast(error.message));
});
events.addEventListener("error", () => {
  if (!state.connectionLost) toast("Studio 服务连接已中断，请重新启动服务");
  state.connectionLost = true;
});
events.addEventListener("job", async () => {
  state.jobs = await api("/api/jobs");
  const selectedProjectId = state.selected;
  if (!selectedProjectId || state.detail?.project?.project.id !== selectedProjectId) return;
  const task = latestJob(selectedProjectId);
  if (task?.status === "completed") await selectProject(selectedProjectId);
  else {
    if (state.detail.project.video.manifest) {
      const workflow = await api(`/api/projects/${selectedProjectId}/workflow/status`).catch(() => state.workflow);
      const delivery = state.viewStep === 5
        ? await api(`/api/projects/${selectedProjectId}/workflow/delivery`).catch(() => state.delivery)
        : state.delivery;
      if (state.selected !== selectedProjectId || state.detail?.project?.project.id !== selectedProjectId) return;
      state.workflow = workflow;
      state.delivery = delivery;
    }
    renderWorkspace();
  }
});
