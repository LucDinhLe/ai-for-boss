import { createHash, generateKeyPairSync, sign as signPayload, createPublicKey } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync, chmodSync } from "node:fs";
import path from "node:path";

const IDENTITY_FILE = "device-identity.json";

/**
 * The Gateway derives the device id from the raw Ed25519 public key
 * (`sha256(rawPublicKeyBytes)` in hex) and rejects any connect frame whose
 * declared id does not match. Deriving it the same way here keeps the host
 * the single owner of the identity without guessing at the wire contract.
 */
export function deriveDeviceId(publicKeyPem) {
  const raw = createPublicKey(publicKeyPem).export({ format: "jwk" }).x;
  return createHash("sha256").update(Buffer.from(raw, "base64url")).digest("hex");
}

export function rawPublicKeyBase64Url(publicKeyPem) {
  return createPublicKey(publicKeyPem).export({ format: "jwk" }).x;
}

export function signDevicePayload(privateKeyPem, payload) {
  return signPayload(null, Buffer.from(payload), privateKeyPem).toString("base64");
}

export function createDeviceIdentity() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();
  return { deviceId: deriveDeviceId(publicKeyPem), privateKeyPem, publicKeyPem };
}

function isUsableIdentity(value) {
  if (!value || typeof value !== "object") return false;
  const { deviceId, privateKeyPem, publicKeyPem } = value;
  if (typeof deviceId !== "string" || typeof privateKeyPem !== "string") return false;
  if (typeof publicKeyPem !== "string") return false;
  try {
    return deriveDeviceId(publicKeyPem) === deviceId;
  } catch {
    return false;
  }
}

/**
 * Loads the persisted identity, replacing it when the file is missing,
 * unreadable or internally inconsistent. A rotated identity costs one pairing
 * approval; a silently accepted broken one costs every later connect.
 */
export function loadOrCreateDeviceIdentity(stateDirectory) {
  const file = path.join(stateDirectory, IDENTITY_FILE);
  if (existsSync(file)) {
    try {
      const parsed = JSON.parse(readFileSync(file, "utf8"));
      if (isUsableIdentity(parsed)) return parsed;
    } catch {
      // fall through and mint a new identity
    }
  }
  const identity = createDeviceIdentity();
  mkdirSync(stateDirectory, { recursive: true });
  writeFileSync(file, JSON.stringify(identity, null, 2), { mode: 0o600 });
  try {
    chmodSync(file, 0o600);
  } catch {
    // Windows ignores POSIX modes; the file still inherits the user profile ACL.
  }
  return identity;
}

const TOKEN_FILE = "device-token.json";

export function loadDeviceToken(stateDirectory, role) {
  const file = path.join(stateDirectory, TOKEN_FILE);
  if (!existsSync(file)) return null;
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    const record = parsed?.[role];
    if (!record || typeof record.token !== "string") return null;
    return { token: record.token, scopes: Array.isArray(record.scopes) ? record.scopes : [] };
  } catch {
    return null;
  }
}

export function storeDeviceToken(stateDirectory, role, token, scopes) {
  const file = path.join(stateDirectory, TOKEN_FILE);
  let current = {};
  if (existsSync(file)) {
    try {
      current = JSON.parse(readFileSync(file, "utf8")) ?? {};
    } catch {
      current = {};
    }
  }
  current[role] = { token, scopes: scopes ?? [] };
  mkdirSync(stateDirectory, { recursive: true });
  writeFileSync(file, JSON.stringify(current, null, 2), { mode: 0o600 });
  try {
    chmodSync(file, 0o600);
  } catch {
    // see loadOrCreateDeviceIdentity
  }
}

export function clearDeviceToken(stateDirectory, role) {
  const file = path.join(stateDirectory, TOKEN_FILE);
  if (!existsSync(file)) return;
  try {
    const current = JSON.parse(readFileSync(file, "utf8")) ?? {};
    delete current[role];
    writeFileSync(file, JSON.stringify(current, null, 2), { mode: 0o600 });
  } catch {
    // a broken token file is replaced on the next successful connect
  }
}
