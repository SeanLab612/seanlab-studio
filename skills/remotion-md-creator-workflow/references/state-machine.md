# Creator project state machine

| State | Required evidence | Allowed next action |
|---|---|---|
| intake | topic, category, Agent pin; confirmed hash-bound material understanding before draft | collect sources and materials; analyze and confirm understanding, then draft |
| drafting | provider run started | finish or retry same Agent |
| script-review | narration package and shooting guide | edit structured sections |
| script-locked | final script hash, globally confirmed visual-beat plan, and hash-bound text annotations | register speaker media |
| awaiting-media | locked script | add speaker video |
| video-ready | video manifest and handoff | preflight video workflow |
| video-running | run state and logs | resume same manifest |
| review | static evidence plus bounded motion-risk excerpts when confirmed animations exist | approve or revise |
| approved | approval record | render delivery |
| delivered | delivery validation | archive/export |

Every transition writes an artifact before changing state. Do not skip approval states and do not infer approval from silence.
