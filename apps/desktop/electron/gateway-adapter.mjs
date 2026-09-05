import { GatewayClient } from "@openclaw/gateway-client";
import {
  loadOrCreateDeviceIdentity,
  loadDeviceToken,
  storeDeviceToken,
  clearDeviceToken,
  rawPublicKeyBase64Url,
  signDevicePayload
} from "./device-identity.mjs";

export const OPERATOR_ROLE = "operator";

/** Scopes a chat client needs, and nothing beyond them. */
export const OPERATOR_SCOPES = Object.freeze(["operator.read", "operator.write", "operator.approvals"]);

/**
 * The Gateway validates `client.id` against a closed registry, so a third-party
 * shell identifies as the generic `gateway-client` and carries its product name
 * in the display name instead.
 */
export const CLIENT_NAME = "gateway-client";
export const CLIENT_MODE = "ui";

/**
 * Beta 0 speaks only the calls the one chat window needs. Everything else stays
 * unreachable from the renderer until a later gate opens it deliberately.
 */
export const READ_METHODS = Object.freeze([
  "health",
  "system.info",
  "models.list",
  "models.authStatus",
  "sessions.list",
  "sessions.describe",
  "chat.history",
  "usage.status",
  "usage.cost",
  "agents.list",
  "projects.list"
]);

export const WRITE_METHODS = Object.freeze([
  "sessions.create",
  "sessions.send",
  "sessions.subscribe",
  "sessions.messages.subscribe",
  "sessions.messages.unsubscribe",
  "sessions.patch",
  "chat.abort"
]);

export const ALLOWED_METHODS = Object.freeze([...READ_METHODS, ...WRITE_METHODS]);

/** Events the renderer may observe. Approvals and tools arrive in a later gate. */
export const FORWARDED_EVENTS = Object.freeze([
  "session.message",
  "session.operation",
  "sessions.changed",
  "chat",
  "chat.metadata.changed",
  "health",
  "shutdown"
]);

export function isAllowedMethod(method) {
  return ALLOWED_METHODS.includes(method);
}

export function isForwardedEvent(eventName) {
  return FORWARDED_EVENTS.includes(eventName);
}

export class GatewayAdapter {
  #client = null;
  #hello = null;
  #connected = false;

  constructor({ stateDirectory, appVersion = "0.0.0-dev", onEvent = () => {}, onStatus = () => {}, logger = console }) {
    this.stateDirectory = stateDirectory;
    this.appVersion = appVersion;
    this.onEvent = onEvent;
    this.onStatus = onStatus;
    this.logger = logger;
  }

  get hello() {
    return this.#hello;
  }

  get connected() {
    return this.#connected;
  }

  /**
   * Connection-time facts the product surface needs: context ceiling for the
   * usage meter, default model, and the negotiated scopes.
   */
  get sessionDefaults() {
    const defaults = this.#hello?.defaults ?? null;
    return defaults;
  }

  connect({ url, token }) {
    if (this.#client) return;
    const identity = loadOrCreateDeviceIdentity(this.stateDirectory);

    this.#client = new GatewayClient({
      url,
      token,
      role: OPERATOR_ROLE,
      scopes: [...OPERATOR_SCOPES],
      clientName: CLIENT_NAME,
      mode: CLIENT_MODE,
      clientDisplayName: "AI for Boss",
      clientVersion: this.appVersion,
      deviceIdentity: identity,
      hostDeps: {
        loadOrCreateDeviceIdentity: () => identity,
        signDevicePayload,
        publicKeyRawBase64UrlFromPem: rawPublicKeyBase64Url,
        loadDeviceAuthToken: ({ role }) => loadDeviceToken(this.stateDirectory, role),
        storeDeviceAuthToken: ({ role, token: minted, scopes }) =>
          storeDeviceToken(this.stateDirectory, role, minted, scopes),
        clearDeviceAuthToken: ({ role }) => clearDeviceToken(this.stateDirectory, role),
        logError: (message) => this.logger.warn?.(`[adapter] ${message}`)
      },
      onHelloOk: (hello) => {
        this.#hello = hello;
        this.#connected = true;
        this.onStatus({ phase: "connected", protocol: hello.protocol, serverVersion: hello.server?.version });
      },
      onConnectError: (error) => {
        this.onStatus({ phase: "connect-error", message: error?.message ?? String(error) });
      },
      onClose: (code, reason) => {
        this.#connected = false;
        this.onStatus({ phase: "closed", code, reason });
      },
      onEvent: (frame) => {
        if (!frame?.event || !isForwardedEvent(frame.event)) return;
        this.onEvent({ event: frame.event, payload: frame.payload ?? null, seq: frame.seq ?? null });
      }
    });

    this.#client.start();
  }

  async request(method, params) {
    if (!isAllowedMethod(method)) {
      throw new Error(`Method not allowed for the renderer: ${method}`);
    }
    if (!this.#client) {
      throw new Error("Gateway adapter is not connected");
    }
    return this.#client.request(method, params, { timeoutMs: 60_000 });
  }

  async disconnect() {
    const client = this.#client;
    this.#client = null;
    this.#connected = false;
    if (!client) return;
    await client.stopAndWait({ timeoutMs: 4_000 }).catch(() => {});
  }
}
