import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  deriveNamedItemCountEvidence,
  evaluateNarrationConformance,
  evaluateRecutConformance,
  evaluateSemanticConformance,
  evaluateSourceGrounding,
  pairwiseMinimumSimilarity,
  semanticSegmentClaimText,
  sha256Json,
} from "../src/agents/conformance.ts";
import {
  approvedAgentModelPairs,
  assertApprovedAgentModel,
  registerConformanceCandidate,
  reviewAgentModelCandidate,
  validateAgentModelGovernance,
} from "../src/agents/governance.ts";

const assertStrictObjectSchemas = (schema: unknown, path = "$") => {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) return;
  const value = schema as Record<string, unknown>;
  if (value.type === "object" && value.properties && typeof value.properties === "object") {
    const keys = Object.keys(value.properties);
    assert.deepEqual(
      new Set(value.required as string[] | undefined),
      new Set(keys),
      `${path} must require every property`,
    );
  }
  for (const [key, child] of Object.entries(value)) assertStrictObjectSchemas(child, `${path}.${key}`);
};

test("Agent/model governance fails closed unless every approved pair has complete evidence", () => {
  const candidate = validateAgentModelGovernance({
    schemaVersion: "1.0",
    contractVersion: "agent-model-governance-1.0",
    pairs: [
      {
        id: "codex-cli.gpt-test",
        agentId: "codex-cli",
        model: "gpt-test",
        status: "candidate",
        testedStages: ["narration"],
        conformanceReportSha256: null,
        review: null,
      },
    ],
  });
  assert.deepEqual(approvedAgentModelPairs(candidate), []);
  assert.throws(() => assertApprovedAgentModel(candidate, "codex-cli", "gpt-test"), /not approved/);
  assert.throws(
    () =>
      validateAgentModelGovernance({
        ...candidate,
        pairs: [{ ...candidate.pairs[0], status: "approved" }],
      }),
    /lacks complete conformance evidence/,
  );
});

test("approved Agent/model pairs require all three tested stages and an exact report hash", () => {
  const registry = validateAgentModelGovernance({
    schemaVersion: "1.0",
    contractVersion: "agent-model-governance-1.0",
    pairs: [
      {
        id: "claude-code.model-test",
        agentId: "claude-code",
        model: "model-test",
        status: "approved",
        testedStages: ["narration", "recut", "semantic-plan"],
        conformanceReportSha256: "a".repeat(64),
        review: {
          reviewer: "Sean",
          reviewedAt: "2026-07-17T00:00:00.000Z",
          reason: "Reviewed the complete conformance report.",
        },
      },
    ],
  });
  assert.equal(assertApprovedAgentModel(registry, "claude-code", "model-test").id, "claude-code.model-test");
});

test("a passing report only registers a candidate until an exact-hash human review", () => {
  const empty = validateAgentModelGovernance({
    schemaVersion: "1.0",
    contractVersion: "agent-model-governance-1.0",
    pairs: [],
  });
  const report = {
    schemaVersion: "1.0",
    contractVersion: "agent-conformance-1.0",
    agent: {
      id: "codex-cli",
      requestedModel: "gpt-test",
      observedModels: ["gpt-test"],
    },
    summary: {
      stages: {
        narration: { runs: 3, passed: 3, blocked: 0, failed: 0 },
        recut: { runs: 3, passed: 3, blocked: 0, failed: 0 },
        "semantic-plan": { runs: 3, passed: 3, blocked: 0, failed: 0 },
      },
    },
    status: "passed",
  };
  const hash = "b".repeat(64);
  const candidate = registerConformanceCandidate({ registry: empty, report, reportSha256: hash });
  assert.equal(candidate.pairs[0].status, "candidate");
  assert.deepEqual(approvedAgentModelPairs(candidate), []);
  assert.throws(
    () =>
      reviewAgentModelCandidate({
        registry: candidate,
        pairId: "codex-cli.gpt-test",
        decision: "approved",
        reportSha256: "c".repeat(64),
        reviewer: "Sean",
        reviewedAt: "2026-07-17T00:00:00.000Z",
        reason: "Reviewed.",
      }),
    /hash does not match/,
  );
  const approved = reviewAgentModelCandidate({
    registry: candidate,
    pairId: "codex-cli.gpt-test",
    decision: "approved",
    reportSha256: hash,
    reviewer: "Sean",
    reviewedAt: "2026-07-17T00:00:00.000Z",
    reason: "Reviewed the isolated attempts and comparison report.",
  });
  assert.equal(assertApprovedAgentModel(approved, "codex-cli", "gpt-test").status, "approved");
});

test("offline rescoring cannot create an Agent/model governance candidate", () => {
  const empty = validateAgentModelGovernance({
    schemaVersion: "1.0",
    contractVersion: "agent-model-governance-1.0",
    pairs: [],
  });
  assert.throws(
    () =>
      registerConformanceCandidate({
        registry: empty,
        report: {
          schemaVersion: "1.0",
          contractVersion: "agent-conformance-1.0",
          agent: {
            id: "codex-cli",
            requestedModel: "gpt-test",
            observedModels: ["gpt-test"],
          },
          attempts: [{ replayedFrom: "/ignored/previous-run" }],
          summary: {
            stages: {
              narration: { runs: 1, passed: 1, blocked: 0, failed: 0 },
              recut: { runs: 1, passed: 1, blocked: 0, failed: 0 },
              "semantic-plan": { runs: 1, passed: 1, blocked: 0, failed: 0 },
            },
          },
          status: "passed",
        },
        reportSha256: "d".repeat(64),
      }),
    /Offline replay reports cannot become/,
  );
});

test("every Agent-facing output schema satisfies strict structured-output object requirements", () => {
  for (const path of [
    "schemas/narration-script-package.schema.json",
    "schemas/animation-asset-plan.schema.json",
    "schemas/recut-provider-plan.schema.json",
    "schemas/semantic-narrative-plan.schema.json",
  ]) {
    assertStrictObjectSchemas(JSON.parse(readFileSync(path, "utf8")), path);
  }
});

test("conformance scoring keeps narration grounding, recut safety, and semantic evidence separate", () => {
  const narration = evaluateNarrationConformance({
    narration: {
      schemaVersion: "1.0",
      title: "Studio",
      opening: "大家好，这里是 Sean 的实验室，SeanLab。",
      overview: "Studio 使用静态审核。",
      transitionAnchor: "好了，接下来我们正式开始。",
      sections: [
        {
          id: "static-review",
          title: "静态审核",
          narration: "静态审核会冻结证据。",
          visualIntent: "semantic-visual",
          materialIds: ["studio-shot"],
          recordingInstruction: null,
        },
        {
          id: "delivery",
          title: "交付",
          narration: "交付读取批准快照。",
          visualIntent: "speaker",
          materialIds: [],
          recordingInstruction: null,
        },
      ],
      conclusion: "这就是本地生产流程。",
      fullScript:
        "大家好，这里是 Sean 的实验室，SeanLab。\n\nStudio 使用静态审核。\n\n好了，接下来我们正式开始。\n\n静态审核会冻结证据。\n\n交付读取批准快照。\n\n这就是本地生产流程。",
      shootingGuide: ["拍摄人物口播"],
    },
    requiredTerms: ["静态审核", "批准快照"],
    forbiddenTerms: ["云端协作"],
    registeredMaterialIds: ["studio-shot"],
  });
  assert.equal(narration.passed, true);

  const recut = evaluateRecutConformance({
    plan: {
      schemaVersion: "1.0",
      candidates: [{ kind: "filler", startWord: 2, endWord: 2, confidence: 0.98, reason: "明确填充词" }],
    },
    expectedCandidates: [{ kind: "filler", startWord: 2, endWord: 2 }],
    protectedWordRanges: [{ startWord: 5, endWord: 8 }],
  });
  assert.equal(recut.passed, true);

  const semantic = evaluateSemanticConformance({
    plan: {
      schemaVersion: "1.0",
      analyzedThroughCue: 3,
      segments: [
        {
          startCue: 0,
          endCue: 1,
          visualPriority: "high",
          rhetoric: "comparison",
          motionIntent: "compare",
          reason: "对比",
          confidence: 0.9,
          narrative: {
            eyebrow: "TEST",
            title: "两种路径",
            subtitleZh: "对比",
            subtitleEn: "Compare",
            takeaway: "取舍",
          },
          items: [],
          timeSeries: [],
          matrix: { rows: [], columns: [], values: [], xLabel: "", yLabel: "" },
          quote: { text: "", sourceName: "", sourceRole: "" },
          mediaIntents: [],
          imageEvidence: null,
        },
        {
          startCue: 2,
          endCue: 3,
          visualPriority: "normal",
          rhetoric: "image-evidence",
          motionIntent: "introduce",
          reason: "图片证据",
          confidence: 0.88,
          narrative: {
            eyebrow: "PROOF",
            title: "静态审核证据",
            subtitleZh: "界面",
            subtitleEn: "Evidence",
            takeaway: "可检查",
          },
          items: [],
          timeSeries: [],
          matrix: { rows: [], columns: [], values: [], xLabel: "", yLabel: "" },
          quote: { text: "", sourceName: "", sourceRole: "" },
          mediaIntents: [],
          imageEvidence: { assetId: "studio-shot", purpose: "prove", caption: "静态审核界面" },
        },
      ],
    },
    expectedEvidenceRanges: [{ startCue: 2, endCue: 3 }],
    forbiddenTerms: ["80%覆盖率"],
    registeredImageIds: ["studio-shot"],
    materializedCandidateCount: 2,
    viewerCopyPassCount: 2,
    layoutCapacityPassCount: 2,
  });
  assert.equal(semantic.passed, true);
  assert.equal(semantic.evidencePrecision, 1);
  assert.equal(semantic.evidenceRecall, 1);
  assert.equal(
    pairwiseMinimumSimilarity([
      ["0-1", "2-3"],
      ["0-1", "2-3"],
    ]),
    1,
  );
  assert.equal(sha256Json({ b: 2, a: 1 }), sha256Json({ a: 1, b: 2 }));
});

test("semantic evidence scoring penalizes cue overreach instead of accepting partial IoU", () => {
  const semantic = evaluateSemanticConformance({
    plan: {
      schemaVersion: "1.0",
      analyzedThroughCue: 1,
      segments: [
        {
          startCue: 0,
          endCue: 1,
          visualPriority: "high",
          rhetoric: "image-evidence",
          motionIntent: "introduce",
          reason: "The image proves only cue zero but the provider merged cue one.",
          confidence: 0.95,
          narrative: {
            eyebrow: "PROOF",
            title: "约四千星并提供视频模板",
            subtitleZh: "GitHub 指标和模板能力",
            subtitleEn: "GitHub evidence",
            takeaway: "项目约有四千星并提供视频模板",
          },
          items: [],
          timeSeries: [],
          matrix: { rows: [], columns: [], values: [], xLabel: "", yLabel: "" },
          quote: { text: "", sourceName: "", sourceRole: "" },
          mediaIntents: [],
          imageEvidence: { assetId: "github-shot", purpose: "prove", caption: "页面显示约 4K Stars" },
        },
      ],
    },
    expectedEvidenceRanges: [{ startCue: 0, endCue: 0 }],
    forbiddenTerms: [],
    registeredImageIds: ["github-shot"],
    materializedCandidateCount: 1,
    viewerCopyPassCount: 1,
    layoutCapacityPassCount: 1,
  });
  assert.equal(semantic.evidencePrecision, 0.5);
  assert.equal(semantic.evidenceRecall, 1);
  assert.equal(semantic.passed, false);
});

test("narration coverage treats Chinese and English metric units as equivalent", () => {
  const narration = evaluateNarrationConformance({
    narration: {
      schemaVersion: "1.0",
      title: "html-video 的 GitHub 数据",
      opening: "大家好，这里是 Sean 的实验室，SeanLab。",
      overview: "项目在 GitHub 上大约有四千个 Star。",
      transitionAnchor: "好了，接下来我们正式开始。",
      sections: [
        {
          id: "stars",
          title: "GitHub Stars",
          narration: "登记截图显示大约四千个 Star。",
          visualIntent: "screenshot",
          materialIds: ["github-shot"],
          recordingInstruction: null,
        },
      ],
      conclusion: "这张截图支持大约四千个 Star。",
      fullScript:
        "大家好，这里是 Sean 的实验室，SeanLab。项目在 GitHub 上大约有四千个 Star。登记截图显示大约四千个 Star。这张截图支持大约四千个 Star。",
      shootingGuide: [],
    },
    requiredTerms: ["GitHub", "四千个星"],
    forbiddenTerms: [],
    sourceGroundingText: "项目在 GitHub 上大约有四千个星，截图支持这项数据。",
    registeredMaterialIds: ["github-shot"],
  });
  assert.equal(narration.requiredTermCoverage, 1);
  assert.equal(narration.passed, true);
});

test("source grounding blocks factual qualifiers absent from the frozen evidence", () => {
  const semantic = evaluateSemanticConformance({
    plan: {
      schemaVersion: "1.0",
      analyzedThroughCue: 0,
      videoIdentity: {
        eyebrow: "HTML VIDEO",
        title: "四千星开源视频工具",
        subject: "获得社区认可的开源 HTML 视频工具",
        startCue: 0,
        endCue: 0,
        confidence: 0.92,
      },
      segments: [
        {
          startCue: 0,
          endCue: 0,
          visualPriority: "high",
          rhetoric: "image-evidence",
          motionIntent: "introduce",
          reason: "Screenshot evidence",
          confidence: 0.95,
          narrative: {
            eyebrow: "PROOF",
            title: "四千星开源视频工具",
            subtitleZh: "社区认可的开源项目",
            subtitleEn: "GitHub evidence",
            takeaway: "这个工具已经获得社区认可",
          },
          items: [],
          timeSeries: [],
          matrix: { rows: [], columns: [], values: [], xLabel: "", yLabel: "" },
          quote: { text: "", sourceName: "", sourceRole: "" },
          mediaIntents: [],
          imageEvidence: { assetId: "github-shot", purpose: "prove", caption: "页面显示约 4K Stars" },
        },
      ],
    },
    expectedEvidenceRanges: [{ startCue: 0, endCue: 0 }],
    forbiddenTerms: [],
    sourceGroundingText: "这个项目在 GitHub 上已经大约有四千个星。",
    registeredImageIds: ["github-shot"],
    materializedCandidateCount: 1,
    viewerCopyPassCount: 1,
    layoutCapacityPassCount: 1,
  });
  assert.ok(semantic.unsupportedSourceTerms.includes("开源"));
  assert.ok(semantic.unsupportedSourceTerms.includes("工具"));
  assert.ok(semantic.unsupportedSourceTerms.includes("社区"));
  assert.ok(semantic.unsupportedSourceTerms.includes("认可"));
  assert.equal(semantic.passed, false);
});

test("source grounding treats quantified Chinese numerals as equivalent to Arabic numerals", () => {
  const report = evaluateSourceGrounding({
    outputText: "3 个重点，2 种做法，4 个阶段",
    sourceText: "三个重点，两种做法，四个阶段",
  });
  assert.deepEqual(report.unsupportedSourceTerms, []);
  assert.deepEqual(new Set(report.groundedSourceTerms), new Set(["3", "2", "4"]));
});

test("source grounding treats Chinese numeral lists as equivalent to Arabic score values", () => {
  const report = evaluateSourceGrounding({
    outputText: "92分、86分、78分和71分",
    sourceText: "得分分别是九十二、八十六、七十八和七十一",
  });
  assert.deepEqual(report.unsupportedSourceTerms, []);
  assert.deepEqual(new Set(report.groundedSourceTerms), new Set(["92", "86", "78", "71"]));
});

test("source grounding treats 无需 as 不需要 and ignores lexical singulars and ordinals", () => {
  const report = evaluateSourceGrounding({
    outputText: "无需一开始面对全部设置，做法一进入下一阶段，这是一种内容呈现形式。",
    sourceText: "不需要一开始面对全部设置。",
  });
  assert.deepEqual(report.unsupportedSourceTerms, []);
  assert.deepEqual(report.groundedSourceTerms, ["不需要"]);
});

test("source grounding recognizes direct English evidence translated into Chinese narration", () => {
  const report = evaluateSourceGrounding({
    outputText: "项目支持 Codex，是 Claude Design 的开源替代方案，并采用 Apache 2.0 许可证。",
    sourceText:
      "The open-source Claude Design alternative. Codex is supported. Licensed under the Apache License, Version 2.0.",
  });
  assert.deepEqual(report.unsupportedSourceTerms, []);
  assert.deepEqual(new Set(report.groundedSourceTerms), new Set(["开源", "支持", "替代", "许可证", "2.0"]));
});

test("source grounding still blocks Chinese factual qualifiers absent from English evidence", () => {
  const report = evaluateSourceGrounding({
    outputText: "这是成熟稳定、广受欢迎的开源替代方案。",
    sourceText: "The open-source alternative.",
  });
  assert.deepEqual(new Set(report.unsupportedSourceTerms), new Set(["稳定", "受欢迎", "成熟"]));
});

test("source grounding can prove a derived list count only from explicitly named labels", () => {
  assert.equal(
    deriveNamedItemCountEvidence({
      labels: ["越多越好", "越复杂越好"],
      sourceText: "先显示越多越好和越复杂越好，然后把它们划掉。",
    }),
    "2项",
  );
  assert.equal(
    deriveNamedItemCountEvidence({
      labels: ["越多越好", "未在证据中出现"],
      sourceText: "只说了越多越好。",
    }),
    undefined,
  );
});

test("semantic grounding excludes deterministic list ordinals but retains real numeric claims", () => {
  const claimText = semanticSegmentClaimText({
    narrative: {
      title: "逐步推进",
      subtitleZh: "按顺序完成",
      takeaway: "关注当前任务",
    },
    items: [
      { label: "创建", detail: "进入流程", displayValue: "1", unit: "步", timeLabel: "" },
      { label: "写稿", detail: "准备内容", displayValue: "2", unit: "步", timeLabel: "" },
      { label: "交付", detail: "生成成片", displayValue: "3", unit: "步", timeLabel: "" },
    ],
    imageEvidence: null,
    quote: { text: "", sourceName: "", sourceRole: "" },
  } as never);
  assert.equal(claimText.includes("\n1\n"), false);
  assert.equal(claimText.includes("\n2\n"), false);
  assert.equal(claimText.includes("\n3\n"), false);
  const unsupported = evaluateSourceGrounding({
    outputText: `${claimText}\n9 个额外步骤`,
    sourceText: "创建、写稿和交付。",
  });
  assert.deepEqual(unsupported.unsupportedSourceTerms, ["9"]);
});

test("recut conformance accepts equivalent split or merged false-start boundaries", () => {
  const acceptableCandidateSets = [
    [
      { kind: "filler", startWord: 3, endWord: 3 },
      { kind: "false-start", startWord: 4, endWord: 6 },
    ],
    [{ kind: "duplicate-retake", startWord: 3, endWord: 6 }],
  ];
  const merged = evaluateRecutConformance({
    plan: {
      schemaVersion: "1.0",
      candidates: [{ kind: "duplicate-retake", startWord: 3, endWord: 6, confidence: 0.98, reason: "Clean retake" }],
    },
    acceptableCandidateSets,
    protectedWordRanges: [{ startWord: 11, endWord: 13 }],
  });
  const split = evaluateRecutConformance({
    plan: {
      schemaVersion: "1.0",
      candidates: [
        { kind: "filler", startWord: 3, endWord: 3, confidence: 0.98, reason: "Filler" },
        { kind: "false-start", startWord: 4, endWord: 6, confidence: 0.95, reason: "Abandoned start" },
      ],
    },
    acceptableCandidateSets,
    protectedWordRanges: [{ startWord: 11, endWord: 13 }],
  });
  assert.equal(merged.passed, true);
  assert.equal(split.passed, true);
});
