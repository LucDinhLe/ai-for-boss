import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";
import path from 'node:path';

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
    reservePort: async () => 43123,
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
  assert.equal(options.env.OPENCLAW_CONFIG_PATH, path.join('/tmp/aifb-test-state', 'openclaw.json'));
  assert.equal(supervisor.state, SUPERVISOR_STATES.STARTING);
  assert.equal(supervisor.url, `ws://127.0.0.1:${port}`);

  await supervisor.stop();
});

test('full product overrides inherited spike skip flags so configured channels remain native', async () => {
  const previous = [process.env.OPENCLAW_SKIP_CHANNELS, process.env.OPENCLAW_SKIP_PROVIDERS];
  process.env.OPENCLAW_SKIP_CHANNELS = '1'; process.env.OPENCLAW_SKIP_PROVIDERS = '1';
  const { supervisor, spawned } = createSupervisor();
  try {
    await supervisor.start();
    assert.equal(spawned[0].options.env.OPENCLAW_SKIP_CHANNELS, '0');
    assert.equal(spawned[0].options.env.OPENCLAW_SKIP_PROVIDERS, '0');
  } finally {
    await supervisor.stop();
    for (const [index, key] of ['OPENCLAW_SKIP_CHANNELS', 'OPENCLAW_SKIP_PROVIDERS'].entries()) {
      if (previous[index] === undefined) delete process.env[key]; else process.env[key] = previous[index];
    }
  }
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

test("concurrent starts share one reservation and one child", async () => {
  let release;
  let reservations = 0;
  const { supervisor, spawned } = createSupervisor({ reservePort: () => {
    reservations++;
    return new Promise((resolve) => { release = resolve; });
  } });
  const first = supervisor.start();
  const second = supervisor.start();
  release(43124);
  assert.deepEqual(await first, await second);
  assert.equal(reservations, 1);
  assert.equal(spawned.length, 1);
  await supervisor.stop();
});

test("stop cancels a start still awaiting its port and ignores stale readiness", async () => {
  let release;
  const { supervisor, spawned } = createSupervisor({
    reservePort: () => new Promise((resolve) => { release = resolve; })
  });
  const started = supervisor.start();
  const cancelled = assert.rejects(started, /cancelled/);
  await supervisor.stop();
  release(43124);
  await cancelled;
  supervisor.markReady();
  assert.equal(spawned.length, 0);
  assert.equal(supervisor.state, SUPERVISOR_STATES.IDLE);
});

test("stop cancels a doctor repair waiting in restart backoff", async () => {
  const { supervisor, spawned } = createSupervisor({ restartDelaysMs: [30] });
  await supervisor.start();
  spawned[0].child.emit("exit", EX_CONFIG, null);
  assert.equal(supervisor.state, SUPERVISOR_STATES.RESTARTING);
  await supervisor.stop();
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(spawned.length, 1);
  assert.equal(supervisor.state, SUPERVISOR_STATES.IDLE);
});

test("an old retry cannot spawn beside a new start and an old child cannot clear it", async () => {
  const { supervisor, spawned } = createSupervisor({ restartDelaysMs: [30] });
  await supervisor.start();
  const oldChild = spawned[0].child;
  oldChild.emit("exit", 1, null);
  await supervisor.stop();
  await supervisor.start();
  oldChild.emit("exit", 1, null);
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(spawned.length, 2);
  supervisor.markReady();
  assert.equal(supervisor.state, SUPERVISOR_STATES.READY);
  await supervisor.stop();
});

test("stop awaits actual exit after force kill before a replacement starts", async () => {
  const { supervisor, spawned } = createSupervisor();
  await supervisor.start();
  const child = spawned[0].child;
  child.kill = (signal) => { child.signals.push(signal); };
  const stopped = supervisor.stop({ timeoutMs: 5, killTimeoutMs: 100 });
  const restarted = supervisor.start();
  await settle();
  assert.deepEqual(child.signals, ["SIGTERM", "SIGKILL"]);
  assert.equal(spawned.length, 1, "signalling is not confirmation of exit");
  child.emit("exit", null, "SIGKILL");
  await stopped;
  await restarted;
  assert.equal(spawned.length, 2);
  await supervisor.stop();
});

test("unconfirmed exit fails closed and does not permit another child", async () => {
  const { supervisor, spawned } = createSupervisor();
  await supervisor.start();
  const child = spawned[0].child;
  child.kill = (signal) => { child.signals.push(signal); };
  await assert.rejects(supervisor.stop({ timeoutMs: 5, killTimeoutMs: 5 }), /did not exit/);
  assert.equal(supervisor.state, SUPERVISOR_STATES.SAFE_MODE);
  await assert.rejects(supervisor.start(), /has not stopped/);
  assert.equal(spawned.length, 1);
  child.emit("exit", null, "SIGKILL");
});

test("stop observes a child that exits synchronously when signalled", async () => {
  const { supervisor, spawned } = createSupervisor();
  await supervisor.start();
  const child = spawned[0].child;
  child.kill = (signal) => { child.signals.push(signal); child.emit("exit", 0, signal); };
  await supervisor.stop({ timeoutMs: 5, killTimeoutMs: 5 });
  assert.deepEqual(child.signals, ["SIGTERM"]);
  assert.equal(supervisor.state, SUPERVISOR_STATES.IDLE);
});

test("a failed spawn without a process does not leave an owned phantom child", async () => {
  const { supervisor, spawned } = createSupervisor();
  await supervisor.start();
  spawned[0].child.emit("error", new Error("spawn ENOENT"));
  assert.equal(supervisor.state, SUPERVISOR_STATES.SAFE_MODE);
  await supervisor.stop();
  assert.deepEqual(spawned[0].child.signals, []);
  await supervisor.start();
  assert.equal(spawned.length, 2);
  await supervisor.stop();
});

test("owned exit reports crash, config failure and planned stop once, ignoring old children", async () => {
  const exits = [];
  const { supervisor, spawned } = createSupervisor({
    onOwnedChildExit: (event) => exits.push(event), runDoctor: () => false, restartDelaysMs: [100]
  });
  await supervisor.start();
  const oldChild = spawned[0].child;
  oldChild.emit("exit", 1, null);
  assert.equal(supervisor.state, SUPERVISOR_STATES.RESTARTING);
  assert.equal(exits.length, 1);
  assert.equal(exits[0].code, 1);
  assert.equal(exits[0].signal, null);
  assert.equal(typeof exits[0].at, "number");
  await supervisor.stop();
  assert.equal(exits.length, 1, "stopping without a child is not another exit");

  await supervisor.start();
  oldChild.emit("exit", 1, null);
  assert.equal(exits.length, 1, "an old child cannot retire a newer job");
  spawned[1].child.emit("exit", EX_CONFIG, null);
  assert.equal(supervisor.state, SUPERVISOR_STATES.SAFE_MODE);
  assert.equal(exits.length, 2);
  assert.equal(exits[1].code, EX_CONFIG);

  await supervisor.start();
  await supervisor.stop();
  assert.equal(supervisor.state, SUPERVISOR_STATES.IDLE);
  assert.equal(exits.length, 3);
  assert.equal(exits[2].signal, "SIGTERM");
});

test("signals and stop timeout do not confirm owned exit before the actual event", async () => {
  const exits = [];
  const { supervisor, spawned } = createSupervisor({ onOwnedChildExit: (event) => exits.push(event) });
  await supervisor.start();
  const child = spawned[0].child;
  child.kill = (signal) => { child.signals.push(signal); };
  await assert.rejects(supervisor.stop({ timeoutMs: 5, killTimeoutMs: 5 }), /did not exit/);
  assert.equal(supervisor.state, SUPERVISOR_STATES.SAFE_MODE);
  assert.deepEqual(child.signals, ["SIGTERM", "SIGKILL"]);
  assert.equal(exits.length, 0);
  child.emit("exit", null, "SIGKILL");
  assert.equal(exits.length, 1);
  assert.equal(exits[0].signal, "SIGKILL");
  child.emit("exit", null, "SIGKILL");
  assert.equal(exits.length, 1);
});
