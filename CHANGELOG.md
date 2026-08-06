# Changelog

## v0.2.0 - 2026-08-06

SeanLab Studio v0.2.0 is the first release in which the complete creator workflow can run reliably from source understanding to final video review.

### Highlights

- The Production Agent now continues through production, internal QA, bounded recovery, and rendering without repeatedly returning recoverable technical failures to the creator.
- Narration remains the creator's primary editable gate; the downstream Production Agent owns detailed visual timing, component selection, material placement, and self-review after the production direction is confirmed.
- Visual coverage can be completed autonomously with specialized components first and the general editorial-statement component where no stronger semantic structure applies.
- Uploaded screenshots and screen recordings remain explicit production obligations after material understanding and creator confirmation.
- The component library now contains 20 approved information components, including the Tiffany-blue editorial-statement component, plus 10 data-visualization recipes and one hand-drawn animation language.
- Studio status and recovery surfaces distinguish active production, internal recovery, creator decisions, and final review more clearly.
- README component galleries and the twentieth-component preview are restored and aligned with the Studio visual library.

### Reliability

- Non-blocking narration polish and deterministic candidate recovery reduce avoidable workflow stalls.
- Production readiness, visual planning, static review, delivery validation, and resumable checkpoints remain fail-closed where user intent or artifact integrity cannot be inferred safely.
- The fixed Agent/model governance and `fallback: none` policy remain unchanged.

### Current scope

- Local-first developer preview for Apple Silicon Macs.
- Command-line installation is still required.
- Real creator projects stay local under `projects/` and are excluded from Git.
- The release does not automatically invoke an image-generation service.

## v0.1.0 - 2026-08-05

- Initial open-source release of the local SeanLab Studio workflow, component library, review contracts, and Remotion rendering foundation.
