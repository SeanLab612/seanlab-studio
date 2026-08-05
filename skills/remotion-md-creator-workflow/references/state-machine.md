# Creator project state machine

| State | Required evidence | Allowed next action |
|---|---|---|
| intake | topic, category, Agent pin; hash-bound material understanding and explicit keep/exclude decisions | collect sources and materials; analyze, curate, and confirm, then draft |
| drafting | provider run started | finish or retry same Agent |
| script-review | narration package and shooting guide | edit structured sections |
| script-locked | final script hash and required-material semantic bindings derived from the latest wording | register speaker media |
| awaiting-media | locked script | add speaker video |
| video-ready | video manifest and complete Production Agent handoff | generate production direction through validation |
| visual-confirmation | hash-bound read-only production direction | confirm direction or return to narration editing |
| video-running | confirmed direction, run state, internal QA and logs | Production Agent resumes same manifest and self-repairs |
| review | validated final video | accept delivery or return with a result-level reason |
| approved | final delivery acceptance record | archive/export |
| delivered | delivery validation | archive/export |

Every transition writes an artifact before changing state. Do not skip approval states and do not infer approval from silence.
