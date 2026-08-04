import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { productionAgentAcceptanceScenario } from "../scripts/creator/production-agent-acceptance.mjs";
import { MAX_AUTOMATIC_PRODUCTION_RECOVERY_ATTEMPTS } from "../scripts/creator/production-agent-recovery.mjs";

const execFileAsync = promisify(execFile);

const availablePort = () =>
  new Promise((done, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close(() => done(port));
    });
  });

const waitForHealth = async (port, logs) => {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (response.ok) return response.json();
    } catch {}
    await new Promise((done) => setTimeout(done, 50));
  }
  throw new Error(`Acceptance Studio did not start:\n${logs.slice(-20).join("\n")}`);
};

const createAcceptanceProject = async ({ creatorRoot, projectId }) => {
  const script = `
    import { createCreatorProject } from ${JSON.stringify(
      new URL("../scripts/creator/project-store.mjs", import.meta.url).href,
    )};
    await createCreatorProject({
      id: ${JSON.stringify(projectId)},
      title: "Production Agent recovery acceptance",
      topic: "Controlled recovery acceptance",
      category: "tutorial",
      agentId: "codex-cli",
      model: "gpt-5.6-sol"
    });
  `;
  await execFileAsync(process.execPath, ["--input-type=module", "-e", script], {
    cwd: process.cwd(),
    env: { ...process.env, REMOTION_MD_CREATOR_ROOT: creatorRoot },
  });
};

const stopStudio = async (child) =>
  new Promise((done) => {
    if (child.exitCode !== null) return done();
    const timeout = setTimeout(done, 12_000);
    child.once("close", () => {
      clearTimeout(timeout);
      done();
    });
    child.kill("SIGTERM");
  });

const runScenario = async ({
  scenario,
  expectedState,
  expectedReason,
  expectedWorkflowJobs,
  expectedDiagnoses,
  expectedAutomaticAttempts,
  allowSafeLiveOutcome = false,
}) => {
  const root = await mkdtemp(join(tmpdir(), `seanlab-production-recovery-${scenario}-`));
  const creatorRoot = join(root, "projects");
  const studioDataRoot = join(root, "studio-data");
  const projectId = `acceptance-${scenario}`;
  await mkdir(studioDataRoot, { recursive: true });
  await createAcceptanceProject({ creatorRoot, projectId });
  const port = await availablePort();
  const logs = [];
  const child = spawn(process.execPath, ["--experimental-strip-types", "scripts/studio-server.mjs"], {
    cwd: resolve("."),
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: String(port),
      REMOTION_MD_CREATOR_ROOT: creatorRoot,
      REMOTION_MD_STUDIO_DATA_ROOT: studioDataRoot,
      REMOTION_MD_ACCEPTANCE_FAULTS: "production-agent-recovery",
      REMOTION_MD_ACCEPTANCE_SCENARIO: scenario,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const append = (chunk) => logs.push(...chunk.toString().split(/\r?\n/).filter(Boolean));
  child.stdout.on("data", append);
  child.stderr.on("data", append);
  try {
    await waitForHealth(port, logs);
    const app = await fetch(`http://127.0.0.1:${port}/api/app`).then((response) => response.json());
    const start = await fetch(
      `http://127.0.0.1:${port}/api/projects/${projectId}/acceptance/production-agent-fault`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: `http://127.0.0.1:${port}`,
          "x-studio-token": app.csrfToken,
        },
        body: "{}",
      },
    );
    assert.equal(start.status, 202, await start.text());

    let jobs;
    let agent;
    for (let attempt = 0; attempt < 1_200; attempt += 1) {
      [jobs, agent] = await Promise.all([
        fetch(`http://127.0.0.1:${port}/api/jobs`).then((response) => response.json()),
        fetch(`http://127.0.0.1:${port}/api/projects/${projectId}/production-agent`).then((response) =>
          response.json(),
        ),
      ]);
      const active = jobs.some((item) => ["queued", "running"].includes(item.status));
      const finalReason = agent.history?.at(-1)?.reason;
      const workflowJobCount = jobs.filter((item) => item.kind === "video-workflow").length;
      const diagnosisJobCount = jobs.filter((item) => item.kind === "production-agent-recovery").length;
      const safeLiveFinal =
        allowSafeLiveOutcome &&
        ((agent.state === "active" && finalReason === "automatic-recovery-succeeded" && workflowJobCount === 2) ||
          (agent.state === "waiting-human" &&
            finalReason?.startsWith("agent-recommended-") &&
            workflowJobCount === 1));
      if (
        !active &&
        diagnosisJobCount === expectedDiagnoses &&
        (safeLiveFinal ||
          (agent.state === expectedState &&
            finalReason === expectedReason &&
            workflowJobCount === expectedWorkflowJobs))
      )
        break;
      await new Promise((done) => setTimeout(done, 50));
    }

    const finalReason = agent.history.at(-1).reason;
    const workflowJobCount = jobs.filter((item) => item.kind === "video-workflow").length;
    const automaticAttempts = agent.history.filter((event) =>
      [
        "automatic-resume",
        "automatic-recheck-resume",
        "automatic-provider-env-refresh",
        "automatic-source-repair",
      ].includes(event.reason),
    ).length;
    if (allowSafeLiveOutcome) {
      assert.equal(["active", "waiting-human"].includes(agent.state), true);
      if (agent.state === "active") {
        assert.equal(finalReason, "automatic-recovery-succeeded");
        assert.equal(workflowJobCount, 2);
        assert.equal(automaticAttempts, 1);
      } else {
        assert.match(finalReason, /^agent-recommended-/);
        assert.equal(workflowJobCount, 1);
        assert.equal(automaticAttempts, 0);
      }
    } else {
      assert.equal(agent.state, expectedState);
      assert.equal(finalReason, expectedReason);
      assert.equal(workflowJobCount, expectedWorkflowJobs);
      assert.equal(automaticAttempts, expectedAutomaticAttempts);
    }
    assert.equal(jobs.filter((item) => item.kind === "production-agent-recovery").length, expectedDiagnoses);
    assert.equal(jobs.some((item) => item.action === "delivery"), false);
    assert.equal(agent.history.some((event) => ["starting-delivery", "exited"].includes(event.state)), false);

    const diagnosisDirectory = join(creatorRoot, projectId, "review", "production-agent-diagnoses");
    const diagnosisFiles = await readdir(diagnosisDirectory);
    assert.equal(diagnosisFiles.length, expectedDiagnoses);
    const diagnoses = await Promise.all(
      diagnosisFiles.map((file) => readFile(join(diagnosisDirectory, file), "utf8").then(JSON.parse)),
    );
    for (const evidence of diagnoses) {
      assert.equal(evidence.kind, "production-agent-diagnosis");
      assert.equal(evidence.failure.stage, scenario === "repair-code" ? "component-props" : "visual-qa");
      assert.deepEqual(evidence.preserved.approvedStages, ["recut-approval"]);
      assert.equal(evidence.decision.readiness.nextHumanGate, "human-approval");
      assert.equal(evidence.decision.readiness.targetStage, "regression-fixtures");
      assert.equal(evidence.decision.workflowAction === "delivery", false);
    }

    const project = JSON.parse(await readFile(join(creatorRoot, projectId, "creator-project.json"), "utf8"));
    assert.deepEqual(project.video, {});
    assert.equal(
      (await readdir(join(creatorRoot, projectId), { recursive: true })).some((entry) =>
        /delivery|approval-snapshot/i.test(entry),
      ),
      false,
    );
    return { jobs, agent, diagnoses };
  } finally {
    await stopStudio(child);
    await rm(root, { recursive: true, force: true });
  }
};

test("production Agent acceptance faults are disabled by default", () => {
  assert.equal(productionAgentAcceptanceScenario(), undefined);
});

test("isolated Studio exercises production Agent recovery without crossing human gates", async (t) => {
  await t.test("a transient failure enters diagnosing, records evidence, and resumes from visual-qa", async () => {
    const result = await runScenario({
      scenario: "recover-once",
      expectedState: "active",
      expectedReason: "automatic-recovery-succeeded",
      expectedWorkflowJobs: 2,
      expectedDiagnoses: 1,
      expectedAutomaticAttempts: 1,
    });
    assert.deepEqual(
      result.agent.history.map(({ state }) => state),
      ["active", "diagnosing", "recovering", "active"],
    );
    assert.equal(result.diagnoses[0].decision.stage, "visual-qa");
    assert.equal(result.diagnoses[0].decision.action, "resume");
  });

  await t.test("the next failure stops after the bounded automatic recovery attempts", async () => {
    const automaticAttemptLimit = MAX_AUTOMATIC_PRODUCTION_RECOVERY_ATTEMPTS;
    const result = await runScenario({
      scenario: "exhaust-attempts",
      expectedState: "waiting-human",
      expectedReason: "automatic-attempt-limit-reached",
      expectedWorkflowJobs: automaticAttemptLimit + 1,
      expectedDiagnoses: automaticAttemptLimit,
      expectedAutomaticAttempts: automaticAttemptLimit,
    });
    assert.equal(result.agent.history.at(-1).attempts, automaticAttemptLimit);
    assert.equal(result.agent.history.filter(({ state }) => state === "recovering").length, automaticAttemptLimit);
  });

  await t.test("a validated isolated source repair resumes the exact failed technical stage", async () => {
    const result = await runScenario({
      scenario: "repair-code",
      expectedState: "active",
      expectedReason: "automatic-recovery-succeeded",
      expectedWorkflowJobs: 2,
      expectedDiagnoses: 1,
      expectedAutomaticAttempts: 1,
    });
    assert.equal(result.diagnoses[0].decision.reason, "automatic-source-repair");
    assert.equal(result.diagnoses[0].decision.stage, "component-props");
    assert.equal(result.diagnoses[0].decision.repair.success, true);
    assert.deepEqual(result.diagnoses[0].decision.repair.validation, [
      "format:check",
      "lint",
      "typecheck",
      "test:unit",
      "test:workflow-core",
    ]);
  });

  await t.test("a visual or code decision remains waiting-human", async () => {
    const result = await runScenario({
      scenario: "waiting-human",
      expectedState: "waiting-human",
      expectedReason: "agent-recommended-request-user",
      expectedWorkflowJobs: 1,
      expectedDiagnoses: 1,
      expectedAutomaticAttempts: 0,
    });
    assert.equal(result.diagnoses[0].decision.action, "wait-human");
    assert.equal(result.diagnoses[0].diagnosis.safeToResume, false);
  });
});

if (process.env.REMOTION_MD_RUN_LIVE_AGENT_ACCEPTANCE === "1")
  test("the fixed project Agent diagnoses one isolated controlled failure", async (t) => {
    const result = await runScenario({
      scenario: "recover-once-live",
      expectedState: "active",
      expectedReason: "automatic-recovery-succeeded",
      expectedWorkflowJobs: undefined,
      expectedDiagnoses: 1,
      expectedAutomaticAttempts: undefined,
      allowSafeLiveOutcome: true,
    });
    assert.equal(result.diagnoses[0].provider.provider, "codex-cli");
    assert.equal(result.diagnoses[0].provider.status, "succeeded");
    assert.equal(["resume", "wait-human"].includes(result.diagnoses[0].decision.action), true);
    t.diagnostic(
      `live Agent decision=${result.diagnoses[0].decision.action} finalState=${result.agent.state} reason=${result.agent.history.at(-1).reason}`,
    );
  });
