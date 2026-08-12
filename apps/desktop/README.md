# AI for Boss desktop shell

Feature 0.4 contains the first executable Electron/React shell.

- `electron/main.mjs` owns the window and deny-by-default desktop boundary.
- `electron/preload.cjs` exposes exactly one read-only method.
- `src/` contains the Editorial Calm renderer.
- `generated/shell-contract.json` is build output derived from locked manifests.

The shell is `experimental-internal`. It does not start OpenClaw, connect a
provider, store credentials or execute tools.

Run from the repository root:

```text
pnpm build
pnpm dev
pnpm package:desktop
```
