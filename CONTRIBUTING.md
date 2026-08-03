# Contributing

Thank you for helping improve SeanLab Studio.

## Before opening a pull request

1. Create a focused branch.
2. Keep real creator data out of Git. This includes `projects/`, `studio-data/`, recordings, screenshots, transcripts, logs, renders, and credentials.
3. Use neutral fixtures. Do not contribute a real person's portrait or a third-party brand asset without a clear redistribution license and attribution.
4. Preserve human approval gates. Agent output must never approve narration, visuals, or delivery on behalf of the creator.
5. Run `npm test` and any focused workflow tests affected by the change.

## Design boundary

Agent code may understand content and produce structured intent. Deterministic local code must validate and materialize components, assets, timing, review evidence, and renders. Provider fallback remains explicit and disabled by default.
