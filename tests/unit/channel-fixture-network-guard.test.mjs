import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

test('generated channel transport permits loopback and blocks external TCP, DNS, UDP before network access', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'aifb-channels-'));
  try {
    const code = `
      import net from 'node:net'; import dns from 'node:dns'; import dgram from 'node:dgram'; import assert from 'node:assert/strict';
      const server = net.createServer(socket => socket.end()); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
      await new Promise((resolve, reject) => net.connect({host:'127.0.0.1',port:server.address().port}).on('close',resolve).on('error',reject));
      await new Promise(resolve => server.close(resolve));
      const error = await new Promise(resolve => net.connect({host:'example.invalid',port:443}).once('error',resolve));
      assert.equal(error.code,'AIFB_NETWORK_DENIED');
      await assert.rejects(dns.promises.lookup('example.invalid'), {code:'AIFB_NETWORK_DENIED'});
      await assert.rejects(dns.promises.resolve4('example.invalid'), {code:'AIFB_NETWORK_DENIED'});
      await new Promise(resolve => dns.lookup('example.invalid', e => {assert.equal(e.code,'AIFB_NETWORK_DENIED');resolve();}));
      const udp=dgram.createSocket('udp4'); assert.throws(()=>udp.send('x',53,'192.0.2.1'), {code:'AIFB_NETWORK_DENIED'}); udp.close();
    `;
    const child = spawnSync(process.execPath, ['--import', pathToFileURL(path.resolve('scripts/channel-fixture-network-guard.mjs')).href, '--input-type=module', '--eval', code], {
      env: { SystemRoot: process.env.SystemRoot, OPENCLAW_HOME: root, AIFB_NATIVE_CHAT_FIXTURE: '1' }, encoding: 'utf8', windowsHide: true, timeout: 15000
    });
    assert.equal(child.status, 0, child.stderr);
    const rows = readFileSync(path.join(root, 'network-denials.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line));
    assert.deepEqual(rows.map(row => row.kind), ['tcp', 'dns-promise', 'dns-resolve-promise', 'dns', 'udp']);
  } finally {
    assert.equal(path.dirname(root), os.tmpdir()); assert.ok(path.basename(root).startsWith('aifb-channels-'));
    rmSync(root, { recursive: true, force: true });
  }
});
