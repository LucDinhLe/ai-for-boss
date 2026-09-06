import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createServer } from "node:net";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Startup exit code reserved by OpenClaw for configuration-class failures. */
export const EX_CONFIG = 78;

/** Environment the embedding guide prescribes for a supervised Gateway child. */
export const EMBEDDING_ENV = Object.freeze({
  OPENCLAW_DISABLE_BONJOUR: "1",
  OPENCLAW_EXEC_SHELL_SNAPSHOT: "0",
  OPENCLAW_NO_RESPAWN: "1",
  OPENCLAW_SKIP_CHANNELS: "1"
});

export const SUPERVISOR_STATES = Object.freeze({
  IDLE: "idle",
  STARTING: "starting",
  READY: "ready",
  RESTARTING: "restarting",
  SAFE_MODE: "safe-mode"
});

const RESTART_WINDOW_MS = 60_000;
const MAX_RESTARTS_PER_WINDOW = 3;
const RESTART_BACKOFF_MS = [500, 2_000, 6_000];

export function createGatewayToken() {
  return randomBytes(32).toString("base64url");
}

/** Asks the OS for a free loopback port instead of guessing a fixed one. */
export function reserveLoopbackPort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

/**
 * OpenClaw must run on a real Node runtime. Under Electron `process.execPath`
 * is the Electron binary, which the child would misread as an app launch, so
 * the host resolves an explicit Node instead.
 */
export function resolveNodeExecutable({ env = process.env, resourcesPath, platform = process.platform } = {}) {
  const explicit = env.AIFB_NODE_PATH;
  if (explicit && existsSync(explicit)) return explicit;

  const binary = platform === "win32" ? "node.exe" : "node";
  if (resourcesPath) {
    const bundled = path.join(resourcesPath, "runtime", "node", binary);
    if (existsSync(bundled)) return bundled;
  }

  const probe = spawnSync(binary, ["--version"], { encoding: "utf8" });
  if (probe.status === 0 && /^v\d+\./.test(probe.stdout.trim())) return binary;

  return null;
}

/**
 * Resolves the installed package entry; never a flattened or vendored copy.
 *
 * A packaged app carries its own OpenClaw install beside the app bundle, since
 * node_modules is deliberately absent from app.asar. That install is a real
 * package tree, so the child resolves its dependencies exactly as it does in
 * development. Outside a package, resolution falls back to the workspace.
 */
export function resolveOpenClawEntry(resolver = (specifier) => import.meta.resolve(specifier), { resourcesPath } = {}) {
  if (resourcesPath) {
    const bundled = path.join(resourcesPath, "openclaw", "node_modules", "openclaw", "openclaw.mjs");
    if (existsSync(bundled)) return bundled;
  }
  const packageEntry = fileURLToPath(resolver("openclaw"));
  return path.resolve(path.dirname(packageEntry), "..", "openclaw.mjs");
}

export class GatewaySupervisor {
  #child = null;
  #state = SUPERVISOR_STATES.IDLE;
  #restarts = [];
  #stopping = false;
  #lastExit = null;
  #doctorAttempted = false;

  constructor({
    stateDirectory,
    nodeExecutable,
    openclawEntry,
    logger = console,
    onStateChange = () => {},
    spawnChild = spawn,
    runDoctor = null,
    restartDelaysMs = RESTART_BACKOFF_MS
  }) {
    this.stateDirectory = stateDirectory;
    this.nodeExecutable = nodeExecutable;
    this.openclawEntry = openclawEntry;
    this.logger = logger;
    this.onStateChange = onStateChange;
    this.spawnChild = spawnChild;
    this.runDoctor = runDoctor ?? ((deps) => defaultDoctor(deps));
    this.restartDelaysMs = restartDelaysMs.length > 0 ? restartDelaysMs : RESTART_BACKOFF_MS;
    this.port = null;
    this.token = null;
  }

  get state() {
    return this.#state;
  }

  get lastExit() {
    return this.#lastExit;
  }

  get url() {
    return this.port ? `ws://127.0.0.1:${this.port}` : null;
  }

  #setState(next, detail) {
    if (this.#state === next) return;
    this.#state = next;
    this.onStateChange({ state: next, detail: detail ?? null, url: this.url });
  }

  #childEnv() {
    return {
      ...process.env,
      ...EMBEDDING_ENV,
      OPENCLAW_STATE_DIR: this.stateDirectory
    };
  }

  #args() {
    return [
      this.openclawEntry,
      "gateway",
      "--allow-unconfigured",
      "--auth",
      "token",
      "--token",
      this.token,
      "--bind",
      "loopback",
      "--port",
      String(this.port)
    ];
  }

  async start() {
    if (this.#child) return { port: this.port, token: this.token };
    this.#stopping = false;
    this.#setState(SUPERVISOR_STATES.STARTING);

    if (!this.nodeExecutable) {
      this.#setState(SUPERVISOR_STATES.SAFE_MODE, "node-runtime-missing");
      throw new Error("No Node runtime available for the OpenClaw child process");
    }

    this.port = await reserveLoopbackPort();
    this.token = createGatewayToken();
    this.#spawn();
    return { port: this.port, token: this.token };
  }

  #spawn() {
    const child = this.spawnChild(this.nodeExecutable, this.#args(), {
      env: this.#childEnv(),
      stdio: ["ignore", "pipe", "pipe"]
    });
    this.#child = child;

    // Consume both streams immediately; an unread pipe eventually blocks the child.
    child.stdout?.on("data", (chunk) => this.logger.info?.(`[gateway] ${String(chunk).trimEnd()}`));
    child.stderr?.on("data", (chunk) => this.logger.warn?.(`[gateway] ${String(chunk).trimEnd()}`));
    child.on("exit", (code, signal) => this.#handleExit(code, signal));
    child.on("error", (error) => {
      this.logger.error?.("[gateway] spawn failed", error);
      this.#setState(SUPERVISOR_STATES.SAFE_MODE, "spawn-failed");
    });
  }

  #handleExit(code, signal) {
    this.#child = null;
    this.#lastExit = { code, signal, at: Date.now() };
    if (this.#stopping) {
      this.#setState(SUPERVISOR_STATES.IDLE, "stopped");
      return;
    }

    if (code === EX_CONFIG) {
      if (this.#doctorAttempted) {
        this.#setState(SUPERVISOR_STATES.SAFE_MODE, "invalid-config");
        return;
      }
      this.#doctorAttempted = true;
      const repaired = this.runDoctor({
        nodeExecutable: this.nodeExecutable,
        openclawEntry: this.openclawEntry,
        env: this.#childEnv()
      });
      if (!repaired) {
        this.#setState(SUPERVISOR_STATES.SAFE_MODE, "invalid-config");
        return;
      }
      this.#setState(SUPERVISOR_STATES.RESTARTING, "config-repaired");
      setTimeout(() => this.#spawn(), this.restartDelaysMs[0]).unref?.();
      return;
    }

    const now = Date.now();
    this.#restarts = this.#restarts.filter((at) => now - at < RESTART_WINDOW_MS);
    if (this.#restarts.length >= MAX_RESTARTS_PER_WINDOW) {
      this.#setState(SUPERVISOR_STATES.SAFE_MODE, "restart-limit-reached");
      return;
    }
    const delay = this.restartDelaysMs[Math.min(this.#restarts.length, this.restartDelaysMs.length - 1)];
    this.#restarts.push(now);
    this.#setState(SUPERVISOR_STATES.RESTARTING, `exit-${code ?? signal}`);
    setTimeout(() => {
      if (!this.#stopping) this.#spawn();
    }, delay).unref?.();
  }

  markReady() {
    this.#doctorAttempted = false;
    this.#setState(SUPERVISOR_STATES.READY);
  }

  async stop({ timeoutMs = 5_000 } = {}) {
    this.#stopping = true;
    const child = this.#child;
    if (!child) {
      this.#setState(SUPERVISOR_STATES.IDLE, "stopped");
      return;
    }
    child.kill("SIGTERM");
    await new Promise((resolve) => {
      const timer = setTimeout(() => {
        try {
          child.kill("SIGKILL");
        } catch {
          // already gone
        }
        resolve();
      }, timeoutMs);
      child.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }
}

function defaultDoctor({ nodeExecutable, openclawEntry, env }) {
  const result = spawnSync(nodeExecutable, [openclawEntry, "doctor", "--fix", "--yes", "--non-interactive"], {
    env,
    encoding: "utf8",
    timeout: 120_000
  });
  return result.status === 0;
}
