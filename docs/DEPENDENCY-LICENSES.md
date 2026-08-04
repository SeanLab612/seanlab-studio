# Dependency licenses

The root MIT License covers SeanLab Studio's own source code. Dependencies retain their own licenses and are
installed from the pinned npm lockfile rather than copied into this repository.

## Runtime dependencies

| Package | Pinned version | License |
| --- | --- | --- |
| `remotion` | 4.0.490 | Remotion License |
| `@remotion/cli` | 4.0.490 | Remotion License |
| `@remotion/media-parser` | 4.0.490 | Remotion License |
| `@remotion/rough-notation` | 4.0.490 | MIT |
| `react` | 19.1.0 | MIT |
| `react-dom` | 19.1.0 | MIT |
| `simple-icons` | 16.28.0 | CC0-1.0 |

The Remotion License is a source-available dependency license with eligibility and commercial-use conditions. It is
not replaced by SeanLab Studio's MIT License. See `LICENSES/Remotion-License.md` and
<https://www.remotion.dev/license> before commercial deployment.

`simple-icons` supplies the vector geometry for the explicitly admitted company/platform icons. Its CC0 license
applies to the package project, but it does not grant trademark rights in the represented brands. Brand names and
marks remain subject to their owners' policies and are used only to identify the product or platform.

## Development dependencies

| Package | Pinned version | License |
| --- | --- | --- |
| `@biomejs/biome` | 2.5.3 | MIT OR Apache-2.0 |
| `@types/node` | 22.15.29 | MIT |
| `@types/react` | 19.1.6 | MIT |
| `@types/react-dom` | 19.1.5 | MIT |
| `ajv` | 8.20.0 | MIT |
| `typescript` | 5.8.3 | Apache-2.0 |

Transitive dependency versions and SPDX identifiers are recorded in `package-lock.json`. Packaged applications or
binary distributions must regenerate a complete third-party license report for the exact dependency tree included
in that release; this source repository does not distribute `node_modules/`.
