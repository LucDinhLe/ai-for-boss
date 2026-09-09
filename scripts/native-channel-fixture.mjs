/** Real pinned Gateway + native managed offline plugins; generated profile, no credentials/messages.
 * node scripts/native-channel-fixture.mjs --resources <packaged-resources> --out <fresh-receipt.json>
 * Default: production offline installer/service, first-click setup, all five native setup contracts.
 * --legacy-repro explicitly reproduces rejected raw load.paths discovery; never release acceptance.
 * --managed-discord is the historical online exact-pin diagnostic, never the default delivery proof.
 * --resume <failed-receipt.json> reuses only this fixture's clean, nonce-bound
 * checkpoint. New evidence references the original install receipt; no copied install claims.
 */
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash, generateKeyPairSync, randomUUID } from 'node:crypto';
import { closeSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, realpathSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createServer } from 'node:http';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { fixtureRuntime, isolatedEnvironment, fixtureConfig, startFixtureModel } from './native-chat-fixture.mjs';
import { PRIORITY_CHANNELS } from '../apps/desktop/electron/channel-setup-service.mjs';
import { CHECKPOINT_FILE, assertOwnedCheckpointPaths, checkpointPins, readCheckpoint } from './channel-fixture-checkpoint.mjs';
import { configFormChannels, stepEvidence, isUnexpectedInstallerStep, assertAccountInput } from './channel-fixture-contract.mjs';
const self = fileURLToPath(import.meta.url), repo = path.resolve(path.dirname(self), '..');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const digest = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const value = flag => { const at = process.argv.indexOf(flag); return at < 0 ? undefined : process.argv[at + 1]; };
async function rejectingModel(port) {
  const observation = { requests: 0, completed: 0, abortStreams: 0, abortedConnections: 0, rejected: 0 };
  const server = createServer((request, response) => { observation.requests++; observation.rejected++; request.resume(); response.writeHead(503); response.end('Channel fixture accepts no inference.'); });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  return { port, observation, close: () => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }) };
}
async function worker({ root, resources, bundle, timeoutMs, firstUse, managedDiscord, checkpoint, resume, diagnoseState }) {
  if (process.env.AIFB_NATIVE_CHAT_FIXTURE !== '1' || process.env.OPENCLAW_HOME !== root) throw new Error('Isolated channel fixture required.');
  const native = fixtureRuntime(resources);
  const { GatewayClient } = await import(pathToFileURL(native.sdk));
  const { GatewaySupervisor } = await import('../apps/desktop/electron/supervisor.mjs');
  const { SetupChannel } = await import('../apps/desktop/electron/setup-channel.mjs');
  const { ChannelPluginInstaller } = await import('../apps/desktop/electron/channel-plugin-installer.mjs');
  const { waitForGatewayReady } = await import('../apps/desktop/electron/startup-readiness.mjs');
  const key = `fixture-${randomUUID()}`, model = resume ? await rejectingModel(resume.modelPort) : await startFixtureModel(key);
  const config = fixtureConfig(root, model.port, key);
  const pluginIds = PRIORITY_CHANNELS.filter(id => id !== 'telegram');
  config.plugins = { load: { paths: pluginIds.map(id => path.join(bundle, 'node_modules/@openclaw', id)) },
    entries: Object.fromEntries(PRIORITY_CHANNELS.map(id => [id, { enabled: true }])) };
  config.channels = {};
  if (firstUse) config.plugins = {};
  if (managedDiscord) config.plugins = {};
  if (!resume) writeFileSync(process.env.OPENCLAW_CONFIG_PATH, JSON.stringify(config));
  const record = { kind: 'AIFB_NATIVE_CHANNEL_FIXTURE', recordedAt: new Date().toISOString(), coreVersion: '2026.9.1', realAccounts: false,
    providerMessagesSent: 0, realAuthentication: false, checks: [], plugins: [], wizards: [], wizardInstallFailures: [], failures: [], cleanup: {},
    bundleLockSha256: JSON.parse(readFileSync(path.join(bundle, firstUse ? 'channel-installer.json' : 'channel-plugins.json'), 'utf8'))[firstUse ? 'pluginLockSha256' : 'lockSha256'],
    bundleManifestSha256: digest(path.join(bundle, firstUse ? 'channel-installer.json' : 'channel-plugins.json')),
    serviceSha256: digest(path.join(repo, 'apps/desktop/electron/channel-setup-service.mjs')),
    configFormSha256: digest(path.join(repo, 'apps/desktop/electron/channel-config-form.mjs')),
    installerSha256: digest(path.join(repo, 'apps/desktop/electron/channel-plugin-installer.mjs')), timeoutMs,
    timeoutRationale: 'Overall native QA includes four separate offline installs, reloads and four schema/config commits; production per-plugin timeout remains 240000 ms.',
    productionInstallerTimeoutMs: 240000, firstUse, managedDiscord, resumed: Boolean(resume), ownedRestarts: 0,
    networkGuard: { kind: 'QA-only Node TCP/DNS/UDP denial', externalConnectionsAllowed: false },
    newInstallCount: 0, ...(resume ? { installEvidence: resume.installReceipt } : {}), offlineInstalls: [] };
  if (resume) record.checkpoint = { ...checkpoint, installPhaseVerified: true, modelPort: resume.modelPort, installReceipt: resume.installReceipt };
  record.sourceHashes = { 'channel-config-form.mjs': record.configFormSha256, 'supervisor.mjs': digest(path.join(repo, 'apps/desktop/electron/supervisor.mjs')),
    'channel-setup-service.mjs': record.serviceSha256, 'channel-plugin-installer.mjs': record.installerSha256 };
  let installer; let installerExit; let aborted = false;
  const nativeInstallerExits = [];
  const nativeInstaller = new ChannelPluginInstaller({ bundleRoot: bundle, stateDirectory: process.env.OPENCLAW_STATE_DIR, nodeExecutable: native.node, openclawEntry: native.entry,
    spawnProcess: (command, args, options) => {
      const expectedPath = [path.dirname(native.node), path.join(bundle, 'npm'), path.join(process.env.SystemRoot, 'System32')].join(path.delimiter);
      assert.equal(command, native.node); assert.equal(options.env.PATH, expectedPath);
      assert.equal(options.env.NPM_CONFIG_OFFLINE, 'true');
      record.toolchain = { ...record.toolchain, installerPath: options.env.PATH, nativeNpmOffline: true };
      const spawned = spawn(command, args, options);
      record.newInstallCount++;
      const item = { id: args[3], output: '' }; (record.offlineInstalls ??= []).push(item);
      process.send?.({ type: 'progress', stage: `native install ${item.id}` });
      nativeInstallerExits.push(new Promise(resolve => { spawned.once('exit', resolve); spawned.once('error', resolve); }));
      for (const stream of [spawned.stdout, spawned.stderr]) stream?.on('data', data => { item.output = (item.output + String(data)).slice(-6000); });
      spawned.once('exit', code => { item.exitCode = code; process.send?.({ type: 'progress', stage: `native install ${item.id} exit ${code}` }); }); return spawned;
    } });
  let child; const logs = []; const log = text => {
    const line = String(text).slice(0, 500); logs.push(line); if (logs.length > 18) logs.shift();
    if (/Plugin install (?:failed|timed out)/iu.test(line)) record.wizardInstallFailures.push(line);
  };
  const networkGuard = pathToFileURL(path.join(repo, 'scripts/channel-fixture-network-guard.mjs')).href;
  record.networkGuard.sourceSha256 = digest(path.join(repo, 'scripts/channel-fixture-network-guard.mjs'));
  const denialLog = path.join(root, 'network-denials.jsonl');
  const priorDenialLines = existsSync(denialLog) ? readFileSync(denialLog, 'utf8').trim().split('\n').filter(Boolean).length : 0;
  const supervisor = new GatewaySupervisor({ configPath: process.env.OPENCLAW_CONFIG_PATH, stateDirectory: process.env.OPENCLAW_STATE_DIR,
    nodeExecutable: native.node, openclawEntry: native.entry, runDoctor: () => false, logger: { info: log, warn: log, error: log },
    spawnChild: (command, args, options) => {
      assert.equal(options.env.OPENCLAW_SKIP_CHANNELS, '0'); assert.equal(options.env.OPENCLAW_SKIP_PROVIDERS, '0');
      const imports = ['--import', networkGuard];
      if (diagnoseState) imports.push('--import', pathToFileURL(path.join(repo, 'artifacts/provider-channels-motion/reproduce/channel-runtime-observer.mjs')).href);
      child = spawn(command, [...imports, ...args], { ...options, cwd: root, windowsHide: true }); return child;
    } });
  const setup = new SetupChannel({ configPath: process.env.OPENCLAW_CONFIG_PATH, stateDirectory: process.env.OPENCLAW_STATE_DIR, Client: GatewayClient, logger: { warn() {} },
    channelBundleRoot: bundle, installPlugin: id => nativeInstaller.install(id), restartRuntime: async () => {
      if (aborted) throw new Error('Fixture cancelled before restart');
      record.ownedRestarts++; await setup.disconnect(); await supervisor.stop();
      const endpoint = await supervisor.start(); assert.ok(endpoint);
      setup.connect({ url: `ws://127.0.0.1:${endpoint.port}`, token: endpoint.token });
      assert.equal(await waitForGatewayReady({ supervisor, adapter: setup, timeoutMs: 120000 }), 'ready'); supervisor.markReady();
    } });
  const rpc = (method, params) => setup.management.request(method, params);
  const service = { run: input => setup.manage(input), clear: () => setup.channelSetup.clear() };
  const channelRequest = setup.channelSetup.request;
  record.nativeSchemaPaths = []; record.nativeConfigCommits = [];
  setup.channelSetup.request = async (method, params) => {
    if (method === 'config.schema.lookup') record.nativeSchemaPaths.push(params.path);
    if (method === 'config.patch' && JSON.parse(params.raw).channels) {
      const patch = JSON.parse(params.raw); assert.deepEqual(Object.keys(patch), ['channels']);
      assert.equal(Object.keys(patch.channels).length, 1);
      const [id] = Object.keys(patch.channels); assert.ok(configFormChannels.has(id));
      const channelPatch = patch.channels[id]; assert.deepEqual(Object.keys(channelPatch), ['accounts']);
      const [accountId] = Object.keys(channelPatch.accounts); assert.equal(Object.keys(channelPatch.accounts).length, 1);
      const changedFields = Object.keys(channelPatch.accounts[accountId]).sort();
      const allowed = id === 'googlechat' ? ['enabled', 'serviceAccount', 'audienceType', 'audience', 'appPrincipal', 'webhookUrl']
        : id === 'whatsapp' ? ['enabled'] : ['enabled', id === 'zalo' ? 'botToken' : 'token'];
      assert.ok(changedFields.every(field => allowed.includes(field))); assert.equal(channelPatch.accounts[accountId].enabled, true);
      record.nativeConfigCommits.push({ id, accountId, changedFields, baseHashPresent: Boolean(params.baseHash) });
    }
    return channelRequest(method, params);
  };
  let timer; let stop;
  const cancelled = new Promise((_, reject) => { stop = () => reject(new Error('Fixture cancelled')); timer = setTimeout(() => reject(new Error('Fixture deadline')), timeoutMs); });
  const onMessage = message => { if (message?.type === 'stop') stop(); }; process.on('message', onMessage);
  try {
    await Promise.race([(async () => {
      if (firstUse) {
        const adjacentNpm = ['npm', 'npm.cmd', 'node_modules/npm'].some(name => existsSync(path.join(path.dirname(native.node), name)));
        assert.equal(adjacentNpm, false, 'production runtime must not supply an unrecorded adjacent npm');
        assert.equal(process.env.PATH, '', 'fixture caller PATH must be empty');
        record.toolchain = { nodeExecutable: native.node, adjacentNpmPresent: false, callerPathEmpty: true,
          bundledNpmVersion: JSON.parse(readFileSync(path.join(bundle, 'npm/node_modules/npm/package.json'), 'utf8')).version };
      }
      if (managedDiscord) {
        const started = Date.now(); let output = '';
        installer = spawn(native.node, [native.entry, 'plugins', 'install', '@openclaw/discord@2026.9.1', '--pin'], {
          cwd: root, env: process.env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
        for (const stream of [installer.stdout, installer.stderr]) stream.on('data', data => { output = (output + String(data)).slice(-12000); });
        installerExit = new Promise(resolve => { installer.once('error', error => resolve({ code: -1, error: error.message })); installer.once('exit', (code, signal) => resolve({ code, signal })); });
        const exited = await installerExit;
        record.nativeInstall = { ...exited, durationMs: Date.now() - started, source: 'npm registry exact @openclaw/discord@2026.9.1 --pin', output };
        assert.equal(exited.code, 0, 'native exact registry CLI install succeeds');
        if (aborted) throw new Error('Fixture cancelled after install');
      }
      const begin = Date.now(), endpoint = await supervisor.start(); assert.ok(endpoint);
      setup.connect({ url: `ws://127.0.0.1:${endpoint.port}`, token: endpoint.token });
      assert.equal(await waitForGatewayReady({ supervisor, adapter: setup, timeoutMs: 240000 }), 'ready'); supervisor.markReady();
      record.startupMs = Date.now() - begin;
      process.send?.({ type: 'progress', stage: 'Gateway ready' });
      if (managedDiscord) {
        const inventory = await rpc('plugins.list', {});
        const row = inventory.plugins.find(plugin => plugin.id === 'discord');
        record.nativePluginRows = [row];
        assert.ok(row?.installed && row.enabled); assert.equal(row.version, '2026.9.1');
        assert.notEqual(row.origin, 'config');
        const status = await rpc('channels.status', { probe: false }); record.channelOrder = status.channelOrder;
        assert.ok(status.channelOrder.includes('discord'), 'native Discord registration succeeds with trusted keyed-store helper');
        let reply = await rpc('wizard.start', { flow: 'channels', channel: 'discord' }); const sessionId = reply.sessionId; const steps = [];
        for (let i = 0; i < 20 && !reply.done; i++) {
          if (reply.step) steps.push({ type: reply.step.type, title: reply.step.title, sensitive: reply.step.sensitive });
          if (reply.step && !['note', 'progress'].includes(reply.step.type)) break;
          reply = await rpc('wizard.next', { sessionId, ...(reply.step?.type === 'note' ? { answer: { stepId: reply.step.id, value: true } } : {}) });
        }
        assert.ok(reply.step && !['note', 'progress'].includes(reply.step.type));
        const cancelled = await rpc('wizard.cancel', { sessionId }); assert.equal(cancelled.status, 'cancelled');
        record.wizards.push({ id: 'discord', steps, reachedInput: true, cancelled: true });
        record.checks.push('native exact registry install grants trusted official Discord runtime registration and targeted wizard');
        return;
      }
      if (firstUse && !resume) {
        const first = await service.run({ action: 'channel-setup', channel: 'discord' });
        record.firstUseInput = { id: 'discord', setupRoute: first.setupRoute ?? 'native-wizard', step: first.step && stepEvidence(first.step) };
        assert.ok(first.sessionId && first.step, 'first click after registration/restart enters account setup');
        assertAccountInput('discord', first);
        const cancelled = await service.run({ action: 'channel-cancel', sessionId: first.sessionId }); assert.equal(cancelled.status, 'cancelled');
        const after = await rpc('config.get', {});
        assert.equal(after.config.plugins.load?.paths?.length ?? 0, 0);
        assert.deepEqual(after.config.channels ?? {}, {}); assert.equal(after.config.tools.deny[0], '*');
        record.firstUse = { channel: 'discord', setupRoute: first.setupRoute, accountInputVerified: true,
          noAdHocLoadPaths: true, channelsUntouched: true, workerPolicyPreserved: true, cancelled: true };
        // Finish the native enable request before stopping the owned Gateway.
        // A live Gateway watches plugin install records and can restart between
        // CLI exit and the next RPC. Install the remaining fixture seeds while
        // it is stopped, then verify all provenance against one fresh runtime.
        await rpc('plugins.setEnabled', { pluginId: 'telegram', enabled: true });
        await setup.disconnect(); await supervisor.stop();
        for (const id of pluginIds.filter(id => id !== 'discord')) await nativeInstaller.install(id);
        if (aborted) throw new Error('Fixture cancelled before registry restart');
        record.ownedRestarts++; await setup.disconnect(); await supervisor.stop();
        const restarted = await supervisor.start(); assert.ok(restarted);
        setup.connect({ url: `ws://127.0.0.1:${restarted.port}`, token: restarted.token });
        assert.equal(await waitForGatewayReady({ supervisor, adapter: setup, timeoutMs: 120000 }), 'ready'); supervisor.markReady();
      }
      const plugins = await rpc('plugins.list', {});
      record.nativePluginRows = plugins.plugins.filter(plugin => PRIORITY_CHANNELS.includes(plugin.id));
      for (const id of PRIORITY_CHANNELS) {
        const row = plugins.plugins.find(plugin => plugin.id === id);
        assert.ok(row?.installed, `${id} installed`); assert.equal(row.enabled, true, `${id} enabled`);
        assert.notEqual(row.state, 'error', `${id} no plugin load error`);
        record.plugins.push({ id, installed: row.installed, enabled: row.enabled, state: row.state, version: row.version, origin: row.origin });
        if (firstUse && id !== 'telegram') {
          const inspected = await rpc('plugins.inspect', { pluginId: id });
          const pinned = JSON.parse(readFileSync(path.join(bundle, 'channel-installer.json'), 'utf8')).plugins.find(plugin => plugin.id === id);
          assert.equal(inspected.plugin.origin, 'global'); assert.equal(inspected.plugin.version, '2026.9.1');
          assert.equal(inspected.source.kind, 'npm'); assert.equal(inspected.source.packageName, pinned.name);
          assert.equal(inspected.source.spec, pinned.spec); assert.equal(inspected.source.integrity, pinned.integrity);
          (record.nativeSources ??= []).push({ id, kind: inspected.source.kind, spec: inspected.source.spec,
            packageName: inspected.source.packageName, integrity: inspected.source.integrity });
        }
      }
      record.checks.push('all five official plugin identities installed and enabled through native inventory');
      const status = await rpc('channels.status', { probe: false });
      // Telegram intentionally uses activation.onStartup:false and no credential is supplied here.
      for (const id of pluginIds) assert.ok(status.channelOrder.includes(id), `${id} registered channel runtime`);
      record.channelOrder = status.channelOrder;
      record.telegramActivation = 'Bundled on-demand plugin; verified targeted native setup below, no credential supplied.';
      if (firstUse) {
        const baseline = await rpc('config.get', {});
        assert.equal(baseline.valid, true); assert.deepEqual(baseline.config.tools, config.tools);
        assert.equal(baseline.config.plugins.load?.paths?.length ?? 0, 0);
        record.checkpoint = { ...checkpoint, installPhaseVerified: true, verifiedAt: new Date().toISOString(), modelPort: model.port };
        if (resume) record.checkpoint.installReceipt = resume.installReceipt;
        process.send?.({ type: 'progress', stage: resume ? 'Retained official provenance reverified; no new installs' : 'Four native official installs and runtime provenance verified' });
      }
      const accountBaseline = (await rpc('config.get', {})).config.channels ?? {};
      const wa = status.channelAccounts.whatsapp.find(row => row.accountId === 'default') ?? status.channelAccounts.whatsapp[0];
      assert.ok(wa); assert.notEqual(wa.connected, true); assert.notEqual(wa.linked, true);
      record.whatsAppBeforeLogin = { configured: wa.configured, connected: wa.connected === true, linked: wa.linked === true };
      const idleQr = await rpc('web.login.wait', { accountId: 'default', timeoutMs: 1000 });
      assert.equal(idleQr.connected, false); assert.match(idleQr.message, /No active WhatsApp login/iu);
      record.checks.push('WhatsApp QR handler loads and reports no active login without opening a network login');
      for (const id of PRIORITY_CHANNELS) {
        if (status.channelOrder.includes(id)) {
          const pairing = await service.run({ action: 'channel-pairing-list', channel: id, accountId: 'default' });
          assert.deepEqual(pairing.requests, []);
          (record.nativePairingChecks ??= []).push({ id, requests: 0 });
        }
        const evidence = { id, targetedChannel: id, steps: [], reachedInput: false, accountInputVerified: false, cancelled: false };
        record.wizards.push(evidence);
        let reply = await service.run({ action: 'channel-setup', channel: id }); let stoppedAtInput = false;
        evidence.setupRoute = reply.setupRoute ?? 'native-wizard';
        for (let attempt = 0; attempt < 20; attempt++) {
          if (reply.step) {
            evidence.steps.push(stepEvidence(reply.step));
            assert.equal(isUnexpectedInstallerStep(reply.step), false, `${id} must never enter an installer or fallback channel picker`);
          }
          if (reply.done) break;
          if (reply.step && !['note', 'progress'].includes(reply.step.type)) { stoppedAtInput = true; break; }
          if (!reply.step || reply.step.type === 'progress') { await delay(100); reply = await service.run({ action: 'channel-next', sessionId: reply.sessionId }); }
          else reply = await service.run({ action: 'channel-next', sessionId: reply.sessionId, answer: { stepId: reply.step.id, value: true } });
        }
        assert.ok(stoppedAtInput, `${id} native setup reached an input step`);
        evidence.reachedInput = true;
        assertAccountInput(id, reply);
        evidence.accountInputVerified = true;
        const cancelled = await service.run({ action: 'channel-cancel', sessionId: reply.sessionId }); assert.equal(cancelled.status, 'cancelled');
        evidence.cancelled = true;
      }
      record.checks.push('one exact Telegram native account selector and four native-schema host account forms; each cancelled before credentials');
      const after = await rpc('config.get', {});
      assert.deepEqual(after.config.channels ?? {}, accountBaseline);
      if (!firstUse) assert.deepEqual(after.config.plugins.load.paths, config.plugins.load.paths);
      record.checks.push('channel settings and configured plugin paths unchanged after cancelled setup');
      if (firstUse) {
        // Generated accounts only, with native auto-start behavior retained.
        // The QA-only transport guard prevents real provider connections.
        const retained = Object.fromEntries([...configFormChannels].map(id => [id, { accounts: { retained: { enabled: false, name: 'Generated retained account' } } }]));
        await rpc('config.patch', { baseHash: after.hash, raw: JSON.stringify({ channels: retained }) });
        const privateKey = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } }).privateKey;
        const generatedServiceAccount = JSON.stringify({ type: 'service_account', project_id: 'aifb-generated-fixture', private_key_id: 'generated', private_key: privateKey,
          client_email: 'aifb-fixture@aifb-generated-fixture.iam.gserviceaccount.com', client_id: '100000000000000000001', token_uri: 'https://oauth2.googleapis.com/token' });
        record.configCommits = [];
        const generatedAccountId = `fixture-${randomUUID().slice(0, 8)}`;
        for (const id of configFormChannels) {
          const commit = { id, accountId: generatedAccountId, steps: [], publicSchemaAccepted: false, saved: false, applied: false, preserved: false };
          record.configCommits.push(commit);
          const before = await rpc('config.get', {}); let reply = await service.run({ action: 'channel-setup', channel: id });
          assertAccountInput(id, reply);
          for (let i = 0; i < 10 && !reply.done; i++) {
            const step = reply.step; assert.ok(step); commit.steps.push(stepEvidence(step));
            const field = step.id.split(':').at(-1);
            if (id === 'whatsapp') assert.ok(['accountId', 'confirm'].includes(field), 'WhatsApp account setup must not collect credentials or start login');
            const fixtureWebhook = `https://example.invalid/aifb-fixture/${generatedAccountId}`;
            const values = { accountId: generatedAccountId, authMethod: 'inline', credential: id === 'googlechat' ? generatedServiceAccount : `aifb-generated-${id}-${generatedAccountId}-not-a-real-token`,
              audienceType: 'app-url', audience: fixtureWebhook, appPrincipal: '100000000000000000001', webhookUrl: fixtureWebhook, confirm: true };
            assert.ok(Object.hasOwn(values, field), `unexpected compatibility form field ${field}`);
            reply = await service.run({ action: 'channel-next', sessionId: reply.sessionId, answer: { stepId: step.id, value: values[field] } });
          }
          assert.equal(reply.done, true, `${id} native config commit reaches terminal state`);
          assert.equal(reply.status, 'done', `${id} native config ACK/readback: ${reply.error ?? 'no terminal success'}`);
          assert.deepEqual(reply.accounts, [{ channel: id, accountId: generatedAccountId }]);
          commit.publicSchemaAccepted = true; commit.saved = true;
          const saved = await rpc('config.get', {});
          assert.equal(saved.valid, true); assert.equal(saved.appliedConfigHash, saved.configRevisionHash);
          assert.deepEqual(saved.config.tools, before.config.tools); assert.deepEqual(saved.config.plugins, before.config.plugins);
          for (const other of Object.keys(before.config.channels)) {
            if (other === id) assert.deepEqual(saved.config.channels[id].accounts.retained, before.config.channels[id].accounts.retained);
            else assert.deepEqual(saved.config.channels[other], before.config.channels[other]);
          }
          assert.equal(saved.config.channels[id].accounts[generatedAccountId].enabled, true);
          commit.appliedRevisionVerified = true; commit.otherAccountsPreserved = true;
          const nativeStatus = await rpc('channels.status', { channel: id, probe: false });
          const projectStatus = status => ({ partial: status.partial === true, warnings: status.warnings ?? [],
            accounts: (status.channelAccounts?.[id] ?? []).map(({ accountId, enabled, configured, running, linked, connected }) => ({ accountId, enabled, configured, running, linked, connected })) });
          commit.statusBeforeRestart = projectStatus(nativeStatus);
          const account = nativeStatus.channelAccounts[id].find(row => row.accountId === generatedAccountId);
          if (!account && diagnoseState) {
            writeFileSync(path.join(root, 'inspect-runtime.trigger'), 'generated fixture observation');
            for (let attempt = 0; attempt < 100 && !existsSync(path.join(root, 'runtime-observation.json')); attempt++) await delay(100);
            record.runtimeObservation = JSON.parse(readFileSync(path.join(root, 'runtime-observation.json'), 'utf8'));
          } else if (!account) {
            await setup.channelSetup.restartRuntime();
            commit.statusAfterDiagnosticRestart = projectStatus(await rpc('channels.status', { channel: id, probe: false }));
          }
          assert.ok(account); assert.equal(account.enabled, true);
          if (id !== 'whatsapp') assert.equal(account.configured, true);
          else {
            assert.notEqual(account.linked, true); assert.notEqual(account.connected, true);
            const idle = await rpc('web.login.wait', { accountId: generatedAccountId, timeoutMs: 1000 });
            assert.equal(idle.connected, false); assert.match(idle.message, /No active WhatsApp login/iu);
            commit.qrEligibility = { accountExists: true, accountEnabled: true, linked: false, connected: false, nativeIdleHandlerVerified: true, qrLoginStarted: false };
          }
          Object.assign(commit, { applied: true, preserved: true, nativeAccountExists: true,
            nativeConfigured: account.configured === true, nativeRunning: account.running === true, appliedRevisionVerified: true, otherAccountsPreserved: true,
            workerPolicyPreserved: true, pluginConfigPreserved: true });
          if (id === 'googlechat') {
            assert.equal(saved.config.channels.googlechat.accounts[generatedAccountId].appPrincipal, '100000000000000000001');
            const stopped = await service.run({ action: 'channel-stop', channel: id, accountId: generatedAccountId });
            assert.equal(stopped.ok, true);
            const resumed = await service.run({ action: 'channel-start', channel: id, accountId: generatedAccountId });
            assert.equal(resumed.ok, true);
            commit.localWebhookLifecycle = { stopped: true, restarted: true, authenticatedExternally: false };
          }
        }
        assert.equal(record.nativeConfigCommits.length, 4); assert.ok(record.nativeSchemaPaths.length > 0);
        record.checks.push('four generated account forms commit through native schema/config CAS and applied readback; all appear in native status; other accounts, plugins and worker policy preserved; native auto-start transport is denied by QA guard; WhatsApp remains unlinked without QR login');
      }
    })(), cancelled]);
  } catch (error) { record.failures.push(String(error.message ?? error).replaceAll(key, '[fixture]').replaceAll(supervisor.token ?? '<none>', '[gateway]').slice(0, 600)); }
  finally {
    aborted = true;
    if (installer && installer.exitCode === null && installer.signalCode === null) {
      spawnSync(path.join(process.env.SystemRoot, 'System32/taskkill.exe'), ['/PID', String(installer.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      await installerExit;
      record.cleanup.installerForced = true;
    }
    await nativeInstaller.stop(); await Promise.all(nativeInstallerExits);
    clearTimeout(timer); process.off('message', onMessage); service.clear(); await setup.disconnect(); await supervisor.stop(); await model.close();
    record.cleanup.installerExited = !installer || installer.exitCode !== null || installer.signalCode !== null;
    record.cleanup.offlineInstallersExited = (record.offlineInstalls ?? []).every(item => Object.hasOwn(item, 'exitCode'));
    record.cleanup.gatewayExited = !child || child.exitCode !== null || child.signalCode !== null;
    record.cleanup.modelClosed = true; record.childLogTail = logs.map(line => line.replaceAll(key, '[fixture]').replaceAll(supervisor.token ?? '<none>', '[gateway]'));
    record.modelRequests = { ...model.observation };
    const denials = path.join(root, 'network-denials.jsonl');
    record.networkGuard.blockedAttempts = existsSync(denials) ? readFileSync(denials, 'utf8').trim().split('\n').filter(Boolean).slice(priorDenialLines).map(line => JSON.parse(line)) : [];
    if (model.observation.requests !== 0) record.failures.push('Unexpected model request');
    if (record.wizardInstallFailures.length) record.failures.push('Native setup attempted an unnecessary or failed plugin install');
    if (!record.cleanup.gatewayExited) record.failures.push('Owned Gateway did not exit');
  }
  record.pass = !record.failures.length; process.send?.({ type: 'receipt', record }); return record.pass;
}
async function main() {
  if (value('--worker')) { process.exitCode = await worker(JSON.parse(value('--worker'))) ? 0 : 1; process.disconnect?.(); return; }
  const resources = path.resolve(value('--resources') ?? path.join(repo, 'apps/desktop/resources'));
  const managedDiscord = process.argv.includes('--managed-discord');
  const firstUse = !process.argv.includes('--legacy-repro') && !managedDiscord;
  if (value('--resume') && !firstUse) throw new Error('Checkpoint resume supports only the production offline route.');
  const bundle = path.resolve(value('--bundle') ?? path.join(repo, 'apps/desktop/resources/bundle', firstUse ? 'channel-installer' : 'channel-plugins'));
  const out = path.resolve(value('--out') ?? path.join(repo, 'artifacts/provider-channels-motion/native-channels-acceptance.json'));
  if (existsSync(out)) throw new Error('Preserve prior receipts; choose a fresh --out.');
  const native = fixtureRuntime(resources), tempParent = realpathSync.native(os.tmpdir());
  const pins = firstUse ? checkpointPins(native, bundle, path.join(repo, 'apps/desktop/electron/channel-plugin-installer.mjs')) : undefined;
  const resume = value('--resume') ? readCheckpoint(path.resolve(value('--resume')), { tempParent, resources, bundle, pins }) : undefined;
  const root = resume?.root ?? realpathSync.native(mkdtempSync(path.join(tempParent, 'aifb-channels-'))), timeoutMs = firstUse ? 1200000 : 330000, env = isolatedEnvironment(root);
  if (firstUse) env.OPENCLAW_CONFIG_PATH = path.join(env.OPENCLAW_STATE_DIR, 'openclaw.json');
  if (managedDiscord) env.PATH = `${path.dirname(native.node)};C:\\Program Files\\nodejs;${path.join(process.env.SystemRoot, 'System32')}`;
  for (const folder of [env.APPDATA, env.LOCALAPPDATA, env.TEMP, env.OPENCLAW_STATE_DIR, path.join(root, 'workspace')]) mkdirSync(folder, { recursive: true });
  const checkpoint = firstUse ? { kind: 'AIFB_CHANNEL_FIXTURE_CHECKPOINT', version: 1, nonce: resume?.nonce ?? randomUUID(), root, tempParent,
    configPath: env.OPENCLAW_CONFIG_PATH, resources, bundle, pins } : undefined;
  if (checkpoint && !resume) writeFileSync(path.join(root, CHECKPOINT_FILE), JSON.stringify(checkpoint));
  const leasePath = path.join(root, 'aifb-channel-fixture-active.lock'), lease = openSync(leasePath, 'wx');
  writeFileSync(lease, JSON.stringify({ parentPid: process.pid, nonce: checkpoint?.nonce })); closeSync(lease);
  let receipt; let forced = false;
  const child = spawn(native.node, [self, '--worker', JSON.stringify({ root, resources, bundle, timeoutMs, firstUse, managedDiscord, checkpoint, resume, diagnoseState: process.argv.includes('--diagnose-state') })], { cwd: root, env, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
  let stderr = ''; child.stderr.on('data', data => { stderr = (stderr + String(data)).slice(-1500); });
  child.on('message', message => {
    if (message?.type === 'receipt') receipt = message.record;
    else if (message?.type === 'progress') console.log(`[native channels] ${message.stage}`);
  });
  const timer = setTimeout(() => { if (child.connected) child.send({ type: 'stop' }); }, timeoutMs + 5000);
  const force = setTimeout(() => { if (child.exitCode === null) { forced = true; spawnSync(path.join(process.env.SystemRoot, 'System32/taskkill.exe'), ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }); } }, timeoutMs + 80000);
  const code = await new Promise(resolve => { child.once('error', () => resolve(-1)); child.once('exit', resolve); }); clearTimeout(timer); clearTimeout(force);
  receipt ??= { kind: 'AIFB_NATIVE_CHANNEL_FIXTURE', pass: false, failures: ['Worker exited without receipt'], stderr };
  receipt.workerExitCode = code; receipt.forcedCleanup = forced; receipt.pass &&= code === 0 && !forced;
  if (path.dirname(root) !== tempParent || !path.basename(root).startsWith('aifb-channels-')) throw new Error('Unsafe cleanup path');
  const ownedLease = JSON.parse(readFileSync(leasePath, 'utf8'));
  assert.equal(ownedLease.parentPid, process.pid); assert.equal(ownedLease.nonce, checkpoint?.nonce);
  const clean = receipt.cleanup?.gatewayExited && receipt.cleanup?.modelClosed && receipt.cleanup?.installerExited
    && receipt.cleanup?.offlineInstallersExited !== false && !forced && !receipt.cleanup.installerForced;
  if (clean) unlinkSync(leasePath); else receipt.activeLeaseRetained = true;
  const retainCheckpoint = firstUse && !receipt.pass && clean && receipt.checkpoint?.installPhaseVerified === true
    && receipt.wizardInstallFailures?.length === 0 && (resume || receipt.offlineInstalls?.length === 4 && receipt.offlineInstalls.every(item => item.exitCode === 0));
  if (retainCheckpoint) {
    assertOwnedCheckpointPaths(root, tempParent, env.OPENCLAW_CONFIG_PATH);
    receipt.tempProfileRemoved = false; receipt.profileRetained = true; receipt.retainedProfile = root;
    receipt.checkpointReason = 'Verified generated install profile retained after a later contract failure; exact receipt/nonce/pins required to resume.';
  } else if (clean) {
    if (checkpoint) assertOwnedCheckpointPaths(root, tempParent, env.OPENCLAW_CONFIG_PATH);
    try { rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 150 }); receipt.tempProfileRemoved = true; } catch { receipt.tempProfileRemoved = false; receipt.pass = false; }
  } else { receipt.tempProfileRemoved = false; receipt.profileRetained = true; receipt.retainedProfile = root; }
  mkdirSync(path.dirname(out), { recursive: true }); writeFileSync(out, `${JSON.stringify(receipt, null, 2)}\n`);
  if (retainCheckpoint && !resume) writeFileSync(path.join(root, CHECKPOINT_FILE), `${JSON.stringify({ ...receipt.checkpoint, receiptPath: out, receiptSha256: digest(out) }, null, 2)}\n`);
  console.log(`[native channels] ${receipt.pass ? 'PASS' : 'FAIL'}; evidence=${out}`); process.exitCode = receipt.pass ? 0 : 1;
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
