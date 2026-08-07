# Third-party notices

SeanLab Studio source code and project-authored media are released under the repository's MIT License unless this
document identifies a different license. Third-party works are not relicensed under MIT.

## Remotion

SeanLab Studio depends on Remotion 4.0.490, including `remotion`, `@remotion/cli`, and
`@remotion/media-parser`. These packages use the separate Remotion License, not MIT. Eligibility and commercial-use
requirements are determined by Remotion's terms. A copy of the license shipped with the pinned dependency is stored
at `LICENSES/Remotion-License.md`; the current upstream terms are available at <https://www.remotion.dev/license>.

SeanLab Studio's MIT License does not grant or replace any permission required by the Remotion License.

## LXGW WenKai GB

`public/fonts/production/LXGWWenKaiGB-Medium-v1.522.ttf` is distributed unchanged under the SIL Open Font License
1.1. Its upstream version, checksum, and provenance are documented in `public/fonts/production/README.md`; the
license text is stored beside the font as `public/fonts/production/OFL-1.1.txt`.

## Historical Apache-2.0 agent icons

Earlier SeanLab Studio revisions included these files copied from the Apache-2.0 licensed
[`nexu-io/html-video`](https://github.com/nexu-io/html-video) repository:

- `packages/project-studio/public/agent-icons/codex.svg`
- `packages/project-studio/public/agent-icons/claude.svg`

The audited upstream revision was `c414ecc07f795add03807d5d9ce4baefd807cea2`. The current files at
`studio/assets/agent-icons/` are new neutral SeanLab-authored badges and no longer contain those third-party paths.
The historical files remain governed by Apache-2.0; a complete copy is stored at `LICENSES/Apache-2.0.txt`.

Apache-2.0 does not grant trademark rights. Product names are used only for compatibility identification and do not
imply sponsorship or endorsement.

## Current OpenAI and Anthropic marks

The current Agent selector uses two unmodified assets obtained from official vendor packages:

- `studio/assets/agent-icons/codex.svg` — the black OpenAI Blossom from
  <https://cdn.openai.com/brand/openai-logos.zip>;
- `studio/assets/agent-icons/claude.svg` — `ClaudeIcon-Rounded.svg` from
  <https://www.anthropic.com/press-kit>.

These marks are excluded from the repository's MIT License. They identify compatibility with Codex CLI and Claude
Code only and do not imply sponsorship, partnership, certification, or endorsement. Redistribution and use remain
subject to the owners' current brand and trademark terms. Exact retrieval dates and checksums are recorded in
`studio/assets/agent-icons/NOTICE.md`.

## Simple Icons brand paths

The pinned `simple-icons` 16.28.0 dependency supplies vector geometry for an explicitly admitted subset of
company and platform icons. Simple Icons is released under CC0-1.0, but its license does not grant trademark rights
in the represented brands. These icons identify products or platforms only and do not imply sponsorship,
certification, or endorsement. A registered brand without an admitted upstream path uses a local text badge instead.

## Project-authored media

The following media groups were created for SeanLab Studio and are released under MIT with the source code:

- the SeanLab logo files;
- system and Studio interface icons, excluding the official Agent marks listed above;
- component review renders and README screenshots;
- animation-template previews;
- generated sound assets and registries;
- project-authored SVG cards, interface mockups, placeholders, and regression renders.

See `docs/ASSET-LICENSES.md` for the file-level inventory and provenance rules.

## User media

Portraits, recordings, screenshots, logos, and other media imported by a user remain the user's responsibility.
SeanLab Studio stores them in ignored local project directories and does not grant a license to them.

## Names and trademarks

SeanLab Studio does not bundle the private creator portrait library. The explicitly admitted Simple Icons paths and
the two documented Agent compatibility marks above are the only bundled third-party brand artwork; other brand
metadata falls back to local text badges. OpenAI, Codex, Anthropic, Claude, Remotion, and all other
third-party names and trademarks remain the property of their respective owners. Their mention describes
compatibility or source provenance only.
