/** Explicit normal packaged-app trial. Root uses Sky for every functional UI action.
 * node scripts/normal-packaged-ui-fixture.mjs --app <beta22 exe> --out <new receipt.json>
 * node scripts/normal-packaged-ui-fixture.mjs --mark readyToSend|enterSent|answerVisible --out <receipt.json>
 * node scripts/normal-packaged-ui-fixture.mjs --finish --out <receipt.json>
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractFile } from '@electron/asar';
import { fixtureRuntime, isolatedEnvironment, fixtureConfig, MODEL_ID, MODEL_REF, COMPLETE_PROMPT, COMPLETE_REPLY, classifyFixtureRequest } from './native-chat-fixture.mjs';
import { mergeProcessObservations, parseProcessSnapshot, reconcileProcessSnapshot, sameProcessIdentity } from './fixture-process-metadata.mjs';

const self = fileURLToPath(import.meta.url), repo = path.resolve(path.dirname(self), '..');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const value = flag => { const index = process.argv.indexOf(flag); return index < 0 ? undefined : process.argv[index + 1]; };
const writeJson = (file, data) => { const next = `${file}.${randomUUID()}.tmp`; writeFileSync(next, `${JSON.stringify(data, null, 2)}\n`, { flag: 'wx' }); renameSync(next, file); };

async function powershell(code) {
  const executable = path.join(process.env.SystemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const child = spawn(executable, ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(`$ErrorActionPreference = 'Stop'; ${code}`, 'utf16le').toString('base64')], { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
  let output = '', timedOut = false, truncated = false;
  child.stdout.on('data', chunk => { if (output.length + chunk.length <= 1000000) output += String(chunk); else truncated = true; });
  const timer = setTimeout(() => { timedOut = true; child.kill(); }, 10000);
  let result;
  try { result = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', (code, signal) => resolve({ code, signal })); }); }
  finally { clearTimeout(timer); }
  assert.equal(timedOut, false, 'Process metadata command timed out');
  assert.equal(truncated, false, 'Process metadata command output exceeded its bound');
  assert.equal(result.code, 0, `Process metadata command failed (${result.code ?? result.signal})`);
  return output.trim();
}

// Process metadata only, never command lines or core state. Root PID comes from this runner's spawn.
async function descendants(pid, observed = []) {
  assert.ok(Number.isSafeInteger(pid) && pid > 0);
  const seeds = [...new Set([pid, ...observed.map(item => item.pid)])];
  assert.ok(seeds.every(id => Number.isSafeInteger(id) && id > 0));
  const result = await powershell(`$all = @(Get-CimInstance Win32_Process); $ids = [System.Collections.Generic.HashSet[int]]::new(); foreach ($seed in @(${seeds.join(',')})) { [void]$ids.Add([int]$seed) }; do { $added = $false; foreach ($item in $all) { if ($ids.Contains([int]$item.ParentProcessId) -and $ids.Add([int]$item.ProcessId)) { $added = $true } } } while ($added); $rows = @($all | Where-Object { $ids.Contains([int]$_.ProcessId) } | ForEach-Object { [pscustomobject]@{ pid=[int]$_.ProcessId; parent=[int]$_.ParentProcessId; executable=$_.ExecutablePath; created=$_.CreationDate.ToUniversalTime().ToString('o') } }); [pscustomobject]@{ ok=$true; processes=$rows } | ConvertTo-Json -Compress -Depth 4`);
  return parseProcessSnapshot(result);
}

async function closeOwnedApp(child, executable, startedAt, cleanup, observations) {
  const rootPid = child.pid;
  if (!rootPid) return;
  // Root closes the normal window via Sky. Finishing this runner never sends UI messages.
  const naturalExitDeadline = Date.now() + 3000;
  while (child.exitCode === null && child.signalCode === null && Date.now() < naturalExitDeadline) await wait(100);
  const before = await descendants(rootPid);
  const observed = mergeProcessObservations(observations, before);
  const ownRoot = observations.find(item => item.pid === rootPid && item.parent === process.pid
    && path.resolve(item.executable ?? '').toLowerCase() === executable.toLowerCase() && Date.parse(item.created) >= startedAt - 2000);
  if (!ownRoot) throw new Error('Initial spawned process identity was not captured; refusing cleanup');
  const currentRoot = before.find(item => item.pid === rootPid);
  if (currentRoot && !sameProcessIdentity(ownRoot, currentRoot)) throw new Error('Spawned PID identity changed; refusing cleanup');
  const packageRoot = path.dirname(executable).toLowerCase() + path.sep;
  // New rows are eligible for termination only while the exact spawned root is
  // present. Seeded/direct orphan checks below are evidence, never ownership grants.
  const ownershipEvidence = currentRoot ? observed : observations;
  const owned = ownershipEvidence.filter(item => Date.parse(item.created) >= startedAt - 2000
    && path.resolve(item.executable ?? '').toLowerCase().startsWith(packageRoot));
  cleanup.observedProcesses = observed;
  cleanup.scope = 'Sampled process identities and their currently discoverable descendants; processes never sampled cannot be retrospectively excluded.';
  cleanup.completeOrphanCleanupProven = false;
  cleanup.ownedPidsObserved = owned.map(item => item.pid);
  cleanup.unverifiedPids = observed.filter(item => !owned.includes(item)).map(item => item.pid);
  const remaining = await descendants(rootPid, observed);
  const verified = remaining.filter(item => {
    const prior = owned.find(candidate => sameProcessIdentity(candidate, item));
    return prior && prior.executable === item.executable;
  });
  cleanup.forcedPids = [];
  for (const item of verified.reverse()) {
    // Exact previously observed identity only; never kill by image name or search arbitrary profiles.
    const current = await powershell(`$p = Get-CimInstance Win32_Process -Filter 'ProcessId = ${item.pid}'; $stopped = $false; if ($p -and $p.CreationDate.ToUniversalTime().ToString('o') -eq '${item.created}') { Stop-Process -Id ${item.pid} -Force -ErrorAction Stop; $stopped = $true }; [pscustomobject]@{ ok=$true; stopped=$stopped } | ConvertTo-Json -Compress`);
    const verdict = JSON.parse(current); assert.equal(verdict.ok, true);
    if (verdict.stopped) cleanup.forcedPids.push(item.pid);
  }
  await wait(250);
  const after = await descendants(rootPid, observed);
  const reconciled = reconcileProcessSnapshot(observed, after);
  cleanup.finalProcesses = after;
  cleanup.remainingPids = reconciled.remainingPids;
  cleanup.newlyObservedPidsAtFinalCheck = reconciled.newlyObserved.map(item => item.pid);
  cleanup.observedProcessChecksComplete = true;
  cleanup.appExitCode = child.exitCode; cleanup.appSignal = child.signalCode;
  cleanup.forced = cleanup.forcedPids.length > 0;
  cleanup.gracefulExit = child.exitCode === 0 && cleanup.forcedPids.length === 0 && cleanup.remainingPids.length === 0;
}

async function main() {
  assert.equal(process.platform, 'win32', 'This trial requires Windows');
  const output = path.resolve(value('--out') ?? path.join(repo, 'artifacts/provider-conversation-recovery/normal-packaged-beta22.json'));
  if (value('--mark') || process.argv.includes('--finish')) {
    const status = JSON.parse(readFileSync(output, 'utf8'));
    assert.equal(status.kind, 'AIFB_NORMAL_PACKAGED_UI_FIXTURE'); assert.equal(status.running, true, 'Trial is not active');
    const control = JSON.parse(readFileSync(status.controlFile, 'utf8'));
    if (process.argv.includes('--finish')) control.finish = true;
    else {
      const mark = value('--mark'); assert.ok(['readyToSend', 'enterSent', 'answerVisible'].includes(mark));
      control.observations[mark] = { observedAt: new Date().toISOString(), source: 'Root manual Sky observation', ...(value('--evidence') ? { evidence: value('--evidence') } : {}) };
    }
    writeJson(status.controlFile, control); console.log(`Normal UI trial: ${value('--mark') ?? 'finish'} recorded.`); return;
  }
  assert.ok(value('--app'), '--app must name the exact newly packaged beta22 executable');
  assert.equal(existsSync(output), false, 'Use a new receipt path; prior evidence is immutable');
  const executable = realpathSync.native(path.resolve(value('--app'))), resources = path.join(path.dirname(executable), 'resources');
  const pkg = JSON.parse(extractFile(path.join(resources, 'app.asar'), 'package.json').toString());
  assert.equal(pkg.version, '0.0.5-beta.22', 'Only the explicitly requested beta22 package is allowed');
  const native = fixtureRuntime(resources);
  const parent = realpathSync.native(os.tmpdir()), root = realpathSync.native(mkdtempSync(path.join(parent, 'aifb-normal-beta22-')));
  const userData = path.join(root, 'profile'), stateDirectory = path.join(userData, 'openclaw-state');
  const controlFile = path.join(root, 'trial-control.json'), apiKey = `fixture-only-${randomUUID()}`;
  const record = { kind: 'AIFB_NORMAL_PACKAGED_UI_FIXTURE', version: pkg.version, running: true, recordedAt: new Date().toISOString(), executable,
    resources, selectedBundleLayout: native.layout, isolatedHome: root, userData, controlFile, normalApp: true, fakeIpc: false, smokeMode: false, securityFlags: [], realAI: false,
    uiAutomation: 'Root Sky only. Runner never interacts with controls or sends window messages; finish/deadline only terminates verified owned processes if necessary.',
    prompt: COMPLETE_PROMPT, reply: COMPLETE_REPLY, configuredModel: MODEL_REF, configuredExternalModelRoutes: 0,
    workerPolicy: 'Production packaged main and host policy; no override. Generated config tools deny-all; model rejects any advertised tool/function.',
    networkEvidence: 'One generated loopback model route; no packet monitoring or real-account access.',
    observations: {}, model: { requests: 0, completed: 0, rejected: 0, toolsAdvertised: [], requestAt: null, responseAt: null }, cleanup: {}, failures: [] };
  let appChild, startedAt = 0, closing = false, exitReason = 'app-exit', processObservations = [];
  const publish = () => writeJson(output, record);
  const server = createServer(async (request, response) => {
    try {
      record.model.requests++; record.model.requestAt ??= new Date().toISOString();
      assert.equal(closing, false); assert.equal(record.model.requests, 1, 'Only one manually submitted prompt is permitted');
      let raw = ''; for await (const chunk of request) { raw += String(chunk); assert.ok(raw.length <= 1048576); }
      const body = JSON.parse(raw); assert.equal(classifyFixtureRequest(request, body, apiKey), 'complete');
      record.model.toolsAdvertised.push(body.tools?.length ?? 0); publish();
      response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      const identity = { id: 'chatcmpl-normal-packaged-fixture', object: 'chat.completion.chunk', created: Math.floor(Date.now() / 1000), model: MODEL_ID };
      const frame = (delta, finish_reason = null) => response.write(`data: ${JSON.stringify({ ...identity, choices: [{ index: 0, delta, finish_reason }] })}\n\n`);
      frame({ role: 'assistant', content: COMPLETE_REPLY.slice(0, 25) }); await wait(100);
      if (response.destroyed) throw new Error('Response cancelled');
      frame({ content: COMPLETE_REPLY.slice(25) }); frame({}, 'stop');
      response.write(`data: ${JSON.stringify({ ...identity, choices: [], usage: { prompt_tokens: 24, completion_tokens: 12, total_tokens: 36 } })}\n\n`);
      response.end('data: [DONE]\n\n'); record.model.completed++; record.model.responseAt = new Date().toISOString(); publish();
    } catch {
      record.model.rejected++; if (!response.headersSent) response.writeHead(400, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ error: { message: 'Generated fixture rejected unexpected request' } })); publish();
    }
  });
  const onSignal = () => { closing = true; exitReason = 'runner-signal'; };
  process.on('SIGINT', onSignal); process.on('SIGTERM', onSignal);
  try {
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const env = isolatedEnvironment(root);
    Object.assign(env, { OPENCLAW_STATE_DIR: stateDirectory, OPENCLAW_CONFIG_PATH: path.join(stateDirectory, 'openclaw.json') });
    for (const folder of [env.APPDATA, env.LOCALAPPDATA, env.TEMP, stateDirectory, path.join(root, 'workspace')]) mkdirSync(folder, { recursive: true });
    const config = fixtureConfig(root, server.address().port, apiKey);
    config.agents.entries.fixture.agentDir = path.join(stateDirectory, 'agents', 'fixture', 'agent');
    writeJson(env.OPENCLAW_CONFIG_PATH, config); writeJson(controlFile, { finish: false, observations: {} });
    mkdirSync(path.dirname(output), { recursive: true });
    const timeoutMs = Number(value('--timeout-ms') ?? 540000); assert.ok(Number.isInteger(timeoutMs) && timeoutMs >= 60000 && timeoutMs <= 600000);
    startedAt = Date.now(); record.startedAt = new Date(startedAt).toISOString(); record.deadlineAt = new Date(startedAt + timeoutMs).toISOString();
    appChild = spawn(executable, [`--user-data-dir=${userData}`], { cwd: root, env, windowsHide: false, stdio: ['ignore', 'ignore', 'ignore'] });
    appChild.once('error', error => { record.failures.push(`Application spawn failed: ${error.code ?? 'unknown'}`); closing = true; });
    record.appPid = appChild.pid; publish(); console.log(JSON.stringify({ receipt: output, pid: appChild.pid, controlFile, prompt: COMPLETE_PROMPT, reply: COMPLETE_REPLY, deadlineAt: record.deadlineAt }));
    let nextProcessSample = 0;
    while (!closing && appChild.exitCode === null && appChild.signalCode === null) {
      if (Date.now() >= nextProcessSample) {
        const sample = await descendants(appChild.pid);
        const currentRoot = sample.find(item => item.pid === appChild.pid);
        const initialRoot = processObservations.find(item => item.pid === appChild.pid);
        if (initialRoot && currentRoot && !sameProcessIdentity(initialRoot, currentRoot)) throw new Error('Spawned process identity changed during observation');
        if (!initialRoot && (!currentRoot || currentRoot.parent !== process.pid
          || path.resolve(currentRoot.executable ?? '').toLowerCase() !== executable.toLowerCase()
          || Date.parse(currentRoot.created) < startedAt - 2000)) throw new Error('Could not capture initial spawned process identity');
        // A root-less sample may contain new orphan descendants. Keep those for
        // final reconciliation, but do not turn their metadata into kill authority.
        if (currentRoot) processObservations = mergeProcessObservations(processObservations, sample);
        record.cleanup.processSamples = (record.cleanup.processSamples ?? 0) + 1;
        nextProcessSample = Date.now() + 5000;
      }
      const control = JSON.parse(readFileSync(controlFile, 'utf8'));
      if (JSON.stringify(control.observations) !== JSON.stringify(record.observations)) { record.observations = control.observations; publish(); }
      if (control.finish) { exitReason = 'explicit-finish'; break; }
      if (Date.now() - startedAt >= timeoutMs) { exitReason = 'deadline'; record.failures.push('Manual normal-app trial reached its deadline'); break; }
      await wait(200);
    }
  } catch (error) { record.failures.push(String(error?.message ?? error).replaceAll(apiKey, '[fixture-key]').slice(0, 500)); }
  finally {
    closing = true; process.off('SIGINT', onSignal); process.off('SIGTERM', onSignal);
    try { if (appChild) await closeOwnedApp(appChild, executable, startedAt, record.cleanup, processObservations); }
    catch (error) { record.failures.push(`Owned process cleanup failed: ${error.code ?? error.message}`); }
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); record.cleanup.modelServerClosed = true;
    if (existsSync(controlFile)) record.observations = JSON.parse(readFileSync(controlFile, 'utf8')).observations;
    record.running = false; record.exitReason = exitReason; record.endedAt = new Date().toISOString();
    for (const item of Object.values(record.observations)) item.observedElapsedMs = Date.parse(item.observedAt) - startedAt;
    record.timingScope = 'Manual Sky observation timestamps are upper bounds including observation/input time. Model HTTP timestamps prove transport, not renderer readiness.';
    if (!record.cleanup.gracefulExit) record.failures.push('Normal application did not prove a clean graceful exit');
    if (!['readyToSend', 'enterSent', 'answerVisible'].every(name => record.observations[name])) record.failures.push('Required manual Sky observations are incomplete');
    if (record.model.requests !== 1 || record.model.completed !== 1 || record.model.rejected) record.failures.push('Expected exactly one completed generated model turn');
    assert.equal(path.dirname(root), parent); assert.ok(path.basename(root).startsWith('aifb-normal-beta22-'));
    if (record.cleanup.observedProcessChecksComplete === true && record.cleanup.remainingPids?.length === 0) {
      try { rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 }); record.cleanup.tempProfileRemoved = true; }
      catch { record.cleanup.tempProfileRemoved = false; record.failures.push('Owned temporary profile could not be removed'); }
    } else { record.cleanup.tempProfileRemoved = false; record.failures.push('Temporary profile retained because descendant exit was not verified'); }
    record.pass = record.failures.length === 0; mkdirSync(path.dirname(output), { recursive: true }); publish();
  }
  console.log(`Normal packaged trial ${record.pass ? 'PASS' : 'INCOMPLETE'}: ${output}`); process.exitCode = record.pass ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === self) main().catch(error => { console.error(error.message); process.exitCode = 1; });
