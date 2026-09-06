import { GatewayClient } from "@openclaw/gateway-client";
import {
  loadOrCreateDeviceIdentity,
  loadDeviceToken,
  storeDeviceToken,
  clearDeviceToken,
  rawPublicKeyBase64Url,
  signDevicePayload
} from "./device-identity.mjs";
import { CLIENT_NAME, CLIENT_MODE, OPERATOR_SCOPES } from "./gateway-adapter.mjs";

/**
 * Connecting a model provider is the one job that needs `operator.admin`, so it
 * gets its own connection instead of widening the chat adapter. The renderer
 * never reaches a general admin channel: it can only ask for the calls below,
 * and the chat adapter keeps its three read/write/approval scopes.
 */
export const SETUP_SCOPES = Object.freeze([...OPERATOR_SCOPES, "operator.admin"]);

/**
 * OpenClaw owns the provider catalogue and every auth flow. The shell drives
 * them; it does not name a single provider of its own, so a provider OpenClaw
 * adds later appears here with no code change.
 */
export const SETUP_METHODS = Object.freeze([
  "openclaw.setup.detect",
  "openclaw.setup.activate",
  "openclaw.setup.activate.start",
  "openclaw.setup.auth.start",
  "openclaw.setup.verify",
  "wizard.next",
  "wizard.cancel",
  "wizard.status",
  "models.authStatus",
  "models.authLogout"
]);

export function isSetupMethod(method) {
  return SETUP_METHODS.includes(method);
}

/** Admin surfaces that must stay unreachable even on the setup connection. */
export function isForbiddenOnSetupChannel(method) {
  return /^(config\.|secrets\.|plugins\.|tools\.|exec\.|terminal\.|node\.|channels\.|cron\.|skills\.)/.test(method);
}

export class SetupChannel {
  #client = null;
  #connected = false;
  #hello = null;

  constructor({ stateDirectory, appVersion = "0.0.0-dev", logger = console, onStatus = () => {} }) {
    this.stateDirectory = stateDirectory;
    this.appVersion = appVersion;
    this.logger = logger;
    this.onStatus = onStatus;
  }

  get connected() {
    return this.#connected;
  }

  get grantedScopes() {
    return this.#hello?.auth?.scopes ?? [];
  }

  connect({ url, token }) {
    if (this.#client) return;
    const identity = loadOrCreateDeviceIdentity(this.stateDirectory);

    this.#client = new GatewayClient({
      url,
      token,
      role: "operator",
      scopes: [...SETUP_SCOPES],
      clientName: CLIENT_NAME,
      mode: CLIENT_MODE,
      clientDisplayName: "AI for Boss setup",
      clientVersion: this.appVersion,
      deviceIdentity: identity,
      hostDeps: {
        loadOrCreateDeviceIdentity: () => identity,
        signDevicePayload,
        publicKeyRawBase64UrlFromPem: rawPublicKeyBase64Url,
        // The setup role negotiates a wider scope set, so its token is stored
        // under its own role key and never overwrites the chat adapter's.
        loadDeviceAuthToken: () => loadDeviceToken(this.stateDirectory, "operator-setup"),
        storeDeviceAuthToken: ({ token: minted, scopes }) =>
          storeDeviceToken(this.stateDirectory, "operator-setup", minted, scopes),
        clearDeviceAuthToken: () => clearDeviceToken(this.stateDirectory, "operator-setup"),
        logError: (message) => this.logger.warn?.(`[setup] ${message}`)
      },
      onHelloOk: (hello) => {
        this.#hello = hello;
        this.#connected = true;
        this.onStatus({ phase: "connected", scopes: hello.auth?.scopes ?? [] });
      },
      onConnectError: (error) => this.onStatus({ phase: "connect-error", message: error?.message ?? String(error) }),
      onClose: () => {
        this.#connected = false;
        this.onStatus({ phase: "closed" });
      }
    });

    this.#client.start();
  }

  async request(method, params) {
    if (isForbiddenOnSetupChannel(method) || !isSetupMethod(method)) {
      throw new Error(`Method not allowed on the setup channel: ${method}`);
    }
    if (!this.#client) throw new Error("Setup channel is not connected");
    return this.#client.request(method, params, { timeoutMs: 180_000 });
  }

  async disconnect() {
    const client = this.#client;
    this.#client = null;
    this.#connected = false;
    if (!client) return;
    await client.stopAndWait({ timeoutMs: 4_000 }).catch(() => {});
  }
}
