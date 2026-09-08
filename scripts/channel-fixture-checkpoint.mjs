/** QA-only ownership checks. Never reads a native config or managed install database. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';

export const CHECKPOINT_FILE = 'aifb-channel-fixture-owner.json';
export const fileDigest = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const equalPath = (a, b) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
export function assertOwnedCheckpointPaths(root, tempParent, configPath) {
  assert.ok(equalPath(path.dirname(root), tempParent) && path.basename(root).startsWith('aifb-channels-'), 'Checkpoint must be an exact generated temp child');
  assert.ok(equalPath(configPath, path.join(root, 'state', 'openclaw.json')), 'Checkpoint config path must be fixture-owned');
  for (const target of [tempParent, root, path.join(root, CHECKPOINT_FILE), path.join(root, 'state'), configPath]) {
    assert.equal(lstatSync(target).isSymbolicLink(), false, 'Checkpoint identity paths must not be links');
    assert.ok(equalPath(realpathSync.native(target), target), 'Checkpoint identity paths must not traverse a reparse target');
  }
}
export function checkpointPins(native, bundle, installerPath) {
  return { nodeSha256: fileDigest(native.node), coreEntrySha256: fileDigest(native.entry),
    coreManifestSha256: fileDigest(path.join(path.dirname(native.entry), 'package.json')),
    sdkEntrySha256: fileDigest(native.sdk), bundleManifestSha256: fileDigest(path.join(bundle, 'channel-installer.json')),
    installerSha256: fileDigest(installerPath) };
}
export function verifyCheckpointReceipt(receipt, marker, { receiptPath, receiptSha256, tempParent, resources, bundle, pins }) {
  assert.equal(receipt.kind, 'AIFB_NATIVE_CHANNEL_FIXTURE'); assert.equal(receipt.pass, false);
  assert.equal(receipt.profileRetained, true); assert.equal(receipt.tempProfileRemoved, false);
  assert.equal(receipt.forcedCleanup, false); assert.equal(receipt.workerExitCode, 1);
  for (const field of ['installerExited', 'offlineInstallersExited', 'gatewayExited', 'modelClosed']) assert.equal(receipt.cleanup?.[field], true, 'Checkpoint requires clean owned process exit');
  assert.notEqual(receipt.cleanup.installerForced, true);
  assert.equal(marker.kind, 'AIFB_CHANNEL_FIXTURE_CHECKPOINT'); assert.equal(marker.version, 1);
  assert.match(marker.nonce, /^[a-f\d-]{36}$/u); assert.equal(marker.nonce, receipt.checkpoint?.nonce);
  assert.equal(marker.receiptSha256, receiptSha256); assert.ok(equalPath(marker.receiptPath, receiptPath));
  assert.ok(equalPath(marker.root, receipt.retainedProfile)); assert.ok(equalPath(marker.tempParent, tempParent));
  assert.ok(equalPath(marker.configPath, path.join(marker.root, 'state', 'openclaw.json')));
  assert.ok(equalPath(marker.resources, resources)); assert.ok(equalPath(marker.bundle, bundle));
  assert.equal(receipt.checkpoint.installPhaseVerified, true);
  assert.deepEqual(marker.pins, pins); assert.deepEqual(receipt.checkpoint.pins, pins);
  assert.ok(Number.isInteger(marker.modelPort) && marker.modelPort > 0 && marker.modelPort < 65536);
  assert.equal(marker.modelPort, receipt.checkpoint.modelPort);
  assert.equal(receipt.offlineInstalls?.length, 4); assert.ok(receipt.offlineInstalls.every(item => item.exitCode === 0));
  assert.equal(receipt.nativeSources?.length, 4); assert.equal(receipt.wizardInstallFailures?.length, 0);
  return { ...receipt.checkpoint, root: marker.root, configPath: marker.configPath,
    installReceipt: { path: path.resolve(receiptPath), sha256: receiptSha256 }, originalRecordedAt: receipt.recordedAt };
}
export function readCheckpoint(receiptPath, options) {
  const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
  const root = receipt.retainedProfile;
  assert.equal(typeof root, 'string');
  const configPath = path.join(root, 'state', 'openclaw.json');
  assertOwnedCheckpointPaths(root, options.tempParent, configPath);
  const marker = JSON.parse(readFileSync(path.join(root, CHECKPOINT_FILE), 'utf8'));
  return verifyCheckpointReceipt(receipt, marker, { ...options, receiptPath, receiptSha256: fileDigest(receiptPath) });
}
