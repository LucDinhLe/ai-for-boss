import { GatewayClient } from "@openclaw/gateway-client";
import { GATEWAY_CLIENT_CAPS } from "@openclaw/gateway-protocol/client-info";
import { projectAgentProgress } from "./agent-progress.mjs";
import { restrictSessionCreate, restrictSessionPatch, WorkerNotSubmittedError } from "./worker-policy.mjs";
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
  "projects.list",
  "sessions.usage",
  "sessions.files.list",
  "sessions.files.get",
  "skills.status",
  "channels.status",
  "cron.list",
  "cron.status",
  "cron.runs"
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

/** Agent progress is projected to presentation-only fields before IPC. */
export const FORWARDED_EVENTS = Object.freeze([
  "agent",
  "session.message",
  "session.operation",
  "sessions.changed",
  "chat",
  "chat.metadata.changed",
  "exec.approval.requested",
  "exec.approval.resolved",
  "health",
  "shutdown"
]);

export function isAllowedMethod(method) {
  return ALLOWED_METHODS.includes(method);
}

export function isForwardedEvent(eventName) {
  return FORWARDED_EVENTS.includes(eventName);
}

/** Only negotiated size limits cross the bridge, never the full hello snapshot. */
export function readAttachmentPolicy(hello) {
  const attachments = hello?.policy?.attachments;
  const policy = { maxBytes: attachments?.maxBytes, maxImageBytes: attachments?.maxImageBytes,
    maxPayload: hello?.policy?.maxPayload };
  return Object.values(policy).every(value => Number.isSafeInteger(value) && value > 0) ? policy : null;
}

export class GatewayAdapter {
  #client = null;
  #hello = null;
  #connected = false;
  #generation = 0;
  #pendingSends = new Set();

  constructor({ stateDirectory, appVersion = "0.0.0-dev", onEvent = () => {}, onStatus = () => {}, logger = console,
    Client = GatewayClient, identityLoader = loadOrCreateDeviceIdentity, authorizeWorker = null }) {
    this.stateDirectory = stateDirectory;
    this.appVersion = appVersion;
    this.onEvent = onEvent;
    this.onStatus = onStatus;
    this.logger = logger;
    this.Client = Client;
    this.identityLoader = identityLoader;
    this.authorizeWorker = authorizeWorker;
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
    const generation = ++this.#generation;
    const identity = this.identityLoader(this.stateDirectory);

    this.#client = new this.Client({
      url,
      token,
      role: OPERATOR_ROLE,
      scopes: [...OPERATOR_SCOPES],
      caps: [GATEWAY_CLIENT_CAPS.TOOL_EVENTS, GATEWAY_CLIENT_CAPS.SESSION_SCOPED_EVENTS, GATEWAY_CLIENT_CAPS.EXEC_APPROVALS],
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
        if (generation !== this.#generation) return;
        this.#hello = hello;
        this.#connected = true;
        this.onStatus({ phase: "connected", protocol: hello.protocol, serverVersion: hello.server?.version,
          attachmentPolicy: readAttachmentPolicy(hello) });
      },
      onConnectError: (error) => {
        if (generation !== this.#generation) return;
        this.onStatus({ phase: "connect-error", message: error?.message ?? String(error) });
      },
      onClose: (code, reason) => {
        if (generation !== this.#generation) return;
        this.#connected = false;
        this.#hello = null;
        this.onStatus({ phase: "closed", code, reason });
      },
      onEvent: (frame) => {
        if (generation !== this.#generation || !this.#connected) return;
        if (!frame?.event || !isForwardedEvent(frame.event)) return;
        const payload = frame.event.startsWith('exec.approval.') ? { changed: true }
          : frame.event === "agent" ? projectAgentProgress(frame.payload) : frame.payload ?? null;
        if (frame.event === "agent" && !payload) return;
        this.onEvent({ event: frame.event, payload, seq: frame.seq ?? null });
      }
    });

    this.#client.start();
  }

  async request(method, params) {
    if (!isAllowedMethod(method)) {
      throw new Error(`Method not allowed for the renderer: ${method}`);
    }
    if (!this.#client || !this.#connected) {
      const error = new Error("Gateway adapter is not connected");
      throw method === 'sessions.send' ? new WorkerNotSubmittedError(error) : error;
    }
    const client = this.#client, generation = this.#generation;
    if (method === 'chat.abort') for (const pending of this.#pendingSends) {
      if (pending.key === params?.sessionKey && (!params.runId || pending.runId === params.runId)) pending.cancelled = true;
    }
    if (method === 'sessions.create') params = restrictSessionCreate(params);
    if (method === 'sessions.patch') params = restrictSessionPatch(params);
    if (this.authorizeWorker && ['sessions.create', 'sessions.send'].includes(method)) {
      const pending = { key: params?.key, runId: params?.idempotencyKey, cancelled: false };
      if (method === 'sessions.send') this.#pendingSends.add(pending);
      try {
        await this.authorizeWorker(method === 'sessions.send' ? params?.key : undefined);
        if (pending.cancelled) throw new Error('Đã dừng trước khi gửi yêu cầu đến mô hình.');
        if (!this.#connected || this.#client !== client || this.#generation !== generation) throw new Error('Gateway đã kết nối lại. Yêu cầu chưa được gửi; hãy thử lại.');
      } catch (error) {
        // The worker RPC below has not been invoked: there is no native run to recover.
        throw method === 'sessions.send' ? new WorkerNotSubmittedError(error) : error;
      } finally { this.#pendingSends.delete(pending); }
    }
    return client.request(method, params, { timeoutMs: 60_000 });
  }

  async disconnect() {
    const client = this.#client;
    ++this.#generation;
    this.#client = null;
    this.#connected = false;
    this.#hello = null;
    if (!client) return;
    this.onStatus({ phase: "closed" });
    await client.stopAndWait({ timeoutMs: 4_000 }).catch(() => {});
  }
}
