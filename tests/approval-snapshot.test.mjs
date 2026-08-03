import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import {
  createApprovalSnapshot,
  verifyAndRestoreApprovalSnapshot,
} from "../scripts/workflow/approval-snapshot.mjs";

test("approval snapshot restores frozen render props without a provider replay", async () => {
  const workspace = await mkdtemp(resolve(tmpdir(), "remotion-md-approval-"));
  const paths = {
    workspace,
    source: resolve(workspace, "source.mp4"),
    manifest: resolve(workspace, "project.json"),
    semanticNarrativePlan: resolve(workspace, "semantic-narrative-plan.json"),
    semanticProviderReport: resolve(workspace, "semantic-provider-report.json"),
    componentCandidates: resolve(workspace, "component-candidates.json"),
    visualDirectionPlan: resolve(workspace, "visual-direction-plan.json"),
    visualDirectionReport: resolve(workspace, "visual-direction-report.json"),
    visualDirectionReview: resolve(workspace, "visual-direction-review.md"),
    visualDirectionTimeline: resolve(workspace, "visual-direction-timeline.svg"),
    planning: resolve(workspace, "visual-brief.json"),
    reviewProps: resolve(workspace, "review-props.json"),
    finalProps: resolve(workspace, "delivery-props.json"),
    resolvedSceneTimeline: resolve(workspace, "resolved-scene-timeline.json"),
    sceneAlignmentReport: resolve(workspace, "scene-alignment.md"),
    supplementalMediaManifest: resolve(workspace, "supplemental-media-manifest.json"),
    reviewEvidence: resolve(workspace, "review-evidence.json"),
    reviewEvidenceSummary: resolve(workspace, "review-evidence.md"),
  };
  await writeFile(paths.reviewProps, '{"overlayCues":["approved"]}\n');
  await writeFile(paths.finalProps, '{"overlayCues":["approved-delivery"]}\n');
  await writeFile(paths.semanticNarrativePlan, '{"segments":4}\n');
  await writeFile(paths.source, "source-video");
  await writeFile(paths.manifest, '{"project":{"id":"snapshot-test"}}\n');
  const evidence = {
    projectId: "snapshot-test",
    approvalBindingSha256: "a".repeat(64),
    artifacts: [{ path: "review-props.json" }],
  };
  const snapshot = await createApprovalSnapshot({ paths, reviewEvidence: evidence });
  await writeFile(paths.reviewProps, '{"overlayCues":["changed"]}\n');
  await writeFile(paths.finalProps, '{"overlayCues":["changed-delivery"]}\n');
  const result = await verifyAndRestoreApprovalSnapshot({ paths, snapshot });
  assert.deepEqual(result.restored, ["delivery-props.json", "review-props.json"]);
  assert.equal(await readFile(paths.reviewProps, "utf8"), '{"overlayCues":["approved"]}\n');
  assert.equal(await readFile(paths.finalProps, "utf8"), '{"overlayCues":["approved-delivery"]}\n');
});

test("approval snapshot rejects changed source or project manifest", async () => {
  const workspace = await mkdtemp(resolve(tmpdir(), "remotion-md-approval-binding-"));
  const paths = {
    workspace,
    source: resolve(workspace, "source.mp4"),
    manifest: resolve(workspace, "project.json"),
    finalProps: resolve(workspace, "delivery-props.json"),
  };
  await writeFile(paths.source, "approved-source");
  await writeFile(paths.manifest, '{"project":{"id":"binding-test"}}\n');
  await writeFile(paths.finalProps, '{}\n');
  const snapshot = await createApprovalSnapshot({
    paths,
    reviewEvidence: { projectId: "binding-test", approvalBindingSha256: "b".repeat(64), artifacts: [] },
  });
  await writeFile(paths.source, "changed-source");
  await assert.rejects(
    verifyAndRestoreApprovalSnapshot({ paths, snapshot }),
    /Approved source-video has changed/,
  );
});
