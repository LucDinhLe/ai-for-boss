# Third-party notices — baseline

AI for Boss is an independent product built on OpenClaw. This baseline covers only the direct release-train candidates selected during Feature 0.2; it is not yet a shipping notice.

## OpenClaw 2026.7.1-2

- Source: <https://github.com/openclaw/openclaw>
- License: MIT
- Required action before distribution: include the upstream copyright and MIT license text from the exact bundled artifact.
- Trademark: use of the software license does not imply endorsement by OpenClaw or grant trademark rights.

## Node.js 24.19.0

- Source: <https://github.com/nodejs/node>
- License: MIT, with third-party license notices shipped by Node.js.
- Required action before distribution: preserve Node.js `LICENSE` and bundled third-party notices.

## Electron 43.3.0

- Source: <https://github.com/electron/electron>
- License: MIT; distributed binaries also include Chromium and other third-party notices.
- Required action before distribution: preserve Electron and bundled Chromium/third-party notices from each platform artifact.

## pnpm 11.2.2

- Source: <https://github.com/pnpm/pnpm>
- License: MIT
- Required action before distribution: preserve the copyright and MIT license text.

## Release limitation

At tag `v2026.7.1-2`, `@openclaw/gateway-client` and
`@openclaw/gateway-protocol` are private workspace packages under the OpenClaw
MIT repository. They are not separately bundled dependencies. Their source
tree fingerprints are retained only to lock the documented Gateway contract;
AI for Boss uses the public external-app WebSocket RPC surface and preserves
OpenClaw attribution.
