const localeStorageKey = "seanlab-studio-locale";

export const supportedLocales = ["zh-CN", "en"];

const english = new Map(
  Object.entries({
    "本地创作工作台": "Local creator workspace",
    "未选择项目": "No project selected",
    "项目名称": "Project name",
    "保存": "Save",
    "取消": "Cancel",
    "视频制作": "Video",
    "封面制作": "Cover",
    "视觉资源库": "Visual library",
    "当前项目 Agent": "Current project Agent",
    "SeanLab 标识": "SeanLab logo",
    "项目工作台": "Project workspace",
    "未固定": "Not pinned",
    "已认证": "Authenticated",
    "当前不可用": "Currently unavailable",
    "等待选择项目": "Select a project",
    "打开设置": "Open settings",
    "设置": "Settings",
    "创作项目": "Projects",
    "隐藏项目边栏": "Hide project sidebar",
    "显示项目边栏": "Show project sidebar",
    "新建创作项目": "New project",
    "刷新项目": "Refresh projects",
    "调整项目列表宽度": "Resize project list",
    "选择或创建一个项目": "Select or create a project",
    "故障恢复": "Recovery",
    "项目详情": "Project details",
    "高级详情": "Advanced details",
    "把一个选题，完成为可交付的视频": "Turn an idea into a deliverable video",
    "创建第一个项目": "Create your first project",
    "关闭详情遮罩": "Close details overlay",
    "未开始": "Not started",
    "关闭项目详情": "Close project details",
    "这里会显示资料、素材、拍摄指导、任务运行和审核证据。":
      "Sources, media, shooting guidance, task activity, and review evidence appear here.",
    "创建创作项目": "Create project",
    "告诉 Studio 这期想做什么，后续只补充真正缺少的信息。":
      "Tell Studio what you want to make. It will only ask for information that is truly missing.",
    "关闭": "Close",
    "例如：html-video 项目介绍": "Example: Introducing html-video",
    "这一期想怎么做": "What do you want to make?",
    "写下主题、想讲的重点、已有素材和期望效果。":
      "Describe the topic, key points, available media, and desired result.",
    "制作方式": "Workflow",
    "从头创作（先写口播稿）": "Start from scratch (write the script first)",
    "已有口播视频（只做后期）": "Existing talking-head video (post-production only)",
    "已有视频模式会保留你的字幕稿原文，先审核文字，再由生产 Agent 统一规划画面。":
      "Existing-video mode keeps your transcript unchanged for text review, then lets the Production Agent plan the visuals.",
    "内容分类": "Content category",
    "通用": "General",
    "GitHub 项目介绍": "GitHub project",
    "新闻介绍": "News",
    "教程类介绍": "Tutorial",
    "创作助手": "Creator Agent",
    "创建后将用于整个项目；详细状态可在设置中查看。":
      "The selected Agent stays pinned to this project. View details in Settings.",
    "创作模型": "Model",
    "创建项目": "Create project",
    "删除项目": "Delete project",
    "将一并删除整个项目文件夹": "The entire project folder will be deleted",
    "包括资料与素材副本、口播稿、工作流缓存、审核产物和成片，且无法恢复。":
      "This includes copied sources and media, scripts, workflow caches, review artifacts, and deliveries. This cannot be undone.",
    "项目文件夹之外的原始视频、截图和资料不会被删除。":
      "Original videos, screenshots, and sources outside the project folder will not be deleted.",
    "复制名称": "Copy name",
    "粘贴或输入项目名称以确认": "Type or paste the project name to confirm",
    "确认删除": "Delete project",
    "设置分类": "Settings categories",
    "健康总览": "Health",
    "Agent 与模型": "Agents & models",
    "文字与样式": "Typography",
    "翻译接口": "Translation",
    "存储与诊断": "Storage & diagnostics",
    "关于": "About",
    "审核画面": "Review frame",
    "上一张": "Previous",
    "下一张": "Next",
    "缩小": "Zoom out",
    "放大": "Zoom in",
    "记录这张画面的审核意见": "Review note for this frame",
    "保存意见": "Save note",
    "项目证据与高级操作": "Project evidence and advanced operations",
    "项目检查分类": "Project inspection categories",
    "内容证据": "Content evidence",
    "视觉方案": "Visual plan",
    "结构化返修": "Structured revision",
    "运行与空间": "Runtime & storage",
    "正在读取项目证据…": "Loading project evidence…",
    "Studio 故障恢复中心": "Studio recovery center",
    "正在校验任务状态和已保留产物…": "Checking task state and preserved artifacts…",
    "制作进度": "Production progress",
    "视频制作总体进度": "Overall video production progress",
    "粗剪提示": "Recut notes",
    "查看粗剪提示": "View recut notes",
    "审核信息": "Review information",
    "更多": "More",
    "还没有项目": "No projects yet",
    "项目文件需要修复": "Project files need repair",
    "品牌": "Brand",
    "功能": "Functional",
    "资源分类": "Resource categories",
    "关闭视觉资源库": "Close visual library",
    "浏览已注册资源；项目新生成的图片只有经你确认后才会加入全局素材库。":
      "Browse registered resources. New project images enter the shared library only after your approval.",
    "组件": "Components",
    "动画模板": "Animation templates",
    "图片素材": "Image assets",
    "图标": "Icons",
    "待入库素材": "Pending assets",
    "全选": "Select all",
    "取消全选": "Clear selection",
    "确认入库": "Add to library",
    "整理元数据": "Edit metadata",
    "没有待入库素材": "No pending assets",
    "没有图片素材": "No image assets",
    "版本": "Version",
    "工作模式": "Mode",
    "本地优先": "Local-first",
    "界面语言": "Interface language",
    "简体中文": "Simplified Chinese",
    "英文": "English",
    "已适配Agent": "Supported Agents",
    "已适配 Agent": "Supported Agents",
    "设置与健康状态": "Settings and health",
    "重新检查": "Run again",
    "检查中…": "Checking…",
    "正在检查": "Checking",
    "运行正常": "Healthy",
    "有待处理项": "Attention needed",
    "需要修复": "Needs repair",
    "正在读取本机环境和服务状态…": "Reading local environment and service status…",
    "任务队列": "Task queue",
    "读取中": "Loading",
    "本地空间": "Local storage",
    "低于安全空间时 Doctor 会阻止生产": "Doctor blocks production when free space is below the safe limit",
    "视频环境": "Video tools",
    "FFmpeg 正常": "FFmpeg ready",
    "等待检查": "Waiting for check",
    "H.264、HEVC、AAC 与完整解码": "H.264, HEVC, AAC, and full-file decoding",
    "分析环境": "Analysis tools",
    "Python 正常": "Python ready",
    "使用仓库本地 .venv": "Uses the repository-local .venv",
    "需要留意": "Needs attention",
    "健康检查不会生成内容、执行翻译或启动渲染，也不会读取密钥正文。":
      "Health checks do not generate content, translate, start renders, or read secret values.",
    "重新扫描": "Rescan",
    "扫描中…": "Scanning…",
    "已安装并认证": "Installed and authenticated",
    "未检测到版本": "Version not detected",
    "已适配": "Supported",
    "当前项目": "Current project",
    "Agent 扫描已更新": "Agent scan updated",
    "自动搭配": "Automatic pairing",
    "统一黑体": "System sans only",
    "文楷强调": "WenKai emphasis",
    "字体由本地规则决定": "Typography is determined by local rules",
    "字 Aa": "Type Aa",
    "默认使用系统黑体；仅在引用、批注和全片标题等适合的场景使用霞鹜文楷。":
      "Use the system sans font by default, with LXGW WenKai reserved for suitable quotations, annotations, and full-screen titles.",
    "所有画面保持系统黑体，适合技术内容、数据画面和最稳妥的历史项目。":
      "Use the system sans font throughout, ideal for technical content, data visuals, and maximum compatibility with older projects.",
    "在自动搭配基础上，允许更多合适的组件标题使用霞鹜文楷；正文、数字和字幕仍保持黑体。":
      "Build on automatic pairing by allowing LXGW WenKai in more suitable component titles, while body text, numbers, and captions remain sans serif.",
    "Agent 只输出语义证据和表达意图，不直接选择字体。系统会检查文字角色、组件、长度、技术字符和字形覆盖，再确定字体或安全回退。":
      "The Agent provides semantic evidence and communication intent, but does not choose fonts. Local rules validate text roles, components, length, technical glyphs, and coverage before selecting a font or safe fallback.",
    "当前": "Current",
    "请先选择一个项目。": "Select a project first.",
    "当前项目已批准，字体变更必须进入返修版本。":
      "This project is approved. Typography changes require a revision.",
    "修改后会重新校验组件及静态审核阶段，不会重跑 Agent 或字幕理解。":
      "Changes revalidate components and static review without rerunning the Agent or caption understanding.",
    "保存字体模式": "Save typography mode",
    "保存中…": "Saving…",
    "字体模式已保存，已有进度已重新校验": "Typography saved and existing progress revalidated",
    "重新读取zshrc": "Reload zshrc",
    "重新读取 zshrc": "Reload zshrc",
    "已连接": "Connected",
    "缺少密钥": "Missing key",
    "不可用": "Unavailable",
    "当前用途": "Current use",
    "模型": "Model",
    "API 地址": "API endpoint",
    "密钥变量": "Key variable",
    "读取来源": "Loaded from",
    "英文翻译": "English translation",
    "支持": "Supported",
    "不支持": "Not supported",
    "原生生图": "Native image generation",
    "外部生图服务": "External image providers",
    "可调度": "Available",
    "固定项目 Agent": "Pinned project Agent",
    "英文字幕翻译、制作阶段编排与故障处理":
      "English caption translation, production orchestration, and failure handling",
    "具备原生生图能力，但 CLI 无生图接口；当前 Studio 尚未连接独立生图服务。":
      "The model can generate images natively, but the CLI has no image-generation interface and Studio has no separate image provider connected.",
    "模型本身不生图，但可以调度 Studio 的独立生图服务。":
      "The model does not generate images itself, but it can orchestrate Studio's separate image provider.",
    "模型本身不生图；配置独立生图服务后可由 Claude Code 负责理解和调度。":
      "The model does not generate images itself. After a separate provider is configured, Claude Code can interpret requests and orchestrate it.",
    "仅用于兼容旧项目的英文字幕翻译": "English caption translation for legacy-project compatibility only",
    "新项目不再默认使用；旧项目仍按原清单运行以保证可复现。":
      "New projects no longer use it by default. Legacy projects keep their original manifest for reproducibility.",
    "本地 zsh 环境": "Local zsh environment",
    "安全说明：": "Security note:",
    "Studio 只显示“已配置/未配置”，不会读取或返回密钥正文。启动视频任务时，密钥只作为子进程环境变量传给原有工作流。":
      "Studio only shows whether a provider is configured. It never reads or returns secret values. Video tasks receive credentials only through the existing child-process environment.",
    "读取中…": "Loading…",
    "已重新读取本地zsh环境": "Local zsh environment reloaded",
    "已重新读取本地 zsh 环境": "Local zsh environment reloaded",
    "可查看项目占用任务历史和安全清理": "View project usage, task history, and safe cleanup",
    "可查看项目占用、任务历史和安全清理": "View project usage, task history, and safe cleanup",
    "进入视频制作后显示项目运行详情": "Production details appear after the video workflow starts",
    "备份策略": "Backup policy",
    "保留3份本地备份": "Keep 3 local backups",
    "保留 3 份本地备份": "Keep 3 local backups",
    "恢复前验证 SHA-256，并保留被替换版本用于回滚":
      "Verify SHA-256 before restore and retain the replaced version for rollback",
    "项目高级详情": "Advanced project details",
    "打开高级详情": "Open advanced details",
    "CLI 备份和恢复仍要求先停止默认端口上的 Studio，避免与运行中的任务竞争。":
      "CLI backup and restore require stopping Studio on the default port to avoid competing with active tasks.",
    "正在保存…": "Saving…",
    "已自动保存": "Saved",
    "保存失败": "Save failed",
    "视觉方案保存失败": "Failed to save visual plan",
    "资料收集": "Collecting sources",
    "正在写稿": "Writing",
    "稿件审核": "Script review",
    "稿件已锁定": "Script locked",
    "等待拍摄": "Waiting for media",
    "视频就绪": "Video ready",
    "视频制作": "Production",
    "Agent 自检": "Agent self-review",
    "待审核成片": "Final video ready for review",
    "静态审核": "Static review",
    "审核通过": "Approved",
    "已交付": "Delivered",
    "工具测评（旧）": "Tool review (legacy)",
    "模型测评（旧）": "Model review (legacy)",
    "生物医药番外（旧）": "Biopharma extra (legacy)",
    "其他（旧）": "Other (legacy)",
    "人物口播": "Speaker",
    "录屏展示": "Screen recording",
    "图片展示": "Image",
    "组件动效": "Component motion",
    "双向对比": "Two-way comparison",
    "多维比较": "Multi-dimensional comparison",
    "有序流程": "Ordered process",
    "逐项解释": "Progressive explanation",
    "因果链": "Causal chain",
    "条件分支": "Conditional branches",
    "重点数字": "Key number",
    "排名或分布": "Ranking or distribution",
    "趋势变化": "Change over time",
    "时间节点": "Dated milestones",
    "分类关系": "Category map",
    "核心与支撑": "Core and supporting factors",
    "取舍与定位": "Trade-off and positioning",
    "来源证据": "Source-backed evidence",
    "文字标注": "Text annotation",
    "分布对比条": "Distribution bars",
    "场景分支": "Scenario branches",
    "趋势折线": "Trend line",
    "人物证据卡": "Person evidence card",
    "因素序列": "Factor sequence",
    "指标排行榜": "Ranked metrics",
    "排行榜": "Leaderboard",
    "分布条": "Distribution bars",
    "媒体对比": "Media comparison",
    "截图证据": "Screenshot evidence",
    "流程步骤": "Process steps",
    "引用来源": "Quote and source",
    "证据展示": "Evidence display",
    "历史时间线": "Historical timeline",
    "决策矩阵": "Decision matrix",
    "分类图": "Classification map",
    "能力网格": "Capability grid",
    "取舍天平": "Trade-off scale",
    "手绘标注": "Rough annotation",
    "观点陈述": "Editorial statement",
    "暂无白名单组件": "No approved component",
    "长停顿": "Long pause",
    "口头语": "Filler",
    "重新起句": "False start",
    "重复重录": "Duplicate take",
    "建议删除": "Recommended removal",
    "受保护": "Protected",
    "已排除": "Excluded",
    "超出时长": "Too long",
    "边界不安全": "Unsafe boundary",
    "置信度不足": "Low confidence",
    "与其他候选重叠": "Overlaps another candidate",
    "等待处理": "Pending",
    "正在处理": "Running",
    "已完成": "Completed",
    "已通过": "Approved",
    "需要处理": "Needs attention",
    "先前结果已过期": "Previous result is stale",
    "已取消可继续": "Cancelled, can resume",
    "已取消，可继续": "Cancelled, can resume",
    "网址": "URL",
    "本地文件": "Local file",
    "文字笔记": "Text note",
    "录屏": "Screen recording",
    "截图": "Screenshot",
    "参考文件": "Reference file",
    "人物原片": "Speaker video",
    "修改英文字幕": "Edit English captions",
    "修改组件展示文字": "Edit component copy",
    "调整视觉出现区间": "Adjust visual timing",
    "修改组件或布局": "Change component or layout",
    "增加人工删除区间": "Add manual removal range",
    "修改字幕断句策略": "Change caption segmentation",
    "仅记录驳回": "Record rejection only",
    "创建方向与资料": "Create · Direction & sources",
    "创建 · 方向与资料": "Create · Direction & sources",
    "先确认写作方向，再补齐参考资料和候选素材，然后生成第一版口播稿。":
      "Confirm the editorial direction, add references and candidate media, then generate the first script draft.",
    "写稿 · Agent 处理中": "Writing · Agent running",
    "Agent 正在根据已读取的资料生成口播稿，完成后会进入人工审核。":
      "The Agent is drafting from the resolved sources. The result will require human review.",
    "写稿 · 口播稿审核": "Writing · Script review",
    "先把内容和拍摄提示改到满意，再锁定稿件进入拍摄。":
      "Revise the script and shooting notes, then lock the script before recording.",
    "拍摄 · 拍摄与素材": "Media · Recording & assets",
    "口播稿已经锁定。按拍摄交接完成录制，并登记人物原片和证据素材。":
      "The script is locked. Record from the shooting handoff and register the speaker video and evidence assets.",
    "拍摄 · 等待素材": "Media · Waiting for assets",
    "按拍摄指导准备原片、录屏和截图；素材齐备后再进入视频制作。":
      "Prepare the source video, screen recordings, and screenshots before starting production.",
    "制作 · 视频制作": "Production · Video workflow",
    "素材已经就绪。先审核连续 720p 粗剪，再推进语义理解和静态画面。":
      "Media is ready. Review the continuous 720p recut before semantic planning and static frames.",
    "制作 · 任务进行中": "Production · Task running",
    "Studio 正在执行本地确定性工作流，可以安全离开并稍后继续。":
      "Studio is running the local deterministic workflow. You can safely leave and return later.",
    "制作 · Agent 自检": "Production · Agent self-review",
    "Agent 正在检查关键画面、字幕、证据和布局，通过后会自动渲染成片。":
      "The Agent is checking key frames, captions, evidence, and layout, then will render the final video automatically.",
    "审核 · 最终成片": "Review · Final video",
    "Agent 制作、自检和技术验收已完成，等待创作者审核最终成片。":
      "Agent production, self-review, and technical validation are complete. The final video is ready for creator review.",
    "审核 · 静态审核": "Review · Static review",
    "逐张检查关键画面、字幕、证据和布局；通过后才允许渲染最终成片。":
      "Inspect key frames, captions, evidence, and layouts. Delivery rendering remains locked until approval.",
    "交付 · 成片与交付": "Delivery · Render & delivery",
    "静态审核已经通过，可以生成最终成片并完成技术验收。":
      "Static review is approved. You can render the final video and complete technical validation.",
    "交付 · 已完成": "Delivery · Completed",
    "成片已经交付并通过最终验收，项目证据和产物仍保留在本地。":
      "The final video passed delivery acceptance. Project evidence and artifacts remain local.",
    "创建": "Create",
    "写稿": "Write",
    "拍摄": "Media",
    "制作": "Produce",
    "审核": "Review",
    "交付": "Deliver",
    "方向与资料": "Direction & sources",
    "口播稿": "Script",
    "拍摄与素材": "Recording & assets",
    "成片与交付": "Render & delivery",
    "任务完成": "Task completed",
    "任务已停止": "Task stopped",
    "Studio 服务连接已中断，请重新启动服务": "Studio connection was lost. Restart the service.",
    "Studio 服务连接已中断，请重新启动服务后再试": "Studio connection was lost. Restart the service and try again.",
    "项目名称不能为空": "Project name cannot be empty",
    "项目名称已更新": "Project name updated",
    "审核意见已记录": "Review note saved",
    "请先填写审核意见": "Enter a review note first",
    "拍摄原片": "Speaker source video",
    "来源": "Source",
    "证据": "Evidence",
    "— 来源": "— Source",
    "视频制作工作台": "Video production workspace",
    "重新读取并校验已有步骤，不会启动工作流，也不会重新调用 Agent、翻译或渲染。":
      "Reload and validate existing stages without starting the workflow or calling the Agent, translator, or renderer.",
    "需要你处理": "Action required",
    "系统没有在当前字幕中找到已确认画面的口播定位句，因此不会猜测插入位置。请检查对应口播并重新绑定，或改用人物画面。":
      "Studio could not find the confirmed visual anchor in the current captions and will not guess its position. Check the narration and rebind it, or use the speaker view.",
    "等待问题解决": "Waiting for issue resolution",
    "创作设置": "Project settings",
    "全局 Agent": "Pinned Agent",
    "参考资料": "References",
    "已登记素材": "Registered assets",
    "流程状态": "Workflow status",
    "项目创建": "Project created",
    "口播稿审核": "Script review",
    "稿件锁定": "Script locked",
    "等待上一步": "Waiting for previous step",
    "成片交付": "Final delivery",
    "最近任务": "Recent tasks",
    "任务已进入队列": "Task queued",
    "原片绝对路径": "Source video path",
    "最终人物口播原片": "Final speaker source video",
    "登记原片": "Register source video",
    "拍摄指导": "Shooting guidance",
    "用途说明：": "How this is used:",
    "这份指导主要给你拍摄时查看。视频工作流使用的是锁稿后生成的结构化录屏场景计划，两者来自同一份最终稿。":
      "Use this guidance while recording. The video workflow uses the structured screen-recording scene plan generated after the script is locked; both come from the same final script.",
    "拍摄用最终口播稿": "Final recording script",
    "上传图片、录屏与素材": "Upload images, screen recordings, and media",
    "补充网页、文档与文字资料": "Add webpages, documents, and text sources",
    "图片适配方式": "Image fit",
    "完整显示": "Fit entire image",
    "填满裁切": "Fill and crop",
    "浏览并加入（可多选）": "Browse and add (multiple selection)",
    "也可以手动填写路径": "Or enter a path manually",
    "素材绝对路径": "Absolute media path",
    "素材类型": "Media type",
    "图片或截图": "Image or screenshot",
    "人物口播原片": "Original talking-head video",
    "名称（可选）": "Name (optional)",
    "默认使用文件名": "Uses the file name by default",
    "加入素材库": "Add media",
    "按添加顺序排列": "Sorted by the order added",
    "尚未添加": "Nothing added yet",
    "Agent 会读取图片原图、录屏代表画面和参考文件，并在视觉规划时决定如何使用。":
      "The Agent reads original images, representative screen-recording frames, and reference files, then decides how to use them during visual planning.",
    "名称": "Name",
    "网址、文件路径或笔记": "URL, file path, or note",
    "https://... 或绝对路径": "https://... or an absolute path",
    "例如 GitHub 仓库": "Example: GitHub repository",
    "加入项目资料": "Add project source",
    "资料用来核实项目能力、新闻事实和教程步骤，不替你决定稿件立场。":
      "Sources verify product capabilities, news facts, and tutorial steps without deciding the script's position for you.",
    "素材理解": "Media understanding",
    "尚未理解": "Not analyzed yet",
    "开始理解资料与素材": "Analyze sources and media",
    "正在理解…": "Analyzing…",
    "素材有变化": "Media has changed",
    "重新理解": "Analyze again",
    "素材已理解": "Media analyzed",
    "确认素材理解": "Confirm media analysis",
    "确认素材安排并继续": "Confirm media decisions and continue",
    "必须呈现": "Must appear",
    "不进入成片": "Exclude from video",
    "补充说明": "Notes",
    "这里只审核口播文字": "Review narration text only",
    "素材语义关系会随最终稿一起交给生产 Agent。组件、动画、时间线和呈现方式将在锁稿后统一规划。":
      "Semantic media bindings travel with the final script. The Production Agent plans components, animation, timing, and presentation after script lock.",
    "保存文字修改": "Save text changes",
    "确认最终口播稿": "Confirm final narration",
    "创作方向": "Creative direction",
    "已理解": "Understood",
    "修改": "Edit",
    "写作方向": "Writing direction",
    "修改创作方向": "Edit creative direction",
    "确认创作方向": "Confirm creative direction",
    "Studio 已理解你的描述": "Studio understood your description",
    "可选：补充三项创作方向": "Optional: add three creative-direction details",
    "不填写也可以继续；填写后只用于调整受众、角度和结论。":
      "You can continue without these. If provided, they only refine the audience, angle, and conclusion.",
    "这些内容只影响写法，不会改变素材理解状态。":
      "These details affect the writing approach without changing media-analysis status.",
    "重新整理": "Reorganize",
    "你和这期内容是什么关系？": "What is your relationship to this project?",
    "例如使用了多久、做过什么测试，或为什么只能基于公开资料判断。":
      "For example, how long you used it, what you tested, or why your assessment relies only on public sources.",
    "这期内容主要讲给谁听？": "Who is this project for?",
    "例如：想减少重复剪辑工作的独立创作者。":
      "Example: independent creators who want to reduce repetitive editing.",
    "观众看完后最应该带走什么？": "What is the one thing viewers should take away?",
    "只写一个核心判断、答案或可执行结果。":
      "Write one central judgment, answer, or actionable outcome.",
    "先完成素材理解": "Complete media analysis first",
    "先完成并保存写作方向": "Complete and save the writing direction first",
    "最终口播稿": "Final narration script",
    "导出口播稿": "Export narration",
    "纯文本": "Plain text",
    "结构化 JSON": "Structured JSON",
    "总结本期写稿经验": "Summarize writing lessons from this project",
    "比较初稿、修改意见和最终审核稿，提炼可复用的表达方式；结果仍由你确认。":
      "Compare the first draft, revision notes, and approved script to extract reusable writing patterns. You still approve the result.",
    "开始提炼": "Extract lessons",
    "开场": "Opening",
    "本期概述": "Overview",
    "结尾总结": "Conclusion",
    "对应画面：": "Visual:",
    "正在总结本期写稿经验": "Summarizing writing lessons",
    "正在比较初稿和最终稿": "Comparing the first and final drafts",
    "把本期经验用于以后项目": "Use these lessons in future projects",
    "只保存表达方式，不保存本期项目事实。":
      "Only writing patterns are saved, never facts from this project.",
    "确认要长期保留的经验": "Choose lessons to retain",
    "确认并用于以后项目": "Confirm and use in future projects",
    "本期经验已沉淀": "Writing lessons saved",
    "已将审核通过的表达偏好加入创作者档案，未来同类写稿会自动参考。":
      "Approved writing preferences were added to the creator profile and will inform similar future scripts.",
    "最终稿 SHA-256": "Final script SHA-256",
    "生成视频工作流交接包": "Create video workflow handoff",
    "检查本机环境": "Check local environment",
    "准备人物原片": "Prepare speaker video",
    "读取视频信息": "Read video metadata",
    "检查录屏素材": "Check screen recordings",
    "检查图片证据": "Check image evidence",
    "识别口播内容": "Transcribe narration",
    "对照定稿校对转录": "Conform transcript to locked script",
    "校对专有名词": "Conform terminology",
    "分析人物位置": "Analyze speaker position",
    "理解口播节奏": "Understand narration rhythm",
    "生成粗剪方案": "Plan recut",
    "生成 720p 审核预览": "Render 720p review preview",
    "等待你审核粗剪": "Waiting for recut review",
    "应用已通过的粗剪": "Apply approved recut",
    "安排 SeanLab 品牌片头": "Place SeanLab bumper",
    "生成中文字幕": "Generate Chinese captions",
    "预检录屏与视觉锚点": "Preflight recordings and visual anchors",
    "翻译英文字幕": "Translate English captions",
    "对齐录屏和图片": "Align recordings and images",
    "理解内容重点": "Understand content priorities",
    "准备视觉组件": "Prepare visual components",
    "安排画面节奏": "Direct visual pacing",
    "检查视觉方案": "Validate visual plan",
    "准备审核画面": "Prepare review frames",
    "检查片头与音效": "Check bumper and sound",
    "生成静态审核图": "Render static review frames",
    "检查显示完整性": "Check visual integrity",
    "按需生成动画片段预览": "Render animation excerpts when needed",
    "整理审核画廊": "Assemble review gallery",
    "检查已批准风格": "Check approved styles",
    "等待最终审核": "Waiting for final review",
    "渲染最终成片": "Render final video",
    "验收成片文件": "Validate final video",
    "视频任务正在排队": "Video task queued",
    "视频工作流正在运行": "Video workflow running",
    "页面刷新不会取消任务，完成后会自动刷新审核内容。":
      "Refreshing the page will not cancel the task. Review content updates automatically when it finishes.",
    "处理视频": "Process video",
    "还没有制作进度": "No production progress yet",
    "目前没有需要留意的内容": "Nothing needs attention",
    "建议调整的片段": "Suggested edits",
    "片段": "Segment",
    "口播调整": "Narration adjustment",
    "这一处是纯停顿，没有口播文字": "This is a silent pause with no spoken words",
    "待审核": "Pending review",
    "仅缩短中间的静音，不删除前后口播": "Shorten only the silence without removing surrounding speech",
    "视频制作暂停": "Video production paused",
    "已保留进度": "Progress preserved",
    "系统保证不会误删": "Protected from accidental deletion",
    "没有需要额外锁定的片段。": "No additional ranges need protection.",
    "需要你留意": "Needs your attention",
    "口播稿中的所有定位句都已在原片中找到。": "Every script anchor was found in the source video.",
    "粗剪审核": "Recut review",
    "已批准": "Approved",
    "已驳回": "Rejected",
    "原始口播": "Original narration",
    "建议成片": "Proposed edit",
    "预计节省": "Estimated savings",
    "查看审核版本标识": "View review version ID",
    "静态审核资料已生成": "Static review package ready",
    "粗剪已通过": "Recut approved",
    "已完成字幕、录屏、视觉组件和显示完整性检查，不会再重复运行粗剪。":
      "Captions, recordings, visual components, and display integrity are complete. The recut will not run again.",
    "已将你审核的版本用于后续字幕、录屏和视觉动效制作。请使用顶部按钮继续。":
      "Your approved edit is now used for captions, recordings, and visual production. Continue from the action above.",
    "正在应用你审核的粗剪版本。": "Applying your approved recut.",
    "如果不满意，请写下具体修改意见": "If needed, describe specific changes",
    "已驳回当前方案。": "The current proposal was rejected.",
    "我已完整播放 720p 预览，并确认所有建议删减都可以接受":
      "I watched the complete 720p preview and accept every proposed removal",
    "撤销驳回": "Reopen proposal",
    "按意见重新规划": "Replan from feedback",
    "保存意见并驳回": "Save feedback and reject",
    "通过粗剪": "Approve recut",
    "重新生成粗剪预览": "Regenerate recut preview",
    "继续到静态审核": "Continue to static review",
    "开始生成粗剪": "Generate recut review",
    "需要先修复": "Fix required",
    "可以继续，但请留意": "Can continue with warnings",
    "可以安全继续": "Safe to continue",
    "已经到达下一审核点": "Next review gate reached",
    "等待检查": "Waiting for check",
    "等待开始后估算": "Estimate after task starts",
    "等待前一个任务完成": "Waiting for the previous task",
    "即将完成": "Nearly finished",
    "运行一段时间后估算": "Estimate after progress begins",
    "检查完成": "Check complete",
    "检查并继续": "Check and continue",
    "重新安全检查": "Run safety check again",
    "等待重新检查": "Waiting for another check",
    "生成制作方向": "Generate production direction",
    "制作方向": "Production direction",
    "等待确认": "Awaiting confirmation",
    "内容章节": "Content chapters",
    "计划视觉段": "Planned visual segments",
    "动画覆盖": "Animation coverage",
    "预计视觉覆盖": "Estimated visual coverage",
    "章节方向": "Chapter direction",
    "必须呈现的素材": "Required media",
    "确认制作方向": "Confirm production direction",
    "我已查看制作方向，确认由 Agent 自主完成后续制作":
      "I reviewed the direction and authorize the Agent to complete production autonomously",
    "重新校验已有进度": "Revalidate existing progress",
    "粗剪 Agent": "Recut Agent",
    "语义 Agent": "Semantic Agent",
    "字幕翻译": "Caption translation",
    "视频工作流": "Video workflow",
    "当前阶段": "Current stage",
    "制作中": "In production",
    "任务处理中，请稍候…": "Task in progress…",
    "任务未完成": "Task incomplete",
    "正在只读检查有效断点和下一审核点": "Checking valid checkpoints and the next review gate",
    "先做一次快速检查，确认可以安全开始或继续。":
      "Run a quick check before starting or continuing.",
    "智能粗剪 2.0": "Intelligent Recut 2.0",
    "就绪检查会同时展示执行计划，因此不再需要先启动一个独立的预览任务。":
      "Readiness includes the execution plan, so a separate preview task is no longer needed.",
    "检查后从当前有效断点继续": "Check and resume from the current valid checkpoint",
    "需重新审核粗剪": "Recut review required again",
    "录屏定位句或粗剪保护范围已变化，上一次的 720p 审核结果不再适用。系统只会重新生成粗剪预览，不会重做转写和 Agent 理解。":
      "Recording anchors or protected ranges changed. Studio will regenerate only the recut preview without repeating transcription or Agent understanding.",
    "开始前还有一项需要处理，打开故障恢复查看解决办法。":
      "One issue must be resolved first. Open Recovery for details.",
    "开始条件已更新，请重新安全检查后继续。":
      "Startup conditions changed. Run the safety check again to continue.",
    "制作 Agent 会读取保留产物并从安全断点处理；只有需要你决定时才会提示。":
      "The production Agent reads preserved artifacts and resumes from a safe checkpoint. It asks only when your decision is required.",
    "制作 Agent 会先校验现有产物，不会覆盖有效结果。":
      "The production Agent validates existing artifacts before acting and does not overwrite valid results.",
    "开始前先快速确认成片规格和可用空间。": "Confirm output settings and available storage before rendering.",
    "开始最终成片渲染": "Start final render",
    "等待静态审核": "Waiting for static review",
    "可以开始渲染": "Ready to render",
    "正在渲染": "Rendering",
    "正在技术验收": "Validating",
    "状态与文件冲突": "State and file conflict",
    "等待最终确认": "Waiting for final acceptance",
    "已退回修改": "Returned for revision",
    "已完成交付": "Delivery complete",
    "正在验收最终成片": "Validating final video",
    "正在渲染最终成片": "Rendering final video",
    "已从批准快照开始处理": "Started from the approved snapshot",
    "最终成片制作进度": "Final video progress",
    "总体进度": "Overall progress",
    "预计剩余": "Estimated remaining",
    "当前状态": "Current status",
    "正在验收": "Validating",
    "正在生成成片": "Rendering video",
    "取消任务": "Cancel task",
    "可以关闭页面或切换项目。任务状态保存在本机，再次打开时会继续显示。":
      "You may close the page or switch projects. Task state is stored locally and appears when you return.",
    "成片检查": "Delivery validation",
    "发布所需的关键信息已经确认。": "Required delivery properties have been validated.",
    "分辨率": "Resolution",
    "帧率": "Frame rate",
    "文件大小": "File size",
    "查看技术验收详情": "View technical validation details",
    "视频编码": "Video codec",
    "音频": "Audio",
    "包含音频": "Audio present",
    "没有音频": "No audio",
    "成片时长": "Duration",
    "完整解码": "Full-file decode",
    "最近处理记录": "Recent activity",
    "项目已经完成交付": "Project delivery complete",
    "最终成片已经通过检查并完成登记。": "The final video passed validation and was registered.",
    "当前成片已退回修改": "Current delivery returned for revision",
    "最终成片确认": "Final video acceptance",
    "请完整播放成片，并结合上方技术验收结果做最终决定。":
      "Watch the complete video and use the technical validation above to make the final decision.",
    "交付备注（可选）": "Delivery note (optional)",
    "我已播放并检查最终成片，确认当前文件可以完成交付":
      "I watched and checked the final video and confirm it is ready for delivery",
    "如果退回，请填写具体原因": "If returning it, provide a specific reason",
    "退回修改": "Return for revision",
    "通过并完成交付": "Approve and complete delivery",
    "确认后，这次 Agent 规划会替换当前动画阶段的图片与图标安排。继续吗？":
      "This Agent plan will replace the current animation-stage image and icon assignments. Continue?",
    "恢复后会创建一个新版本，当前版本和历史版本都会保留。继续吗？":
      "Restoring creates a new version while preserving the current and historical versions. Continue?",
    "确认把上述意见交给 Agent 重新规划？当前版本会保留为历史记录。":
      "Send this feedback to the Agent for replanning? The current version will be preserved in history.",
    "英文字幕已经更新，需要由当前项目的 Agent 重新理解内容。旧计划会保留用于比较，是否继续？":
      "English captions changed and require the project Agent to understand the content again. The previous plan will be preserved for comparison. Continue?",
    "确认": "Confirm",
  }),
);

const patterns = [
  [/^打开(.+)的项目操作$/, (_, value) => `Open project actions for ${value}`],
  [/^已添加\s*(\d+)\s*份素材$/, (_, count) => `${count} asset${count === "1" ? "" : "s"} added`],
  [/^已添加\s*(\d+)\s*个网址$/, (_, count) => `${count} URL${count === "1" ? "" : "s"} added`],
  [/^已添加\s*(\d+)\s*份参考资料$/, (_, count) => `${count} reference${count === "1" ? "" : "s"} added`],
  [/^(\d+)\s*项通过$/, (_, count) => `${count} passed`],
  [/^(\d+)\s*项提醒$/, (_, count) => `${count} warning${count === "1" ? "" : "s"}`],
  [/^(\d+)\s*项失败$/, (_, count) => `${count} failed`],
  [/^(\d+)\s*运行\s*·\s*(\d+)\s*排队$/, (_, running, queued) => `${running} running · ${queued} queued`],
  [/^全局最多同时运行\s*(\d+)\s*个重任务$/, (_, count) => `Up to ${count} heavy task${count === "1" ? "" : "s"} globally`],
  [/^已恢复\s*(\d+)\s*个有效步骤$/, (_, count) => `${count} valid stage${count === "1" ? "" : "s"} restored`],
  [/^已确认\s*(\d+)\s*条写稿经验，未来同类项目会自动参考$/, (_, count) => `${count} writing lesson${count === "1" ? "" : "s"} saved for similar projects`],
  [/^(\d+)\s*个文件$/, (_, count) => `${count} file${count === "1" ? "" : "s"}`],
  [/^(\d+)\s*个词$/, (_, count) => `${count} words`],
  [/^还差\s*(\d+)\s*项$/, (_, count) => `${count} item${count === "1" ? "" : "s"} remaining`],
  [/^最终口播稿\s*·\s*(.+)$/, (_, title) => `Final narration script · ${title}`],
  [/^拍摄用最终口播稿\s*·\s*(.+)$/, (_, title) => `Final recording script · ${title}`],
  [/^版本历史\s*·\s*(\d+)$/, (_, count) => `Version history · ${count}`],
  [/^累计\s*(\d+)\s*条$/, (_, count) => `${count} saved in total`],
  [/^只保存表达方式，不保存本期项目事实。当前已有\s*(\d+)\s*条长期偏好。$/, (_, count) => `Only writing patterns are saved, never facts from this project. ${count} long-term preference${count === "1" ? "" : "s"} currently saved.`],
  [/^已将\s*(\d+)\s*条审核通过的表达偏好加入创作者档案，未来同类写稿会自动参考。$/, (_, count) => `${count} approved writing preference${count === "1" ? "" : "s"} added to the creator profile for similar future scripts.`],
  [/^(.+?)\s*·\s*已通过\s*(\d+)\s*·\s*待审核\s*(\d+)$/, (_, version, approved, pending) => `${version} · ${approved} approved · ${pending} pending review`],
  [/^(.+) UI 示意预览$/, (_, label) => `${translateText(label, "en")} UI schematic preview`],
  [/^查看制作进度，已完成\s*(\d+)%$/, (_, percent) => `View production progress, ${percent}% complete`],
  [/^制作进度\s*(\d+)%$/, (_, percent) => `Production progress ${percent}%`],
  [/^总体进度\s*(\d+)%$/, (_, percent) => `Overall progress ${percent}%`],
  [/^预计剩余：(.+)$/, (_, value) => `Estimated remaining: ${translateText(value, "en")}`],
  [/^最后生成：(.+)。每次重新生成会覆盖当前封面预览，不影响成片。$/, (_, date) => `Last generated: ${date}. Regenerating replaces the cover preview without changing the video.`],
  [/^确认从当前项目移除“(.+)”？原文件会保留在项目回收目录中。$/, (_, label) => `Remove “${label}” from this project? The file will remain in the project recovery directory.`],
];

const normalizeLocale = (value) => (value === "en" ? "en" : "zh-CN");

export const getLocale = () => {
  try {
    return normalizeLocale(localStorage.getItem(localeStorageKey));
  } catch {
    return "zh-CN";
  }
};

export const localeTag = () => (getLocale() === "en" ? "en-US" : "zh-CN");

export const setLocale = (locale) => {
  const normalized = normalizeLocale(locale);
  try {
    localStorage.setItem(localeStorageKey, normalized);
  } catch {}
  return normalized;
};

export const translateText = (value, locale = getLocale()) => {
  if (locale !== "en" || typeof value !== "string" || !value.trim()) return value;
  const leading = value.match(/^\s*/)?.[0] ?? "";
  const trailing = value.match(/\s*$/)?.[0] ?? "";
  const source = value.trim();
  const exact = english.get(source);
  if (exact) return `${leading}${exact}${trailing}`;
  for (const [pattern, replacement] of patterns) {
    if (pattern.test(source)) return `${leading}${source.replace(pattern, replacement)}${trailing}`;
  }
  return value;
};

export const formatDateTime = (value) => new Date(value).toLocaleString(localeTag());

const translatedAttributes = ["aria-label", "placeholder", "title"];
const skippedSelector = [
  "[data-i18n-skip]",
  "pre",
  "code",
  "q",
  "#project-title-button",
  "#workspace-title",
  "#delete-project-name",
  ".project-item strong",
  ".script-block p",
  ".script-section-head > span:first-child",
  ".editorial-summary-card p",
  ".review-note-list p",
  ".evidence-row span",
].join(",");

const localizeTextNode = (node) => {
  if (node.parentElement?.closest(skippedSelector)) return;
  const translated = translateText(node.nodeValue);
  if (translated !== node.nodeValue) node.nodeValue = translated;
};

const localizeElement = (element) => {
  if (!(element instanceof Element)) return;
  for (const target of [element, ...element.querySelectorAll("*")]) {
    if (!target.closest(skippedSelector)) {
      for (const attribute of translatedAttributes) {
        const value = target.getAttribute(attribute);
        if (value) target.setAttribute(attribute, translateText(value));
      }
    }
  }
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    localizeTextNode(node);
    node = walker.nextNode();
  }
};

export const localizeDocument = (root = document.documentElement) => {
  document.documentElement.lang = getLocale();
  if (getLocale() !== "en") return;
  localizeElement(root);
};

export const startI18n = () => {
  localizeDocument();
  if (getLocale() !== "en") return;
  const observer = new MutationObserver((mutations) => {
    observer.disconnect();
    for (const mutation of mutations) {
      if (mutation.type === "characterData") localizeTextNode(mutation.target);
      if (mutation.type === "attributes") localizeElement(mutation.target);
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.TEXT_NODE) localizeTextNode(node);
        else if (node.nodeType === Node.ELEMENT_NODE) localizeElement(node);
      }
    }
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: translatedAttributes,
      childList: true,
      characterData: true,
      subtree: true,
    });
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: translatedAttributes,
    childList: true,
    characterData: true,
    subtree: true,
  });
};

export const switchLocale = () => {
  setLocale(getLocale() === "en" ? "zh-CN" : "en");
  window.location.reload();
};

export const localeButtonLabel = () => (getLocale() === "en" ? "中" : "EN");
export const localeButtonTitle = () => (getLocale() === "en" ? "Switch to Simplified Chinese" : "切换到英文");
