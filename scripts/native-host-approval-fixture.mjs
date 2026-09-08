/** Real isolated Gateway and host exec; generated loopback model, no account. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdirSync, mkdtempSync, realpathSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { fixtureRuntime, isolatedEnvironment, fixtureConfig, MODEL_ID } from './native-chat-fixture.mjs';
const self = fileURLToPath(import.meta.url), sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function worker(root, resources) {
  assert.equal(process.env.OPENCLAW_HOME, root);
  const native = fixtureRuntime(resources), { GatewayClient } = await import(pathToFileURL(native.sdk));
  const { GatewaySupervisor } = await import('../apps/desktop/electron/supervisor.mjs');
  const { SetupChannel } = await import('../apps/desktop/electron/setup-channel.mjs');
  const { waitForGatewayListener } = await import('../apps/desktop/electron/startup-listener.mjs');
  let client, requests = 0, child, token = ''; const toolResults = [];
  const logs = [], remember = value => { logs.push(String(value)); if (logs.length > 12) logs.shift(); };
  const key = 'agent:fixture:aifb-host-approval';
  const script = path.join(root, 'workspace', 'approval-marker.cjs');
  writeFileSync(script, "require('node:fs').writeFileSync('approval-marker.txt', 'AIFB_APPROVED');\n");
  const command = `& '${native.node.replaceAll("'", "''")}' '${script.replaceAll("'", "''")}'`;
  const marker = path.join(root, 'workspace/approval-marker.txt');
  const server = createServer(async (request, response) => {
    let raw = ''; for await (const chunk of request) raw += chunk;
    const body = JSON.parse(raw); requests++;
    if (requests > 12) { response.writeHead(429); response.end(); return; }
    const lastUser = body.messages.findLastIndex(item => item.role === 'user');
    const done = body.messages.slice(lastUser + 1).some(item => item.role === 'tool');
    if (done) toolResults.push(body.messages.slice(lastUser + 1).filter(item => item.role === 'tool'));
    response.writeHead(200, { 'Content-Type': 'text/event-stream' });
    const delta = done ? { content: 'Fixture completed.' } : { tool_calls: [{ index: 0, id: 'call-' + randomUUID(), type: 'function',
      function: { name: 'exec', arguments: JSON.stringify({ command, workdir: path.join(root, 'workspace'), yieldMs: 1000 }) } }] };
    const identity = { id: 'chatcmpl-' + requests, object: 'chat.completion.chunk', created: Math.floor(Date.now() / 1000), model: MODEL_ID };
    response.end('data: ' + JSON.stringify({ ...identity, choices: [{ index: 0, delta, finish_reason: null }] }) + '\n\n'
      + 'data: ' + JSON.stringify({ ...identity, choices: [{ index: 0, delta: {}, finish_reason: done ? 'stop' : 'tool_calls' }] }) + '\n\ndata: [DONE]\n\n');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const config = fixtureConfig(root, server.address().port, 'fixture-only-' + randomUUID());
  config.agents.defaults.timeoutSeconds = 120;
  config.models.providers['aifb-fixture'].models[0].compat.supportsTools = true;
  config.models.providers['aifb-fixture'].models[0].maxTokens = 2048;
  writeFileSync(process.env.OPENCLAW_CONFIG_PATH, JSON.stringify(config));
  const supervisor = new GatewaySupervisor({ configPath: process.env.OPENCLAW_CONFIG_PATH, stateDirectory: process.env.OPENCLAW_STATE_DIR,
    nodeExecutable: native.node, openclawEntry: native.entry, runDoctor: () => false,
    logger: { info: remember, warn: remember, error: remember },
    spawnChild: (command, args, options) => (child = spawn(command, args, { ...options, cwd: root, windowsHide: true })) });
  const capture = value => { client = value; };
  class ObservedClient extends GatewayClient { constructor(options) { super(options); capture(this); } }
  const setup = new SetupChannel({ stateDirectory: process.env.OPENCLAW_STATE_DIR, configPath: process.env.OPENCLAW_CONFIG_PATH,
    Client: ObservedClient, hostApproval: true, logger: { warn: remember } });
  const receipt = { realAI: false, runtime: '2026.9.1', checks: [], failures: [] };
  try {
    const endpoint = await supervisor.start(); token = endpoint.token;
    assert.equal(await waitForGatewayListener({ port: endpoint.port, supervisor, timeoutMs: 240000 }), 'ready');
    setup.connect({ url: `ws://127.0.0.1:${endpoint.port}`, token });
    const deadline = Date.now() + 60000; while (!setup.connected && Date.now() < deadline) await sleep(100);
    assert.equal(setup.connected, true); supervisor.markReady();
    await setup.authorizeWorker();
    await client.request('sessions.create', { key, permissionMode: 'read-only' });
    for (const decision of ['deny', 'allow-once', 'deny']) {
      if (existsSync(marker)) rmSync(marker);
      const policy = await setup.authorizeWorker(key); assert.equal(policy.approval, 'every-command');
      const sending = client.request('sessions.send', { key, message: 'Execute fixture command ' + randomUUID(), idempotencyKey: randomUUID() });
      sending.catch(() => {});
      let row; const until = Date.now() + 50000;
      while (!row && Date.now() < until) { row = (await setup.manage({ action: 'approval-list' })).approvals[0]; if (!row) await sleep(200); }
      assert.ok(row, 'Native exec must request approval'); assert.equal(existsSync(marker), false, 'No command before approval');
      assert.ok(row.command.includes('approval-marker.cjs'));
      await assert.rejects(setup.manage({ action: 'approval-resolve', id: row.id, revision: row.revision, decision: 'allow-always' }));
      const resolved = await setup.manage({ action: 'approval-resolve', id: row.id, revision: row.revision, decision });
      const sent = await sending;
      await client.request('agent.wait', { runId: sent.runId, timeoutMs: 60000 }, { timeoutMs: 65000 });
      assert.equal(existsSync(marker), decision === 'allow-once');
      await assert.rejects(setup.manage({ action: 'approval-resolve', id: row.id, revision: row.revision, decision: 'allow-once' }));
      receipt.checks.push({ decision, status: resolved.status, markerWritten: existsSync(marker), noExecutionBeforeApproval: true, replayDenied: true });
    }
  } catch (error) { receipt.failures.push(error.message); receipt.toolResults = toolResults; receipt.logs = logs.map(line => token ? line.replaceAll(token, '[REDACTED]') : line); }
  finally { await setup.disconnect(); await supervisor.stop(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    receipt.gatewayExited = !child || child.exitCode !== null || child.signalCode !== null; receipt.providerRequests = requests; }
  receipt.pass = receipt.failures.length === 0 && receipt.gatewayExited;
  process.send(receipt);
}
async function main() {
  if (process.argv[2] === '--worker') return worker(process.argv[3], process.argv[4]);
  const resources = process.argv[2], output = process.argv[3]; if (!resources || !output) throw new Error('Expected resources and output');
  const root = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'aifb-host-approval-')));
  for (const name of ['state', 'workspace', 'tmp', 'appdata', 'localappdata']) mkdirSync(path.join(root, name));
  const native = fixtureRuntime(resources);
  const result = await new Promise((resolve, reject) => {
    const child = spawn(native.node, [self, '--worker', root, resources], { env: isolatedEnvironment(root), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
    let receipt, errors = ''; child.stderr.on('data', chunk => { errors += chunk; }); child.stdout.resume();
    child.on('message', value => { receipt = value; }); child.on('error', reject);
    child.on('exit', code => receipt ? resolve(receipt) : reject(new Error('Fixture exit ' + code + ': ' + errors.slice(-2000))));
  });
  assert.ok(root.startsWith(realpathSync(os.tmpdir()) + path.sep));
  if (result.gatewayExited) rmSync(root, { recursive: true });
  mkdirSync(path.dirname(output), { recursive: true }); writeFileSync(output, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result)); process.exitCode = result.pass ? 0 : 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
