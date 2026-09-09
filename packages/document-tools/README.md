# AI for Boss document tools

Product-owned OpenClaw tool plugin, packaged separately from the immutable engine.
Install dependencies reproducibly with `npm ci --ignore-scripts` in this directory.
The tool accepts structured text/tables/slides and creates new files under the active
session workspace. It does not accept commands, filenames, URLs or executable code.
Sandbox sessions are not supported. Read-only sessions fail closed.

Noto Sans is distributed under the included SIL Open Font License (fonts/OFL.txt).
Font source: https://raw.githubusercontent.com/google/fonts/main/ofl/notosans/NotoSans%5Bwdth,wght%5D.ttf
SHA-256: bfb7bb691513f12e734dc346c03a03f784912432d7e3fa8e56efcf906fe86b3d

Pinned public integration contracts: OpenClaw 2026.9.1 plugin registration and
`api.runtime.agent.session.getSessionEntry` (docs/plugins/sdk-runtime.md).
Custom plugins cannot use `api.runtime.gateway.request`; no trusted-plugin identity
or engine patch is used to bypass this restriction.
