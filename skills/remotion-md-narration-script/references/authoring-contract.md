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

Uploaded screen recordings and screenshots begin as candidates. The draft may recommend or bind a candidate when it directly supports the spoken section, but it must not use every candidate merely because it exists. The creator confirms placement after the draft. The system derives the verbatim spoken anchor at lock; the creator is never asked to know that anchor during upload. Unbound candidates remain optional and stay out of the production manifest.

Before drafting, the pinned project Agent inspects original images and six-frame recording contact sheets, combines
them with frozen text sources, and produces one understanding card per input. The creator confirms these cards as an
intake gate. The confirmation binds the source/material inventory and original asset hashes; adding or replacing an
input invalidates the gate. A recording card must distinguish sampled visible evidence from actions that were not
observed between frames.

For screen recordings and screenshots, describe what the creator should show and what the narration should explain. Do not assign absolute timecodes and do not choose Remotion components. The downstream workflow aligns the final spoken words to the recorded video.

At draft level, `section.materialIds` remains an optional preferred recording or screenshot hint. The deterministic visual planner may additionally bind materials to exact non-overlapping beats inside that section. A screen-demo beat binds exactly one recording. An image beat may bind one to three directly related screenshots as a single grouped presentation. The same registered material may be reused by several beats, with each placement frozen to its own spoken quote at lock.

## Visual-aware authoring

- The writing Agent may see semantic presentation forms such as comparison, ordered progression, causal explanation, evidence, classification, numbers, and short-text emphasis.
- Use those forms only to make supported content easier to say and easier to understand. Do not add facts, repeat points, or force a fixed number of visual opportunities.
- Keep component ids, renderer names, layout, color, animation, and timing out of the spoken narration.
- Record each visual opportunity as non-spoken metadata with an exact quote from the same section. The real transcript and downstream evidence remain authoritative after recording.
- The downstream planner may place several non-overlapping visual beats in any spoken block. Each beat owns one primary visual; uncovered words remain on the speaker.
- A single image beat may group up to three directly related screenshots. A screen recording must anchor to the exact short quote it proves, never automatically stretch across the complete section.
- Manual edits that change the quoted section invalidate its old visual-opportunity hints; regenerate them through Agent rewrite or let downstream understanding work from the final recording.
