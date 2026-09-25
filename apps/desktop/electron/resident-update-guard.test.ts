import { describe, expect, it } from 'vitest'

import {
  isBackendSelfUpdateRequest,
  RESIDENT_UPDATE_DISABLED_CODE,
  residentSelfUpdateRefusal,
  shouldRefuseResidentSelfUpdate
} from './resident-update-guard'

describe('resident self-update guard', () => {
  it('matches only POST /api/hermes/update', () => {
    expect(isBackendSelfUpdateRequest({ method: 'POST', path: '/api/hermes/update' })).toBe(true)
    expect(isBackendSelfUpdateRequest({ method: 'post', path: '/api/hermes/update?x=1' })).toBe(true)
    expect(isBackendSelfUpdateRequest({ method: 'GET', path: '/api/hermes/update' })).toBe(false)
    expect(isBackendSelfUpdateRequest({ method: 'POST', path: '/api/hermes/update-check' })).toBe(false)
    expect(isBackendSelfUpdateRequest({ path: '/api/hermes/update' })).toBe(false)
    expect(isBackendSelfUpdateRequest(null)).toBe(false)
  })

  it('refuses the bundled local backend, allows remote backends and checkouts', () => {
    const req = { method: 'POST', path: '/api/hermes/update' }

    expect(shouldRefuseResidentSelfUpdate(req, { registryConnectionId: null, resident: true })).toBe(true)
    expect(shouldRefuseResidentSelfUpdate(req, { registryConnectionId: 'local', resident: true })).toBe(true)
    expect(shouldRefuseResidentSelfUpdate(req, { registryConnectionId: 'box-1', resident: true })).toBe(false)
    expect(shouldRefuseResidentSelfUpdate(req, { registryConnectionId: null, resident: false })).toBe(false)
  })

  it('returns the backend refusal shape the renderer already handles', () => {
    expect(residentSelfUpdateRefusal()).toMatchObject({ ok: false, error: RESIDENT_UPDATE_DISABLED_CODE })
  })
})
