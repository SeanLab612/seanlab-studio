import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { MULTI_TOPIC_REGRESSION_SUITE } from "../../src/regression-fixtures/topic-fixtures.ts";
import { validateTopicRegressionSuite } from "../../src/regression-fixtures/topic-suite.ts";

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
};
const jsonPath = resolve(option("--json", "out/feature-0.2.16/topic-suite-review.json"));
const markdownPath = resolve(option("--markdown", "out/feature-0.2.16/topic-suite-review.md"));

validateTopicRegressionSuite(MULTI_TOPIC_REGRESSION_SUITE, { verifyMaterials: true });
const suiteContentSha256 = createHash("sha256").update(JSON.stringify(MULTI_TOPIC_REGRESSION_SUITE)).digest("hex");
const componentCoverage = Object.fromEntries(
  MULTI_TOPIC_REGRESSION_SUITE.fixtures.flatMap((fixture) =>
    fixture.expectations.flatMap((expectation) =>
      expectation.expectedOneOf.map((component) => [component, fixture.id]),
    ),
  ),
);
const report = {
  schemaVersion: "1.0",
  suiteId: MULTI_TOPIC_REGRESSION_SUITE.suiteId,
  status: "awaiting-human-script-review",
  generatedAt: new Date().toISOString(),
  suiteContentSha256,
  fixtures: MULTI_TOPIC_REGRESSION_SUITE.fixtures.map((fixture) => ({
    id: fixture.id,
    title: fixture.title,
    purpose: fixture.purpose,
    sourceFacts: fixture.sourceFacts,
    materials: fixture.materials.map(({ id, kind, path, sha256, rights, provenance }) => ({
      id,
      kind,
      path,
      sha256,
      rights,
      provenance,
    })),
    narration: fixture.narration,
    expectations: fixture.expectations,
  })),
  summary: {
    fixtures: MULTI_TOPIC_REGRESSION_SUITE.fixtures.length,
    expectations: MULTI_TOPIC_REGRESSION_SUITE.fixtures.reduce(
      (count, fixture) => count + fixture.expectations.length,
      0,
    ),
    components: Object.keys(componentCoverage).length,
    componentCoverage,
    agentCalls: 0,
    renders: 0,
  },
};
const canonical = JSON.stringify(report);
report.reportSha256 = createHash("sha256").update(canonical).digest("hex");
await mkdir(dirname(jsonPath), { recursive: true });
await mkdir(dirname(markdownPath), { recursive: true });
await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

const markdown = `# 0.2.16 多主题回归口播审核包

- 状态：等待人工审核口播与视觉关系
- 主题：${report.summary.fixtures}
- 视觉关系：${report.summary.expectations}
- 组件覆盖：${report.summary.components}/20
- Agent 调用：0
- 渲染：0
- 夹具内容 SHA-256：${report.suiteContentSha256}
- 报告 SHA-256：${report.reportSha256}

${MULTI_TOPIC_REGRESSION_SUITE.fixtures
  .map(
    (fixture, fixtureIndex) => `## ${fixtureIndex + 1}. ${fixture.title}

测试目的：${fixture.purpose}

### 口播稿

${fixture.narration.fullScript}

### 期望视觉关系

${fixture.expectations
  .map(
    (expectation) =>
      `- ${expectation.evidenceText}\n  - 形式：${expectation.form}\n  - 允许组件：${expectation.expectedOneOf.join("、")}\n  - 图标：${expectation.expectedIconIds?.join("、") || "无指定"}\n  - 素材：${expectation.materialId || "无绑定素材"}`,
  )
  .join("\n")}

### 来源

${fixture.sourceFacts.map((source) => `- ${source.text}\n  - ${source.sourceUrl}`).join("\n")}`,
  )
  .join("\n\n")}
`;
await writeFile(markdownPath, markdown);
console.log(
  JSON.stringify({
    event: "fixtures.topic-review.written",
    jsonPath,
    markdownPath,
    suiteContentSha256: report.suiteContentSha256,
    reportSha256: report.reportSha256,
  }),
);
