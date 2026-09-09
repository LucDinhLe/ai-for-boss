const START_METHODS = new Set(["openclaw.setup.activate.start", "openclaw.setup.auth.start"]);
const SESSION_METHODS = new Set(["wizard.status", "wizard.next", "wizard.cancel"]);
const validSessionId = (value) => typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/u.test(value);
const inactiveRequest = Object.freeze({ complete() {}, fail() {} });

export function isAllowedSetupPage(value) {
  if (typeof value !== "string" || value.length > 8192 || !value.isWellFormed()) return false;
  try {
    const url = new URL(value);
    return !url.username && !url.password && (url.protocol === "https:"
      || (url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)));
  } catch { return false; }
}

// Only native replies to a start initiated through this host create a grant.
// Renderer input can select a known session, never supply the destination URL.
export function createSetupPageAccess({ openExternal, canOpen = () => false, now = Date.now,
  ttlMs = 10 * 60_000, maxSessions = 8 }) {
  const sessions = new Map();
  const prune = () => {
    for (const [id, entry] of sessions) if (entry.expiresAt <= now()) sessions.delete(id);
  };
  return Object.freeze({
    clear() { sessions.clear(); },
    begin(method, params) {
      if (!START_METHODS.has(method) && !SESSION_METHODS.has(method)) return inactiveRequest;
      const id = params?.sessionId;
      if (!validSessionId(id)) return inactiveRequest;
      prune();
      if (method === "wizard.cancel") { sessions.delete(id); return inactiveRequest; }
      let entry = sessions.get(id);
      if (START_METHODS.has(method)) {
        sessions.delete(id);
        if (sessions.size >= maxSessions) sessions.delete(sessions.keys().next().value);
        entry = { expiresAt: now() + ttlMs, revision: 0, url: null, opening: null };
        sessions.set(id, entry);
      }
      if (!entry) return inactiveRequest;
      const revision = ++entry.revision;
      if (method === "wizard.next") entry.url = null;
      const current = () => sessions.get(id) === entry && entry.revision === revision && entry.expiresAt > now();
      return Object.freeze({
        complete(result) {
          if (!current()) return;
          if (!result || typeof result !== "object" || Array.isArray(result)
            || (result.sessionId !== undefined && result.sessionId !== id)
            || result.done === true || result.error
            || ["done", "completed", "error", "failed", "cancelled", "canceled"].includes(result.status)) {
            sessions.delete(id); return;
          }
          // Native wizard.status only carries status/error; it cannot replace a step.
          if (method === "wizard.status") return;
          entry.url = isAllowedSetupPage(result.step?.externalUrl) ? result.step.externalUrl : null;
        },
        fail() { if (current()) sessions.delete(id); }
      });
    },
    openPage(id) {
      prune();
      const entry = validSessionId(id) ? sessions.get(id) : null;
      if (!canOpen() || !entry?.url) return Promise.resolve(false);
      if (entry.opening) return entry.opening;
      const url = entry.url;
      const revision = entry.revision;
      entry.opening = Promise.resolve().then(async () => {
        if (!canOpen() || sessions.get(id) !== entry || entry.revision !== revision
          || entry.expiresAt <= now() || entry.url !== url) return false;
        try { await openExternal(url); return true; } catch { return false; }
      }).finally(() => { entry.opening = null; });
      return entry.opening;
    }
  });
}
