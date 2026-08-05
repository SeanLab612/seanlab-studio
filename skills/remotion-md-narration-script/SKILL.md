---
name: remotion-md-narration-script
description: Create, revise, and lock a natural Chinese talking-head narration package with source-aware screenshot or screen-recording guidance. Use when a user has a topic and needs a script, shooting guide, authored-media plan, or a final script handoff before running the creator workflow.
---

# Remotion MD Narration Script

Turn a topic into a reviewable, creator-edited script package. The Agent pinned in `creator-project.json` is authoritative for this entire project; never select or silently fall back to another Agent here.

## Intake

New projects use one of three public categories: GitHub project introduction, news introduction, or tutorial
introduction. Legacy category values remain readable for existing projects but must not be offered during new-project
creation.

Studio may begin with one free-form creator brief. The pinned project Agent may extract only answers supported by an
exact quote from that brief, then Studio asks only for required answers that remain missing. The structured
`brief.editorialBrief` remains authoritative; inference is an input convenience, not permission to invent.

Complete intake in this order:

1. Start from the creator's free-form project description, then add candidate images, screenshots, screen recordings,
   reference files, and speaker footage when available.
2. Add websites, repository links, documents, notes, or local file paths that can verify external facts. Accept
   “没有”, but do not invent product, event, or procedural claims when evidence is absent.
3. Run the project-pinned Agent over the resolved sources, original images, and sampled recording contact sheets.
   Present one project summary plus one card for every source and material. For each image or recording, recommend keep,
   exclude, merge, or trim. The creator may accept or override the disposition and add a material-specific note.
   Confirmation binds the current source and asset hashes; any later intake change makes the cards stale.
4. Confirm every universal and category-specific answer in the versioned `brief.editorialBrief`. Record the creator's
   motivation, real relationship to the topic, audience, single takeaway, selected category angle, experience or
   evidence, and relevant limits, unknowns, failures, or completion check. A call to action is optional.

Do not start generation while the saved editorial brief is incomplete or the material-understanding cards are
unconfirmed. Treat creator answers as the authority for first-person experience and writing direction, while frozen
sources and confirmed material-understanding cards remain authoritative for external and visible facts.

CLI operators may run `npm run creator -- understand --id <creator-project-id>`, inspect the returned
`inputSha256`, then record explicit approval with
`npm run creator -- confirm-understanding --id <creator-project-id> --sha <inputSha256>`.

## Draft

Read [references/authoring-contract.md](references/authoring-contract.md) and
[references/editorial-method.md](references/editorial-method.md). The first defines the production contract; the
second defines how to turn source facts into a coherent spoken argument without copying a reference author's words.
Run:

```bash
npm run creator -- draft --id <creator-project-id>
```

The output contract is `schemas/narration-script-package.schema.json`. Treat the structured sections as the editable source; `fullScript` is derived from them. Never invent a recording or screenshot that the material inventory cannot support.

New drafts enter the topic directly. Do not invent a creator name, channel greeting, slogan, or fixed transition; include one only when the creator explicitly supplies it in the editorial direction.

Before invoking the writing Agent, Studio freezes URL text, supported local reference files, and notes into
`authoring/source-context.json`. Failed sources remain explicit failed records and must not be used as factual evidence.
Images are supplied directly to the pinned Agent. Recordings are represented by six uniformly sampled frames and must
carry the limitation that unsampled moments were not inspected. The resulting
`authoring/material-understanding.json` is reviewable, hash-bound, and must be confirmed before drafting.

The first draft must have one audience-facing question or judgment, not a catalogue of everything in the source.
Build evidence modules before writing prose: each module should make one claim, support it with a fact, example, or
registered material, explain why it matters, and state a limitation when the evidence requires one. Treat component
forms as silent organization aids only. Do not mention them or contort the narration to cover the registry.

After the first structurally valid draft, run the same project-pinned Agent a second time as an evidence editor. It must
compare every external claim semantically against the frozen sources, creator direction, and confirmed material cards,
preserve supported translations and paraphrases, and remove or narrow unsupported claims itself. Save the pre-review
draft as an immutable superseded attempt before exposing the reviewed result. Local code may hard-block only
deterministic defects such as invalid structure, unknown material ids, or exact numeric claims absent from the frozen
evidence. Qualifier words and cross-language phrasing remain audit signals; they must not become lexical hard gates.
Speaker footage added for the shooting handoff is production input, not writing evidence, and must not invalidate an
already confirmed material-understanding card.

## Review and lock

Present the script and shooting guide for creator editing. Ask the creator to edit the generated draft directly; the
diff between Agent attempts and creator saves is future style evidence, not permission to imitate third-party prose.
Preserve the creator's wording; do not “polish” an approved final draft automatically. Update the structured package,
then run:

```bash
npm run creator -- update-script --id <creator-project-id> --package <narration-package.json>
npm run creator -- lock --id <creator-project-id>
```

Locking freezes the final-script hash and derives authored scene anchors from the final wording. If a screen scene lacks exactly one available material, stop and explain what is missing. Do not begin the video workflow before the creator approves and locks the script.

Studio presents only the narration text for creator editing. Do not generate or expose a visual storyboard, component
selector, animation selector, timeline, or manual annotation layer during writing. The writing Agent may assign every
required uploaded image or recording to exactly one semantic section so downstream production understands why it belongs,
and a section may carry several related material ids. This binding is internal metadata, not a creator-editable visual plan.
Do not add component names, layout recipes, animation timings, or coverage targets to the spoken script.

The opening follows the same semantic visual planning rules as every other section. Do not inject a fixed portrait,
identity card, slogan, component, or episode tag. Creator identity is optional project input, never a repository default.

Every initial draft, Agent rewrite, creator save, and restore is an immutable project-local authoring attempt. A failed Agent call must not replace the last valid package. Restoring history creates a new attempt, and locking binds the exact current attempt id and hash. Studio may export the current package as Markdown, plain text, structured JSON, or a local print-to-PDF page without calling the Agent.

After locking, Studio may compare the first valid attempt, creator instructions, and the locked final attempt to
suggest reusable writing lessons only when the creator starts that action manually. Locking must not enqueue learning.
The creator must explicitly accept those lessons. Only canonical style and structure
preferences enter the local creator profile; episode facts, names, metrics, conclusions, and unsupported personal
claims never become future writing evidence. Accepted lessons guide later drafts but cannot override the current
editorial brief or frozen sources.

Uploaded screenshots and screen recordings default to mandatory production assets. Material understanding may recommend
excluding, merging, or trimming them; the creator's confirmed disposition is authoritative. Every required visual must
bind exactly once in the narration package and every excluded visual must remain absent. Locking derives fresh anchors
from the latest creator-edited wording and must fail closed if a required visual is missing or duplicated. Never ask the
creator to supply an anchor while uploading an asset.

## Handoff

After the speaker video is registered, create the video handoff with:

```bash
npm run creator -- handoff --id <creator-project-id> --speaker-asset <asset-id>
```

The resulting video manifest must retain the creator project's Agent pin for recut and semantic planning.

Studio may present the same intake, editable structured draft, lock, and shooting handoff in the browser. The files under the creator project remain authoritative; Studio must call the same authoring functions and must not keep a separate browser-only draft. A future `narration-only` project mode is planned, but until its schema is implemented this Skill continues to hand off into the complete creator workflow.
