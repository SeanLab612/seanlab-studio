import test from "node:test";
import { validateArtifactSchema } from "../scripts/operations/artifact-schema.mjs";

test("visual QA schema accepts the current generated report contract", async () => {
  await validateArtifactSchema({
    schemaPath: "schemas/visual-qa-report.schema.json",
    label: "Visual QA fixture",
    artifact: {
      schemaVersion: "1.0",
      projectId: "schema-contract",
      reviewMode: "static",
      generatedAt: new Date().toISOString(),
      canvas: { width: 1920, height: 1080 },
      status: "warning",
      summary: {
        cues: 1,
        semanticCues: 1,
        authoredScreenScenes: 1,
        titleContinuityCues: 1,
        visualGroups: 3,
        frames: 8,
        speakerOnlyFrames: 1,
        errors: 0,
        warnings: 1,
        infos: 0,
      },
      policy: {},
      renderContext: { overlayScale: 1 },
      dependencies: { node: "test", remotion: "test", ffmpeg: "test", opencv: "test" },
      baseline: {},
      regressionProfile: { enabled: true },
      artifacts: {},
      renderMetrics: null,
      findings: [
        {
          id: "QA-0001",
          severity: "warning",
          rule: "title.fixture",
          message: "fixture",
          cueId: "title-1",
          phase: "title-entry",
        },
      ],
      reportSha256: "a".repeat(64),
    },
  });
});
