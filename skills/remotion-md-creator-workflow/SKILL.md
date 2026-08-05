---
name: remotion-md-creator-workflow
description: Operate the complete remotion-md creator workflow from topic intake and Agent selection through material curation, narration approval, read-only production-direction confirmation, autonomous production, and delivery review.
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
- Human-editable truth ends at the final narration text and material keep/exclude decisions. The production direction is read-only and requires one confirmation; internal static and motion QA belong to the Production Agent.
- Uploaded screenshots and recordings default to required production evidence. The Agent may recommend exclude, merge, or trim during material understanding, and the creator may override those recommendations before drafting.
- Resume from frozen artifacts. Do not regenerate semantics or narration merely to continue a run.

## State flow

Read [references/state-machine.md](references/state-machine.md). Then follow:

1. Detect Agents: `npm run creator -- agents`.
2. Create the project: `npm run creator -- init ... --agent <codex-cli|claude-code>`.
3. Use `remotion-md-narration-script` for material upload, pinned-Agent understanding and curation cards, narration-only draft, creator text revision, and lock.
4. Register authored media and the final speaker video with `npm run creator -- asset ...`.
5. Create the handoff. Confirm its Agent pin and final-script hash match the creator project.
6. Read `skills/remotion-md-video-workflow/SKILL.md` completely and run through `validate` to generate a read-only production direction.
7. After the creator confirms the current hash-bound direction, let the Production Agent continue through internal QA, bounded self-repair, and delivery rendering without user-facing intermediate approvals.
8. Present the final result for delivery review and record acceptance in the same creator project.

The narration Agent may bind required materials to semantic sections, including several related uploads in one section, but must not prescribe components, layout, crop, animation, or timing. Each required image or recording appears exactly once in this semantic handoff; excluded material must not appear. If the creator edits the narration, locking derives anchors again from the latest wording. Never reuse stale anchors.

After lock, the Production Agent owns all five primary visual types: speaker, component, image, screen-demo, and animation. It receives the complete latest narration, confirmed material understanding, every local asset, and the material decisions. Required uploaded assets are hard presence obligations, while placement, duration, crop, grouping, PIP, and animation remain downstream decisions. Studio exposes only a compact read-only direction summary. It must not expose component selectors, timeline editing, annotation tools, or per-beat approval.

The opening uses the same automatic semantic planning and human confirmation rules as every other spoken block. Never
inject a fixed portrait, channel identity, slogan, episode tag, transition sentence, or bumper. Creator branding is
optional project-local input and must not become a repository default.

## Operator surfaces

SeanLab Studio and the CLI/Skills are two interfaces over the same creator project, video manifest, run state, artifact hashes, typed revision contract, and approval snapshots. Studio may inspect evidence, create a hash-bound typed revision, preview the narrow invalidation plan, resume affected stages, validate delivery, and record final acceptance. It must never create browser-only editing truth or bypass the CLI-safe operation allowlist.

The Studio API must enforce the same two boundaries as the UI: narration endpoints accept structured text only, and the production-direction endpoint accepts only a hash-bound confirmation literal. Any change to the narration, material inventory, or generated direction invalidates the old confirmation.

When a creator rejects static review or returns a delivery, open the Studio project operations surface or use the existing revision CLI. Show whether the requested change will call the pinned Agent, translation API, static renderer, or final renderer before applying it. Preserve old review and delivery artifacts as history; never delete valid upstream artifacts to force a retry.

Studio runs one Agent/render job at a time across all projects. A queued or running job keeps its project busy. After Studio restarts, abandoned work is marked interrupted and must resume from persisted workflow evidence; never replay an Agent, translation, or render automatically. Use the hash-bound cleanup preview only for allowlisted regenerable caches. Stop Studio before CLI backup/restore operations, verify every backup before restore, and keep the archived rollback until the restored project has been inspected.

Future project modes (`narration-only`, `video-only`, and `full-workflow`) are planned but not active. Until the creator-project schema explicitly supports them, operate every Studio project as the complete connected workflow and do not infer a partial mode.

## Failure policy

If the pinned Agent is unavailable or unauthenticated, stop with remediation. If the final-script hash or authored-media inventory differs from the handoff, stop and rebuild the handoff explicitly. A workflow failure must never silently rewrite approved narration, semantic plans, or accepted visual artifacts.
