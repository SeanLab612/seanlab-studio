import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("new-project dialog close controls never submit the required form", async () => {
  const html = await readFile(new URL("../studio/index.html", import.meta.url), "utf8");
  const closeControls = html.match(/<button\s+type="button"[^>]*data-close-project-dialog[^>]*>/g) ?? [];

  assert.equal(closeControls.length, 2);
  assert.match(html, /<button\s+type="submit"\s+class="primary">创建项目<\/button>/);
});

test("new projects collect sources and materials before confirmed understanding and narration", async () => {
  const html = await readFile(new URL("../studio/index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../studio/app.js", import.meta.url), "utf8");
  const server = await readFile(new URL("../scripts/studio-server.mjs", import.meta.url), "utf8");

  assert.match(html, /value="github-project">GitHub 项目介绍/);
  assert.match(html, /value="general">通用/);
  assert.match(html, /value="script-first">从头创作/);
  assert.match(html, /value="visual-post-production">已有口播视频/);
  assert.match(html, /value="news-analysis">新闻介绍/);
  assert.match(html, /value="tutorial">教程类介绍/);
  assert.doesNotMatch(html, /value="tool-review">/);
  assert.doesNotMatch(html, /value="model-review">/);
  assert.match(
    app,
    /上传图片、录屏与素材[\s\S]*补充网页、文档与文字资料[\s\S]*\$\{materialUnderstandingView\(project\)\}[\s\S]*\$\{editorialBriefView\(project,"04"\)\}/,
  );
  assert.match(app, /先完成素材理解/);
  assert.match(app, /素材已理解/);
  assert.match(app, /确认素材理解/);
  assert.match(app, /浏览并加入（可多选）/);
  assert.match(app, /data-delete-material/);
  assert.match(app, /原文件会保留在项目回收目录/);
  assert.match(server, /deleteCreatorMaterial/);
  assert.match(app, /assets\/pick/);
  assert.doesNotMatch(app, /图片证据用途/);
  assert.doesNotMatch(app, /来源标注/);
  assert.doesNotMatch(app, /本期素材整体理解/);
  assert.doesNotMatch(app, /识别边界/);
  assert.doesNotMatch(app, /建议用于/);
  assert.doesNotMatch(app, /每段录屏均匀抽取六个代表画面/);
  assert.match(app, /material-understanding\/analyze/);
  assert.match(app, /material-understanding\/confirm/);
  assert.match(server, /analyzeMaterialUnderstanding/);
  assert.match(server, /confirmMaterialUnderstanding/);
  assert.match(app, /\/editorial-brief/);
  assert.match(app, /先完成并保存写作方向/);
  assert.match(app, /创作方向/);
  assert.match(app, /editorial-brief-summary/);
  assert.match(app, /id="edit-editorial-brief"/);
  assert.match(app, /id="cancel-editorial-edit"/);
  assert.match(app, /editorialAnswerLabel/);
  assert.match(server, /\/api\/editorial-questions/);
  assert.match(server, /updateCreatorEditorialBrief/);
  assert.match(html, /name="creatorNotes"/);
  assert.match(html, /这一期想怎么做/);
  assert.match(app, /editorial-brief\/infer/);
  assert.match(app, /creatorFacingEditorialQuestionIds = \["relationship-detail", "audience", "takeaway"\]/);
  assert.match(app, /Studio 已理解你的描述/);
  assert.doesNotMatch(app, /Studio 已从描述中整理出 \$\{inferredAnswers\.length\} 项/);
  assert.match(server, /inferCreatorEditorialBrief/);
  assert.match(server, /writing-learning\/suggest/);
  assert.match(server, /writing-learning\/accept/);
});

test("Studio pins only governance-approved explicit models", async () => {
  const html = await readFile(new URL("../studio/index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../studio/app.js", import.meta.url), "utf8");
  const server = await readFile(new URL("../scripts/studio-server.mjs", import.meta.url), "utf8");

  assert.match(html, /<select id="agent-model" name="model"><\/select>/);
  assert.match(html, /<select id="agent-options" name="agentId"><\/select>/);
  assert.match(html, /id="project-agent-icon"[\s\S]*id="agent-options"/);
  assert.doesNotMatch(html, /贯穿全局的 Agent/);
  assert.doesNotMatch(html, /<input[^>]+name="model"/);
  assert.doesNotMatch(html, /只有白名单中的模型才会显示并固定到项目/);
  assert.doesNotMatch(html, /语义理解和视觉导演/);
  assert.match(app, /governance\?\.approvedModels/);
  assert.match(app, /model:\s*data\.get\("model"\)\s*\|\|\s*undefined/);
  assert.match(server, /assertApprovedAgentModel/);
  assert.match(server, /agentId: input\.agentId,[\s\S]*?model: input\.model/);
  assert.doesNotMatch(server, /createCreatorProject\(input\)/);
});

test("topbar uses an icon-only settings control and no current-project label", async () => {
  const html = await readFile(new URL("../studio/index.html", import.meta.url), "utf8");

  assert.doesNotMatch(html, />当前项目<\/span>/);
  assert.match(
    html,
    /<button\s+type="button"\s+class="settings-button"\s+id="settings-open"[^>]*>[\s\S]*?<img\s+src="\/assets\/icons\/settings\.svg"\s+alt=""\s*\/>[\s\S]*?<\/button>/,
  );
  assert.doesNotMatch(html, /id="settings-open"[^>]*>设置<\/button>/);
});

test("Studio exposes intake inventory and evidence-bound recut controls", async () => {
  const app = await readFile(new URL("../studio/app.js", import.meta.url), "utf8");
  const server = await readFile(new URL("../scripts/studio-server.mjs", import.meta.url), "utf8");

  assert.match(app, /已添加 \$\{items\.length\}/);
  assert.match(app, /workflow\/status/);
  assert.match(app, /screenSha256/);
  assert.match(app, /通过粗剪/);
  assert.match(app, /通过粗剪/);
  assert.match(app, /按意见重新规划/);
  assert.match(app, /保存意见并驳回/);
  assert.match(app, /recut-feedback/);
  assert.match(app, /图片适配方式/);
  assert.match(app, /浏览并加入（可多选）/);
  assert.doesNotMatch(app, /asset-description/);
  assert.doesNotMatch(app, /asset-source-label/);
  assert.match(app, /\/assets\/\$\{encodeURIComponent\(item\.assetId\)\}/);
  assert.match(server, /resolveCreatorAsset/);
});

test("Studio does not offer a duplicate continue action after static review is ready", async () => {
  const source = await readFile(new URL("../studio/app.js", import.meta.url), "utf8");
  const contracts = await readFile(new URL("../studio/contracts.js", import.meta.url), "utf8");
  assert.match(source, /静态审核资料已生成/);
  assert.match(source, /workflow\.reviewReady[\s\S]*id="open-static-review"/);
  assert.match(source, /workflow\.semanticReplanRequired[\s\S]*id="replan-semantic-workflow">重新理解内容/);
  assert.match(source, /id="workflow-refresh" aria-label="重新校验已有进度"/);
  assert.match(source, /assets\/icons\/refresh\.svg/);
  assert.match(source, /不会启动工作流，也不会重新调用 Agent、翻译或渲染/);
  assert.match(source, /workflow-workbench-actions/);
  assert.doesNotMatch(source, /workflow-progress-note/);
  assert.doesNotMatch(source, /staticReviewReady \? "" : `<button class="primary" id="continue-workflow"/);
  assert.match(source, /需重新审核粗剪/);
  assert.match(contracts, /先前结果已过期/);
});

test("Studio readiness checks stop at the next human gate without starting production", async () => {
  const app = await readFile(new URL("../studio/app.js", import.meta.url), "utf8");
  const server = await readFile(new URL("../scripts/studio-server.mjs", import.meta.url), "utf8");

  assert.match(app, /检查下一步是否可安全运行/);
  assert.match(app, /operations-readiness/);
  assert.match(app, /avoidedExpensiveStages/);
  assert.match(app, /workflow-creator-status/);
  assert.match(app, /准备中/);
  assert.match(app, /制作中/);
  assert.match(app, /需要你处理/);
  assert.match(app, /可以审核/);
  assert.match(app, /预计剩余/);
  assert.match(app, /workflow-readiness-confirm/);
  assert.match(app, /data-readiness-sha/);
  assert.match(app, /delivery-readiness-check/);
  assert.match(server, /workflowArgsForStudioReadiness/);
  assert.match(server, /input\.action === "readiness"/);
  assert.match(server, /event\.event === "workflow\.preview"/);
  assert.match(server, /assertStudioReadinessConfirmation/);
  assert.match(server, /recordStudioReadinessConfirmation/);
  assert.match(server, /input\.readinessSha256/);
});

test("Studio keeps production and delivery creator-facing while preserving advanced evidence", async () => {
  const app = await readFile(new URL("../studio/app.js", import.meta.url), "utf8");

  assert.match(app, /制作 Agent 正在后台诊断、修改并重新检查/);
  assert.match(app, /无需处理技术错误；详细诊断仅保留在高级详情中/);
  assert.doesNotMatch(app, /\$\{escapeHtml\(delivery\.failure\?\.message/);
  assert.doesNotMatch(app, /id="open-workflow-recovery"/);
  assert.doesNotMatch(app, /id="open-delivery-recovery"/);
  assert.match(app, /发布所需的关键信息已经确认/);
  assert.match(app, /查看技术验收详情/);
  assert.match(app, /项目已经完成交付/);
  assert.doesNotMatch(app, /class="panel approval-binding"/);
  assert.doesNotMatch(app, /\$\{deliveryActivityView\(delivery\)\}/);
  assert.doesNotMatch(app, /PRE-RUN READINESS/);
});

test("Studio keeps project errors inside the creation dialog and supports confirmed deletion", async () => {
  const html = await readFile(new URL("../studio/index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../studio/app.js", import.meta.url), "utf8");
  const server = await readFile(new URL("../scripts/studio-server.mjs", import.meta.url), "utf8");

  assert.match(html, /id="project-form-error"[^>]*role="alert"/);
  assert.match(html, /id="delete-project-dialog"/);
  assert.match(html, /id="copy-delete-project-name"/);
  assert.match(html, /将一并删除整个项目文件夹/);
  assert.match(html, /项目文件夹之外的原始视频、截图和资料不会被删除/);
  assert.match(html, /粘贴或输入项目名称以确认/);
  assert.match(app, /data-delete-project/);
  assert.match(app, /`projects\/\$\{project\.project\.id\}\/`/);
  assert.match(app, /navigator\.clipboard\.writeText\(projectName\)/);
  assert.match(app, /项目名称已复制，请粘贴到下方确认框/);
  assert.match(app, /method: "DELETE"/);
  assert.match(server, /deleteCreatorProject/);
  assert.match(server, /resumeStageForStudio\(snapshot\.stages\)/);
  assert.match(server, /workflow\/refresh/);
  assert.match(server, /reconcileStudioWorkflow/);
  assert.match(server, /inspectCreatorProjects/);
  assert.match(app, /invalidProjects/);
  assert.match(app, /项目文件需要修复/);
});

test("Studio publishes project detail atomically and ignores stale live-job events", async () => {
  const app = await readFile(new URL("../studio/app.js", import.meta.url), "utf8");

  assert.match(app, /projectLoadToken:\s*0/);
  assert.match(app, /const loadToken = \+\+state\.projectLoadToken/);
  assert.match(app, /const detail = await api\(`\/api\/projects\/\$\{id\}`\)/);
  assert.match(app, /if \(loadToken !== state\.projectLoadToken \|\| state\.selected !== id\) return;/);
  assert.ok(app.indexOf("state.detail = detail;") > app.indexOf("loadToken !== state.projectLoadToken"));
  assert.match(app, /if \(!state\.detail\?\.project \|\| state\.detail\.project\.project\.id !== state\.selected\) return;/);
  assert.match(app, /state\.detail\?\.project\?\.project\.id !== selectedProjectId/);
});

test("new video handoffs stay inside the creator project directory", async () => {
  const handoff = await readFile(new URL("../scripts/creator/lock-handoff.mjs", import.meta.url), "utf8");
  assert.match(handoff, /resolve\(projectDir\(projectId\), "video", "project\.json"\)/);
  assert.match(handoff, /manifest\.paths\.referenceScript/);
});

test("shooting handoff removes the redundant final-script navigation button", async () => {
  const app = await readFile(new URL("../studio/app.js", import.meta.url), "utf8");
  assert.doesNotMatch(app, /id="view-locked-script"/);
  assert.doesNotMatch(app, /\$\("#view-locked-script"\)/);
});

test("Studio exposes source grounding status and an Agent rewrite action", async () => {
  const app = await readFile(new URL("../studio/app.js", import.meta.url), "utf8");
  const server = await readFile(new URL("../scripts/studio-server.mjs", import.meta.url), "utf8");

  assert.match(app, /只有读取成功的资料会交给 Agent/);
  assert.match(app, /rewrite-instructions/);
  assert.match(app, /\/rewrite/);
  assert.match(server, /rewriteNarration/);
  assert.match(server, /narration-rewrite/);
  assert.match(app, /section\.visualOpportunities = \[\]/);
  assert.match(app, /narration-support-details/);
  assert.match(app, /<details class="review-details rewrite-panel">/);
});

test("Studio exposes immutable narration history and local multi-format export", async () => {
  const app = await readFile(new URL("../studio/app.js", import.meta.url), "utf8");
  const server = await readFile(new URL("../scripts/studio-server.mjs", import.meta.url), "utf8");
  assert.match(app, /导出口播稿/);
  assert.match(app, /data-export-narration="pdf"/);
  assert.match(app, /data-export-narration="md"/);
  assert.match(app, /恢复为新版本/);
  assert.match(server, /listNarrationAttempts/);
  assert.match(server, /restoreNarrationAttempt/);
  assert.match(server, /buildNarrationExport/);
});

test("Studio product shell keeps health, translation, storage, and project evidence discoverable", async () => {
  const html = await readFile(new URL("../studio/index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../studio/app.js", import.meta.url), "utf8");
  const contracts = await readFile(new URL("../studio/contracts.js", import.meta.url), "utf8");
  const styles = await readFile(new URL("../studio/styles.css", import.meta.url), "utf8");
  const server = await readFile(new URL("../scripts/studio-server.mjs", import.meta.url), "utf8");

  assert.match(html, /data-settings-tab="health">健康总览/);
  assert.match(html, /data-settings-tab="typography">文字与样式/);
  assert.match(html, /data-settings-tab="llm">翻译接口/);
  assert.match(html, /data-settings-tab="storage">存储与诊断/);
  assert.match(html, /id="project-context-toggle"/);
  assert.match(html, /id="project-inspector"/);
  assert.match(html, /id="sidebar-resizer"[^>]*role="separator"/);
  assert.match(html, /id="sidebar-toggle"[^>]*aria-expanded="true"/);
  assert.match(
    html,
    /class="sidebar-heading"[\s\S]*id="sidebar-toggle"[\s\S]*id="new-project"[\s\S]*class="project-list"/,
  );
  assert.match(html, /assets\/seanlab-logo-white\.svg/);
  assert.match(html, /id="workflow-progress-dialog"/);
  assert.match(html, /id="workflow-warning-dialog"/);
  assert.match(html, /项目证据与高级操作/);
  assert.match(contracts, /创建 · 方向与资料/);
  assert.match(contracts, /审核 · 静态审核/);
  assert.match(app, /sidebarWidthStorageKey/);
  assert.match(app, /sidebarCollapsedStorageKey/);
  assert.match(app, /class="intake-index"/);
  assert.match(app, /class="panel workflow-candidates"/);
  assert.doesNotMatch(app, /#agent-pin"\)\.innerHTML/);
  assert.match(app, /id="workflow-progress-open"/);
  assert.match(app, /name === "agent-review"/);
  assert.match(app, /completed \/ productionStages\.length/);
  assert.match(app, /workflow-progress-badge/);
  assert.match(styles, /\.workflow-refresh-icon\.refresh-help:hover \.workflow-hover-tip/);
  assert.match(app, /id="workflow-warning-open"/);
  assert.doesNotMatch(app, /id="back-to-shooting"/);
  assert.match(styles, /\.workflow-stage-grid \{ grid-template-columns:repeat\(4,minmax\(0,1fr\)\); \}/);
  assert.match(styles, /\.app-shell\.sidebar-collapsed/);
  assert.match(styles, /\.workflow-refresh-icon\.warning\.active \{\s*background:transparent/);
  assert.match(styles, /@container \(max-width:800px\)/);
  assert.match(app, /api\("\/api\/health"\)/);
  assert.match(app, /api\(`\/api\/doctor\?agent=/);
  assert.match(app, /重新读取 zshrc/);
  assert.match(server, /英文字幕翻译、制作阶段编排与故障处理/);
  assert.match(server, /仅用于兼容旧项目的英文字幕翻译/);
  assert.match(server, /environmentVariable: "MIMO_API_KEY"/);
  assert.doesNotMatch(server, /MIMO_API_KEY\s*:\s*process\.env\.MIMO_API_KEY/);
});

test("Studio exposes project typography policy without delegating font choice to Agent", async () => {
  const app = await readFile(new URL("../studio/app.js", import.meta.url), "utf8");
  const server = await readFile(new URL("../scripts/studio-server.mjs", import.meta.url), "utf8");

  assert.match(app, /Agent 只输出语义证据和表达意图，不直接选择字体/);
  assert.match(app, /id: "auto"/);
  assert.match(app, /id: "system-only"/);
  assert.match(app, /id: "wenkai-emphasis"/);
  assert.match(app, /不会重跑 Agent 或字幕理解/);
  assert.match(app, /\/api\/projects\/\$\{state\.selected\}\/typography/);
  assert.match(server, /action === "typography"/);
  assert.match(server, /已批准或已交付的项目不能直接更换字体/);
  assert.match(server, /manifest\.policies\.typography = typography/);
  assert.match(server, /reconcileStudioWorkflow\(projectId\)/);
});

test("Studio exposes an evidence-bound static review gallery and explicit human decisions", async () => {
  const html = await readFile(new URL("../studio/index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../studio/app.js", import.meta.url), "utf8");
  const server = await readFile(new URL("../scripts/studio-server.mjs", import.meta.url), "utf8");

  assert.match(html, /id="review-lightbox"/);
  assert.match(html, /id="review-info-dialog"/);
  assert.match(app, /data-review-filter/);
  assert.match(app, /\["priority", "重点审核"\]/);
  assert.match(app, /state\.reviewFilter === "priority"/);
  assert.match(app, /完整证据仍可切换“全部”查看/);
  assert.doesNotMatch(app, /review-chapter/);
  assert.match(app, /data-review-coverflow-stage/);
  assert.match(app, /data-review-coverflow-index/);
  assert.match(app, /data-review-coverflow-dot/);
  assert.match(app, /moveReviewCoverflow/);
  assert.match(app, /event\.target\.closest\("\[data-review-coverflow-index\]"\)/);
  assert.match(app, /Math\.abs\(distance\) > 8 && !dragging/);
  assert.match(app, /Math\.abs\(distance\) > 70/);
  assert.match(app, /ArrowLeft/);
  assert.match(app, /ArrowRight/);
  assert.doesNotMatch(app, /review-stack-current/);
  assert.match(app, /reviewInfoContent/);
  assert.match(app, /review-zoom-in/);
  assert.match(app, /data-waiver-finding/);
  assert.match(app, /human-review-approved/);
  assert.match(app, /保存意见并驳回/);
  assert.match(app, /录屏与图片转场/);
  assert.match(app, /mediaTransitionEntry/);
  assert.match(app, /mediaTransitionExit/);
  assert.match(server, /resolveStaticReviewArtifact/);
  assert.match(server, /assertStaticReviewApproval/);
  assert.doesNotMatch(server, /workflow\/review-artifacts\/\(\.\+\)/);
});

test("Studio exposes approval-gated source delivery and final acceptance as step six", async () => {
  const app = await readFile(new URL("../studio/app.js", import.meta.url), "utf8");
  const server = await readFile(new URL("../scripts/studio-server.mjs", import.meta.url), "utf8");
  const delivery = await readFile(new URL("../scripts/creator/studio-delivery.mjs", import.meta.url), "utf8");

  assert.match(app, /"成片与交付"/);
  assert.match(app, /human-delivery-start/);
  assert.match(app, /human-delivery-accepted/);
  assert.match(app, /通过并完成交付/);
  assert.match(app, /在 Finder 中显示成片/);
  assert.match(app, /完整解码/);
  assert.match(server, /workflow\/delivery\/start/);
  assert.match(server, /workflow\/delivery\/video/);
  assert.match(server, /\^segment \(\\d\+\)\\\/\(\\d\+\)\$/);
  assert.match(server, /\^Rendered \(\\d\+\)\\\/\(\\d\+\)/);
  assert.match(server, /\^Encoded \(\\d\+\)\\\/\(\\d\+\)/);
  assert.match(server, /正在编码最终视频/);
  assert.match(server, /resolveDeliveryArtifact\(projectId, input\.target\)/);
  assert.doesNotMatch(server, /resolve\(input\.path\)/);
  assert.match(delivery, /verifyApprovalSnapshot/);
  assert.match(delivery, /clips_final_4k/);
  assert.match(delivery, /交付产物不在当前项目目录中/);
  assert.match(delivery, /不能在未返修的情况下重新批准/);
  assert.match(app, /成片状态需要确认/);
  assert.match(delivery, /DELIVERY_FILE_WITHOUT_RENDER_STATE/);
});

test("Studio cover workspace renders registered local layers without invoking an Agent", async () => {
  const html = await readFile(new URL("../studio/index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../studio/app.js", import.meta.url), "utf8");
  const server = await readFile(new URL("../scripts/studio-server.mjs", import.meta.url), "utf8");
  const covers = await readFile(new URL("../scripts/creator/studio-covers.mjs", import.meta.url), "utf8");

  assert.match(app, /生成 4:3 横版与 3:4 竖版封面/);
  assert.doesNotMatch(app, /16:9 横版|生成后显示横版封面/);
  assert.match(app, /下载横屏视频构图 PNG/);
  assert.match(app, /下载竖屏视频构图 PNG/);
  assert.match(covers, /creator-cover-3x4-portrait-4x3-landscape-v1/);
  assert.match(covers, /registerStudioCoverPortrait/);
  assert.match(app, /不会调用 Agent 或生图模型/);
  assert.match(html, /id="open-video-workspace"/);
  assert.match(html, /id="open-cover-workspace"/);
  assert.match(app, /workspaceMode === "cover"/);
  assert.match(app, /cover-icon-category-group/);
  assert.match(app, /data-add-cover-icon/);
  assert.match(app, /data-remove-cover-icon/);
  assert.match(app, /coverIconIds/);
  assert.doesNotMatch(app, /cover-icon-search|coverIconQuery|applyCoverIconFilters|搜索已入库图标/);
  assert.match(app, /公司与平台/);
  assert.match(covers, /assetKind: "brand-vector"/);
  assert.match(covers, /assetKind: "vector"/);
  assert.match(covers, /封面图标必须来自已核对的本地图标目录/);
  assert.doesNotMatch(app, /\$\{coverStudioView\(project, state\.cover\)\}\s+\$\{canStart/);
  assert.match(server, /cover\/render/);
  assert.match(server, /coverArtifactMatch/);
  assert.match(server, /coverDownloadMatch/);
  assert.match(covers, /CoverAssetPackLandscape/);
  assert.match(covers, /CoverAssetPackPortrait/);
  assert.match(covers, /portraitTreatment: "transparent-cutout"/);
  assert.match(covers, /background-only-no-people-no-text-v1|coverRegistryPath/);
  assert.match(app, /导入你自己的透明人物抠图/);
  assert.match(app, /background\.landscape/);
  assert.doesNotMatch(covers, /detectAgent|generateNarration|semantic/);
});

test("Studio defers animation style selection until visual review", async () => {
  const html = await readFile(new URL("../studio/index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../studio/app.js", import.meta.url), "utf8");
  const server = await readFile(new URL("../scripts/studio-server.mjs", import.meta.url), "utf8");

  assert.doesNotMatch(html, /name="animationTemplateId"|animation-template-options|项目动画模板/);
  assert.doesNotMatch(app, /animationTemplateId:data\.get\("animationTemplateId"\)/);
  assert.doesNotMatch(server, /animationTemplateId: input\.animationTemplateId/);
  assert.match(app, /data-animation-prototype/);
  assert.doesNotMatch(app, /data-animation-style/);
  assert.match(app, /默认使用统一的手绘视觉语言/);
  assert.match(app, /备选动画/);
  assert.match(app, /第二优先级 · 组件备选/);
  assert.match(app, /data-animation-component-backup/);
  assert.match(app, /语义结构/);
  assert.match(app, /表现风格/);
  assert.match(app, /template\.previewUrl/);
  assert.match(server, /animationTemplates: animationTemplateRegistry/);
  assert.match(server, /animationStructures: Object\.values\(animationPrototypeRegistry\)/);
});

test("Studio topbar exposes a visual resource library with human-confirmed asset promotion", async () => {
  const html = await readFile(new URL("../studio/index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../studio/app.js", import.meta.url), "utf8");
  const server = await readFile(new URL("../scripts/studio-server.mjs", import.meta.url), "utf8");

  assert.match(html, /id="resource-library-toggle"/);
  assert.match(html, /id="resource-library-panel"/);
  assert.match(app, /RESOURCE LIBRARY/);
  assert.match(app, /human-promote-generated-asset/);
  assert.match(app, /human-promote-generated-assets-batch/);
  assert.match(app, /只有经你确认后才会加入全局素材库/);
  assert.match(app, /label: "图片素材"/);
  assert.match(app, /确认入库/);
  assert.match(app, /全选/);
  assert.match(app, /resource-component-grid/);
  assert.match(app, /resource-animation-grid/);
  assert.match(app, /resource-image-grid/);
  assert.match(app, /resource-icon-grid/);
  assert.match(app, /\/api\/image-assets/);
  assert.match(app, /template\.previewUrl/);
  assert.match(app, /icons\/system\/sprite\.svg/);
  assert.match(server, /icons: Object\.values\(iconRegistry\)/);
  assert.match(server, /promoteGeneratedAssetsBatch/);
  assert.match(server, /resolveImageAssetPreview/);
  assert.match(server, /buildProjectImageAssetMatches/);
  assert.match(app, /动画图片素材/);
  assert.match(app, /Agent 已选择/);
  assert.match(app, /图片只作为这个动画阶段的制作素材/);
  assert.match(app, /动画内部自动使用图标/);
  assert.doesNotMatch(app, /human-import-image-asset-candidate/);
  assert.doesNotMatch(app, /加入本项目候选/);
  assert.match(app, /human-update-image-asset-metadata/);
  assert.match(app, /human-add-image-asset-tags-batch/);
  assert.match(app, /整理元数据/);
  assert.match(app, /试匹配一段口播/);
  assert.match(app, /检测到完全重复/);
  assert.match(server, /updatePromotedImageAssetMetadata/);
  assert.match(server, /addPromotedImageAssetTagsBatch/);
  assert.match(server, /previewPromotedImageAssetMatch/);
});

test("Studio replans animation image ingredients as a reviewable Agent draft", async () => {
  const app = await readFile(new URL("../studio/app.js", import.meta.url), "utf8");
  const server = await readFile(new URL("../scripts/studio-server.mjs", import.meta.url), "utf8");
  const replanning = await readFile(
    new URL("../scripts/creator/animation-asset-replanning.mjs", import.meta.url),
    "utf8",
  );

  assert.match(app, /重新规划动画素材/);
  assert.match(app, /查看新旧差异/);
  assert.match(app, /确认使用这次规划/);
  assert.match(app, /human-confirm-animation-asset-replan/);
  assert.match(server, /action === "animation-assets\/replan"/);
  assert.match(server, /action === "animation-assets\/replan\/confirm"/);
  assert.match(server, /job\("animation-asset-replan"/);
  assert.match(replanning, /animation-asset-attempts/);
  assert.match(replanning, /baseStoryboardSha256/);
  assert.match(replanning, /candidateStoryboardSha256/);
  assert.match(replanning, /当前分镜在候选方案生成后已经修改/);
  assert.match(replanning, /\{ flag: "wx" \}/);
});

test("Studio component catalog count follows the current 19-item allowlist", async () => {
  const app = await readFile(new URL("../studio/app.js", import.meta.url), "utf8");
  const contracts = await import(`../studio/contracts.js?catalog=${Date.now()}`);
  assert.equal(contracts.visualComponentCatalog.length, 19);
  assert.match(app, /\$\{visualComponentCatalog\.length\} 个组件/);
  assert.doesNotMatch(app, /查看全部 20 个组件|20 个组件预览/);
});

test("Studio exposes evidence inspectors, typed revision preview, and operations recovery", async () => {
  const html = await readFile(new URL("../studio/index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../studio/app.js", import.meta.url), "utf8");
  const server = await readFile(new URL("../scripts/studio-server.mjs", import.meta.url), "utf8");
  const operations = await readFile(new URL("../scripts/creator/studio-operations.mjs", import.meta.url), "utf8");
  const storage = await readFile(new URL("../scripts/operations/storage-governance.mjs", import.meta.url), "utf8");

  assert.match(html, /id="operations-dialog"/);
  assert.match(html, /data-operations-tab="revision"/);
  assert.match(html, /内容证据/);
  assert.match(app, /结构化返修/);
  assert.match(app, /影响预览/);
  assert.match(app, /populateRevisionCueFields/);
  assert.match(app, /const latestJob = operations\.operations\.jobs\[0\]/);
  assert.match(app, /从当前有效断点继续/);
  assert.match(server, /workflow\/revisions\/preview/);
  assert.match(server, /workflow\/revisions\/apply/);
  assert.match(operations, /previewRevisionImpact/);
  assert.match(operations, /buildProjectStoragePlan/);
  assert.match(storage, /cleanupPreview/);
  assert.match(storage, /delete-regenerable-cache/);
  assert.match(storage, /Cleanup preview is stale/);
});

test("Studio exposes a confirmation-bound recovery center and read-only Ask Agent diagnosis", async () => {
  const html = await readFile(new URL("../studio/index.html", import.meta.url), "utf8");
  const app = await readFile(new URL("../studio/app.js", import.meta.url), "utf8");
  const server = await readFile(new URL("../scripts/studio-server.mjs", import.meta.url), "utf8");
  const recovery = await readFile(new URL("../scripts/creator/studio-recovery.mjs", import.meta.url), "utf8");
  const schema = JSON.parse(
    await readFile(new URL("../schemas/studio-recovery-diagnosis.schema.json", import.meta.url), "utf8"),
  );

  assert.match(html, /id="open-recovery"/);
  assert.match(html, /id="recovery-dialog"/);
  assert.match(app, /recovery-resume-confirm/);
  assert.match(app, /human-recovery-resume/);
  assert.match(app, /Ask Agent 诊断/);
  assert.match(server, /workflow\/recovery\/ask/);
  assert.match(server, /workflow\/recovery\/resume/);
  assert.match(server, /createStructuredAgentJsonAdapter/);
  assert.match(server, /runProductionAgentTechnicalRepair/);
  assert.match(server, /creator-authorized-production/);
  assert.match(app, /data-beat-animation-style/);
  assert.match(app, /data-beat-component-choice/);
  assert.match(recovery, /recoverySha256/);
  assert.match(recovery, /mutatesProject: false/);
  assert.deepEqual(schema.properties.recommendedAction.enum, [
    "recheck",
    "resume",
    "repair-config",
    "repair-code",
    "repair-binding",
    "repair-visual",
    "request-user",
  ]);
});

test("Studio revision choices match the component ids allowed by the revision contract", async () => {
  const app = await readFile(new URL("../studio/app.js", import.meta.url), "utf8");
  const server = await readFile(new URL("../scripts/studio-server.mjs", import.meta.url), "utf8");
  const registry = await readFile(new URL("../src/components/library/registry.ts", import.meta.url), "utf8");
  const schema = JSON.parse(
    await readFile(new URL("../schemas/revision-request.schema.json", import.meta.url), "utf8"),
  );
  const registryIds = [...registry.matchAll(/^  "([^"]+)": \{$/gm)].map((match) => match[1]);
  const visualUpdate = schema.properties.operations.items.oneOf.find(
    (item) => item.properties?.type?.const === "visual-cue.update",
  );
  const schemaIds = visualUpdate.properties.patch.properties.component.properties.id.enum;

  assert.match(server, /componentIds: Object\.keys\(approvedComponentRegistry\)/);
  assert.match(app, /state\.metadata\.componentIds/);
  assert.deepEqual(registryIds, schemaIds);
  assert.equal(registryIds.length, 19);
  assert.match(app, /"image-evidence-inset": "图片证据"/);
  assert.match(app, /"rough-annotation": "手绘语义标注"/);
});

test("Studio treats uploaded visual assets as candidates and binds them after drafting", async () => {
  const app = await readFile(new URL("../studio/app.js", import.meta.url), "utf8");
  assert.match(app, /Agent 会读取并理解素材内容/);
  assert.match(app, /写稿后补充截图或录屏/);
  assert.match(app, /素材与口播段落/);
  assert.match(app, /data-section-material/);
  assert.match(app, /继续生成视觉方案/);
  assert.match(app, /不会重新调用 Agent 写稿/);
  assert.doesNotMatch(app, /asset-anchor-text/);
});

test("Studio reviews narration and visual choices together without adding human state to the Agent schema", async () => {
  const app = await readFile(new URL("../studio/app.js", import.meta.url), "utf8");
  const server = await readFile(new URL("../scripts/studio-server.mjs", import.meta.url), "utf8");
  const narrationSchema = JSON.parse(
    await readFile(new URL("../schemas/narration-script-package.schema.json", import.meta.url), "utf8"),
  );
  assert.match(app, /分镜脚本/);
  assert.match(app, /主视觉类型/);
  assert.match(app, /data-visual-mode/);
  assert.doesNotMatch(app, /confirm-all-visuals/);
  assert.doesNotMatch(app, /确认全部自动方案/);
  assert.match(app, /下游可以按全文重新规划/);
  assert.match(app, /只有你亲手添加的文字标注会作为必须保留项/);
  assert.match(app, /信息关系/);
  assert.match(app, /文字标注/);
  assert.match(app, /选中 2–24 个字符/);
  assert.match(app, /data-add-text-annotation/);
  assert.match(app, /data-annotation-effect/);
  assert.match(app, /视觉修改自动保存/);
  assert.match(app, /const autosaveVisualStoryboard/);
  assert.match(app, /keepalive:\s*true/);
  assert.match(app, /void autosaveVisualStoryboard\(id\)/);
  assert.match(app, /storyboardReview\(section\)\?\.materialId \?\? section\.materialIds\[0\]/);
  assert.doesNotMatch(app, /stop-motion-machine/);
  assert.match(app, /动画风格/);
  assert.match(app, /animation: "动画"/);
  assert.match(app, /data-visual-mode="auto"/);
  assert.match(app, /id:"opening", title:"开场"/);
  assert.doesNotMatch(app, /data-opening-episode-tag/);
  assert.doesNotMatch(server, /creatorOpeningIdentity: CREATOR_OPENING_IDENTITY/);
  assert.match(app, /id:"overview", title:"本期概述"/);
  assert.doesNotMatch(app, /id:"transition-anchor", title:"入场锚点"/);
  assert.doesNotMatch(app, /index:-2/);
  assert.doesNotMatch(app, /固定入场动画/);
  assert.doesNotMatch(server, /creatorTransitionAnchorVisual: CREATOR_TRANSITION_ANCHOR_VISUAL/);
  assert.match(app, /id:"conclusion", title:"结尾总结"/);
  assert.match(app, /storyboardEntries\(narration\)/);
  assert.doesNotMatch(app, /item\.id !== "rough-annotation"/);
  assert.doesNotMatch(app, /data-beat-visual-type/);
  assert.doesNotMatch(app, /data-confirm-beat/);
  assert.match(server, /action === "visual-storyboard"/);
  assert.equal(narrationSchema.properties.sections.items.properties.visualReview, undefined);
});

test("browser acceptance fixture covers the complete Studio revision loop", async () => {
  const fixture = JSON.parse(
    await readFile(new URL("./fixtures/studio-browser-acceptance.json", import.meta.url), "utf8"),
  );
  assert.equal(fixture.schemaVersion, "1.0");
  assert.deepEqual(
    fixture.steps.map((step) => step.id),
    [
      "project-create",
      "script-lock",
      "shooting-handoff",
      "recut-approval",
      "static-review",
      "revision-preview",
      "revision-apply",
      "narrow-rerun",
      "reapproval",
      "delivery",
      "final-acceptance",
    ],
  );
});

test("Studio persists jobs serially and only recovers interrupted work after owning the port", async () => {
  const server = await readFile(new URL("../scripts/studio-server.mjs", import.meta.url), "utf8");

  assert.match(server, /persistJobsQueue/);
  assert.match(server, /\$\{jobsPath\}\.\$\{process\.pid\}\.\$\{randomUUID\(\)\}\.tmp/);
  assert.match(server, /server\.listen\(port, "127\.0\.0\.1", async \(\) =>/);
  assert.match(server, /for \(const id of storedRunningJobIds\)/);
  assert.match(server, /server\.once\("error"/);
});

test("Studio exposes a source-bound baseline review instead of sending enhanced-production failures to the user", async () => {
  const app = await readFile(new URL("../studio/app.js", import.meta.url), "utf8");
  const server = await readFile(new URL("../scripts/studio-server.mjs", import.meta.url), "utf8");
  assert.match(app, /productionBaselineReviewView/);
  assert.match(app, /human-production-baseline-approved/);
  assert.match(server, /createProductionBaseline/);
  assert.match(server, /workflow\/production-baseline\/video/);
  assert.match(server, /automatic-baseline-ready/);
});

test("production Remotion root registers the workflow composition used by every render stage", async () => {
  const root = await readFile(new URL("../src/Root.tsx", import.meta.url), "utf8");
  assert.match(root, /id: "GeneratedWorkflowReview"/);
});

test("workflow retries clear stale terminal fields before marking a stage running", async () => {
  const workflow = await readFile(new URL("../scripts/workflow.mjs", import.meta.url), "utf8");
  assert.match(workflow, /\["failure", "error", "finishedAt", "elapsedMs", "lastProgressAt"\]/);
  assert.match(workflow, /delete entry\[key\]/);
});
