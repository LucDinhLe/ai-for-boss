import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash, createPublicKey, verify } from "node:crypto";

import {
  clearDeviceToken,
  createDeviceIdentity,
  deriveDeviceId,
  loadDeviceToken,
  loadOrCreateDeviceIdentity,
  rawPublicKeyBase64Url,
  signDevicePayload,
  storeDeviceToken
} from "../../apps/desktop/electron/device-identity.mjs";

function tempDirectory() {
  return mkdtempSync(path.join(os.tmpdir(), "aifb-identity-"));
}

test("device id matches the Gateway derivation rule", () => {
  const identity = createDeviceIdentity();
  const raw = createPublicKey(identity.publicKeyPem).export({ format: "jwk" }).x;
  const expected = createHash("sha256").update(Buffer.from(raw, "base64url")).digest("hex");
  assert.equal(identity.deviceId, expected);
  assert.equal(deriveDeviceId(identity.publicKeyPem), expected);
  assert.equal(rawPublicKeyBase64Url(identity.publicKeyPem), raw);
});

test("identity is persisted once and reused", () => {
  const directory = tempDirectory();
  try {
    const first = loadOrCreateDeviceIdentity(directory);
    const second = loadOrCreateDeviceIdentity(directory);
    assert.equal(first.deviceId, second.deviceId);
    assert.equal(first.privateKeyPem, second.privateKeyPem);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("a tampered identity file is replaced instead of trusted", () => {
  const directory = tempDirectory();
  try {
    const original = loadOrCreateDeviceIdentity(directory);
    const file = path.join(directory, "device-identity.json");
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    parsed.deviceId = "0".repeat(64);
    writeFileSync(file, JSON.stringify(parsed));

    const replaced = loadOrCreateDeviceIdentity(directory);
    assert.notEqual(replaced.deviceId, "0".repeat(64));
    assert.notEqual(replaced.deviceId, original.deviceId);
    assert.equal(replaced.deviceId, deriveDeviceId(replaced.publicKeyPem));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("unreadable identity file does not throw", () => {
  const directory = tempDirectory();
  try {
    writeFileSync(path.join(directory, "device-identity.json"), "{ not json");
    const identity = loadOrCreateDeviceIdentity(directory);
    assert.equal(identity.deviceId, deriveDeviceId(identity.publicKeyPem));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("device signatures verify against the published public key", () => {
  const identity = createDeviceIdentity();
  const payload = "connect:challenge:1788584344953";
  const signature = signDevicePayload(identity.privateKeyPem, payload);
  assert.equal(
    verify(null, Buffer.from(payload), identity.publicKeyPem, Buffer.from(signature, "base64")),
    true
  );
});

test("device tokens round-trip per role and clear cleanly", () => {
  const directory = tempDirectory();
  try {
    assert.equal(loadDeviceToken(directory, "operator"), null);
    storeDeviceToken(directory, "operator", "token-1", ["operator.read"]);
    storeDeviceToken(directory, "node", "token-2", []);
    assert.deepEqual(loadDeviceToken(directory, "operator"), { token: "token-1", scopes: ["operator.read"] });
    clearDeviceToken(directory, "operator");
    assert.equal(loadDeviceToken(directory, "operator"), null);
    assert.equal(loadDeviceToken(directory, "node").token, "token-2");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
