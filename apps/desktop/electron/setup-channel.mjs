import {prepareHostPlugin,HOST_PLUGINS} from './host-plugin-setup.mjs';
import { NativeManagement } from "./native-management.mjs";
import { HostExecutionPolicy } from './host-execution-policy.mjs';
import { ApprovalService } from './approval-service.mjs';
import { ChannelSetupService } from './channel-setup-service.mjs';
import { WorkerPolicy, restrictSessionCreate } from "./worker-policy.mjs";
import path from 'node:path';
import { GatewayClient } from "@openclaw/gateway-client";
import { GATEWAY_CLIENT_CAPS } from '@openclaw/gateway-protocol/client-info';
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
 * Provider setup and the fixed host-owned Advisor model override need admin,
 * so they use this connection instead of widening the chat adapter. The renderer
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

/** Longer than the Gateway's own 25-minute provider-login session. */
export const WIZARD_NEXT_TIMEOUT_MS = 26 * 60_000;

export function isSetupMethod(method) {
  return SETUP_METHODS.includes(method);
}

/** Admin surfaces that must stay unreachable even on the setup connection. */
export function isForbiddenOnSetupChannel(method) {
  return /^(config\.|secrets\.|plugins\.|tools\.|exec\.|terminal\.|node\.|channels\.|cron\.|skills\.)/.test(method);
}

const advisorUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const advisorAgentId = /^[a-z0-9][a-z0-9_-]{0,63}$/u;
const advisorOptions = new Set(["requestId", "agentId", "model", "prompt", "onAccepted", "signal", "timeoutMs"]);
const validModelPart = (value) => typeof value === "string" && value.length > 0 && value.length <= 256
  && value === value.trim() && [...value].every((character) => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127);

export class SetupChannel {
  #client = null;
  #connected = false;
  #hello = null;
  #generation = 0;
  #connectionEpoch = 0;
  #advisorRuns = new Map();

  constructor({ stateDirectory, appVersion = "0.0.0-dev", logger = console, onStatus = () => {},
    Client = GatewayClient, identityLoader = loadOrCreateDeviceIdentity, catalogue = { version: "unknown", channels: [] },
    configPath = path.join(stateDirectory, 'openclaw.json'), channelBundleRoot, restartRuntime, installPlugin, hostApproval = false }) {
    this.stateDirectory = stateDirectory;
    this.configPath = configPath;
    this.appVersion = appVersion;
    this.logger = logger;
    this.onStatus = onStatus;
    this.Client = Client;
    this.identityLoader = identityLoader;
    this.workerPolicy = new WorkerPolicy({ configPath, backupPath: path.join(stateDirectory, 'aifb-worker-policy-before-beta21.json'),
      request: (method, params) => {
        if (!this.#client || !this.#connected || !this.grantedScopes.includes('operator.admin')) throw new Error('Chưa kết nối bộ chạy.');
        return this.#client.request(method, params, { timeoutMs: 180_000 });
      } });
    this.management = new NativeManagement((method, params) => {
      if (!this.#client || !this.#connected) throw new Error("Chưa kết nối bộ chạy.");
      return this.#client.request(method, params, { timeoutMs: 180_000 });
    }, catalogue);
    const hostRequest = (method, params) => {
      if (!this.#client || !this.#connected || !this.grantedScopes.includes('operator.admin')) throw new Error('Chưa kết nối bộ chạy.');
      return this.#client.request(method, params, { timeoutMs: 180_000 });
    };
    if (hostApproval) this.workerPolicy = new HostExecutionPolicy({ request: hostRequest, configPath });
    this.approvals = new ApprovalService(hostRequest);
    this.channelSetup = new ChannelSetupService({ bundleRoot: channelBundleRoot, configPath, restartRuntime, installPlugin,
      request: (method, params) => {
        if (!this.#client || !this.#connected || !this.grantedScopes.includes('operator.admin')) throw new Error('Chưa kết nối bộ chạy.');
        return this.#client.request(method, params, { timeoutMs: 180_000 });
      } });
  }

  get connected() {
    return this.#connected;
  }

  get grantedScopes() {
    return this.#hello?.auth?.scopes ?? [];
  }

  connect({ url, token }) {
    if (this.#client) return;
    const generation = ++this.#generation;
    const identity = this.identityLoader(this.stateDirectory);

    this.#client = new this.Client({
      url,
      token,
      role: "operator",
      scopes: [...SETUP_SCOPES],
      caps: [GATEWAY_CLIENT_CAPS.EXEC_APPROVALS],
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
        if (generation !== this.#generation) return;
        ++this.#connectionEpoch;
        this.#hello = hello;
        this.#connected = true;
        this.onStatus({ phase: "connected", scopes: hello.auth?.scopes ?? [] });
      },
      onConnectError: (error) => {
        if (generation === this.#generation) this.onStatus({ phase: "connect-error", message: error?.message ?? String(error) });
      },
      onClose: () => {
        if (generation !== this.#generation) return;
        this.channelSetup.clear();
        ++this.#connectionEpoch;
        this.#connected = false;
        this.#hello = null;
        this.onStatus({ phase: "closed" });
      }
    });

    this.#client.start();
  }

  manage(input) {
    if (['approval-list', 'approval-resolve'].includes(input?.action)) return this.approvals.run(input);
    return this.channelSetup.handles(input) ? this.channelSetup.run(input) : this.management.run(input);
  }

  // Fixed host calls; cannot be selected through setup.request or management.
  #adminRequest(method,params) {
    if(!this.#connected||!this.grantedScopes.includes('operator.admin'))throw new Error('Chưa kết nối bộ chạy.');
    return this.#client.request(method,params,{timeoutMs:180000});
  }
  prepareHostPlugin(id,directory,restart) {
    const spec=HOST_PLUGINS.find(p=>p.id===id);
    if(!spec)throw new Error('Plugin không thuộc vỏ ứng dụng.');
    return prepareHostPlugin({...spec,directory,configPath:this.configPath,restart,request:(method,params)=>this.#adminRequest(method,params)});
  }
  prepareDocuments(directory,restart) { return this.prepareHostPlugin('aifb-documents',directory,restart); }

  /**
   * Per-agent skill allowlist (`agents.<id>.skills`), the core's own mechanism
   * for limiting which skills an agent sees. Only skill names from the bundled
   * business pack are accepted; the write is read back before it counts.
   */
  async assignAgentSkills(agentId,skills) {
    if(!/^[a-z0-9][a-z0-9_-]{0,63}$/u.test(agentId)||!Array.isArray(skills)||skills.length>40||skills.some(s=>!/^[a-z0-9-]{1,64}$/u.test(s)))throw new Error('Danh sách kỹ năng chưa hợp lệ.');
    const before=await this.#adminRequest('config.get',{});
    if(before?.valid!==true||typeof before.hash!=='string'||!before.hash||path.resolve(before.path)!==path.resolve(this.configPath))throw new Error('Chưa xác nhận cấu hình ứng dụng.');
    const list=before.config.agents?.list;
    if(!Array.isArray(list)||!list.some(a=>a?.id===agentId))throw new Error('Agent chưa có trong cấu hình.');
    const sorted=[...new Set(skills)].sort();
    const next=list.map(a=>a?.id===agentId?{...a,skills:sorted}:a);
    const ack=await this.#adminRequest('config.patch',{baseHash:before.hash,replacePaths:['agents.list'],raw:JSON.stringify({agents:{list:next}})});
    if(ack?.ok!==true)throw new Error('Chưa xác nhận lưu kỹ năng cho agent.');
    const after=await this.#adminRequest('config.get',{});
    const saved=after?.config?.agents?.list?.find(a=>a?.id===agentId)?.skills;
    if(JSON.stringify(saved)!==JSON.stringify(sorted))throw new Error('Kỹ năng đã gửi nhưng chưa xác nhận được kết quả.');
    return {skills:sorted};
  }
  authorizeWorker(sessionKey) { return this.workerPolicy.ensure(sessionKey); }

  // Only the host's ChromeBridge may construct this fixed read-only route.
  browserRequest(params) {
    if (!this.#client || !this.#connected) throw new Error('Bật Gateway để kết nối Chrome.');
    if (params?.method !== 'GET' || !['/', '/tabs', '/snapshot'].includes(params.path) || params.target !== 'host'
      || params.query?.profile !== 'chrome') throw new Error('Chrome route not allowed');
    return this.#client.request('browser.request', params, { timeoutMs: 30000 });
  }

  // Host project/agent broker only. Never exposed as a generic renderer method.
  async workspaceRequest(method, params) {
    if (!['agents.list', 'agents.create', 'agents.files.get', 'agents.files.set', 'models.list', 'skills.status',
      'sessions.create', 'sessions.describe', 'sessions.delete', 'chat.history', 'agent.wait', 'health', 'aifb.documents.inspect', 'aifb.profiles.set',
      'aifb.harness.contract', 'aifb.harness.usage'].includes(method)) throw new Error('Workspace method not allowed');
    if (!this.#client || !this.#connected) throw new Error('Chưa kết nối bộ chạy.');
    const client = this.#client, generation = this.#generation;
    if (method === 'sessions.create') { params = restrictSessionCreate(params, true); await this.authorizeWorker(); }
    if (!this.#connected || client !== this.#client || generation !== this.#generation) throw new Error('Gateway đã kết nối lại. Yêu cầu chưa được gửi; hãy thử lại.');
    return client.request(method, params, { timeoutMs: 180_000 });
  }

  async request(method, params) {
    if (isForbiddenOnSetupChannel(method) || !isSetupMethod(method)) {
      throw new Error(`Method not allowed on the setup channel: ${method}`);
    }
    if (!this.#client || !this.#connected) throw new Error("Setup channel is not connected");
    const client = this.#client, generation = this.#generation, epoch = this.#connectionEpoch;
    const assertCurrent = () => {
      if (!this.#connected || client !== this.#client || generation !== this.#generation || epoch !== this.#connectionEpoch) {
        throw new Error('Gateway đã kết nối lại. Kiểm tra trạng thái kết nối trước khi thử lại.');
      }
    };
    // wizard.next blocks on the Gateway until the next step exists. During a
    // browser sign-in that is however long the person takes; the Gateway itself
    // expires a provider login after 25 minutes, so the client waits at least as long.
    const timeoutMs = method === 'wizard.next' ? WIZARD_NEXT_TIMEOUT_MS : 180_000;
    let result;
    try {
      result = await client.request(method, params, { timeoutMs });
    } catch (error) {
      assertCurrent();
      // A delivered progress step can outlive its runner. Never equate the
      // rejection with success: read the exact session's terminal result.
      if (method !== 'wizard.next' || !params?.answer || error?.code !== 'INVALID_REQUEST' || error?.message !== 'wizard not running') throw error;
      result = await client.request('wizard.next', { sessionId: params.sessionId }, { timeoutMs });
    }
    assertCurrent();
    return result;
  }

  // Host-only primitive: never reached by request(method, params) or its generic
  // preload bridge. The broker owns source/model verification and the UUID.
  async runAdvisorModel(options) {
    if (!options || typeof options !== "object" || Object.keys(options).some((key) => !advisorOptions.has(key))) {
      throw new Error("ADVISOR_INVALID_REQUEST");
    }
    const { requestId, agentId, model, prompt, onAccepted, signal, timeoutMs = 120_000 } = options;
    if (typeof requestId !== "string" || !advisorUuid.test(requestId) || typeof agentId !== "string" || !advisorAgentId.test(agentId)
      || !model || Object.keys(model).some((key) => key !== "id" && key !== "provider")
      || !validModelPart(model.id) || !validModelPart(model.provider)
      || typeof prompt !== "string" || !prompt.trim() || Buffer.byteLength(prompt, "utf8") > 128_000
      || !Number.isInteger(timeoutMs) || timeoutMs < 2_000 || timeoutMs > 120_000
      || (onAccepted !== undefined && typeof onAccepted !== "function")
      || (signal !== undefined && (typeof signal?.aborted !== "boolean" || typeof signal.addEventListener !== "function"
        || typeof signal.removeEventListener !== "function"))) throw new Error("ADVISOR_INVALID_REQUEST");
    if (signal?.aborted) throw new Error("ADVISOR_CANCELLED");
    const client = this.#client;
    if (!client || !this.#connected || !this.grantedScopes.includes("operator.admin")) throw new Error("ADVISOR_ADMIN_UNAVAILABLE");
    for (const [id, run] of this.#advisorRuns) if (run.expiresAt <= Date.now()) this.#advisorRuns.delete(id);
    if (this.#advisorRuns.has(requestId) || this.#advisorRuns.size >= 8) throw new Error("ADVISOR_REQUEST_UNAVAILABLE");
    const generation = this.#generation;
    const sessionKey = `agent:${agentId}:explicit:model-run-${requestId}`;
    const owned = { sessionKey, client, generation, expiresAt: Date.now() + 600_000 };
    this.#advisorRuns.set(requestId, owned);
    const controller = new globalThis.AbortController();
    const cancelWait = () => controller.abort();
    signal?.addEventListener("abort", cancelWait, { once: true });
    let protocolError = null;
    let accepted = false;
    try {
      const result = await client.request("agent", {
        agentId, sessionKey, provider: model.provider, model: model.id, message: prompt,
        modelRun: true, promptMode: "none", deliver: false, idempotencyKey: requestId,
        timeout: Math.min(110, Math.floor(timeoutMs / 1_000) - 1)
      }, {
        expectFinal: true, timeoutMs, signal: controller.signal,
        onAccepted: (payload) => {
          if (generation !== this.#generation || this.#client !== client || controller.signal.aborted) return;
          if (payload?.status !== "accepted" || payload.runId !== requestId || payload.sessionKey !== sessionKey || payload.agentId !== agentId) {
            protocolError = new Error("ADVISOR_ACCEPTANCE_MISMATCH");
            controller.abort();
            return;
          }
          if (!accepted) { accepted = true; onAccepted?.(payload); }
        }
      });
      if (protocolError) throw protocolError;
      if (generation !== this.#generation || this.#client !== client || controller.signal.aborted) throw new Error("ADVISOR_CANCELLED");
      if (result?.runId !== requestId || !["ok", "error", "timeout"].includes(result.status)) throw new Error("ADVISOR_RESULT_MISMATCH");
      if (this.#advisorRuns.get(requestId) === owned) this.#advisorRuns.delete(requestId);
      return result;
    } catch (error) {
      // A local timeout/abort does not cancel native execution. Retain the exact
      // owned pair briefly so the broker can still send the native abort.
      throw protocolError ?? error;
    } finally {
      signal?.removeEventListener("abort", cancelWait);
    }
  }

  async abortAdvisorModel({ sessionKey, runId }) {
    const owned = this.#advisorRuns.get(runId);
    if (!owned || owned.sessionKey !== sessionKey || owned.expiresAt <= Date.now()
      || owned.client !== this.#client || owned.generation !== this.#generation) throw new Error("ADVISOR_ABORT_NOT_OWNED");
    if (!this.#connected || !this.grantedScopes.includes("operator.admin")) throw new Error("ADVISOR_ADMIN_UNAVAILABLE");
    const result = await owned.client.request("chat.abort", { sessionKey, runId }, { timeoutMs: 10_000 });
    if (owned.client !== this.#client || owned.generation !== this.#generation) throw new Error("ADVISOR_ABORT_MISMATCH");
    if (result?.aborted === true && this.#advisorRuns.get(runId) === owned) this.#advisorRuns.delete(runId);
    return result;
  }

  // Read only the public terminal cache for an exact unresolved host-owned run.
  // A timeout/missing cache entry is unknown, never evidence of native completion.
  async getAdvisorRunState({ sessionKey, runId }) {
    const owned = this.#advisorRuns.get(runId);
    if (!owned || owned.sessionKey !== sessionKey || owned.expiresAt <= Date.now()
      || owned.client !== this.#client || owned.generation !== this.#generation) throw new Error("ADVISOR_STATE_NOT_OWNED");
    if (!this.#connected || !this.grantedScopes.includes("operator.admin")) throw new Error("ADVISOR_ADMIN_UNAVAILABLE");
    const result = await owned.client.request("agent.wait", { runId, timeoutMs: 0 }, { timeoutMs: 5_000 });
    if (owned.client !== this.#client || owned.generation !== this.#generation || result?.runId !== runId) throw new Error("ADVISOR_STATE_MISMATCH");
    if (["ok", "error"].includes(result.status) && Number.isFinite(result.endedAt)
      && result.pendingError !== true && result.yielded !== true && this.#advisorRuns.get(runId) === owned) this.#advisorRuns.delete(runId);
    return result;
  }

  async disconnect() {
    this.management.clear();
    this.channelSetup.clear();
    const client = this.#client;
    ++this.#generation;
    ++this.#connectionEpoch;
    this.#client = null;
    this.#connected = false;
    this.#hello = null;
    this.#advisorRuns.clear();
    if (!client) return;
    this.onStatus({ phase: "closed" });
    await client.stopAndWait({ timeoutMs: 4_000 }).catch(() => {});
  }
}
