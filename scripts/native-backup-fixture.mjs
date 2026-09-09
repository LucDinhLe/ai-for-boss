/** Public OpenClaw backup/restore contract against a disposable profile, no account. */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fixtureConfig, isolatedEnvironment } from './native-chat-fixture.mjs';
import { GatewaySupervisor } from '../apps/desktop/electron/supervisor.mjs';
import { waitForGatewayListener } from '../apps/desktop/electron/startup-listener.mjs';
import { BackupService, nativeBackupRunner } from '../apps/desktop/electron/backup-service.mjs';
const root = await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()), 'aifb-recovery-'));
const packageRoot = process.argv[2];
if (!packageRoot) throw new Error('Pass the verified portable build directory');
const state = path.join(root, 'openclaw-state'); await fs.mkdir(state);
await fs.writeFile(path.join(state, 'sentinel.txt'), 'preserve fixture data');
const config = fixtureConfig(root, 1, 'generated-fixture-only');
config.agents.entries.fixture.agentDir = path.join(state, 'agents/fixture/agent');
config.agents.entries.fixture.workspace = path.join(state, 'workspace');
await fs.writeFile(path.join(state, 'openclaw.json'), JSON.stringify(config));
const environment = isolatedEnvironment(root);
for (const dir of [environment.APPDATA, environment.LOCALAPPDATA, environment.TEMP]) await fs.mkdir(dir, { recursive: true });
const service = new BackupService({ root, version: 'fixture', native: nativeBackupRunner({
  node: path.join(packageRoot, 'resources/runtime/node/node.exe'), entry: path.join(packageRoot, 'resources/node_modules/openclaw/openclaw.mjs'), state,
  environment }), protect: value => value, unprotect: value => value,
  exclusive: operation => operation(), pause: async () => {}, confirm: async () => true, onRestored: async () => {} });
const started = Date.now();
const supervisor = new GatewaySupervisor({ stateDirectory: state, configPath: path.join(state, 'openclaw.json'),
  nodeExecutable: path.join(packageRoot, 'resources/runtime/node/node.exe'), openclawEntry: path.join(packageRoot, 'resources/node_modules/openclaw/openclaw.mjs'), runDoctor: () => false,
  spawnChild: (command, args, options) => spawn(command, args, { ...options, windowsHide: true, env: { ...environment, OPENCLAW_STATE_DIR: state, OPENCLAW_CONFIG_PATH: path.join(state, 'openclaw.json') } }), logger: { info() {}, warn() {}, error() {} } });
try {
  const endpoint = await supervisor.start();
  assert.equal(await waitForGatewayListener({ port: endpoint.port, supervisor, timeoutMs: 180000 }), 'ready'); await supervisor.stop();
  assert.ok((await fs.readdir(state, { recursive: true })).some(name => name.endsWith('.sqlite')), 'Native SQLite state was created');
  await service.initialize(); await service.run({ action: 'data-backup' });
  console.log('Native create+verify completed', Date.now() - started);
  await fs.writeFile(path.join(state, 'sentinel.txt'), 'new version');
  await service.run({ action: 'data-restore', id: service.records[0].id });
  assert.equal(await fs.readFile(path.join(state, 'sentinel.txt'), 'utf8'), 'preserve fixture data');
  console.log(JSON.stringify({ nativeRecovery: true, elapsedMs: Date.now() - started, realAccounts: false }));
} finally { await service.stop(); await supervisor.stop(); await fs.rm(root, { recursive: true, force: true }); }
