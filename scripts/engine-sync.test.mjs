import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { contractMismatch, parseEngineContract, parseShellContract } from './desktop-contract.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('đọc số contract của lõi và của vỏ', () => {
  assert.equal(parseEngineContract('x = 1\nDESKTOP_BACKEND_CONTRACT = 6\n'), 6)
  assert.equal(parseShellContract('const REQUIRED_BACKEND_CONTRACT = 7\n'), 7)
  assert.equal(parseShellContract('export const REQUIRED_BACKEND_CONTRACT = 6\n'), 6)
  assert.equal(parseEngineContract('nothing here'), null)
})

test('lệch số contract là lỗi, khớp là null', () => {
  const core = 'DESKTOP_BACKEND_CONTRACT = 6\n'
  assert.equal(contractMismatch(core, 'export const REQUIRED_BACKEND_CONTRACT = 6\n'), null)
  assert.match(contractMismatch(core, 'const REQUIRED_BACKEND_CONTRACT = 7\n'), /vỏ đòi contract 7 nhưng lõi ghim báo 6/)
  assert.match(contractMismatch('', 'const REQUIRED_BACKEND_CONTRACT = 6\n'), /không đọc được/)
})

test('kho hiện tại: vỏ khớp contract của lõi trong engine.lock', () => {
  const lock = JSON.parse(fs.readFileSync(path.join(ROOT, 'engine.lock'), 'utf8'))
  let serverPy

  try {
    serverPy = execFileSync('git', ['show', `${lock.engine.commit}:tui_gateway/server.py`], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore']
    })
  } catch {
    // Máy chưa fetch commit lõi: đọc bản đang checkout (engine-sync check bảo đảm hai bản trùng).
    serverPy = fs.readFileSync(path.join(ROOT, 'tui_gateway/server.py'), 'utf8')
  }

  const updatesTs = fs.readFileSync(path.join(ROOT, 'apps/desktop/src/store/updates.ts'), 'utf8')
  assert.equal(contractMismatch(serverPy, updatesTs), null)
})
