import assert from "node:assert/strict";
import test from "node:test";
import { waitForSmokeRendererReady } from "../../apps/desktop/electron/startup-smoke.mjs";

test("smoke waits for the renderer to commit the connected runtime status", async () => {
  let reads = 0;
  assert.equal(await waitForSmokeRendererReady({ runtimeReady: () => true,
    readReady: async () => ++reads >= 3, pollMs: 1, timeoutMs: 1_000 }), true);
  assert.equal(reads, 3);
});

test("a stale or unresponsive renderer cannot pass the bounded smoke wait", async () => {
  for (const readReady of [async () => false, () => new Promise(() => {})]) {
    assert.equal(await waitForSmokeRendererReady({ runtimeReady: () => true,
      readReady, pollMs: 1, timeoutMs: 10 }), false);
  }
});

test("renderer readiness cannot hide a connection lost during its query", async () => {
  let connected = true;
  assert.equal(await waitForSmokeRendererReady({ runtimeReady: () => connected,
    readReady: async () => { connected = false; return true; }, pollMs: 1 }), false);
});

test("smoke rejects unavailable runtime or renderer without claiming readiness", async () => {
  let reads = 0;
  assert.equal(await waitForSmokeRendererReady({ runtimeReady: () => false,
    readReady: async () => { reads++; return true; } }), false);
  assert.equal(reads, 0);
  assert.equal(await waitForSmokeRendererReady({ runtimeReady: () => true,
    readReady: async () => { throw new Error("renderer gone"); } }), false);
});
