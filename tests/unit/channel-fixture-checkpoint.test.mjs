import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyCheckpointReceipt } from '../../scripts/channel-fixture-checkpoint.mjs';

function sample() {
  const pins = { nodeSha256: 'node', coreEntrySha256: 'core', bundleManifestSha256: 'bundle', installerSha256: 'installer' };
  const checkpoint = { nonce: 'aafafafa-0000-1111-2222-333333333333', installPhaseVerified: true, modelPort: 32001, pins };
  const receipt = { kind: 'AIFB_NATIVE_CHANNEL_FIXTURE', pass: false, profileRetained: true, tempProfileRemoved: false,
    forcedCleanup: false, workerExitCode: 1, retainedProfile: 'C:/Temp/aifb-channels-owned', checkpoint,
    cleanup: { installerExited: true, offlineInstallersExited: true, gatewayExited: true, modelClosed: true },
    offlineInstalls: Array.from({ length: 4 }, () => ({ exitCode: 0 })), nativeSources: [1, 2, 3, 4], wizardInstallFailures: [] };
  const marker = { kind: 'AIFB_CHANNEL_FIXTURE_CHECKPOINT', version: 1, nonce: checkpoint.nonce, pins, modelPort: checkpoint.modelPort,
    root: receipt.retainedProfile, configPath: `${receipt.retainedProfile}/state/openclaw.json`, tempParent: 'C:/Temp',
    resources: 'C:/package/resources', bundle: 'C:/bundle', receiptPath: 'C:/evidence/first.json', receiptSha256: 'receipt' };
  const options = { receiptPath: marker.receiptPath, receiptSha256: marker.receiptSha256, tempParent: marker.tempParent,
    resources: marker.resources, bundle: marker.bundle, pins };
  return { receipt, marker, options };
}
test('checkpoint joins original exact failed receipt and installer pins without copying install counts into a new run', () => {
  const { receipt, marker, options } = sample(); const value = verifyCheckpointReceipt(receipt, marker, options);
  assert.equal(value.installReceipt.sha256, 'receipt'); assert.equal(value.modelPort, 32001); assert.equal(value.offlineInstalls, undefined);
});
test('checkpoint refuses changed receipt, nonce, runtime, cleanup or partial install proof', () => {
  for (const mutate of [s => { s.options.receiptSha256 = 'changed'; }, s => { s.marker.nonce = '00000000-0000-1111-2222-333333333333'; },
    s => { s.options.pins = { ...s.options.pins, nodeSha256: 'changed' }; }, s => { s.receipt.cleanup.gatewayExited = false; },
    s => { s.receipt.forcedCleanup = true; }, s => { s.receipt.offlineInstalls[3].exitCode = 1; }, s => { s.receipt.wizardInstallFailures.push('install failed'); },
    s => { s.receipt.checkpoint.installPhaseVerified = false; }]) {
    const s = sample(); mutate(s); assert.throws(() => verifyCheckpointReceipt(s.receipt, s.marker, s.options));
  }
});
