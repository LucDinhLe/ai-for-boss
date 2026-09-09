import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fixtureRuntime, fixtureConfig, isolatedEnvironment } from './native-chat-fixture.mjs';
import { GatewaySupervisor } from '../apps/desktop/electron/supervisor.mjs';
import { GatewayAdapter } from '../apps/desktop/electron/gateway-adapter.mjs';
import { SetupChannel } from '../apps/desktop/electron/setup-channel.mjs';
import { waitForGatewayListener } from '../apps/desktop/electron/startup-listener.mjs';
import { waitForGatewayReady } from '../apps/desktop/electron/startup-readiness.mjs';
import { pairingCode } from '../apps/desktop/electron/chrome-bridge.mjs';
const resources = process.argv[process.argv.indexOf('--resources') + 1];
if (!process.argv.includes('--resources') || !resources) throw new Error('Provide --resources for the isolated packaged runtime');
const output = path.resolve('artifacts/shared-web-tabs/native-bridge.json');
if (!process.argv.includes('--isolated-child')) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'aifb-web-native-')), env = isolatedEnvironment(root);
  for (const dir of [env.TEMP, env.APPDATA, env.LOCALAPPDATA, env.OPENCLAW_STATE_DIR]) mkdirSync(dir, { recursive: true });
  const config = fixtureConfig(root, 9, 'generated-unused-fixture-key');
  config.plugins = { enabled: true, allow: ['browser'], entries: { browser: { enabled: true } } };
  config.browser = { enabled: true, extensionRelay: { allowLegacyAuth: false }, profiles: { chrome: { driver: 'extension', cdpPort: 19693 } } };
  writeFileSync(env.OPENCLAW_CONFIG_PATH, JSON.stringify(config));
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), '--isolated-child', '--resources', resources], { env, windowsHide: true, stdio: 'inherit' });
  const code = await new Promise(resolve => child.on('exit', resolve));
  rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 }); process.exitCode = code ?? 1;
} else {
  const native = fixtureRuntime(resources), record = { recordedAt: new Date().toISOString(), core: '2026.9.1', realAI: false, realChrome: false, failures: [] };
  const supervisor = new GatewaySupervisor({ configPath: process.env.OPENCLAW_CONFIG_PATH, stateDirectory: process.env.OPENCLAW_STATE_DIR, nodeExecutable: native.node, openclawEntry: native.entry, logger: { info() {}, warn() {}, error() {} }, runDoctor: () => false });
  const adapter = new GatewayAdapter({ stateDirectory: process.env.OPENCLAW_STATE_DIR, appVersion: 'beta14-fixture', logger: { warn() {} } });
  const setup = new SetupChannel({ configPath: process.env.OPENCLAW_CONFIG_PATH, stateDirectory: process.env.OPENCLAW_STATE_DIR, appVersion: 'beta14-fixture' });
  try {
    const started = Date.now(), endpoint = await supervisor.start();
    if (await waitForGatewayListener({ port: endpoint.port, supervisor, shouldStop: () => false }) !== 'ready') throw new Error('Listener timeout');
    const connection = { url: supervisor.url, token: endpoint.token }; adapter.connect(connection); setup.connect(connection);
    if (await waitForGatewayReady({ supervisor, adapter: { get connected() { return adapter.connected && setup.connected; } }, timeoutMs: Math.max(0, 240000 - (Date.now() - started)), shouldStop: () => false }) !== 'ready') throw new Error('Handshake timeout');
    supervisor.markReady(); record.handshakeMs = Date.now() - started;
    const status = await setup.browserRequest({ method: 'GET', path: '/', query: { profile: 'chrome' }, target: 'host' });
    record.status = { keys: Object.keys(status), enabled: status.enabled, profile: status.profile, cdpPort: status.cdpPort, driver: status.driver };
    const secret = await pairingCode(supervisor); const pairingUrl = new URL(secret);
    if (!pairingUrl.hash || pairingUrl.hostname !== '127.0.0.1' || Number(pairingUrl.port) !== 19693 || pairingUrl.pathname !== '/extension') throw new Error('Pairing route mismatch');
    record.pairing = { valid: true, nativeRelayPort: 19693, secretPrinted: false, stableAcrossGatewayPort: true };
    try { const tabs = await setup.browserRequest({ method: 'GET', path: '/tabs', query: { profile: 'chrome' }, target: 'host' }); record.tabs = { keys: Object.keys(tabs), count: tabs.tabs?.length }; }
    catch { record.tabs = { unattachedExtension: true }; }
  } catch (e) { record.failures.push(String(e.message)); }
  finally { await adapter.disconnect(); await setup.disconnect(); await supervisor.stop(); record.cleanup = supervisor.state === 'idle'; mkdirSync(path.dirname(output), { recursive: true }); writeFileSync(output, JSON.stringify(record, null, 2)+'\n'); }
  console.log(JSON.stringify(record)); process.exitCode = record.failures.length ? 1 : 0;
}
