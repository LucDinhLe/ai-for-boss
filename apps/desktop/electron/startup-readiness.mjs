// An owned Gateway may take minutes to scan its bundled plugins on a cold
// Windows start. Readiness is an authenticated handshake, never an open port.
export const STARTUP_TIMEOUT_MS = 240_000;
export const STARTUP_SLOW_MS = 15_000;

export async function waitForGatewayReady({ adapter, supervisor, onSlow = () => {},
  shouldStop = () => false, timeoutMs = STARTUP_TIMEOUT_MS, now = Date.now,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) }) {
  const started = now();
  let slowReported = false;
  while (true) {
    if (shouldStop()) return "stopped";
    if (supervisor.state === "safe-mode" || supervisor.state === "idle") return "failed";
    if (adapter.connected) return "ready";
    const elapsed = now() - started;
    if (elapsed >= timeoutMs) return "timed-out";
    if (!slowReported && elapsed >= STARTUP_SLOW_MS) { slowReported = true; onSlow(); }
    await sleep(Math.min(1_000, timeoutMs - elapsed));
  }
}

export function isExpectedStartupConnectionError(message) {
  return typeof message === "string" && /\bECONNREFUSED\b/u.test(message);
}

// Coalesce setup completion notifications and never restart after quit begins.
export function createGatewayRestart({ disconnect, stop, start, connect,
  shouldStop = () => false, onRestart = () => {} }) {
  let pending = null;
  const restart = async () => {
    onRestart();
    await disconnect();
    if (shouldStop()) return false;
    await stop();
    if (shouldStop()) return false;
    const endpoint = await start();
    if (shouldStop()) { await stop(); return false; }
    return connect(endpoint);
  };
  return () => {
    if (pending) return pending;
    if (shouldStop()) return Promise.resolve(false);
    pending = restart().catch((error) => {
      if (shouldStop()) return false;
      throw error;
    }).finally(() => { pending = null; });
    return pending;
  };
}

// A retry creates no new owner or arbitrary command. It can only re-enter the
// already-owned restart lifecycle after startup has failed. Concurrent clicks
// share that attempt; the user must click again after a failed attempt settles.
export function createStartupRetry({ restart, getRuntimeStatus, hasSupervisor,
  shouldStop = () => false, isSmoke = () => false, onFailure = () => {} }) {
  let pending = null;
  const blocked = () => shouldStop() || isSmoke() || !hasSupervisor();
  const eligible = () => {
    const status = getRuntimeStatus();
    return status.supervisor === "safe-mode" && status.connected === false && status.setupReady === false;
  };
  return (...args) => {
    if (args.length !== 0 || blocked()) return Promise.reject(new Error("STARTUP_RETRY_UNAVAILABLE"));
    if (pending) return pending;
    if (!eligible()) return Promise.reject(new Error("STARTUP_RETRY_UNAVAILABLE"));
    pending = Promise.resolve().then(async () => {
      if (blocked() || !eligible()) return false;
      try { return await restart() === true; }
      catch {
        if (!shouldStop()) onFailure();
        return false;
      }
    }).finally(() => { pending = null; });
    return pending;
  };
}
