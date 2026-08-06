# Creator authoring contract

## Voice

- For new projects, read the saved editorial brief before the source inventory. Its creator relationship, audience,
  selected angle, takeaway, and first-person evidence define the writing direction.
- Never invent personal usage, testing, ownership, preference, or recommendation. Use only what the creator supplied.
- Do not generate a platform call to action when the editorial brief leaves it empty.
- Write conversational Mandarin that is comfortable to say aloud.
- Prefer concrete observations and short transitions over abstract summaries.
- Avoid “首先、其次、最后”, exaggerated claims, fake suspense, and generic AI phrasing.
- State evidence before judgment. Mark inference and personal opinion clearly.
- Keep technical nouns accurate; do not simplify away necessary product or biomedical terminology.
- In a screen-led walkthrough, directly describe the product interface, supported user action, and visible result.
  Phrases such as opening the page, choosing a template, entering a request, and seeing the result are valid narration.
- Treat screenshots, recordings, and reference files as silent evidence by default. Do not narrate how the Agent read
  an uploaded asset (for example, "the recording shows" or "this material reflects") unless that source medium is
  itself the subject. This rule must not suppress a genuine interface walkthrough.
- Give the whole narration one audience-facing question or judgment. Do not treat the source inventory as an outline.
- Let each section perform one main reasoning job. Split sections that mix comparison, process, cause, and conclusion.
- Use concrete situations to explain capability; mention internal technologies only when the audience needs them.
- Include failures, limits, and uncertainty when the sources contain them. Do not bury them after the conclusion.

## Opening and transitions

Enter the topic with a concrete problem, change, result, or question. Do not invent a creator name, channel greeting,
slogan, or fixed transition. A creator may provide their own identity language in the editorial brief, but the
repository supplies none. The opening visual follows the same semantic planning rules as every other spoken block.

## Category structures

- GitHub project introduction: creator relationship → real problem → selected angle → verified workflow/result →
  limitation → who it fits and does not fit.
- Tutorial: problem → prerequisite → real action sequence → result → common failure → summary.
- News analysis: event → verified facts → why it matters → impact → uncertainty → view.
- Tool review: problem → product positioning → evidence/results → strengths → limitations → who should use it.
- Model review: test frame → capability evidence → speed/cost → limitations → scenario recommendation.
- Biopharma extra: scientific context → evidence level → development implication → uncertainty → non-medical summary.

These are reasoning routes, not mandatory headings. Use two to six natural evidence modules and omit a step that the
sources cannot support. The conclusion must resolve the opening premise without introducing a new claim.

## Authored media

Uploaded screen recordings and screenshots begin as intake inputs. Material understanding may recommend keeping,
excluding, merging, or trimming them, and the creator confirms that disposition before drafting. Every item confirmed as
required must bind exactly once to the most relevant spoken section; excluded items remain absent. The system derives
the verbatim spoken anchor at lock, so the creator is never asked to know that anchor during upload.

Before drafting, the pinned project Agent inspects original images and six-frame recording contact sheets, combines
them with frozen text sources, and produces one understanding card per input. The creator confirms these cards as an
intake gate. The confirmation binds the source/material inventory and original asset hashes; adding or replacing an
input invalidates the gate. A recording card must distinguish sampled visible evidence from actions that were not
observed between frames.

For screen recordings and screenshots, write the supported interface, action, and result from the creator or viewer's
perspective. Keep the asset reference in non-spoken metadata instead of announcing that the Agent saw it in a recording.
Do not assign absolute timecodes and do not choose Remotion components. The downstream workflow aligns the final spoken
words to the recorded video.

At draft level, `section.materialIds` is the required non-spoken handoff for materials confirmed as required. The
deterministic visual planner binds them to exact non-overlapping beats inside that section. A screen-demo beat binds
exactly one recording. An image beat may group one to three directly related screenshots. The narration package binds
each required material once; downstream layout may create the grouped presentation without changing that ownership.

## Visual-aware authoring

- The writing Agent may see semantic presentation forms such as comparison, ordered progression, causal explanation, evidence, classification, numbers, and short-text emphasis.
- Use those forms only to make supported content easier to say and easier to understand. Do not add facts, repeat points, or force a fixed number of visual opportunities.
- Keep component ids, renderer names, layout, color, animation, and timing out of the spoken narration.
- Record each visual opportunity as non-spoken metadata with an exact quote from the same section. The real transcript and downstream evidence remain authoritative after recording.
- The downstream planner may place several non-overlapping visual beats in any spoken block. Each beat owns one primary visual; uncovered words remain on the speaker.
- A single image beat may group up to three directly related screenshots. A screen recording must anchor to the exact short quote it proves, never automatically stretch across the complete section.
- Manual edits that change the quoted section invalidate its old visual-opportunity hints; regenerate them through Agent rewrite or let downstream understanding work from the final recording.

## Evidence review boundary

- The pinned Agent performs a separate evidence-editing pass after it produces a structurally valid draft and before the creator sees it.
- That pass evaluates complete claim meaning, including translation and paraphrase, against frozen sources, creator direction, and confirmed material-understanding cards.
- Unsupported claims are removed or narrowed by the Agent inside the same job. They are not returned to the creator as keyword errors.
- Local hard validation is limited to deterministic contracts: package structure, registered material references, exact numeric claims, and derived-script consistency.
- Lexical qualifiers such as “free”, “stable”, “support”, or their translations may be reported for audit metrics, but a missing literal token match must never reject a narration draft.
