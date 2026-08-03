# Workflow Contract

## Stable interfaces

- Project manifest: `schemas/project.schema.json`
- Run state: `schemas/run-state.schema.json`
- Runner: `npm run workflow -- --project <manifest>`
- Artifact ledger: `<workspace>/artifacts.json`
- Structured progress: one JSON object per stdout line emitted by the runner
- Asset profile: project manifest `assetProfile`
- Semantic component registry: `src/components/library/registry.ts`
- Reusable foundations: `src/design-tokens/`, `src/motion-primitives/`, and `src/layout-templates/`
- Controlled component-motion profiles: `src/motion-recipes/`
- Reusable person and identity registry: `src/media-assets/`
- Terminology and copy profile: `src/terminology/` plus the project manifest `terminology` selection
- Regression fixture profile: `regression-fixtures/registry.json` plus the project manifest `regression` selection
- Environment report: `schemas/environment-doctor.schema.json`
- Project preflight report: `schemas/project-preflight.schema.json`
- Structured failures: `schemas/operational-error.schema.json`
- Portable bundle: `schemas/portable-project-bundle.schema.json`
- Typed operator request: `schemas/operator-control.schema.json`
- Acceptance report: `schemas/workflow-acceptance.schema.json`
- Revision request: `schemas/revision-request.schema.json`
- Revision history: `<workspace>/revisions/revision-history.json`
- Punctuation-preserving semantic captions: `<workspace>/captions-semantic.source.json` and `<workspace>/captions-semantic.json`
- Display captions: `<workspace>/captions-verbatim.source.json` and `<workspace>/captions-verbatim.json`
- Global semantic intent: `<workspace>/semantic-narrative-plan.json`
- Semantic-provider evidence: `<workspace>/semantic-provider-report.json`
- Frozen component candidates: `<workspace>/component-candidates.json`
- Whole-video direction: `<workspace>/visual-direction-plan.json`
- Direction review report: `<workspace>/visual-direction-report.json`
- Review mode: project manifest `workflow.reviewMode` (`static` for new projects, `full-video` for explicit continuous review; missing legacy value means `full-video`)
- Motion review mode: `workflow.motionReviewMode` (`conditional-excerpts` for new projects, `full-pacing` for legacy or explicit strict review)
- Review evidence: `<workspace>/review-evidence.json`
- Delivery validation: `<workspace>/delivery-validation.json`
- Supplemental media manifest: `<workspace>/supplemental-media-manifest.json`
- Authored screen-scene timeline: `<workspace>/resolved-scene-timeline.json`
- Scene-alignment review: `<workspace>/scene-alignment.md`
- Semantic attempt history: `<workspace>/semantic-attempts/<attempt-id>/`
- Frozen approval package: `<workspace>/approvals/<approval-id>/approval-snapshot.json`
- Whole-video identity title cues: `titleCues` in direction plan, visual plan, and render props
- Recut provider proposal: `<workspace>/recut-provider-plan.json` and `<workspace>/recut-provider-report.json`
- Materialized recut review: `<workspace>/recut-candidates.json`, `<workspace>/recut-review.md`, and `<workspace>/edl.proposed.json`
- Continuous recut evidence: `<workspace>/recut-preview-720p.mp4`
- Review/source cut segment caches: `<workspace>/clips_review/segment-cache.json` and
  `<workspace>/clips_final_4k/segment-cache.json`
- Frame-local QA cache: `<workspace>/visual-qa/frame-cache.json`
- Next-gate readiness: the `workflow.preview` event emitted by a bounded `--dry-run`

## Stages

Intelligent recut 2.0 path for new projects:

`preflight -> ingest -> probe + transcribe -> recut-plan -> edit-plan -> recut-review -> recut-approval -> edit-promote`

Shared downstream path after canonical EDL promotion (legacy manifests enter directly through `edit-plan`):

`terminology + layout + supplemental-probe -> captions -> translate -> scene-align + semantic-plan -> component-props -> visual-direction -> validate -> review-base`

Static review (new-project default):

`review-base -> qa-capture -> visual-qa -> conditional motion-risk excerpts -> review-evidence -> regression-fixtures -> human-approval -> delivery-render -> delivery-validate`

Full-video review (explicit or legacy):

`review-base -> review-render -> qa-capture -> visual-qa -> review-evidence -> regression-fixtures -> human-approval -> delivery-render -> delivery-validate`

After static QA, new projects render one 540p excerpt package only when confirmed animation cues require continuous
motion evidence. No-animation projects record that no excerpt was required. Legacy `full-pacing` static projects keep
their continuous 720p proxy. Full-video review already owns continuous evidence and therefore does not create a
duplicate pacing proxy.

Preflight validates the project before paid or render work. It records source/transcript readiness, provider environment names without values, the exact reusable asset profile, terminology and regression selections, output writability, and resumable state. Environment Doctor is separately runnable because machine readiness and project readiness have different lifecycles.

The terminology stage resolves global terms, selected domain packs, and optional project overrides in that precedence order. It freezes `terminology-profile.json` and `terminology-review.json`; captions, translation, semantic planning, validation, and Web status consume that same snapshot. Caption corrections are limited to entries explicitly marked as safe ASR corrections. The captions stage writes timing-identical semantic and display source channels. Translation reads punctuation-preserving `captions-semantic.source.json`, rejects code-mixed or punctuation-only English, writes `captions-semantic.json`, then derives `captions-verbatim.json` using the manifest display-punctuation policy. Provider output never changes either upstream Chinese source signature.

The layout stage measures face position. `supplemental-probe` validates, checksums, and locally stages every manifest-owned recording. `scene-align` deterministically matches authored spoken-text anchors to the punctuation-preserving caption channel, converts the detected horizontal face center into a target-aspect-aware static PIP crop, and blocks unresolved required scenes. Resolved recording scenes are hard constraints for `visual-direction`; overlapping semantic candidates become speaker-screen evidence rather than competing overlays. The renderer keeps the edited speaker track as the only audible source, mutes supplemental media, and reuses a muted speaker view for PIP. With the default `codex-cli` provider, `semantic-plan` reads the complete punctuation-preserving transcript and freezes ordered evidence-backed narrative intents plus provider metadata; Codex runs ephemerally, read-only, with structured output. It never selects a Remotion component. `component-props` is deterministic and local-only: it validates evidence completeness, maps rhetoric to an approved component, resolves motion through the component allowlist, charts through the component chart allowlist, identities through the media and icon registries, content scale through the selected layout zone, and bounded complete copy for every cue. Missing evidence is skipped rather than rendered with placeholders. It freezes candidate props instead of directly publishing the final overlay timeline.

`recut-plan` reads the cached raw word-level transcript once and asks the pinned read-only Codex adapter only for filler, false-start, and duplicate-retake word ranges. `edit-plan` assigns stable candidate IDs and locally rejects low-confidence, overly long, protected, overlapping, or insufficiently padded ranges; local silence compression is evaluated in the same report. It writes a proposed EDL without changing the canonical EDL. `recut-review` renders a 720p continuous proxy from that proposal. `recut-approval` binds the proposal, candidate report, Markdown audit, and proxy; only `edit-promote` may copy the approved proposal to canonical `edl.json`. Authored scene anchors and project protected anchors are resolved against raw transcript words early enough to prevent their removal. Provider replanning is explicit and cannot be caused by an ordinary force or downstream change.

`visual-direction` is a separate deterministic local stage. It consumes the frozen candidates and semantic caption timing, groups auditable discourse chapters, records caption merge and adjacent-claim split boundaries, assigns hero/support/accent/none importance, and enforces display-duration, breathing, repetition, per-minute density, continuous-display, and whole-video coverage budgets. It may delay, shorten, replace, or skip a candidate; it never modifies transcript truth, invents evidence, changes the semantic provider, or selects an unapproved component. Only its selected timeline becomes final planning and render props. Remotion consumes those frozen choices and never fetches remote media during rendering.
The understanding package also carries one evidence-backed whole-video identity. The local director may reuse it only in eligible speaker-only gaps and never over a semantic component or authored recording.

`qa-capture` freezes four risk frames for every selected cue and one speaker-only frame for every skipped direction decision using the fps from the probed media manifest; a fixed 30fps assumption is invalid for 24/25/50/60fps sources. `visual-qa` writes a signed report and contact sheet. `review-evidence` hashes and binds the direction plan, render props, QA contracts, metrics, contact sheet, every frame, and—only in full-video mode—the review video. `regression-fixtures` compares the project against its pinned expected semantic and QA outcomes, or writes an explicit skipped report when disabled. `human-approval` is never executed implicitly and binds the review-evidence, QA-report, and regression-report signatures. `delivery-render` re-verifies those artifacts before rendering. `delivery-validate` checks codec, source dimensions, audio, EDL duration, full decode, file size, and SHA-256; the `delivery` target is incomplete until it passes.
Title continuity adds entry/stable/exit frames. Every frame is classified as `semantic-component`, `authored-screen`, `title-continuity`, or `speaker-only`, and evidence reports those counts independently. Human approval copies the complete bound package into an immutable approval snapshot. A normal delivery verifies and restores that package and starts at `delivery-render`, so it cannot traverse provider-backed stages. Replacing an existing semantic plan requires explicit `--replan-semantic`, uses an isolated attempt directory, preserves the last valid output on failure, and writes a before/after comparison.

A review rejection or revision is applied through the typed revision contract. New rejection requests bind review evidence, visual-QA, and regression hashes; the review-video hash remains accepted for legacy requests. Policy revisions persist in the manifest; translation and VisualBrief revisions are baseline-bound edits to the current review artifacts. Every request is frozen in revision history, an existing approval is revoked, and only stages reachable through the explicit dependency graph become stale. Chinese caption text is not directly patchable.

An English-only caption revision is a deterministic exception to ordinary translated-caption invalidation. It updates
both timing-identical caption channels and frozen render props, preserves the Chinese-evidence semantic plan and
downstream visual choices, revokes approval, and resumes at `validate`.

Cut preparation caches every exact EDL range using source SHA-256, millisecond boundaries, and encoding profile.
Unchanged ranges may be reused when a later EDL edit affects only neighboring ranges. Final base-cut reuse is bound to
source, media manifest, EDL, and base encoding profile rather than unrelated visual props or approval metadata.

## Status values

- `pending`: never run or awaiting approval
- `running`: command is active
- `succeeded`: outputs and signatures were recorded
- `failed`: error is recorded; upstream artifacts remain intact
- `stale`: an upstream stage changed
- `approved`: a human approved the reviewed output

## Web boundary

A Web API may initialize manifests, select allowlisted terminology domains and regression profiles, invoke allowlisted runner arguments, stream JSON events, read state/ledger files, display terminology, regression, and render artifacts, submit a registered revision ID, and record explicit approval. It must not accept arbitrary shell commands, arbitrary revision paths, expose environment secrets, upload local-only fixtures, or independently reproduce stage logic.

The executable boundary is `scripts/operator-control.mjs`, driven by `src/operator-control/contract.ts`. Requests identify a registered `projectId`, never a path. Status snapshots replace local absolute paths with repository or external references. Portable bundles and acceptance use the same manifest, stages, signatures, ledger, and approval rules; they do not implement a second workflow.
