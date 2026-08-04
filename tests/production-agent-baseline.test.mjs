import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);

test("an unrecoverable enhanced production can publish and approve a source-bound baseline without Git", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "seanlab-production-baseline-"));
  try {
    const script = `
      import { mkdir, writeFile } from "node:fs/promises";
      import { resolve } from "node:path";
      import { createCreatorProject, saveCreatorProject } from ${JSON.stringify(new URL("../scripts/creator/project-store.mjs", import.meta.url).href)};
      import { createManifest, readManifest, writeManifest } from ${JSON.stringify(new URL("../scripts/workflow/manifest.mjs", import.meta.url).href)};
      import { approveProductionBaseline, createProductionBaseline, loadProductionBaseline } from ${JSON.stringify(new URL("../scripts/creator/production-agent-baseline.mjs", import.meta.url).href)};

      const root = process.env.REMOTION_MD_CREATOR_ROOT;
      const projectId = "baseline-fixture";
      const videoRoot = resolve(root, projectId, "video");
      const source = resolve(root, projectId, "source.mp4");
      const manifestPath = resolve(videoRoot, "project.json");
      await createCreatorProject({ id: projectId, title: "Baseline", topic: "Baseline", category: "tutorial", agentId: "codex-cli", model: "gpt-5.6-sol" });
      await mkdir(videoRoot, { recursive: true });
      await writeFile(source, "valid-source");
      const manifest = createManifest({ id: "baseline-video", title: "Baseline", source, outputPath: manifestPath, agentId: "codex-cli", agentModel: "gpt-5.6-sol", translationProvider: "offline" });
      await writeManifest(manifest, manifestPath);
      const creator = JSON.parse(await import("node:fs/promises").then(({ readFile }) => readFile(resolve(root, projectId, "creator-project.json"), "utf8")));
      creator.materials.push({ id: "material-fixture", kind: "speaker-video", label: "Speaker", assetId: "fixture", required: true });
      creator.video = { projectId: "baseline-video", manifest: manifestPath, sourceAssetId: "fixture" };
      creator.project.status = "video-running";
      await saveCreatorProject(creator);
      const { paths } = await readManifest(manifestPath);
      await mkdir(paths.workspace, { recursive: true });
      await writeFile(resolve(paths.workspace, "media-manifest.json"), JSON.stringify({ width: 1920, height: 1080, fps: 30, durationSeconds: 2 }));
      await writeFile(resolve(paths.workspace, "edl.json"), JSON.stringify({ sources: [source], ranges: [{ source: 0, start: 0, end: 2 }], totalDurationS: 2 }));
      const reviewPath = resolve(root, projectId, "review", "baseline.mp4");
      await writeFile(paths.runtimeConfig, JSON.stringify({ publicReviewFile: reviewPath, editDir: paths.workspace, source }));
      const created = await createProductionBaseline({
        projectId,
        failure: { stage: "semantic-plan", code: "PROVIDER_REQUEST_TIMEOUT" },
        execute: async () => { await mkdir(resolve(reviewPath, ".."), { recursive: true }); await writeFile(reviewPath, "baseline-review"); return { stdout: "", stderr: "" }; },
      });
      if (!created.success) throw new Error(created.reason);
      const loaded = await loadProductionBaseline(projectId);
      if (loaded.status !== "review-ready" || !loaded.reviewUrl) throw new Error("baseline was not review-ready");
      await approveProductionBaseline({ projectId, confirmation: "human-production-baseline-approved", inputSha256: loaded.inputSha256 });
      const approved = await loadProductionBaseline(projectId);
      if (approved.status !== "approved") throw new Error("baseline was not approved");
      console.log(JSON.stringify({ created: created.success, status: approved.status, fallback: approved.fallbackReason }));
    `;
    const { stdout } = await execFileAsync(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", script], {
      cwd: process.cwd(),
      env: { ...process.env, REMOTION_MD_CREATOR_ROOT: resolve(root, "projects") },
    });
    const result = JSON.parse(stdout.trim().split(/\r?\n/).at(-1));
    assert.deepEqual(result, {
      created: true,
      status: "approved",
      fallback: { stage: "semantic-plan", code: "PROVIDER_REQUEST_TIMEOUT" },
    });
    const record = JSON.parse(
      await readFile(resolve(root, "projects", "baseline-fixture", "review", "production-baseline.json"), "utf8"),
    );
    assert.equal(record.status, "approved");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
