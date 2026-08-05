import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { evaluateAcceptance, evaluateResumeEvents } from "../scripts/operations/acceptance.mjs";
import { summarizeDoctorChecks } from "../scripts/operations/doctor.mjs";
import {
  OperationalError,
  classifyOperationalError,
  redactSecrets,
  summarizeStageLog,
} from "../scripts/operations/errors.mjs";
import { exportPortableBundle, verifyPortableBundle } from "../scripts/operations/portable-bundle.mjs";
import { providerCheck, runProjectPreflight } from "../scripts/operations/preflight.mjs";
import { CURRENT_ASSET_PROFILE, createManifest, readManifest, writeManifest } from "../scripts/workflow/manifest.mjs";
import { createStages } from "../scripts/workflow/stages.mjs";

const execFileAsync = promisify(execFile);

test("operational failures are structured and secrets are redacted", () => {
  const env = { MIMO_API_KEY: "super-secret-token" };
  assert.equal(redactSecrets("Bearer super-secret-token", env), "Bearer [REDACTED]");
  const failure = classifyOperationalError(
    new OperationalError("INPUT_SOURCE_MISSING", "Source video is missing"),
    { stage: "ingest" },
  );
  assert.equal(failure.code, "INPUT_SOURCE_MISSING");
  assert.match(failure.remediation, /Relink/);
});

test("stage log summaries prefer the real error over the Node version footer", () => {
  const log = `file:///project/plan.mjs:38\nError: Agent semantic plan remained invalid after repair: segments[1] exceeds the semantic density limit\nNode.js v22.23.1\n`;
  assert.equal(
    summarizeStageLog(log),
    "Agent semantic plan remained invalid after repair: segments[1] exceeds the semantic density limit",
  );
});

test("stage log summaries preserve typed operational failures from child processes", () => {
  const log = `OperationalError: Recording scene preflight failed: playback rate 0.612, below the 0.8 safety limit\nNode.js v22.23.1\n`;
  assert.match(summarizeStageLog(log), /Recording scene preflight failed/);
});

test("revision conflicts expose stable review remediation", () => {
  const failure = classifyOperationalError(new Error("Revision baseline conflict for planningSha256: the reviewed artifact has changed"), {stage: "apply-revision"});
  assert.equal(failure.code, "REVISION_BASELINE_CONFLICT");
  assert.equal(failure.category, "review-revision");
  assert.match(failure.remediation, /Reload the current review artifacts/);
});

test("production failures are classified into creator-facing recovery classes", () => {
  const cases = [
    ["Resolved narration would require playback rate 0.612, below the 0.8 safety limit", "INPUT_SCENE_DURATION_UNSAFE"],
    ["Confirmed animation section anchor was not found: overview", "BINDING_ANCHOR_NOT_FOUND"],
    ["Missing motion profile for process-steps", "REGISTRY_CONTRACT_INVALID"],
    ["VisualBrief props items are invalid", "VISUAL_PROPS_INVALID"],
    ["Missing component QA contract: process-steps", "QA_CONTRACT_MISSING"],
    ["Agent semantic provider request timed out", "PROVIDER_REQUEST_TIMEOUT"],
  ];
  for (const [message, code] of cases)
    assert.equal(classifyOperationalError(new Error(message), { stage: "component-props" }).code, code);
});

test("doctor summary distinguishes warnings from failures", () => {
  assert.equal(summarizeDoctorChecks([{ status: "passed" }, { status: "warning" }]).status, "warning");
  assert.equal(summarizeDoctorChecks([{ status: "failed" }]).status, "failed");
});

test("new projects select the authenticated Codex CLI semantic provider by default", () => {
  const manifest = createManifest({
    id: "codex-default",
    title: "Codex default",
    source: "/tmp/source.mp4",
    outputPath: "/tmp/codex-default/project.json",
  });
  assert.equal(manifest.providers.semanticPlanning.provider, "codex-cli");
  assert.equal(manifest.providers.translation.provider, "mimo");
});

test("provider preflight reuses Agent discovery instead of relying on the service PATH", async () => {
  const manifest = createManifest({
    id: "provider-discovery",
    title: "Provider discovery",
    source: "/tmp/source.mp4",
    outputPath: "/tmp/provider-discovery/project.json",
  });
  manifest.providers.translation.provider = "codex-cli";
  const check = await providerCheck(manifest, {
    detectAgentImpl: async (id) => ({
      id,
      available: true,
      authenticated: true,
      executablePath: "/Users/test/.npm-global/bin/codex",
      version: "codex-cli 1.0",
      remediation: null,
    }),
  });
  assert.equal(check.status, "passed");
  assert.equal(check.details.agent.executablePath, "/Users/test/.npm-global/bin/codex");
});

test("project preflight validates source, providers, assets, outputs, and resume state", async () => {
  const root = await mkdtemp(join(tmpdir(), "remotion-preflight-"));
  const source = join(root, "source.mp4");
  const transcript = join(root, "transcript.json");
  const recutFixture = join(root, "recut-fixture.json");
  const manifestPath = join(root, "project", "project.json");
  await writeFile(source, "source");
  await writeFile(transcript, JSON.stringify({ words: [] }));
  await writeFile(recutFixture, JSON.stringify({ schemaVersion: "1.0", candidates: [] }));
  const manifest = createManifest({ id: "preflight-test", title: "Preflight", source, transcript, outputPath: manifestPath });
  manifest.providers.translation.provider = "offline";
  manifest.providers.semanticPlanning.provider = "fixture";
  manifest.providers.recutPlanning.provider = "fixture";
  manifest.providers.recutPlanning.fixture = recutFixture;
  await writeManifest(manifest, manifestPath);
  const context = await readManifest(manifestPath);
  const report = await runProjectPreflight({ context, stages: createStages(context), currentAssetProfile: CURRENT_ASSET_PROFILE });
  assert.equal(report.summary.failed, 0);
  assert.ok(report.checks.some((item) => item.id === "output" && item.status === "passed"));
  assert.ok(report.checks.some((item) => item.id === "production-contracts" && item.status === "passed"));
});

test("workflow persists a precise structured preflight failure", async () => {
  const root = await mkdtemp(join(tmpdir(), "remotion-preflight-failure-"));
  const source = join(root, "missing.mp4");
  const transcript = join(root, "transcript.json");
  const manifestPath = join(root, "project", "project.json");
  await writeFile(transcript, JSON.stringify({ words: [] }));
  const manifest = createManifest({ id: "failure-test", title: "Failure", source, transcript, outputPath: manifestPath });
  manifest.providers.translation.provider = "offline";
  manifest.providers.semanticPlanning.provider = "fixture";
  await writeManifest(manifest, manifestPath);
  await assert.rejects(
    execFileAsync(process.execPath, ["scripts/workflow.mjs", "--project", manifestPath, "--until", "preflight"], {
      cwd: resolve("."),
    }),
  );
  const state = JSON.parse(await readFile(join(root, "project/workspace/run-state.json"), "utf8"));
  assert.equal(state.stages.preflight.status, "failed");
  assert.equal(state.stages.preflight.failure.code, "INPUT_SOURCE_MISSING");
  assert.match(state.stages.preflight.failure.remediation, /Relink/);
});

test("workflow readiness reports a missing source before any production stage starts", async () => {
  const root = await mkdtemp(join(tmpdir(), "remotion-readiness-source-"));
  const source = join(root, "missing.mp4");
  const transcript = join(root, "transcript.json");
  const manifestPath = join(root, "project", "project.json");
  await writeFile(transcript, JSON.stringify({ words: [] }));
  const manifest = createManifest({ id: "readiness-source", title: "Readiness", source, transcript, outputPath: manifestPath });
  manifest.providers.translation.provider = "offline";
  manifest.providers.semanticPlanning.provider = "fixture";
  await writeManifest(manifest, manifestPath);
  let stdout = "";
  await assert.rejects(
    execFileAsync(
      process.execPath,
      ["scripts/workflow.mjs", "--project", manifestPath, "--until", "recut", "--dry-run"],
      { cwd: resolve(".") },
    ),
    (error) => {
      stdout = error.stdout;
      return true;
    },
  );
  const events = stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const readiness = events.find((event) => event.event === "workflow.preview");
  assert.equal(readiness.readinessStatus, "blocked");
  assert.ok(readiness.issues.some((item) => item.id === "source" && /Relink/.test(item.remediation)));
  assert.equal(events.some((event) => event.event === "stage.started"), false);
});

test("portable bundle excludes source and detects tampering", async () => {
  const root = await mkdtemp(join(tmpdir(), "remotion-bundle-"));
  const source = join(root, "private-source.mp4");
  const transcript = join(root, "transcript.json");
  const manifestPath = join(root, "project", "project.json");
  const output = join(root, "portable.vrbundle");
  await writeFile(source, "private-video-content");
  await writeFile(transcript, JSON.stringify({ words: [] }));
  const manifest = createManifest({ id: "bundle-test", title: "Bundle", source, transcript, outputPath: manifestPath });
  await writeManifest(manifest, manifestPath);
  const context = await readManifest(manifestPath);
  await exportPortableBundle({ context, outputPath: output });
  assert.equal((await verifyPortableBundle(output)).status, "passed");
  assert.equal((await readFile(join(output, "source-binding.json"), "utf8")).includes("private-video-content"), false);
  await assert.rejects(access(join(output, "media/review-1080p.mp4")));
  await assert.rejects(access(join(output, "media/visual-qa-contact-sheet.png")));
  await writeFile(join(output, "project.json"), "{}\n");
  const tampered = await verifyPortableBundle(output);
  assert.equal(tampered.status, "failed");
  assert.ok(tampered.findings.some((item) => item.rule === "inventory.hash"));
});

test("acceptance combines evidence and verifies deterministic resume", () => {
  const resume = evaluateResumeEvents([{ event: "stage.skipped", stage: "preflight" }]);
  const decision = evaluateAcceptance({
    doctor: { summary: { failed: 0, warnings: 0 } },
    preflight: { summary: { failed: 0 } },
    artifacts: {
      checks: [{ stage: "preflight", status: "passed" }],
      evidence: {
        captions: 2,
        semanticCues: 1,
        visualDirection: {status: "review"},
        reviewEvidence: {status: "passed"},
        qa: {status: "passed"},
        regression: {status: "passed"},
      },
    },
    resume,
  });
  assert.equal(decision.status, "passed");
});
