---
name: remotion-md-creator-workflow
description: Operate the complete remotion-md creator workflow from topic intake and global Agent selection through narration approval, shooting handoff, video workflow execution, static review, approval, and delivery. Use when the user wants one connected project rather than running script authoring and video production separately.
---

# Remotion MD Creator Workflow

This is the project-level controller. It delegates authoring to `remotion-md-narration-script` and video production to `remotion-md-video-workflow`, while preserving one Agent pin and one auditable artifact chain.

## Invariants

- Create one `creator-project.json` before authoring.
- Detect installed Agents and ask the user to choose one available Agent at project creation.
- Pin that Agent with `fallback: none`. Use it for narration, intelligent recut, semantic planning, and choosing shared
  image ingredients for already-directed animation stages. The local system still owns deterministic visual contracts,
  compatibility checks, icon fallback, animation, and rendering. Never switch providers automatically.
- If a project pins an explicit model, accept only an Agent/model pair approved by the versioned governance registry. A conformance run alone creates a candidate, not an approval.
- Require human approval at the final-script and static-review gates.
- Do not render a full review video by default. Render static review evidence first. For confirmed animations, render
  only bounded 540p motion-risk excerpts after static QA; projects without time-sensitive visuals may proceed from
  static approval to delivery. Keep full continuous review as an explicit strict option.
- Resume from frozen artifacts. Do not regenerate semantics or narration merely to continue a run.

## State flow

Read [references/state-machine.md](references/state-machine.md). Then follow:

1. Detect Agents: `npm run creator -- agents`.
2. Create the project: `npm run creator -- init ... --agent <codex-cli|claude-code>`.
3. Use `remotion-md-narration-script` for material upload, pinned-Agent understanding cards, creator confirmation,
   draft, creator revision, automatic visual-beat review, optional text annotations, and lock.
4. Register authored media and the final speaker video with `npm run creator -- asset ...`.
5. Create the handoff. Confirm its Agent pin and final-script hash match the creator project.
6. Read `skills/remotion-md-video-workflow/SKILL.md` completely and run that workflow against the generated video manifest.
7. Stop at static review. Apply revisions only through explicit review decisions.
8. After approval, render delivery and record delivery evidence in the same creator project.

During narration review, include every spoken block—opening, overview, authored body sections,
and conclusion—and let the local deterministic planner recommend zero or more sequential visual beats inside each
spoken block. Every beat owns exactly one primary visual: `speaker`, `component`, `image`, `screen-demo`, or
`animation`; uncovered narration returns to `speaker`. One image beat may group up to three directly related
screenshots, while a screen-demo beat binds exactly one recording and only covers its exact spoken quote. The creator
normally confirms the complete plan once and only changes exceptional beats. Optional text annotations are a separate secondary layer: each annotation binds a
2-24 character exact quote and chooses only a local effect such as highlight, circle, underline, box, cross-off,
strike-through, or bracket. An annotation may coexist with the section primary visual and never reserves or suppresses
its interval. Both automatic text-emphasis components and manual annotations reuse the approved `rough-annotation`
renderer; manual annotations must not add a separate surface container. Lock binds the complete visual-beat plan and
annotations to the final-script hash. Speaker PIP presence is reported separately. Structural blocks must not default
to speaker merely because of their position in the script. Project creation never selects an animation style. After
the narration exists, the local visual planner recommends one semantic animation structure and one compatible approved
style for every animation section. Studio shows both fields and the style preview before the creator confirms the
complete visual plan. A video may use more than one approved style because the style choice is frozen per beat, not
per project; report the most-used style as primary and the remaining approved style as secondary. Every approved
animation remains full-screen with a top-right circular speaker PIP. Animation is only one of the five primary visual
types. When the same evidence supports both animation and a component, recommend animation first and show the compatible
component as a second-priority human-selectable alternative. Within animation, show a primary structure/style pairing
plus compatible backup animations; confirmation freezes exactly one primary visual per beat, not one for the whole section.
Shared image-library assets are not a sixth primary visual and must never compete with animation. After an animation
structure and style are known, the pinned project Agent may bind a compatible shared image to an individual animation
stage. If it selects none, the local system resolves a registered icon for that stage. Authored screenshots and source
evidence remain the separate `image` primary visual type. If the creator later changes an animation structure or style,
Studio may explicitly ask the pinned Agent to replan those image ingredients. Save the result as a reviewable draft with
an immutable attempt record; show the old/new bindings and promote them only after explicit human confirmation. Never
rerun this automatically or treat it as approval of the complete visual plan.

The opening uses the same automatic semantic planning and human confirmation rules as every other spoken block. Never
inject a fixed portrait, channel identity, slogan, episode tag, transition sentence, or bumper. Creator branding is
optional project-local input and must not become a repository default.

## Operator surfaces

SeanLab Studio and the CLI/Skills are two interfaces over the same creator project, video manifest, run state, artifact hashes, typed revision contract, and approval snapshots. Studio may inspect evidence, create a hash-bound typed revision, preview the narrow invalidation plan, resume affected stages, validate delivery, and record final acceptance. It must never create browser-only editing truth or bypass the CLI-safe operation allowlist.

During narration visual review, every creator change to a visual beat, component, material binding, animation structure or
style, display mode, and text annotations is saved immediately as a `suggested` visual-storyboard draft. A page
refresh must restore that draft. Explicit confirmation promotes the current choices to `confirmed`; returning a section to the
automatic recommendation is the reversible cancellation path.

When a creator rejects static review or returns a delivery, open the Studio project operations surface or use the existing revision CLI. Show whether the requested change will call the pinned Agent, translation API, static renderer, or final renderer before applying it. Preserve old review and delivery artifacts as history; never delete valid upstream artifacts to force a retry.

Studio runs one Agent/render job at a time across all projects. A queued or running job keeps its project busy. After Studio restarts, abandoned work is marked interrupted and must resume from persisted workflow evidence; never replay an Agent, translation, or render automatically. Use the hash-bound cleanup preview only for allowlisted regenerable caches. Stop Studio before CLI backup/restore operations, verify every backup before restore, and keep the archived rollback until the restored project has been inspected.

Future project modes (`narration-only`, `video-only`, and `full-workflow`) are planned but not active. Until the creator-project schema explicitly supports them, operate every Studio project as the complete connected workflow and do not infer a partial mode.

## Failure policy

If the pinned Agent is unavailable or unauthenticated, stop with remediation. If the final-script hash or authored-media inventory differs from the handoff, stop and rebuild the handoff explicitly. A workflow failure must never silently rewrite approved narration, semantic plans, or accepted visual artifacts.
