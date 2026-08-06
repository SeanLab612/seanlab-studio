<p align="center">
  <img src="studio/assets/seanlab-logo.png" width="112" alt="SeanLab Studio" />
</p>

<h1 align="center">SeanLab Studio</h1>

<p align="center">
  A local-first, agentic production studio for knowledge-driven talking-head videos.<br />
  Script, recut, caption, visually package, self-review, repair, and render in one resumable workflow.
</p>

<p align="center">
  <a href="README.zh-CN.md">简体中文</a> · <strong>English</strong>
</p>

<p align="center">
  <a href="https://github.com/SeanLab612/seanlab-studio/actions/workflows/ci.yml"><img src="https://github.com/SeanLab612/seanlab-studio/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green.svg" alt="MIT License" /></a>
  <img src="https://img.shields.io/badge/platform-Apple%20Silicon%20Mac-black" alt="Apple Silicon Mac" />
  <img src="https://img.shields.io/badge/Node.js-%3E%3D22-43853d" alt="Node.js 22 or newer" />
</p>

![SeanLab Studio workflow](docs/assets/studio-workflow.png)

## What it is

SeanLab Studio is not a generic timeline editor or a one-click text-to-video generator. It is a review-led production workflow where a local coding agent understands source material and narration, edits real footage, plans visual coverage, checks its own work, repairs recoverable failures, and prepares a final Remotion render for the creator to approve.

The creator starts the production, reviews the script, and reviews the finished video. Routine production QA stays inside the agent loop instead of repeatedly stopping the workflow and handing technical errors back to the user.

## From footage to finished video

1. **Create** — choose a topic, import research, and bind one local agent to the project.
2. **Write** — the agent studies the sources and uploaded media, recommends what to keep, merge, trim, or exclude, then drafts a natural narration; the creator edits and locks only the words.
3. **Shoot** — import locally recorded talking-head footage and project assets.
4. **Plan** — after the script is locked, the production agent receives the latest script, all material understanding, every uploaded asset, and the confirmed keep/exclude decisions. It presents one read-only production direction for confirmation.
5. **Produce** — after confirmation, the same logical production agent handles conservative recutting, captions, visual planning, required-media placement, component selection, and hand-drawn animation.
6. **Self-review** — the agent checks the cut, keyframes, visual QA evidence, and delivery contract, then repairs recoverable problems and continues without exposing internal QA gates.
7. **Choose and render** — after Agent self-review passes, the creator chooses 720p preview, 1080p, 2K, 4K, or source resolution, then explicitly starts and reviews the final render.

Project state, assets, evidence, and approvals remain resumable. Completed stages do not need to be repeated after an interruption.

## Why it is different

- **Agent-directed production** — the agent interprets the material and narration instead of merely filling a fixed template.
- **Downstream visual authority** — writing produces words and semantic material bindings, not an editable storyboard. The production agent owns timing, layout, crop, components, and animation. Uploaded images and recordings default to required; the creator may accept or override the agent's keep/exclude recommendation before drafting.
- **Self-healing workflow** — recoverable semantic, planning, asset, and QA failures are repaired within bounded loops before the creator is asked to intervene.
- **Human approval where it matters** — the creator edits narration, confirms the read-only production direction, and reviews final delivery. Internal production QA stays inside the agent loop.
- **Local-first media handling** — footage, screenshots, captions, project state, and renders stay on the local machine.
- **Reusable visual system** — built-in editorial components, charts, icons, cover backgrounds, and one coherent hand-drawn animation language.

## Quick start

The current preview targets Apple Silicon Macs and requires:

- Node.js 22 or newer
- FFmpeg and ffprobe with H.264/AAC support
- Python 3
- an authenticated Codex CLI or Claude Code installation

```bash
git clone https://github.com/SeanLab612/seanlab-studio.git
cd seanlab-studio
npm ci
npm run setup:python
cp .env.example .env.local
npm run doctor -- --agent codex-cli
npm run studio:start
```

Open <http://localhost:3080>. To stop the persistent Studio service:

```bash
npm run studio:stop
```

For Claude Code, replace `codex-cli` with `claude-code` in the doctor command.

## Visual production library

The Studio includes 20 information components for evidence, key numbers, timelines, processes, causal relationships, comparisons, decisions, quotations, and unstructured plain-language claims. The editorial-statement bridge has no whole-video share cap when the Production Agent finds it semantically suitable, but it is limited to two consecutive uses and never outranks stronger materials or specialized components.

![SeanLab Studio visual resource library](docs/assets/studio-resource-library.png)

It also includes 10 chart patterns for comparisons, time series, proportions, waterfalls, scatter plots, ranges, funnels, before-and-after views, and risk/reward framing.

Animation uses a single hand-drawn editorial language. The production agent selects the information structure and may combine local icons with project-bound images.

![Hand-drawn editorial animation system](docs/assets/animation-templates-overview.jpg)

- [Watch the hand-drawn animation preview](public/assets/animation-templates/paper-editorial-preview-v1.mp4)

## Local data and privacy

- Real creator projects live under `projects/`, which is excluded from Git by default.
- Each project stays bound to one selected agent; the workflow does not silently switch providers.
- Three neutral cover backgrounds are included. Users provide their own transparent portrait cutout as PNG or WebP.
- The project does not automatically call an image-generation service.
- Never attach recordings, credentials, or private project files to examples, issues, or pull requests.

## Current status

SeanLab Studio is a developer preview, not yet a packaged desktop application. The end-to-end workflow, approval boundaries, recovery path, and rendering pipeline are operational, but installation still requires the command line and the current release is limited to Apple Silicon Macs.

## Development

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test:unit
npm run test:workflow-core
npm run docs:assets
```

Before contributing, read [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## License

Original SeanLab Studio source code, interface code, functional icons, and generated demo assets are available under the [MIT License](LICENSE).

Third-party material is not relicensed as MIT. Remotion has its own license and may require a company license for some organizational or commercial uses. Fonts, NASA test imagery, and compatibility logos retain their respective terms. Product names indicate compatibility only and do not imply endorsement by OpenAI, Anthropic, NASA, or Remotion.

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md), [asset licenses](docs/ASSET-LICENSES.md), and [dependency licenses](docs/DEPENDENCY-LICENSES.md) for the complete boundaries.
