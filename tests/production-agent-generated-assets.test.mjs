import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import {
  buildGeneratedImageRequest,
  imageGenerationCapability,
} from "../scripts/creator/generated-image-contract.mjs";
import {
  automaticRecoveryDelayMs,
  decideAutomaticProductionRecovery,
  deterministicProductionDiagnosis,
  deterministicProductionRepair,
  MAX_AUTOMATIC_PRODUCTION_RECOVERY_ATTEMPTS,
} from "../scripts/creator/production-agent-recovery.mjs";
import {
  bindingTargetId,
  buildBindingCandidates,
  buildSceneBindingCandidates,
  repairProductionBinding,
} from "../scripts/creator/production-agent-binding-repair.mjs";
import { visualContractTargetId } from "../scripts/creator/production-agent-visual-contract-repair.mjs";
import {
  canApplyValidatedProjectRepair,
  productionAgentAuthorityForFailure,
} from "../scripts/creator/production-agent-permissions.mjs";
import { automaticProductionRecoveryAttempts } from "../scripts/creator/production-agent.mjs";
import {
  isAutonomousTechnicalRepairEligible,
  runProductionAgentTechnicalRepair,
  validateAutonomousRepairPaths,
} from "../scripts/creator/production-agent-technical-repair.mjs";
import {
  stripDisplayPunctuation,
  translateCaptionBatch,
  validateAgentTranslation,
} from "../scripts/translate-captions-agent.mjs";

test("production Agents distinguish native image generation from external provider orchestration", () => {
  assert.equal(imageGenerationCapability({ agentId: "codex-cli", brokerCommand: "/tmp/broker" }).supported, true);
  assert.equal(imageGenerationCapability({ agentId: "codex-cli", brokerCommand: "/tmp/broker" }).native, true);
  assert.equal(imageGenerationCapability({ agentId: "claude-code", brokerCommand: "/tmp/broker" }).supported, true);
  assert.equal(imageGenerationCapability({ agentId: "claude-code", brokerCommand: "/tmp/broker" }).native, false);
  assert.equal(
    buildGeneratedImageRequest({
      agentId: "claude-code",
      projectId: "demo",
      beatId: "beat-1",
      templateId: "paper-editorial",
      subject: "录音机",
    }).agentId,
    "claude-code",
  );
});

test("generated image requests bind subject to the hand-drawn style contract", () => {
  const request = buildGeneratedImageRequest({
    agentId: "codex-cli",
    projectId: "demo",
    beatId: "beat-1",
    templateId: "paper-editorial",
    subject: "录音机",
    context: "介绍三个测试模型",
  });
  assert.equal(request.background, "transparent");
  assert.match(request.prompt, /录音机/);
  assert.match(request.prompt, /editorial paper cutout illustration/);
  assert.match(request.negativePrompt, /readable text/);
});

test("Agent translation preserves source cues and rejects reordered or mixed-language output", async () => {
  const captions = [
    { start: 0, end: 1, zh: "这是 Three.js 模型。" },
    { start: 1, end: 2, zh: "它可以继续使用。" },
  ];
  const before = structuredClone(captions);
  const adapter = {
    completeJson: async () => ({
      schemaVersion: "1.0",
      items: [
        { index: 0, en: "This is a Three.js model." },
        { index: 1, en: "It can be used further." },
      ],
    }),
  };
  assert.deepEqual(await translateCaptionBatch({ captions, adapter }), [
    "This is a Three.js model.",
    "It can be used further.",
  ]);
  assert.deepEqual(captions, before);
  assert.throws(
    () =>
      validateAgentTranslation({
        source: captions,
        response: {
          schemaVersion: "1.0",
          items: [
            { index: 1, en: "Wrong order" },
            { index: 0, en: "仍有中文" },
          ],
        },
      }),
    /changed caption order/,
  );
  assert.equal(stripDisplayPunctuation("Three.js，版本 1,000。"), "Three.js版本 1,000");
});

test("Agent translation repairs one invalid punctuation-only batch before failing the workflow", async () => {
  const captions = [
    { start: 0, end: 1, zh: "SeanLab Studio 是我开源" },
    { start: 1, end: 2, zh: "的项目。" },
  ];
  let calls = 0;
  const adapter = {
    completeJson: async () => {
      calls += 1;
      return calls === 1
        ? { schemaVersion: "1.0", items: [{ index: 0, en: "I open-sourced SeanLab Studio" }, { index: 1, en: "." }] }
        : {
            schemaVersion: "1.0",
            items: [
              { index: 0, en: "I open-sourced SeanLab Studio" },
              { index: 1, en: "as a project." },
            ],
          };
    },
  };
  assert.deepEqual(await translateCaptionBatch({ captions, adapter }), [
    "I open-sourced SeanLab Studio",
    "as a project.",
  ]);
  assert.equal(calls, 2);
});

test("Agent caption translation schema is accepted by strict structured-output providers", async () => {
  const schema = JSON.parse(
    await readFile(resolve("schemas/agent-caption-translation.schema.json"), "utf8"),
  );
  assert.deepEqual(schema.properties.schemaVersion, {
    type: "string",
    const: "1.0",
  });
});

test("automatic production recovery only resumes a verified retryable checkpoint", () => {
  const recovery = {
    status: "recoverable",
    resume: { enabled: true, action: "continue", stage: "visual-qa" },
  };
  const diagnosis = {
    safeToResume: true,
    recommendedAction: "resume",
    userMessage: "可以从断点继续",
  };
  const readiness = { readinessStatus: "ready", readinessSha256: "readiness-1" };
  assert.deepEqual(
    decideAutomaticProductionRecovery({ recovery, diagnosis, attempts: 0, readiness }),
    {
      action: "resume",
      reason: "automatic-resume",
      message: "从 visual-qa 安全恢复",
      workflowAction: "continue",
      stage: "visual-qa",
      attempt: 1,
    },
  );
});

test("production Agent authority follows reversibility and validators instead of diagnosis wording", () => {
  assert.deepEqual(
    productionAgentAuthorityForFailure({
      code: "BINDING_ANCHOR_NOT_FOUND",
      category: "binding",
      stage: "visual-input-preflight",
      retryable: false,
    }).level,
    "validated-project-repair",
  );
  assert.equal(
    canApplyValidatedProjectRepair({
      failure: { code: "BINDING_ANCHOR_NOT_FOUND", category: "binding" },
      repair: { kind: "validated-binding-repair", success: true },
    }),
    true,
  );
  assert.equal(
    productionAgentAuthorityForFailure({
      code: "INPUT_SCENE_DURATION_UNSAFE",
      category: "creator-input",
      retryable: false,
    }).level,
    "human-decision",
  );
  assert.equal(
    productionAgentAuthorityForFailure({
      code: "QA_CONTRACT_MISSING",
      category: "studio-defect",
      retryable: false,
    }).level,
    "isolated-source-repair",
  );
  assert.equal(
    productionAgentAuthorityForFailure({
      code: "PROVIDER_REQUEST_FAILED",
      category: "provider",
      retryable: true,
    }).level,
    "checkpoint-retry",
  );
});

test("automatic production recovery stops for unvalidated code repair, blocked readiness, and attempt exhaustion", () => {
  const recovery = {
    status: "recoverable",
    resume: { enabled: true, action: "continue", stage: "visual-qa" },
  };
  const resumableDiagnosis = {
    safeToResume: true,
    recommendedAction: "resume",
    userMessage: "可以继续",
  };
  assert.equal(
    decideAutomaticProductionRecovery({
      recovery,
      diagnosis: { ...resumableDiagnosis, safeToResume: false, recommendedAction: "repair-code" },
      attempts: 0,
      readiness: { readinessStatus: "ready" },
    }).action,
    "wait-human",
  );
  assert.equal(
    decideAutomaticProductionRecovery({
      recovery,
      diagnosis: resumableDiagnosis,
      attempts: 0,
      readiness: { readinessStatus: "blocked" },
    }).reason,
    "readiness-blocked",
  );
  assert.equal(
    decideAutomaticProductionRecovery({
      recovery,
      diagnosis: resumableDiagnosis,
      attempts: MAX_AUTOMATIC_PRODUCTION_RECOVERY_ATTEMPTS,
      readiness: { readinessStatus: "ready" },
    }).reason,
    "automatic-attempt-limit-reached",
  );
  assert.equal(
    automaticProductionRecoveryAttempts({
      history: [
        { reason: "automatic-resume" },
        { reason: "automatic-recovery-succeeded" },
        { reason: "automatic-provider-env-refresh" },
        { reason: "automatic-source-repair" },
        { reason: "automatic-binding-repair" },
        { reason: "automatic-visual-contract-repair" },
        { reason: "automatic-semantic-plan-repair" },
      ],
    }),
    5,
  );
  assert.equal(
    automaticProductionRecoveryAttempts({
      history: [
        { state: "active", reason: "creator-authorized-production" },
        { state: "recovering", reason: "automatic-resume" },
        { state: "waiting-human", reason: "automatic-attempt-limit-reached" },
        { state: "active", reason: "creator-authorized-production" },
        { state: "recovering", reason: "automatic-recheck-resume" },
      ],
    }),
    1,
  );
});

test("transient provider failures use a bounded deterministic checkpoint retry", () => {
  assert.deepEqual(
    deterministicProductionRepair({
      code: "PROVIDER_REQUEST_FAILED",
      category: "provider",
      stage: "semantic-plan",
      retryable: true,
    }),
    {
      kind: "validated-checkpoint-retry",
      success: true,
      strategy: "transient-checkpoint-retry",
    },
  );
  assert.deepEqual([0, 1, 2, 3, 8].map(automaticRecoveryDelayMs), [2_000, 5_000, 15_000, 30_000, 30_000]);
});

test("semantic plan validation failures use a deterministic repair and ignore a pessimistic diagnosis", () => {
  const repair = deterministicProductionRepair({
    code: "SEMANTIC_PLAN_INVALID",
    category: "semantic-planning",
    stage: "semantic-plan",
    retryable: true,
  });
  assert.deepEqual(repair, {
    kind: "validated-semantic-plan-repair",
    stage: "semantic-plan",
    workflowAction: "continue",
    strategy: "structured-validation-repair",
    success: true,
  });
  const diagnosis = deterministicProductionDiagnosis(
    { code: "SEMANTIC_PLAN_INVALID", stage: "semantic-plan", message: "mixed relations" },
    repair,
  );
  assert.equal(diagnosis.recommendedAction, "recheck");
  assert.equal(diagnosis.safeToResume, true);
  assert.match(diagnosis.evidence.join(" "), /structured-validation-repair/);
  const decision = decideAutomaticProductionRecovery({
    recovery: {
      status: "blocked",
      resume: { enabled: false, stage: "semantic-plan" },
    },
    diagnosis: {
      safeToResume: false,
      recommendedAction: "request-user",
      userMessage: "需要用户处理",
    },
    attempts: 0,
    readiness: { readinessStatus: "ready" },
    repair,
  });
  assert.equal(decision.action, "resume");
  assert.equal(decision.reason, "automatic-semantic-plan-repair");
  assert.equal(decision.stage, "semantic-plan");
  assert.equal(
    deterministicProductionRepair({
      code: "SEMANTIC_PLAN_INVALID",
      stage: "semantic-plan",
      retryable: false,
    }),
    undefined,
  );
});

test("production Agent can safely rebind a long visual quote across minor ASR differences", () => {
  const quote = "这是一个即装即用的开源项目，你可以到 GitHub 查看。";
  const plan = {
    beats: [
      {
        id: "conclusion-beat-1",
        sectionId: "conclusion",
        exactSpokenQuote: quote,
        status: "confirmed",
        primaryVisualType: "component",
        takeover: "partial",
        speakerPresence: "full",
        exactSpokenQuoteSha256: "before",
      },
    ],
  };
  const captions = [
    { start: 10, end: 11, zh: "这是一个集装即用的开源项目，" },
    { start: 11, end: 12, zh: "你可以到GitHub查看。" },
  ];
  const candidates = buildBindingCandidates({ plan, captions, targetId: "conclusion-beat-1" });
  assert.equal(candidates[0].candidateId, "caption-0-1");
  assert.equal(candidates[0].quote, captions.map((caption) => caption.zh).join(""));
  assert.ok(candidates[0].similarity > 0.8);
});

test("production Agent builds a verified recording-scene candidate across TTS wording expansion", () => {
  const plan = {
    scenes: [
      {
        id: "scene-material-7",
        type: "screen-evidence",
        assetId: "asset-recording",
        startAnchor: { text: "先看录音机这组。" },
        endAnchor: { text: "先看录音机这组。" },
        required: true,
        speakerPip: { shape: "circle", preferredPosition: "bottom-left", size: 360 },
      },
    ],
  };
  const captions = [
    { start: 44.23, end: 48.65, zh: "先看录音机这一组，参考图里最容易认出的是前" },
    { start: 48.65, end: 52.19, zh: "低后高的斜面机身、顶部两个旋钮，" },
  ];
  const assets = [
    {
      id: "asset-recording",
      publicSrc: "recording.mp4",
      clip: { in: 0, out: 12 },
      fps: 60,
      width: 1600,
      height: 1080,
    },
  ];
  const candidates = buildSceneBindingCandidates({ plan, captions, assets, targetId: "scene-material-7" });
  assert.equal(bindingTargetId({ message: "Recording scene preflight failed: scene-material-7: Spoken-text anchors did not match in order" }), "scene-material-7");
  assert.equal(candidates[0].candidateId, "caption-0-0");
  assert.equal(candidates[0].quote, captions[0].zh);
  assert.ok(candidates[0].targetCoverage >= 0.7);
});

test("production Agent repairs a required recording scene and records validated evidence", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "seanlab-binding-repair-"));
  try {
    const authoring = resolve(root, "authoring");
    const workspace = resolve(root, "video/workspace");
    await mkdir(authoring, { recursive: true });
    await mkdir(workspace, { recursive: true });
    const scenePlanPath = resolve(authoring, "authored-scene-plan.json");
    const visualPlanPath = resolve(authoring, "authored-visual-plan.json");
    const captionsPath = resolve(workspace, "captions-semantic.source.json");
    const supplementalPath = resolve(workspace, "supplemental-media-manifest.json");
    await writeFile(
      scenePlanPath,
      `${JSON.stringify({
        schemaVersion: "1.0",
        scenes: [
          {
            id: "scene-material-7",
            type: "screen-evidence",
            assetId: "asset-recording",
            startAnchor: { text: "先看录音机这组。" },
            endAnchor: { text: "先看录音机这组。" },
            required: true,
            speakerPip: { shape: "circle", preferredPosition: "bottom-left", size: 360 },
          },
        ],
      })}\n`,
    );
    await writeFile(visualPlanPath, '{"schemaVersion":"1.0","beats":[]}\n');
    await writeFile(
      captionsPath,
      `${JSON.stringify([
        { start: 44.23, end: 48.65, zh: "先看录音机这一组，参考图里最容易认出的是前" },
        { start: 48.65, end: 52.19, zh: "低后高的斜面机身、顶部两个旋钮，" },
      ])}\n`,
    );
    await writeFile(
      supplementalPath,
      `${JSON.stringify({
        schemaVersion: "1.0",
        assets: [
          {
            id: "asset-recording",
            publicSrc: "recording.mp4",
            clip: { in: 0, out: 12 },
            fps: 60,
            width: 1600,
            height: 1080,
          },
        ],
      })}\n`,
    );
    await writeFile(
      resolve(workspace, "runtime-config.json"),
      `${JSON.stringify({
        authoredScenePlanFile: scenePlanPath,
        authoredVisualPlanFile: visualPlanPath,
        semanticCaptionSourceFile: captionsPath,
        supplementalMediaManifestFile: supplementalPath,
      })}\n`,
    );
    const result = await repairProductionBinding({
      projectId: "fixture",
      projectRoot: root,
      recovery: {
        failure: {
          code: "BINDING_ANCHOR_NOT_FOUND",
          message:
            "Recording scene preflight failed: scene-material-7: Spoken-text anchors did not match in order",
        },
      },
      adapter: {
        completeJson: async ({ user }) => {
          assert.match(user, /必须是上述候选之一/);
          return {
            schemaVersion: "1.0",
            targetId: "scene-material-7",
            action: "rebind",
            candidateId: "caption-0-0",
            rationale: "当前字幕是同一句口播的 TTS 展开表达。",
          };
        },
      },
    });
    assert.equal(result.success, true);
    assert.equal(result.targetKind, "recording-scene");
    const repaired = JSON.parse(await readFile(scenePlanPath, "utf8"));
    assert.equal(repaired.scenes.length, 1);
    assert.equal(repaired.scenes[0].required, true);
    assert.equal(repaired.scenes[0].startAnchor.text, "先看录音机这一组，参考图里最容易认出的是前");
    const evidence = JSON.parse(await readFile(result.evidencePath, "utf8"));
    assert.equal(evidence.targetKind, "recording-scene");
    assert.equal(evidence.validation.requiredUnresolved, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("automatic production recovery resumes after a validated Agent binding repair", () => {
  const decision = decideAutomaticProductionRecovery({
    recovery: {
      status: "blocked",
      failure: { code: "BINDING_ANCHOR_NOT_FOUND", category: "binding" },
      resume: { enabled: false, action: "continue", stage: "visual-input-preflight" },
    },
    diagnosis: {
      safeToResume: false,
      recommendedAction: "repair-binding",
      userMessage: "重绑定后继续",
    },
    attempts: 0,
    readiness: { readinessStatus: "ready", readinessSha256: "readiness-1" },
    repair: { kind: "validated-binding-repair", success: true, targetId: "conclusion-beat-1" },
  });
  assert.equal(decision.action, "resume");
  assert.equal(decision.reason, "automatic-binding-repair");
  assert.equal(decision.stage, "visual-input-preflight");
});

test("a validated binding repair overrides a conservative request-user diagnosis", () => {
  const decision = decideAutomaticProductionRecovery({
    recovery: {
      status: "blocked",
      failure: { code: "BINDING_ANCHOR_NOT_FOUND", category: "binding" },
      resume: { enabled: false, action: "continue", stage: "visual-input-preflight" },
    },
    diagnosis: {
      safeToResume: false,
      recommendedAction: "request-user",
      userMessage: "请用户处理",
    },
    attempts: 0,
    readiness: { readinessStatus: "ready", readinessSha256: "readiness-1" },
    repair: { kind: "validated-binding-repair", success: true, targetId: "scene-material-7" },
  });
  assert.equal(decision.action, "resume");
  assert.equal(decision.reason, "automatic-binding-repair");
  assert.equal(decision.stage, "visual-input-preflight");
});

test("production Agent recognizes one invalid confirmed component beat for speaker fallback", () => {
  assert.equal(
    visualContractTargetId({
      message:
        "component-props exited with code 1: Confirmed component beat overview:overview-beat-1 could not be materialized: Key statistics require 1-3 explicit numbers.",
    }),
    "overview-beat-1",
  );
  assert.equal(
    visualContractTargetId({ message: "Confirmed component beat start-beat-2 has no overlapping semantic evidence" }),
    "start-beat-2",
  );
  assert.equal(
    visualContractTargetId({
      details: {
        logTail: "Production Agent self-review requested speaker fallback for confirmed component beat: proof-beat-3",
      },
    }),
    "proof-beat-3",
  );
  const decision = decideAutomaticProductionRecovery({
    recovery: { status: "blocked", resume: { enabled: false, action: "continue", stage: "component-props" } },
    diagnosis: { safeToResume: false, recommendedAction: "repair-visual", userMessage: "回退后继续" },
    attempts: 0,
    readiness: { readinessStatus: "ready" },
    repair: { kind: "validated-visual-contract-repair", success: true, targetId: "overview-beat-1" },
  });
  assert.equal(decision.reason, "automatic-visual-contract-repair");
  assert.equal(decision.action, "resume");
});

test("production Agent resumes after an isolated source repair passes the complete validation gate", () => {
  const recovery = {
    status: "blocked",
    resume: { enabled: false, action: "continue", stage: "component-props" },
  };
  const diagnosis = {
    safeToResume: false,
    recommendedAction: "repair-code",
    userMessage: "修复组件契约后继续",
  };
  assert.deepEqual(
    decideAutomaticProductionRecovery({
      recovery,
      diagnosis,
      attempts: 0,
      readiness: { readinessStatus: "ready" },
      repair: {
        kind: "validated-source-repair",
        success: true,
        changedPaths: ["src/visual-brief/generator.ts", "tests/semantic-planning.test.ts"],
      },
    }),
    {
      action: "resume",
      reason: "automatic-source-repair",
      message: "从 component-props 安全恢复",
      workflowAction: "continue",
      stage: "component-props",
      attempt: 1,
    },
  );
});

test("production Agent source repair accepts technical defects but rejects human decisions and unsafe paths", () => {
  assert.equal(
    isAutonomousTechnicalRepairEligible({
      code: "VISUAL_PROPS_INVALID",
      category: "visual-contract",
      stage: "component-props",
    }),
    true,
  );
  assert.equal(
    isAutonomousTechnicalRepairEligible({
      code: "BINDING_ANCHOR_NOT_FOUND",
      category: "binding",
      stage: "visual-input-preflight",
    }),
    false,
  );
  assert.equal(
    isAutonomousTechnicalRepairEligible({
      code: "QA_FAILED",
      category: "visual-contract",
      stage: "delivery-validate",
    }),
    true,
  );
  assert.deepEqual(validateAutonomousRepairPaths(["src/fix.ts", "tests/fix.test.ts"]), [
    "src/fix.ts",
    "tests/fix.test.ts",
  ]);
  assert.throws(() => validateAutonomousRepairPaths(["projects/real-project/project.json"]), /cannot modify/);
  assert.throws(() => validateAutonomousRepairPaths(["package-lock.json"]), /cannot modify/);
});

test("production Agent source repair works from a modified source snapshot without Git metadata", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "seanlab-source-snapshot-repair-"));
  try {
    await mkdir(resolve(root, "src"), { recursive: true });
    await mkdir(resolve(root, "tests"), { recursive: true });
    await writeFile(resolve(root, "src", "fixture.ts"), "export const value = 'user-modified';\n");
    await writeFile(resolve(root, "tests", "fixture.test.ts"), "export const fixture = true;\n");
    await writeFile(resolve(root, "package.json"), '{"scripts":{}}\n');

    const commands = [];
    const result = await runProductionAgentTechnicalRepair({
      projectId: "snapshot-repair",
      recovery: {
        failure: { code: "VISUAL_PROPS_INVALID", category: "visual-contract", stage: "component-props" },
      },
      agentId: "codex-cli",
      model: "fixture",
      repoRoot: root,
      execute: async ({ command, args, cwd }) => {
        commands.push({ command, args });
        if (command === "codex") {
          assert.equal(args.includes("--skip-git-repo-check"), true);
          await writeFile(resolve(cwd, "src", "fixture.ts"), "export const value = 'agent-repaired';\n");
          await writeFile(resolve(cwd, "tests", "new-repair.test.ts"), "export const repaired = true;\n");
        }
        return { stdout: "", stderr: "" };
      },
    });

    assert.equal(result.success, true);
    assert.deepEqual(result.changedPaths, ["src/fixture.ts", "tests/new-repair.test.ts"]);
    assert.equal(await readFile(resolve(root, "src", "fixture.ts"), "utf8"), "export const value = 'agent-repaired';\n");
    assert.equal(await readFile(resolve(root, "tests", "new-repair.test.ts"), "utf8"), "export const repaired = true;\n");
    assert.equal(commands.some(({ command }) => command === "git"), false);
    assert.equal(commands.filter(({ command }) => command === "npm").length, 5);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("automatic production recovery accepts only a successful allowlisted provider environment repair", () => {
  const recovery = {
    status: "recoverable",
    resume: { enabled: true, action: "continue", stage: "translate" },
  };
  const diagnosis = {
    safeToResume: false,
    recommendedAction: "repair-config",
    userMessage: "重新读取本地凭据",
  };
  const readiness = { readinessStatus: "ready" };
  assert.equal(
    decideAutomaticProductionRecovery({
      recovery,
      diagnosis,
      attempts: 0,
      readiness,
      repair: { kind: "provider-environment-refresh", success: true },
    }).reason,
    "automatic-provider-env-refresh",
  );
  assert.equal(
    decideAutomaticProductionRecovery({
      recovery,
      diagnosis,
      attempts: 0,
      readiness,
      repair: { kind: "provider-environment-refresh", success: false },
    }).action,
    "wait-human",
  );
});

test("production Agent resumes a validated delivery checkpoint and exits only after validation", () => {
  const decision = decideAutomaticProductionRecovery({
    recovery: {
      status: "recoverable",
      resume: { enabled: true, action: "delivery", stage: "delivery-validate" },
    },
    diagnosis: {
      safeToResume: true,
      recommendedAction: "recheck",
      userMessage: "recheck delivery",
    },
    attempts: 0,
    readiness: { readinessStatus: "ready" },
  });
  assert.equal(decision.action, "resume");
  assert.equal(decision.workflowAction, "delivery");
  assert.equal(decision.stage, "delivery-validate");
});

test("generated project assets remain pending until explicitly promoted", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "seanlab-generated-assets-"));
  try {
    await mkdir(resolve(root, "demo"), { recursive: true });
    const image = resolve(root, "input.png");
    await writeFile(image, "fixture-image");
    const script = `
      import {
        recordGeneratedAsset,
        listGeneratedAssetCandidates,
        listPromotedImageAssets,
        promoteGeneratedAsset,
        resolveImageAssetPreview
      } from ${JSON.stringify(new URL("../scripts/creator/generated-assets.mjs", import.meta.url).href)};
      const asset = await recordGeneratedAsset({
        projectId: "demo",
        sourcePath: ${JSON.stringify(image)},
        subject: "录音机",
        beatId: "beat-1",
        templateId: "paper-editorial",
        prompt: "fixture",
        negativePrompt: "none",
        agentId: "codex-cli"
      });
      if (asset.status !== "project-only") throw new Error("asset was not project-only");
      if ((await listGeneratedAssetCandidates()).length !== 1) throw new Error("pending asset was not listed");
      const promoted = await promoteGeneratedAsset({ projectId: "demo", assetId: asset.id });
      if (promoted.status !== "promoted") throw new Error("asset was not promoted");
      if ((await listGeneratedAssetCandidates()).length !== 0) throw new Error("promoted asset remained pending");
      const images = await listPromotedImageAssets();
      if (images.length !== 1 || images[0].id !== asset.id) throw new Error("promoted image was not listed");
      if ((await resolveImageAssetPreview({ assetId: asset.id })).size !== 13)
        throw new Error("promoted image preview was not resolved");
    `;
    await promisify(execFile)(process.execPath, ["--input-type=module", "-e", script], {
      cwd: process.cwd(),
      env: { ...process.env, REMOTION_MD_CREATOR_ROOT: root },
    });
    const shared = JSON.parse(await readFile(resolve(root, ".asset-library/images/registry.json"), "utf8"));
    assert.equal(shared.assets.length, 1);
    assert.equal(shared.assets[0].origin, "generated");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("image asset library reads legacy generated registry without migrating it", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "seanlab-image-assets-legacy-"));
  try {
    const directory = resolve(root, ".asset-library/generated/legacy-recorder");
    await mkdir(directory, { recursive: true });
    await writeFile(resolve(directory, "asset.png"), "legacy-image");
    await writeFile(
      resolve(root, ".asset-library/generated/registry.json"),
      JSON.stringify({
        schemaVersion: "1.0",
        assets: [
          {
            id: "legacy-recorder",
            subject: "旧录音机",
            file: "legacy-recorder/asset.png",
            promotedAt: "2026-07-01T00:00:00.000Z",
          },
        ],
      }),
    );
    const script = `
      import {
        listPromotedImageAssets,
        resolveImageAssetPreview
      } from ${JSON.stringify(new URL("../scripts/creator/generated-assets.mjs", import.meta.url).href)};
      const assets = await listPromotedImageAssets();
      if (assets.length !== 1 || assets[0].origin !== "generated") throw new Error("legacy asset was not listed");
      if ((await resolveImageAssetPreview({ assetId: "legacy-recorder" })).size !== 12)
        throw new Error("legacy image preview was not resolved");
    `;
    await promisify(execFile)(process.execPath, ["--input-type=module", "-e", script], {
      cwd: process.cwd(),
      env: { ...process.env, REMOTION_MD_CREATOR_ROOT: root },
    });
    await assert.rejects(readFile(resolve(root, ".asset-library/images/registry.json")), /ENOENT/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("batch promotion validates every asset before changing registries and promotes valid selections", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "seanlab-generated-assets-batch-"));
  try {
    await mkdir(resolve(root, "demo"), { recursive: true });
    const firstImage = resolve(root, "first.png");
    const secondImage = resolve(root, "second.png");
    await writeFile(firstImage, "first-image");
    await writeFile(secondImage, "second-image");
    const script = `
      import assert from "node:assert/strict";
      import { readFile, writeFile } from "node:fs/promises";
      import { resolve } from "node:path";
      import {
        recordGeneratedAsset,
        promoteGeneratedAssetsBatch
      } from ${JSON.stringify(new URL("../scripts/creator/generated-assets.mjs", import.meta.url).href)};
      const create = (sourcePath, subject) => recordGeneratedAsset({
        projectId: "demo",
        sourcePath,
        subject,
        beatId: "beat-1",
        templateId: "paper-editorial",
        prompt: "fixture",
        negativePrompt: "none",
        agentId: "codex-cli"
      });
      const first = await create(${JSON.stringify(firstImage)}, "一号");
      const second = await create(${JSON.stringify(secondImage)}, "二号");
      const registryPath = resolve(${JSON.stringify(root)}, "demo/generated-assets/registry.json");
      const registry = JSON.parse(await readFile(registryPath, "utf8"));
      const secondAsset = registry.assets.find((asset) => asset.id === second.id);
      const secondSha256 = secondAsset.sha256;
      secondAsset.sha256 = "invalid";
      await writeFile(registryPath, JSON.stringify(registry));
      await assert.rejects(
        promoteGeneratedAssetsBatch({
          selections: [
            { projectId: "demo", assetId: first.id },
            { projectId: "demo", assetId: second.id }
          ]
        }),
        /checksum does not match/
      );
      const unchanged = JSON.parse(await readFile(registryPath, "utf8"));
      assert.equal(unchanged.assets[0].status, "project-only");
      assert.equal(unchanged.assets[1].status, "project-only");
      unchanged.assets.find((asset) => asset.id === second.id).sha256 = secondSha256;
      await writeFile(registryPath, JSON.stringify(unchanged));
      const promoted = await promoteGeneratedAssetsBatch({
        selections: [
          { projectId: "demo", assetId: first.id },
          { projectId: "demo", assetId: second.id }
        ]
      });
      assert.equal(promoted.length, 2);
      assert.ok(promoted.every((asset) => asset.status === "promoted"));
    `;
    await promisify(execFile)(process.execPath, ["--input-type=module", "-e", script], {
      cwd: process.cwd(),
      env: { ...process.env, REMOTION_MD_CREATOR_ROOT: root },
    });
    const shared = JSON.parse(await readFile(resolve(root, ".asset-library/images/registry.json"), "utf8"));
    assert.equal(shared.assets.length, 2);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("generated asset preview and promotion reject registry path traversal", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "seanlab-generated-assets-traversal-"));
  try {
    await mkdir(resolve(root, "demo"), { recursive: true });
    const image = resolve(root, "input.png");
    await writeFile(image, "fixture-image");
    const script = `
      import assert from "node:assert/strict";
      import { readFile, writeFile } from "node:fs/promises";
      import { resolve } from "node:path";
      import {
        recordGeneratedAsset,
        promoteGeneratedAsset,
        resolveGeneratedAssetPreview
      } from ${JSON.stringify(new URL("../scripts/creator/generated-assets.mjs", import.meta.url).href)};
      const asset = await recordGeneratedAsset({
        projectId: "demo",
        sourcePath: ${JSON.stringify(image)},
        subject: "录音机",
        beatId: "beat-1",
        templateId: "paper-editorial",
        prompt: "fixture",
        negativePrompt: "none",
        agentId: "codex-cli"
      });
      const preview = await resolveGeneratedAssetPreview({ projectId: "demo", assetId: asset.id });
      assert.equal(preview.size, 13);
      assert.match(preview.path, /production\\.png$/);
      const registryPath = resolve(${JSON.stringify(root)}, "demo/generated-assets/registry.json");
      const registry = JSON.parse(await readFile(registryPath, "utf8"));
      registry.assets[0].files.production = "../../input.png";
      await writeFile(registryPath, JSON.stringify(registry));
      await assert.rejects(
        resolveGeneratedAssetPreview({ projectId: "demo", assetId: asset.id }),
        /escapes the generated asset directory/
      );
      await assert.rejects(
        promoteGeneratedAsset({ projectId: "demo", assetId: asset.id }),
        /escapes the generated asset directory/
      );
    `;
    await promisify(execFile)(process.execPath, ["--input-type=module", "-e", script], {
      cwd: process.cwd(),
      env: { ...process.env, REMOTION_MD_CREATOR_ROOT: root },
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
