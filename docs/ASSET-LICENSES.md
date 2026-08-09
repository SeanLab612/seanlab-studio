# Asset licenses and provenance

This inventory separates SeanLab-authored assets from third-party works. New binary or visual assets must be added
here before a release.

| Files | Origin | License / terms | Redistribution note |
| --- | --- | --- | --- |
| `studio/assets/seanlab-logo.png`, `studio/assets/seanlab-logo-white.svg` | SeanLab-authored identity | MIT | May be used, modified, and redistributed under the root MIT License. |
| `public/icons/system/sprite.svg` | SeanLab-authored functional icon set | MIT | No third-party brand artwork is embedded. |
| Runtime brand paths from `simple-icons` 16.28.0 | Simple Icons contributors | CC0-1.0 package; third-party trademarks remain reserved | Only explicitly admitted paths are rendered; unavailable marks use local text badges. |
| `studio/assets/icons/*.svg` | SeanLab-authored Studio controls | MIT | The settings icon was redrawn as a sliders control in 2026-08. |
| `studio/assets/agent-icons/codex.svg` | Official OpenAI logo package: unmodified black Blossom | OpenAI brand usage terms | Identifies Codex CLI compatibility only; excluded from MIT; no endorsement. |
| `studio/assets/agent-icons/claude.svg` | Official Anthropic press kit: unmodified `ClaudeIcon-Rounded.svg` | Anthropic trademark/media terms | Identifies Claude Code compatibility only; excluded from MIT; no endorsement. |
| `public/review-assets/*.svg` | SeanLab-authored mock interfaces and placeholders | MIT | Mock interfaces do not reproduce vendor logos. |
| `docs/assets/*` | Screenshots and renders of SeanLab Studio | MIT | Generated from this repository; imported user projects are excluded. |
| `public/assets/animation-templates/*.mp4` | SeanLab-authored template renders | MIT | Rendered from repository animation source. |
| `public/assets/covers/backgrounds/*.png` | SeanLab-generated background-only cover templates | MIT | No people, logos, or text; exact hashes are frozen in `public/assets/covers/registry.json`. |
| `regression-fixtures/golden/**` | SeanLab-authored component renders | MIT | Generated from repository components and local fixtures. |
| `regression-fixtures/topics/assets/deepswe-score-card.svg` | SeanLab-authored factual test card | MIT | Source facts are attributed in `src/regression-fixtures/topic-fixtures.ts`. |
| `regression-fixtures/topics/assets/kimi-k3-fact-card.svg` | SeanLab-authored factual test card | MIT | Source facts are attributed in `src/regression-fixtures/topic-fixtures.ts`. |
| `public/fonts/production/LXGWWenKaiGB-Medium-v1.522.ttf` | Official LXGW WenKai GB v1.522 release | SIL OFL 1.1 | Keep the font copyright, OFL text, upstream filename, and version evidence. |

Exact official download URLs, retrieval dates, and SHA-256 values for the current Agent marks are recorded in
`studio/assets/agent-icons/NOTICE.md`. Historical revisions contained different Apache-2.0 licensed paths from
`nexu-io/html-video`; that historical license and provenance remain documented in `THIRD_PARTY_NOTICES.md` and
`LICENSES/Apache-2.0.txt`.

## Admission rule

Do not commit a new visual, font, sound, video, or binary fixture unless all of these are known:

1. exact source or a statement that it is SeanLab-authored;
2. author or copyright holder when attribution is required;
3. license or usage terms;
4. whether modification and redistribution are allowed;
5. required credit and any trademark, likeness, or endorsement restriction;
6. a stable local path and checksum for third-party binary assets.

Unknown, scraped, or “found online” assets are not admissible. User-imported media belongs in ignored local project
directories and must never be promoted into the public repository without a separate rights review.

Tracked raster images and videos must also be registered with their exact SHA-256 value in
`config/public-media-assets.json`. `npm run privacy:check` fails when a media file is new, missing, or changed without
an explicit manifest update. The manifest uses the `no-real-people` policy: creator portraits, test-project captures,
and other private media must remain in ignored local project directories and cannot be admitted to the public list.
