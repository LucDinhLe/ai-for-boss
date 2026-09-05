import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";

import {
  EMBEDDING_ENV,
  EX_CONFIG,
  GatewaySupervisor,
  SUPERVISOR_STATES,
  createGatewayToken,
  reserveLoopbackPort,
  resolveNodeExecutable
} from "../../apps/desktop/electron/supervisor.mjs";

class FakeChild extends EventEmitter {
  constructor() {
    super();
    this.stdout = new EventEmitter();
    this.stderr = new EventEmitter();
    this.signals = [];
  }

  kill(signal) {
    this.signals.push(signal);
    if (signal === "SIGTERM") queueMicrotask(() => this.emit("exit", 0, signal));
  }
}

function createSupervisor(overrides = {}) {
  const spawned = [];
  const supervisor = new GatewaySupervisor({
    stateDirectory: "/tmp/aifb-test-state",
    nodeExecutable: "/usr/bin/node",
    openclawEntry: "/opt/openclaw/openclaw.mjs",
    logger: { info: () => {}, warn: () => {}, error: () => {} },
    spawnChild: (command, args, options) => {
      const child = new FakeChild();
      spawned.push({ command, args, options, child });
      return child;
    },
    runDoctor: () => true,
    restartDelaysMs: [5],
    ...overrides
  });
  return { supervisor, spawned };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

test("a fresh token is minted per call and is not guessable", () => {
  const first = createGatewayToken();
  const second = createGatewayToken();
  assert.notEqual(first, second);
  assert.ok(first.length >= 40);
});

test("the reserved port is a real free loopback port", async () => {
  const port = await reserveLoopbackPort();
  assert.ok(port > 1024 && port < 65_536);
});

test("start binds loopback with token auth and the embedding preset", async () => {
  const { supervisor, spawned } = createSupervisor();
  const { port, token } = await supervisor.start();

  assert.equal(spawned.length, 1);
  const { command, args, options } = spawned[0];
  assert.equal(command, "/usr/bin/node");
  assert.equal(args[0], "/opt/openclaw/openclaw.mjs");
  assert.equal(args[1], "gateway");
  assert.ok(args.includes("--allow-unconfigured"));
  assert.equal(args[args.indexOf("--bind") + 1], "loopback");
  assert.equal(args[args.indexOf("--auth") + 1], "token");
  assert.equal(args[args.indexOf("--token") + 1], token);
  assert.equal(args[args.indexOf("--port") + 1], String(port));

  for (const [key, value] of Object.entries(EMBEDDING_ENV)) {
    assert.equal(options.env[key], value);
  }
  assert.equal(options.env.OPENCLAW_STATE_DIR, "/tmp/aifb-test-state");
  assert.equal(supervisor.state, SUPERVISOR_STATES.STARTING);
  assert.equal(supervisor.url, `ws://127.0.0.1:${port}`);

  await supervisor.stop();
});

test("an unexpected exit restarts the child, and repeated crashes stop in safe mode", async () => {
  const { supervisor, spawned } = createSupervisor();
  await supervisor.start();

  for (let attempt = 0; attempt < 4; attempt += 1) {
    spawned.at(-1).child.emit("exit", 1, null);
    await new Promise((resolve) => setTimeout(resolve, 40));
  }

  assert.equal(supervisor.state, SUPERVISOR_STATES.SAFE_MODE);
  assert.ok(spawned.length > 1, "supervisor restarted at least once before giving up");
  assert.equal(supervisor.lastExit.code, 1);
});

test("a config-class exit runs doctor once and then fails closed", async () => {
  let doctorCalls = 0;
  const { supervisor, spawned } = createSupervisor({
    runDoctor: () => {
      doctorCalls += 1;
      return true;
    }
  });
  await supervisor.start();

  spawned.at(-1).child.emit("exit", EX_CONFIG, null);
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal(doctorCalls, 1);
  assert.equal(spawned.length, 2, "supervisor retried once after a successful repair");

  spawned.at(-1).child.emit("exit", EX_CONFIG, null);
  await settle();
  assert.equal(doctorCalls, 1, "the repair loop does not run twice");
  assert.equal(supervisor.state, SUPERVISOR_STATES.SAFE_MODE);
});

test("a failed repair fails closed without restarting", async () => {
  const { supervisor, spawned } = createSupervisor({ runDoctor: () => false });
  await supervisor.start();
  spawned.at(-1).child.emit("exit", EX_CONFIG, null);
  await settle();
  assert.equal(supervisor.state, SUPERVISOR_STATES.SAFE_MODE);
  assert.equal(spawned.length, 1);
});

test("stop terminates the child and does not restart it", async () => {
  const { supervisor, spawned } = createSupervisor();
  await supervisor.start();
  await supervisor.stop();
  assert.deepEqual(spawned[0].child.signals, ["SIGTERM"]);
  await settle();
  assert.equal(spawned.length, 1);
  assert.equal(supervisor.state, SUPERVISOR_STATES.IDLE);
});

test("start fails closed when no Node runtime is available", async () => {
  const { supervisor } = createSupervisor({ nodeExecutable: null });
  await assert.rejects(() => supervisor.start(), /Node runtime/);
  assert.equal(supervisor.state, SUPERVISOR_STATES.SAFE_MODE);
});

test("an explicit runtime path is only used when it exists", () => {
  assert.equal(
    resolveNodeExecutable({ env: { AIFB_NODE_PATH: "/definitely/not/here/node" }, platform: "linux" }),
    resolveNodeExecutable({ env: {}, platform: "linux" })
  );
});

test("state transitions are reported to the host once per change", async () => {
  const seen = [];
  const { supervisor } = createSupervisor({ onStateChange: ({ state }) => seen.push(state) });
  await supervisor.start();
  supervisor.markReady();
  supervisor.markReady();
  await supervisor.stop();
  assert.deepEqual(seen, [SUPERVISOR_STATES.STARTING, SUPERVISOR_STATES.READY, SUPERVISOR_STATES.IDLE]);
});
