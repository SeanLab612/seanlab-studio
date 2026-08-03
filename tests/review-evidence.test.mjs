import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { evaluateDeliveryProbe } from "../scripts/operations/delivery-validation.mjs";
import { buildReviewEvidence, verifyReviewEvidence } from "../scripts/operations/review-evidence.mjs";

const execFileAsync = promisify(execFile);

test("static review evidence binds every risk frame and detects tampering", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "remotion-static-review-"));
  const qaDir = join(workspace, "visual-qa");
  const framesDir = join(qaDir, "frames");
  await mkdir(framesDir, { recursive: true });
  const files = {
    planning: join(workspace, "visual-brief.json"),
    props: join(workspace, "review-props.json"),
    finalProps: join(workspace, "delivery-props.json"),
    framePlan: join(qaDir, "frame-plan.json"),
    framesManifest: join(qaDir, "frames-manifest.json"),
    contracts: join(qaDir, "qa-contracts.json"),
    metrics: join(qaDir, "image-metrics.json"),
    contactSheet: join(qaDir, "contact-sheet.png"),
    titleContactSheet: join(qaDir, "title-continuity-contact-sheet.png"),
    qaReport: join(qaDir, "qa-report.json"),
    terminologyReview: join(workspace, "terminology-review.json"),
    frame: join(framesDir, "01-stable.png"),
    evidence: join(workspace, "review-evidence.json"),
    visualPacingReview: join(workspace, "visual-pacing-review-720p.mp4"),
  };
  for (const path of [
    files.planning,
    files.props,
    files.finalProps,
    files.framePlan,
    files.contracts,
    files.metrics,
    files.terminologyReview,
  ])
    await writeFile(path, "{}\n");
  await writeFile(files.contactSheet, "contact-sheet");
  await writeFile(files.titleContactSheet, "title-contact-sheet");
  await writeFile(files.frame, "frame-one");
  await writeFile(files.visualPacingReview, "continuous 720p preview");
  await writeFile(
    files.framesManifest,
    JSON.stringify({ frames: [{ file: files.frame, phase: "stable" }] }),
  );
  await writeFile(
    files.qaReport,
    JSON.stringify({
      status: "passed",
      reportSha256: "qa-sha",
      summary: {
        semanticCues: 1,
        authoredScreenScenes: 0,
        titleContinuityCues: 0,
        visualGroups: 1,
        errors: 0,
        warnings: 0,
      },
    }),
  );
  const evidence = await buildReviewEvidence({
    config: {
      editDir: workspace,
      projectId: "static-review",
      reviewMode: "static",
      planningFile: files.planning,
      reviewPropsFile: files.props,
      finalPropsFile: files.finalProps,
      visualPacingReviewFile: files.visualPacingReview,
      terminologyReviewFile: files.terminologyReview,
      visualQa: { outputDir: qaDir, reportFile: files.qaReport },
    },
  });
  await writeFile(files.evidence, `${JSON.stringify(evidence, null, 2)}\n`);
  assert.ok(evidence.artifacts.some((artifact) => artifact.kind === "terminology-review"));
  assert.ok(evidence.artifacts.some((artifact) => artifact.kind === "visual-pacing-review-video"));
  assert.equal((await verifyReviewEvidence({ evidencePath: files.evidence, workspace })).reviewMode, "static");
  await writeFile(files.frame, "changed-frame");
  await assert.rejects(() => verifyReviewEvidence({ evidencePath: files.evidence, workspace }), /changed after capture/);
});

test("full-video review uses the continuous review without rendering a duplicate pacing proxy", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "remotion-full-video-review-"));
  const qaDir = join(workspace, "visual-qa");
  const framesDir = join(qaDir, "frames");
  await mkdir(framesDir, { recursive: true });
  const files = {
    planning: join(workspace, "visual-brief.json"),
    props: join(workspace, "review-props.json"),
    finalProps: join(workspace, "delivery-props.json"),
    framePlan: join(qaDir, "frame-plan.json"),
    framesManifest: join(qaDir, "frames-manifest.json"),
    contracts: join(qaDir, "qa-contracts.json"),
    metrics: join(qaDir, "image-metrics.json"),
    contactSheet: join(qaDir, "contact-sheet.png"),
    titleContactSheet: join(qaDir, "title-continuity-contact-sheet.png"),
    qaReport: join(qaDir, "qa-report.json"),
    terminologyReview: join(workspace, "terminology-review.json"),
    frame: join(framesDir, "01-stable.png"),
    reviewVideo: join(workspace, "review-1080p.mp4"),
  };
  for (const path of [
    files.planning,
    files.props,
    files.finalProps,
    files.framePlan,
    files.contracts,
    files.metrics,
    files.terminologyReview,
  ])
    await writeFile(path, "{}\n");
  await writeFile(files.contactSheet, "contact-sheet");
  await writeFile(files.titleContactSheet, "title-contact-sheet");
  await writeFile(files.frame, "frame-one");
  await writeFile(files.reviewVideo, "continuous full review");
  await writeFile(files.framesManifest, JSON.stringify({ frames: [{ file: files.frame, phase: "stable" }] }));
  await writeFile(
    files.qaReport,
    JSON.stringify({
      status: "passed",
      reportSha256: "qa-sha",
      summary: { semanticCues: 1, visualGroups: 1, errors: 0, warnings: 0 },
    }),
  );
  const evidence = await buildReviewEvidence({
    config: {
      editDir: workspace,
      projectId: "full-video-review",
      reviewMode: "full-video",
      planningFile: files.planning,
      reviewPropsFile: files.props,
      finalPropsFile: files.finalProps,
      reviewOutputFile: files.reviewVideo,
      terminologyReviewFile: files.terminologyReview,
      visualQa: { outputDir: qaDir, reportFile: files.qaReport },
    },
  });
  assert.ok(evidence.artifacts.some((artifact) => artifact.kind === "review-video"));
  assert.equal(evidence.artifacts.some((artifact) => artifact.kind === "visual-pacing-review-video"), false);
  assert.equal(evidence.summary.fullReviewVideoIncluded, true);
  assert.equal(evidence.summary.visualPacingReviewIncluded, false);
});

test("conditional motion review binds its report and skips video when static frames are sufficient", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "remotion-motion-risk-review-"));
  const qaDir = join(workspace, "visual-qa");
  const framesDir = join(qaDir, "frames");
  await mkdir(framesDir, { recursive: true });
  const paths = {
    planning: join(workspace, "visual-brief.json"),
    props: join(workspace, "review-props.json"),
    finalProps: join(workspace, "delivery-props.json"),
    framePlan: join(qaDir, "frame-plan.json"),
    framesManifest: join(qaDir, "frames-manifest.json"),
    contracts: join(qaDir, "qa-contracts.json"),
    metrics: join(qaDir, "image-metrics.json"),
    contactSheet: join(qaDir, "contact-sheet.png"),
    titleContactSheet: join(qaDir, "title-continuity-contact-sheet.png"),
    qaReport: join(qaDir, "qa-report.json"),
    frame: join(framesDir, "01-stable.png"),
    motionReport: join(workspace, "motion-risk-review.json"),
  };
  for (const path of [
    paths.planning,
    paths.props,
    paths.finalProps,
    paths.framePlan,
    paths.contracts,
    paths.metrics,
  ])
    await writeFile(path, "{}\n");
  await writeFile(paths.contactSheet, "contact-sheet");
  await writeFile(paths.titleContactSheet, "title-contact-sheet");
  await writeFile(paths.frame, "frame-one");
  await writeFile(paths.framesManifest, JSON.stringify({ frames: [{ file: paths.frame, phase: "stable" }] }));
  await writeFile(
    paths.qaReport,
    JSON.stringify({ status: "passed", reportSha256: "qa-sha", summary: { errors: 0, warnings: 0 } }),
  );
  await writeFile(
    paths.motionReport,
    JSON.stringify({
      schemaVersion: "1.0",
      kind: "motion-risk-review",
      mode: "conditional-excerpts",
      status: "not-required",
      excerpts: [],
    }),
  );
  const evidence = await buildReviewEvidence({
    config: {
      editDir: workspace,
      projectId: "motion-risk-review",
      reviewMode: "static",
      motionReviewMode: "conditional-excerpts",
      planningFile: paths.planning,
      reviewPropsFile: paths.props,
      finalPropsFile: paths.finalProps,
      motionRiskReviewReportFile: paths.motionReport,
      visualQa: { outputDir: qaDir, reportFile: paths.qaReport },
    },
  });
  assert.ok(evidence.artifacts.some((artifact) => artifact.kind === "motion-risk-review-report"));
  assert.equal(evidence.artifacts.some((artifact) => artifact.kind === "motion-risk-review-video"), false);
  assert.equal(evidence.summary.motionRiskReviewIncluded, false);
  assert.equal(evidence.summary.motionRiskReviewRequired, false);
  assert.equal(evidence.summary.motionReviewMode, "conditional-excerpts");
});

test("motion-risk renderer records a no-render decision when there are no animation cues", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "remotion-motion-risk-renderer-"));
  const props = join(workspace, "review-props.json");
  const config = join(workspace, "runtime-config.json");
  const report = join(workspace, "motion-risk-review.json");
  const preview = join(workspace, "motion-risk-review-540p.mp4");
  await writeFile(props, JSON.stringify({ outputFps: 60, overlayCues: [], animationCues: [] }));
  await writeFile(
    config,
    JSON.stringify({
      editDir: workspace,
      reviewPropsFile: props,
      motionRiskReviewReportFile: report,
      motionRiskReviewFile: preview,
    }),
  );
  await execFileAsync(process.execPath, ["scripts/render-motion-risk-review.mjs", config], {
    cwd: resolve("."),
  });
  const value = JSON.parse(await readFile(report, "utf8"));
  assert.equal(value.status, "not-required");
  assert.deepEqual(value.excerpts, []);
  await assert.rejects(() => readFile(preview), /ENOENT/);
});

test("motion-risk ranges clamp end padding to the frozen presentation duration", async () => {
  const { motionRiskRanges } = await import("../scripts/operations/motion-risk-ranges.mjs");
  assert.deepEqual(
    motionRiskRanges({
      cues: [{ id: "ending-animation", start: 287.86, end: 327.24 }],
      paddingSeconds: 0.75,
      maximumEndSeconds: 327.24,
    }),
    [{ start: 287.11, end: 327.24, cueIds: ["ending-animation"] }],
  );
});

test("delivery validation requires expected media, audio, duration, and a clean decode", () => {
  const expected = { width: 1920, height: 1080, codec: "h264", durationSeconds: 300, durationToleranceSeconds: 1 };
  const probe = {
    streams: [
      { codec_type: "video", codec_name: "h264", width: 1920, height: 1080 },
      { codec_type: "audio", codec_name: "aac" },
    ],
    format: { duration: "300.2" },
  };
  assert.equal(evaluateDeliveryProbe({ probe, expected, decodePassed: true }).status, "passed");
  const failed = evaluateDeliveryProbe({ probe: { streams: [probe.streams[0]], format: { duration: "302" } }, expected, decodePassed: false });
  assert.equal(failed.status, "failed");
  assert.deepEqual(
    failed.findings.map(({ rule }) => rule),
    ["delivery.audio.missing", "delivery.duration", "delivery.decode"],
  );
});

test("delivery validation probes and fully decodes a rendered file", async () => {
  const workspace = await mkdtemp(join(tmpdir(), "remotion-delivery-validation-"));
  const output = join(workspace, "delivery.mp4");
  const report = join(workspace, "delivery-validation.json");
  const config = join(workspace, "runtime-config.json");
  await execFileAsync("ffmpeg", [
    "-v",
    "error",
    "-f",
    "lavfi",
    "-i",
    "color=c=black:s=320x180:r=30:d=1",
    "-f",
    "lavfi",
    "-i",
    "sine=frequency=1000:sample_rate=48000:duration=1",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-shortest",
    output,
  ]);
  await writeFile(join(workspace, "media-manifest.json"), JSON.stringify({ width: 320, height: 180, fps: 30 }));
  await writeFile(join(workspace, "edl.json"), JSON.stringify({ ranges: [{ start: 0, end: 1 }] }));
  await writeFile(
    join(workspace, "delivery-render-report.json"),
    JSON.stringify({
      schemaVersion: "1.0",
      kind: "delivery-render-report",
      projectId: "delivery-validation",
      provenance: { inputSignature: "fixture" },
      output: { path: output },
    }),
  );
  await writeFile(
    config,
    JSON.stringify({
      projectId: "delivery-validation",
      editDir: workspace,
      deliveryOutputFile: output,
      deliveryValidationFile: report,
      delivery: { codec: "h264" },
    }),
  );
  await execFileAsync("node", [resolve("scripts/validate-delivery.mjs"), config]);
  const validation = JSON.parse(await readFile(report, "utf8"));
  assert.equal(validation.status, "passed");
  assert.equal(validation.output.bytes > 0, true);
  assert.match(validation.output.sha256, /^[a-f0-9]{64}$/);
});

test("new review and delivery schemas remain valid JSON documents", async () => {
  for (const path of ["schemas/review-evidence.schema.json", "schemas/delivery-validation.schema.json"])
    JSON.parse(await readFile(path, "utf8"));
});
