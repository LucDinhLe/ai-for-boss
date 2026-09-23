// Hermes Vietnamese: the backend bundled in the app (resident payload under
// resources/agent-payload) must never run upstream's in-place `hermes update`.
// On a per-machine install it fails with EACCES (seen 2026-09-20 in
// hermes-update.log); on a per-user install it would overwrite the core pinned
// in engine.lock. New backend bytes only arrive through a new installer.

export const RESIDENT_UPDATE_DISABLED_CODE = 'resident_bundle_update_disabled'

export function isBackendSelfUpdateRequest(request: unknown): boolean {
  const req = request as { method?: unknown; path?: unknown } | null | undefined
  const method = typeof req?.method === 'string' ? req.method.toUpperCase() : 'GET'
  const path = typeof req?.path === 'string' ? req.path : ''

  return method === 'POST' && /^\/api\/hermes\/update(?:[?#]|$)/.test(path)
}

/** Local target = no registry id, or the explicit `local` registry entry. */
export function shouldRefuseResidentSelfUpdate(
  request: unknown,
  { registryConnectionId, resident }: { registryConnectionId: null | string | undefined; resident: boolean }
): boolean {
  if (!resident || !isBackendSelfUpdateRequest(request)) {
    return false
  }

  return !registryConnectionId || registryConnectionId === 'local'
}

export function residentSelfUpdateRefusal() {
  return {
    ok: false,
    pid: null,
    name: 'hermes-update',
    error: RESIDENT_UPDATE_DISABLED_CODE,
    message:
      'Hermes Vietnamese đóng kèm dịch vụ nền trong bộ cài nên không cập nhật tại chỗ được. ' +
      'Hãy tải bộ cài mới từ trang phát hành.',
    update_command: 'install the latest Hermes Vietnamese release'
  }
}
