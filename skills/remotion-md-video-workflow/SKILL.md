---
name: remotion-md-video-workflow
description: Orchestrate this repository's resumable talking-head video workflow from source video and transcript through conservative recut, verbatim bilingual captions, semantic VisualBrief planning, approved Remotion components, static-first or full-video human review, and approval-gated validated source-resolution delivery. Use when initializing, running, resuming, diagnosing, reviewing, or delivering a video project in video-remotion/remotion-md, including future Web-console operations backed by the same manifest and runner.
---

# Remotion MD Video Workflow

Keep the speaker primary. Treat Remotion as a deterministic renderer and keep speech understanding outside the render process.

This is the single operator-facing orchestration Skill. Keep durable rules in typed modules, manifests, and the linked reference documents rather than expanding this file with implementation detail. Split out a subordinate Skill only when a capability has an independent user trigger, lifecycle, approval gate, and test contract; retain this Skill as the stable entry point that sequences them.

## Start a project

1. Confirm the source video path. Accept an existing word-level transcript when supplied; otherwise use cached video-use Scribe transcription.
2. Initialize a versioned manifest:

```bash
npm run project:init -- --id <project-id> --title "<title>" --source <video> [--transcript <transcript-json>]
```

3. Read the generated `projects/<project-id>/project.json` before running it. Never put API keys in the manifest.
4. Read [references/workflow-contract.md](references/workflow-contract.md) when changing stages, approvals, artifacts, or Web integration.
5. Run the Doctor and project preflight before paid calls, transcription, or rendering:

```bash
npm run doctor -- --project projects/<project-id>/project.json
npm run project:preflight -- --project projects/<project-id>/project.json
```

The formal runner repeats preflight as its first resumable stage. A warning is inspectable; a failed check blocks downstream work.

## Run and resume

Inspect planned work without paid calls or rendering:

```bash
npm run workflow -- --project projects/<project-id>/project.json --until review --dry-run
```

The final `workflow.preview` event reports invalidation reasons plus planned Codex, translation-provider, static-render, and video-render work. If a prior semantic plan exists, ordinary runs and `--force` may reuse it but may not replace it. A deliberate replacement requires:

```bash
npm run workflow -- --project projects/<project-id>/project.json --replan-semantic --until review
```

Every explicit semantic attempt is isolated and compared with the last valid plan before promotion.

Studio may run the same dry-run only as far as the next human gate. The readiness result must list every planned,
reused, and blocked stage plus the provider and render counts. A readiness check never calls an Agent, translator, or
renderer.

New projects also stop at an early conservative recut gate before captions or semantic planning:

```bash
npm run workflow -- --project projects/<project-id>/project.json --until recut
```

Inspect `recut-review.md`, `recut-candidates.json`, `edl.proposed.json`, and the continuous `recut-preview-720p.mp4`. Candidate meaning comes from read-only Codex CLI over the packed word-level transcript; local code owns stable IDs, word boundaries, silence padding, protected anchors, rejection policy, and EDL materialization. Approve only the exact reviewed proposal:

```bash
npm run workflow -- --project projects/<project-id>/project.json --approve-recut
```

Only then run through `plan` or `review`. Replacing a frozen provider proposal is explicit:

```bash
npm run workflow -- --project projects/<project-id>/project.json --replan-recut --until recut
```

Ordinary `--force` must not replace it. Legacy manifests without `policies.edit.version: "2.0"` preserve their existing edit path.

Run through the manifest-selected review mode. New projects default to static review evidence; `full-video` remains an explicit strict mode:

```bash
npm run workflow -- --project projects/<project-id>/project.json --until review
```

The runner reuses only stages whose input signature, output signature, and files remain valid. Use `--from <stage>` to start inspection at a stage and `--force` only when deliberately rebuilding it and its dependents.

For 16:9 visual-only changes, resume at the narrowest valid stage:

```bash
npm run workflow -- --project projects/<project-id>/project.json --from layout --until review
npm run workflow -- --project projects/<project-id>/project.json --from visual-direction --until review
npm run workflow -- --project projects/<project-id>/project.json --from qa-capture --until review
```

Use `--from review-render` only when the manifest selects `workflow.reviewMode: "full-video"`.

Do not repeat transcription, translation, or semantic planning when their signatures remain valid.

An explicit English-only caption correction updates the timing-identical semantic and display caption channels plus
their frozen render props. Because Chinese semantic evidence and anchors remain unchanged, preserve scene alignment,
semantic planning, component materialization, and visual direction, then resume at deterministic validation.

## Preserve text roles

- Keep `caption` text faithful to every retained spoken word. Correct only unambiguous ASR or domain errors.
- Freeze two timing-identical caption channels: punctuation-preserving `captions-semantic*` for translation and understanding, and policy-controlled `captions-verbatim*` for on-screen display. Never feed punctuation-stripped display text into semantic planning.
- Let `display-copy` summarize the visual argument without replacing captions.
- Keep `design-label` short and non-narrative.
- Use Xiaomi MiMo from `MIMO_API_KEY` by default for English translation. Use the offline provider only when explicitly requested.
- Reject a translation batch when an English item contains CJK text or has no lexical content. Retry the provider; never silently move meaning between adjacent caption items or invent a local replacement.
- Use authenticated Codex CLI as the default semantic-planning provider. It must run ephemerally with read-only sandboxing and structured output. Preserve `semantic-narrative-plan.json` and `semantic-provider-report.json` as separate review evidence.
- Resolve the project terminology snapshot before captions. Use global terms, selected domain packs, then project overrides; never maintain a second ad-hoc correction list inside a project script.
- Keep numbers and units as spoken in `caption`. Compact units only in `display-copy` or `design-label` without changing their values.

Read [../../docs/terminology-copy-foundation-0.1.12.md](../../docs/terminology-copy-foundation-0.1.12.md) when changing ASR correction, canonical bilingual names, subtitle segmentation, title compression, project overrides, or viewer-facing copy validation. Inspect `terminology-review.json` at the review gate.

## Protect approved behavior

Read [../../docs/regression-fixture-foundation-0.1.13.md](../../docs/regression-fixture-foundation-0.1.13.md) when changing components, motion, layouts, subtitles, terminology, visual QA, or rendering dependencies. Run `npm run fixtures:validate` and the relevant regression suite before asking for release approval. Private video fixtures remain local-only and are identified by checksum; never copy them into Git or a public artifact directory.

Fixture baseline promotion is separate from ordinary video approval. Require the exact current fixture report SHA and a named reviewer; never run `fixtures:promote` merely because tests passed.

## Apply the reusable asset foundations

Treat semantic components and asset foundations as separate layers and apply them in this order:

1. Read the complete punctuation-preserving transcript once to produce ordered, non-overlapping semantic intents. Then materialize each eligible intent locally into a validated VisualBrief and one approved semantic component from `src/components/library/registry.ts`. The provider never names a component.
2. Let the component consume `src/design-tokens/` and `src/motion-primitives/`; do not ask the language model to invent colors, glass recipes, easing, or decorative motion for each cue.
   - Upper-left section titles use the approved coordinate-frame primitive: bracketed English eyebrow above the Chinese argument title. Do not regenerate the former glowing vertical-bar style.
   - Content-bearing containers use the approved high-transparency Liquid Glass recipes. Prefer `card`, `compact`, or `brightFootage`; use the global `glassOpacityScale` for product-wide tuning and a component `opacityScale` only when footage contrast justifies it.
   - Keep glass limited to short labels, evidence cards, compact comparisons, and callouts. Never wrap a complete chart, long paragraph, subtitle block, or an outer group around already-glassed children.
3. Resolve semantic `motionIntent` through the selected component's profile in `src/motion-recipes/`. Motion Pack 2 recipes are approved; any future candidate recipe still falls back to the component's approved default until human promotion.
4. Resolve a layout per cue with `selectLayoutTemplate()`. It combines the selected component, its props, and detected face position. Do not assume one global left-column layout for the whole video.
5. Resolve icons through the icon registry and use its fallback. Do not hard-code a brand asset path.
6. Persist and validate component props, motion recipe, and layout before rendering.
   - Keep `semantic-plan` provider-backed and `component-props` local-only so copy, identity, layout, or renderer fixes can resume without another Codex call.
   - Refuse unsupported numbers, incomplete matrices, missing identity evidence, placeholders, incomplete titles, or copy beyond the reviewed component capacity. A skipped visual is safer than invented or clipped content.
   - Freeze every valid component candidate before whole-video direction. The local-only `visual-direction` stage assigns hero/support/accent/none importance, enforces breathing, duration, density, coverage, and repetition budgets, and writes an auditable show/skip decision for every candidate. It may shorten, delay, replace, or skip a candidate but may not invent new semantic evidence or choose an unapproved component.
   - When the manifest supplies authored screen recordings, probe and checksum them before planning, then resolve authored spoken-text anchors against punctuation-preserving captions in `scene-align`. A required resolved recording is a hard constraint: it suppresses overlapping semantic components, stays muted, and uses the edited speaker video as the single audio master plus a muted safe-area PIP. Never let the director guess, replace, or silently skip the requested asset.
   - Resolve the locked section-level primary-visual plan against punctuation-preserving semantic captions. Reject stale
     final-script bindings and overlapping primary intervals. A selected image, screen-demo, animation, or explicit
     speaker interval suppresses conflicting semantic component candidates and may never be silently moved or replaced.
   - Resolve locked text annotations independently against the same semantic captions. Reject stale hashes, missing
     quotes, and overlaps between annotations, but never suppress the primary visual because of an annotation. Render a
     compact annotation with the approved `rough-annotation` renderer in the primary visual's safe zone; do not wrap it
     in a new surface container. For a component, prefer the available space below it.
   - Keep `speaker`, `component`, `image`, `screen-demo`, and `animation` mutually exclusive as primary interval types.
     Report component coverage, real-material coverage, animation coverage, full-screen takeover, and speaker visibility
     separately. These reports are diagnostic and must not force irrelevant visuals.
   - Animation may use only approved semantic archetypes and style profiles. The locked authored visual plan binds the
     creator-confirmed structure and style per section; a creator-workflow handoff uses `per-cue` animation policy and
     must never replace those choices with one project-wide template. Each animation is full-screen with a fixed
     top-right circular speaker PIP. Candidate movement primitives require static phase review and bounded 540p
     continuous excerpts covering every confirmed animation cue; omit animation cues from delivery props until
     explicit renderer promotion. Full continuous 720p pacing review remains an explicit strict option.
   - The public workflow never inserts a repository-owned bumper or fixed brand interval. User-supplied branding may be added only through an explicit, project-local extension and must remain subject to the normal review gates.
   - Sound design is deterministic and local. Resolve only registered checksum-frozen local assets by semantic role, preserve silent defaults for captions and support motion, enforce the configured per-minute, per-cue, collision, and speech-safe gain budgets, and never ask an understanding provider to select a file or fetch audio remotely.
7. For explicit quantitative claims, let the understanding layer emit only a typed `chartIntent`. Resolve it deterministically through `src/charts/selector.ts` and the selected component's chart allowlist. Never let the model name a chart recipe. The ten 0.1.10 recipes are approved; radar remains restricted.
8. For a materially named person, company, institution, country, exchange, university, research group, or publication, let the understanding layer emit only typed `mediaIntents`. Resolve IDs and spoken aliases through `src/media-assets/`; production may use only approved local variants and must fall back to a respectful full name, monogram, or text badge for candidate, blocked, missing, or unknown assets. Person evidence, quote/source, binary comparison, ranked metrics, and model classification consume this identity layer. Never let generated JSON contain a remote media URL or local path.

When adding or changing a component, token, motion primitive, chart recipe, layout, or reusable media asset, keep the
Draft → rendered risk frames → QA → human approval → promotion gate. Open-license portraits and official nominative
marks remain review-only until explicit human promotion. Topic-specific screenshots are project evidence and are not
part of the reusable identity registry.

The project manifest's `assetProfile` records the expected foundation and inventory versions. If it is absent in an older manifest, preserve backward compatibility but report that the project does not pin an asset profile. Do not silently substitute an unknown profile.

## Review gate

Honor the manifest's review mode. New projects use `static`; manifests that omit the field retain legacy `full-video` behavior. Inspect `visual-direction-plan.json` and `visual-direction-report.json`: chapters, hero/support balance, merge/split boundaries, show/skip reasons, repeated components, visuals per minute, and whole-video coverage must be deliberate. `qa-capture` must derive frames from the probed source/review fps rather than assuming 30fps. It captures entry, transition, stable, and exit-risk states for every selected cue plus one speaker-only frame for every skipped direction decision.

Static review is sufficient for final approval when `visual-qa` passes and `review-evidence.json` binds the plan, props, direction reports, QA contracts, image metrics, contact sheet, and every captured frame. Present the contact sheet, direction report, evidence summary, and every error/warning frame. Ask the user to inspect subtitle fidelity, semantic component choice, per-cue layout, visual breathing, importance hierarchy, face safety, local scrim, ending state, and the speaker-only gaps. Use `full-video` when continuous cut pacing, speech edits, or overlay transitions cannot be decided from the static evidence. Do not render a full review merely to duplicate an approved static package.
Static mode renders bounded 540p motion-risk excerpts only when confirmed animation cues require continuous evidence.
Projects without time-sensitive visuals may proceed from approved static evidence to delivery. Explicit `full-video`
mode uses its existing continuous review and must not render a second pacing proxy. Legacy static manifests retain
their continuous 720p pacing review. Cut preparation caches each exact source range by source
content and encoding profile; QA capture similarly reuses a frame only when its active visual, active subtitle,
renderer, and base-video hashes still match.
For intelligent recut 2.0, the bound 720p speech-cut proxy is the required continuous evidence even in static visual-review mode. Recut approval is separate from final visual approval; final approval cannot substitute for an unapproved proposed EDL.
Review counts must keep semantic components, authored recording scenes, whole-video title continuity, and remaining speaker-only gaps separate. Never report their total as a component count.
For every authored recording scene, also inspect screen entry, transition, stable, exit-risk, and speaker-return frames, the alignment confidence, source clip bounds, PIP crop, subtitle clearance, and the absence of an overlapping semantic component.

For a brand-enabled project, review the complete audio-bearing bumper and the bounded real transition excerpt in addition to static frames. Confirm that the final-script anchor matched, speaker audio stops and resumes without losing words, captions and competing visuals are absent during the bumper, the event timeline follows the registered roles and budgets, and the mix report has no clipping error. These excerpts replace a full review-video render unless they expose unresolved pacing.

Record approval only after an explicit user decision:

```bash
npm run workflow -- --project projects/<project-id>/project.json --approve
```

Never infer approval from a successful render. Never generate source-resolution delivery for a component test unless requested.
Approval creates a recoverable immutable snapshot under `<workspace>/approvals/`. Ordinary delivery restores and verifies that package, starts at `delivery-render`, and never replays translation or semantic planning.

When review finds a problem, record a typed rejection or revision instead of editing generated files ad hoc:

```bash
npm run revision:apply -- --project projects/<project-id>/project.json --revision projects/<project-id>/revisions/<revision-id>.json
```

The request must match the current artifact hashes. It may update only allowlisted edit/caption policies, English translation, or validated VisualBrief cue fields. Chinese caption truth remains transcript-derived. Any rejection or applied revision revokes the old approval and resumes from the narrowest stale stage.

SeanLab Studio exposes the same contract through its project “检查与返修” surface. Its inspectors may read transcript, semantic/display captions, EDL, semantic plan, VisualBriefs, direction decisions, provider evidence, job history, and project-local disk usage. A Studio revision preview must derive current hashes on the server, show the earliest stale stage and every provider/render call, and require explicit confirmation before applying. If semantic history must be replaced, the resumed task must use the explicit semantic-replan path; an ordinary continue may not overwrite it.

Visual QA errors block ordinary approval. Only record a waiver when the user explicitly accepts the named findings and supplies a reason:

```bash
npm run workflow -- --project projects/<project-id>/project.json --approve --waive-qa "<explicit reason>"
```

Visual regression baselines require a separate report-SHA-bound approval. Never update them as a side effect of rendering or ordinary review approval.

After approval, delivery may run with:

```bash
npm run workflow -- --project projects/<project-id>/project.json --until delivery
```

Delivery must re-verify the approved evidence hashes before rendering. `delivery-validate` then checks codec, source dimensions, audio, expected EDL duration, full-file decode, byte size, and SHA-256. A render is not a successful delivery until this stage passes.

Studio delivery may select 1080p, 2K, 4K, or source resolution and 30fps, 60fps, or source fps. New projects default to
1080p60. The current format remains MP4/H.264. Never upscale beyond source resolution or duplicate frames above source
fps; surface the effective output and historical time/disk estimate before starting.

## Diagnose failures

1. Read `workspace/run-state.json` for stage status and its structured `failure` (`code`, `category`, `retryable`, `remediation`). Do not parse raw provider exceptions as the product contract.
2. Read `workspace/logs/<stage>.log` for command output.
3. Read `workspace/artifacts.json` for frozen paths, hashes, and sizes. For language failures, also read `workspace/terminology-review.json` and confirm the selected domain packs and project overrides. For release regressions, read `workspace/regression/report.json` and inspect its exact cue, rule, and expected value.
   A Web-safe snapshot is available with `npm run workflow:status -- --project <manifest>`.
4. Fix the narrow cause and rerun normally; let signatures determine stale stages.
5. Do not delete valid upstream artifacts to force progress.

Provider and render stages have bounded timeouts. Render stages that stop emitting progress fail with `RENDER_STALLED`; other absolute timeouts use `STAGE_TIMEOUT`. Resume from the named failed stage after fixing the narrow cause.

Report discovered workflow problems after the review run so they can be fixed independently of the video content.

## Export, automate, and accept

Create a portable project without private source media or secrets:

```bash
npm run project:export -- --project projects/<project-id>/project.json --output out/<project-id>.vrbundle
npm run project:bundle:verify -- --bundle out/<project-id>.vrbundle
```

The receiver must relink the original source and match `source-binding.json` by size and SHA-256. Never add source media, provider keys, local-only regression media, logs, or non-redistributable reusable assets to the bundle.

A future Web workspace must submit a versioned JSON request to `npm run operator:control -- --request <request.json>`. Use only the typed action allowlist; never add a generic command, shell string, or user-supplied filesystem path. Approval still requires the literal human confirmation and QA waivers remain explicit.

Run the release-path acceptance after implementation or environment changes:

```bash
npm run acceptance -- --project projects/<project-id>/project.json
```

For intelligent recut 2.0 projects, run acceptance only after the continuous recut proxy has received explicit human approval and `edl.json` has been promoted. Acceptance must stop at the recut gate on an unapproved new project; it never auto-approves speech edits.

Use `--verify-existing` only when auditing already-produced review, QA, and regression artifacts without repeating provider or render work. It does not replace a clean full run on a new supported machine.
