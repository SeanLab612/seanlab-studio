# SeanLab Studio

SeanLab Studio is a local, review-gated workflow for turning a talking-head recording into a Remotion video with captions, evidence-bound visual planning, reusable components, animation, static review, and final delivery.

![SeanLab Studio local workflow](docs/assets/studio-workflow.png)

The open-source edition is intentionally creator-neutral:

- it does not insert a fixed channel greeting, transition phrase, logo bumper, or signature sound;
- it does not ship a creator's portrait, cover pose library, project footage, or production history;
- cover production starts with a photo selected by the local user and keeps that photo inside the ignored project directory;
- brand identity is optional and disabled by default;
- Codex CLI and Claude Code adapters are optional local integrations, with no silent provider fallback.

## Status

This repository is an early developer preview for Apple silicon macOS. It is not yet a packaged desktop application. The workflow is designed around local files, FFmpeg, Remotion, and explicit human review gates.

## What is included

- six-step local Studio: create, write, shoot, produce, review, deliver;
- structured narration and source-grounding contracts;
- conservative talking-head recut and verbatim caption workflow;
- semantic visual planning with deterministic component materialization;
- animation templates with local icon and user-supplied image ingredients;
- resumable execution, evidence hashes, static review, and delivery validation;
- a local cover workspace that uses the creator's own photo.

## Studio and visual library

The browser-based Studio keeps project stages, the fixed local Agent, review gates, and reusable visual resources in one workspace. The screenshots below were captured from a clean local instance with no private creator project loaded.

![SeanLab Studio visual resource library](docs/assets/studio-resource-library.png)

### 19 production components

These are real frames rendered from the approved Remotion component compositions on a neutral blank source. They are not schematic Studio thumbnails. Production layouts reserve the right side for the speaker and hard-darken the information stage on the left for legibility.

![Production component renders, group 1](docs/assets/components-group-01.jpg)

![Production component renders, group 2](docs/assets/components-group-02.jpg)

![Production component renders, group 3](docs/assets/components-group-03.jpg)

![Production component renders, group 4](docs/assets/components-group-04.jpg)

![Production component renders, group 5](docs/assets/components-group-05.jpg)

### Data visualization recipes

Ten controlled chart recipes cover comparison, time series, dot plots, ratios, waterfall changes, scatter plots, intervals, funnels, before/after comparisons, and risk-return positioning.

![Data visualization recipe renders, group 1](docs/assets/data-effects-group-01.jpg)

![Data visualization recipe renders, group 2](docs/assets/data-effects-group-02.jpg)

![Data visualization recipe renders, group 3](docs/assets/data-effects-group-03.jpg)

### Animation templates

The repository includes three semantic animation directions. They use local icons and user-approved project images; the existence of an image-generation interface does not trigger image generation.

![Paper editorial, research archive, and stop-motion animation templates](docs/assets/animation-templates-overview.jpg)

- [Paper editorial preview](public/assets/animation-templates/paper-editorial-preview-v1.mp4)
- [Research archive preview](public/assets/animation-templates/research-archive-preview-v1.mp4)
- [Stop-motion machine preview](public/assets/animation-templates/stop-motion-machine-preview-v1.mp4)

## What is not included

- private projects, recordings, screenshots, transcripts, renders, logs, or backups;
- SeanLab channel intro/bumper assets and fixed narration anchors;
- preloaded creator portraits or a bundled celebrity/person image library;
- third-party brand artwork; named brands render as local text badges unless the user supplies an authorized asset;
- any hosted AI, storage, publishing, or image-generation service.

## Requirements

- Apple silicon macOS
- Node.js 22 or newer
- FFmpeg and ffprobe with H.264/AAC support
- Python 3
- optional: an authenticated Codex CLI or Claude Code installation

## Quick start

```bash
git clone https://github.com/SeanLab612/seanlab-studio.git
cd seanlab-studio
npm ci
npm run setup:python
cp .env.example .env.local
npm run doctor -- --agent codex-cli
npm run studio:start
```

Open <http://localhost:3080>. Stop the service with `npm run studio:stop`.

Real creator data is written to `projects/` and is ignored by Git. Never put a real recording or credential into an example, fixture, issue, or pull request.

## Personalized features

The public edition treats identity as project configuration rather than product behavior:

- write any natural opening you want; there is no required greeting;
- no transition sentence is reserved for a bumper;
- no bumper is inserted into the timeline;
- upload your own cover portrait and adjust crop position/zoom locally;
- import project-specific images instead of relying on a bundled people library;
- add terminology and branding only when the project actually needs them.

## Development

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test:unit
npm run test:workflow-core
npm run docs:assets
```

See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) before contributing.

## License

Source code is available under the [MIT License](LICENSE). Fonts and other redistributable assets keep their own notices. User-provided media is never relicensed by this repository.
