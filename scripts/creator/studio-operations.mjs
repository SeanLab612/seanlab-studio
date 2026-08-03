import { randomUUID } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import { loadLocalProductPolicy } from "../operations/local-product-policy.mjs";
import {
  applyRevision,
  previewRevisionImpact,
  revisionArtifactHashes,
  validateRevisionRequest,
} from "../operations/revisions.mjs";
import { buildProjectStoragePlan } from "../operations/storage-governance.mjs";
import { fileExists, hashFile } from "../workflow/state.mjs";
import { projectDir, writeJsonAtomic } from "./project-store.mjs";
import { buildStudioRecovery } from "./studio-recovery.mjs";
import { loadStudioWorkflow, workflowContextForCreator } from "./studio-workflow.mjs";

const optionalJson = async (path, fallback) => {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return fallback;
  }
};
const publicPath = (root, path) => relative(root, path).split(sep).join("/");
const describeArtifact = async (root, path, kind) => {
  if (!(await fileExists(path))) return { kind, available: false };
  const info = await stat(path);
  return {
    kind,
    available: true,
    path: publicPath(root, path),
    bytes: info.size,
    sha256: await hashFile(path),
  };
};
const compactTranscript = (transcript) => {
  const words = transcript?.words ?? [];
  return {
    wordCount: words.length,
    text: words
      .map((item) => item.text)
      .join("")
      .slice(0, 50000),
    truncated: words.map((item) => item.text).join("").length > 50000,
  };
};
const publicCaptions = (captions = []) =>
  captions.slice(0, 1000).map((cue, index) => ({ index, start: cue.start, end: cue.end, zh: cue.zh, en: cue.en }));
const publicVisuals = (plan = {}) =>
  (plan.overlayCues ?? []).map((cue, index) => ({
    index,
    start: cue.start,
    end: cue.end,
    segmentId: cue.generatedVisual?.segment?.id,
    title: cue.title,
    subtitle: cue.subtitle,
    subtitleEn: cue.subtitleEn,
    componentId: cue.generatedVisual?.component?.id,
    props: cue.generatedVisual?.props,
    layoutTemplateId: cue.layoutTemplateId,
  }));

export const loadStudioOperations = async ({ projectId, jobs = [] }) => {
  const { context } = await workflowContextForCreator(projectId);
  const { paths } = context;
  const root = projectDir(projectId);
  const transcriptPath = (await fileExists(paths.conformedTranscript)) ? paths.conformedTranscript : paths.transcript;
  const [transcript, semanticCaptions, displayCaptions, edl, semanticPlan, planning, direction, provider, history] =
    await Promise.all([
      optionalJson(transcriptPath, {}),
      optionalJson(paths.semanticCaptions, []),
      optionalJson(paths.captions, []),
      optionalJson(resolve(paths.workspace, "edl.json"), {}),
      optionalJson(paths.semanticNarrativePlan, {}),
      optionalJson(paths.planning, {}),
      optionalJson(paths.visualDirectionPlan, {}),
      optionalJson(paths.semanticProviderReport, {}),
      optionalJson(paths.revisionHistory, { revisions: [] }),
    ]);
  const artifactEntries = [
    [transcriptPath, "transcript"],
    [paths.transcriptConformanceReport, "transcript-conformance-report"],
    [paths.semanticCaptions, "semantic-captions"],
    [paths.captions, "display-captions"],
    [resolve(paths.workspace, "edl.json"), "recut-edl"],
    [paths.semanticNarrativePlan, "semantic-plan"],
    [paths.planning, "visual-brief"],
    [paths.visualDirectionPlan, "visual-direction"],
    [paths.semanticProviderReport, "provider-report"],
  ];
  const artifacts = await Promise.all(artifactEntries.map(([path, kind]) => describeArtifact(root, path, kind)));
  const policy = await loadLocalProductPolicy();
  const workflow = await loadStudioWorkflow(projectId);
  const storage = await buildProjectStoragePlan({
    root,
    workspace: paths.workspace,
    quotaBytes: policy.projectQuotaBytes,
  });
  return {
    schemaVersion: "1.0",
    projectId,
    inspectors: {
      transcript: compactTranscript(transcript),
      semanticCaptions: publicCaptions(semanticCaptions),
      displayCaptions: publicCaptions(displayCaptions),
      edl: { totalDurationS: edl.totalDurationS, ranges: edl.ranges ?? [] },
      semantic: {
        sections: semanticPlan.segments ?? semanticPlan.sections ?? semanticPlan.intents ?? [],
        provider: {
          executor: provider.executor ?? provider.provider ?? provider.agentId,
          model: provider.model ?? provider.generation?.model,
          cliVersion: provider.cliVersion ?? provider.runtimeVersion,
          generatedAt: provider.generatedAt,
          outputHash: provider.outputHash,
        },
      },
      visuals: publicVisuals(planning),
      direction: direction.decisions ?? [],
      artifacts,
    },
    revisions: history.revisions ?? [],
    operations: {
      jobs: jobs
        .filter((item) => item.projectId === projectId)
        .slice(-40)
        .reverse(),
      disk: storage,
      recovery: buildStudioRecovery({
        projectId,
        workflow,
        jobs,
        artifacts,
        agent: context.manifest.agent,
      }),
    },
  };
};

const normalizedRevisionDraft = async ({ projectId, reviewer = "Sean", reason, kind, values = {} }) => {
  const { context } = await workflowContextForCreator(projectId);
  const { manifest, paths } = context;
  const expected = await revisionArtifactHashes(paths);
  const revisionId = `studio-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
  const operation = await (async () => {
    if (kind === "translation") {
      const captions = await optionalJson(paths.captions, []);
      const cue = captions[Number(values.cueIndex)];
      if (!cue) throw new Error("请选择存在的字幕条目");
      return { type: "translation.update", cueIndex: Number(values.cueIndex), expectedZh: cue.zh, en: values.en };
    }
    if (["visual-copy", "visual-timing", "visual-component"].includes(kind)) {
      const plan = await optionalJson(paths.planning, {});
      const cue = plan.overlayCues?.[Number(values.cueIndex)];
      if (!cue) throw new Error("请选择存在的视觉条目");
      let patch = {};
      if (kind === "visual-copy")
        patch = Object.fromEntries(
          [
            ["title", values.title],
            ["subtitle", values.subtitle],
            ["subtitleEn", values.subtitleEn],
          ].filter(([, value]) => typeof value === "string" && value.trim()),
        );
      if (kind === "visual-timing") patch = { start: Number(values.start), end: Number(values.end) };
      if (kind === "visual-component") {
        let props;
        try {
          props = JSON.parse(values.propsJson);
        } catch {
          throw new Error("组件参数必须是有效 JSON");
        }
        patch = {
          component: { id: values.componentId, props },
          ...(values.layoutTemplateId ? { layoutTemplateId: values.layoutTemplateId } : {}),
        };
      }
      if (Object.keys(patch).length === 0) throw new Error("请至少填写一项修改内容");
      return {
        type: "visual-cue.update",
        cueIndex: Number(values.cueIndex),
        expectedSegmentId: cue.generatedVisual?.segment?.id,
        patch,
      };
    }
    if (kind === "edit-removal") {
      const current = manifest.policies.edit.manualRemovals ?? [];
      return {
        type: "edit-policy.update",
        patch: {
          manualRemovals: [
            ...current,
            { start: Number(values.start), end: Number(values.end), reason: values.removalReason ?? reason },
          ],
        },
      };
    }
    if (kind === "caption-policy")
      return {
        type: "caption-policy.update",
        patch: {
          ...(values.maximumCharacters ? { maximumCharacters: Number(values.maximumCharacters) } : {}),
          ...(values.maximumDurationSeconds ? { maximumDurationSeconds: Number(values.maximumDurationSeconds) } : {}),
          ...(values.displayPunctuation ? { displayPunctuation: values.displayPunctuation } : {}),
        },
      };
    if (kind === "rejection") return undefined;
    throw new Error("不支持的返修类型");
  })();
  const request = {
    schemaVersion: "1.0",
    revisionId,
    projectId: manifest.project.id,
    reviewer,
    reason,
    decision: kind === "rejection" ? "rejected" : "revision-requested",
    createdAt: new Date().toISOString(),
    expected: Object.fromEntries(Object.entries(expected).filter(([, value]) => value)),
    operations: operation ? [operation] : [],
  };
  return validateRevisionRequest(request);
};

export const previewStudioRevision = async (input) => {
  const request = await normalizedRevisionDraft(input);
  const { context } = await workflowContextForCreator(input.projectId);
  return { request, impact: await previewRevisionImpact({ manifestPath: context.paths.manifest, request }) };
};

export const applyStudioRevision = async ({ projectId, request }) => {
  const { context } = await workflowContextForCreator(projectId);
  validateRevisionRequest(request);
  if (request.projectId !== context.manifest.project.id) throw new Error("返修请求与当前项目不匹配");
  await previewRevisionImpact({ manifestPath: context.paths.manifest, request });
  const requestPath = resolve(projectDir(projectId), "review", "revision-requests", `${request.revisionId}.json`);
  await writeJsonAtomic(requestPath, request);
  return applyRevision({ manifestPath: context.paths.manifest, revisionPath: requestPath });
};
