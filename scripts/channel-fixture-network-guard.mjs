/** QA only: deny non-loopback TCP, DNS and UDP before native channel code runs.
 * This never ships in the application and never changes an OpenClaw function.
 * Native connection attempts may fail; they are not authenticated-channel proof.
 */
import net from 'node:net';
import dns from 'node:dns';
import dgram from 'node:dgram';
import path from 'node:path';
import { appendFileSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
const root = process.env.OPENCLAW_HOME;
if (process.env.AIFB_NATIVE_CHAT_FIXTURE !== '1' || !path.basename(root ?? '').startsWith('aifb-channels-')) throw new Error('Generated channel fixture required');
const loopback = host => host === undefined || host === null || ['localhost', '127.0.0.1', '::1', '[::1]'].includes(String(host).toLowerCase());
function denied(kind, host) {
  appendFileSync(path.join(root, 'network-denials.jsonl'), JSON.stringify({ kind, host: String(host).slice(0, 250) }) + '\n');
  const error = new Error('Generated channel fixture blocks external network'); error.code = 'AIFB_NETWORK_DENIED'; return error;
}
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const input = Array.isArray(args[0]) ? args[0] : args;
  const first = input[0], host = first && typeof first === 'object' ? first.host : typeof input[1] === 'string' ? input[1] : undefined;
  if (!loopback(host)) { const error = denied('tcp', host); queueMicrotask(() => this.destroy(error)); return this; }
  return connect.apply(this, args);
};
const lookup = dns.lookup;
dns.lookup = function (host, ...args) {
  if (loopback(host)) return lookup.call(this, host, ...args);
  const callback = args.at(-1), error = denied('dns', host);
  if (typeof callback !== 'function') throw error;
  queueMicrotask(() => callback(error));
};
const lookupPromise = dns.promises.lookup;
dns.promises.lookup = async function (host, ...args) {
  if (!loopback(host)) throw denied('dns-promise', host);
  return lookupPromise.call(this, host, ...args);
};
for (const target of [dns, dns.Resolver.prototype]) {
  for (const key of Object.getOwnPropertyNames(target).filter(key => /^(resolve|reverse)/u.test(key) && typeof target[key] === 'function')) {
    target[key] = function (host, ...args) {
      const error = denied('dns-resolve', host), callback = args.at(-1);
      if (typeof callback !== 'function') throw error;
      queueMicrotask(() => callback(error));
    };
  }
}
for (const target of [dns.promises, dns.promises.Resolver.prototype]) {
  for (const key of Object.getOwnPropertyNames(target).filter(key => /^(resolve|reverse)/u.test(key) && typeof target[key] === 'function')) {
    target[key] = async function (host) { throw denied('dns-resolve-promise', host); };
  }
}
// Channel providers have no reason to use UDP in this generated fixture.
dgram.Socket.prototype.send = function () { throw denied('udp', 'all'); };
syncBuiltinESMExports();
