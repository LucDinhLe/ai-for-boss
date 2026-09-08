# AI for Boss desktop shell

Windows preview: Electron main process, a restricted preload bridge, and a React renderer. See the repository README for current capabilities and limitations.

- `electron/main.mjs` owns the window and deny-by-default desktop boundary.
- `electron/preload.cjs` exposes a restricted IPC bridge.
- `src/` contains the Editorial Calm renderer.
- `generated/shell-contract.json` is build output derived from locked manifests.

The main process supervises the separately packaged OpenClaw runtime and owns provider setup, command approval prompts and signed component updates. Historical manifests describe their original release train; the running application version comes from its package metadata.

Run from the repository root:

```text
pnpm build
pnpm dev
pnpm package:desktop
```
