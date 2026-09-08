import { Socket } from "node:net";
import { STARTUP_SLOW_MS, STARTUP_TIMEOUT_MS } from "./startup-readiness.mjs";

const PROBE_TIMEOUT_MS = 500;
const PROBE_INTERVAL_MS = 1_000;
const activeStates = new Set(["starting", "ready", "restarting"]);
const validPort = (port) => Number.isInteger(port) && port >= 1 && port <= 65_535;

// This sends no bytes and proves only that a TCP listener exists. Authentication
// and application readiness remain the responsibility of the two SDK channels.
export function probeGatewayListener({ port, timeoutMs = PROBE_TIMEOUT_MS,
  createSocket = () => new Socket() }) {
  if (!validPort(port) || !Number.isFinite(timeoutMs) || timeoutMs <= 0) return Promise.resolve(false);
  return new Promise((resolve) => {
    let socket;
    let timer;
    let settled = false;
    const finish = (listening) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket?.destroy();
      resolve(listening);
    };
    try {
      socket = createSocket();
      socket.once("connect", () => finish(true));
      socket.on("error", () => finish(false));
      socket.once("close", () => finish(false));
      timer = setTimeout(() => finish(false), Math.min(PROBE_TIMEOUT_MS, timeoutMs));
      socket.connect({ host: "127.0.0.1", port });
    } catch {
      finish(false);
    }
  });
}

// A single initial gate avoids starting both SDK backoff schedules while the
// owned process is still loading. It neither starts nor restarts an SDK client.
export async function waitForGatewayListener({ port, supervisor, shouldStop = () => false,
  timeoutMs = STARTUP_TIMEOUT_MS, onSlow = () => {}, now = Date.now,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), probe = probeGatewayListener }) {
  if (!validPort(port) || !Number.isFinite(timeoutMs) || timeoutMs < 0) return "failed";
  const started = now();
  const budget = Math.min(timeoutMs, STARTUP_TIMEOUT_MS);
  let slowReported = false;
  const outcome = () => {
    if (shouldStop()) return "stopped";
    if (supervisor?.port !== port || !activeStates.has(supervisor?.state)) return "failed";
    if (now() - started >= budget) return "timed-out";
    return null;
  };
  while (true) {
    const before = outcome();
    if (before) return before;
    const elapsed = now() - started;
    if (!slowReported && elapsed >= STARTUP_SLOW_MS) { slowReported = true; onSlow(); }
    const attempted = now();
    let listening;
    try {
      listening = await probe({ port, timeoutMs: Math.min(PROBE_TIMEOUT_MS, budget - elapsed) });
    } catch {
      return outcome() ?? "failed";
    }
    const after = outcome();
    if (after) return after;
    if (listening === true) return "ready";
    await sleep(Math.min(Math.max(0, PROBE_INTERVAL_MS - (now() - attempted)), budget - (now() - started)));
  }
}
