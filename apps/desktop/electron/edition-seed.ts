// edition-seed.ts — gieo gói doanh nghiệp (apps/desktop/edition) vào HERMES_HOME trước khi
// backend khởi động: kỹ năng, plugin aifb-harness, SOUL.md, bộ đệm prompt 1 giờ, bốn vai
// trò. Việc ghi do edition/seed_edition.py làm bằng Python của lõi, dùng hàm cấu hình
// công khai của Hermes, nên vỏ không cần tự đọc ghi YAML và lõi không bị sửa.
//
// Chỉ chạy khi seedVersion trong edition.json mới hơn dấu <HERMES_HOME>/edition-seed.json.
// Hỏng thì ghi log và để lần mở sau thử lại; không bao giờ chặn khởi động.

import { spawn as nodeSpawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { hiddenWindowsChildOptions } from './windows-child-options'

export const EDITION_SEED_MARKER = 'edition-seed.json'
const SEED_TIMEOUT_MS = 90_000

export interface EditionBackend {
  command: string
  env?: NodeJS.ProcessEnv
  kind?: string
}

export function resolveEditionDir(isPackaged: boolean, resourcesPath: string | undefined, appRoot: string): string {
  return isPackaged && resourcesPath ? path.join(resourcesPath, 'edition') : path.join(appRoot, 'edition')
}

function readJson(file: string): Record<string, unknown> | null {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

/** seedVersion cần gieo, hoặc null khi đã gieo bản này (hay không có gói edition). */
export function pendingSeedVersion(hermesHome: string, editionDir: string): number | null {
  const manifest = readJson(path.join(editionDir, 'edition.json'))
  const wanted = Number(manifest?.seedVersion)

  if (!Number.isFinite(wanted) || wanted <= 0) {
    return null
  }

  const done = Number(readJson(path.join(hermesHome, EDITION_SEED_MARKER))?.seedVersion)

  return Number.isFinite(done) && done >= wanted ? null : wanted
}

export interface SeedResult {
  ok: boolean
  skipped?: boolean
  summary?: string
  error?: string
}

export async function seedEditionIfNeeded(options: {
  backend: EditionBackend
  editionDir: string
  hermesHome: string
  log: (line: string) => void
  spawnImpl?: typeof nodeSpawn
}): Promise<SeedResult> {
  const { backend, editionDir, hermesHome, log } = options
  const version = pendingSeedVersion(hermesHome, editionDir)

  if (version === null) {
    return { ok: true, skipped: true }
  }

  // Backend dạng 'hermes' (lệnh trên PATH, không phải Python) không chạy được script.
  if (backend.kind && backend.kind !== 'python' && backend.kind !== 'resident') {
    log(`[edition] bỏ qua gieo gói: backend ${backend.kind} không phải Python`)

    return { ok: false, error: `unsupported backend ${backend.kind}` }
  }

  const script = path.join(editionDir, 'seed_edition.py')
  const spawnImpl = options.spawnImpl ?? nodeSpawn

  log(`[edition] gieo gói doanh nghiệp seedVersion ${version} vào ${hermesHome}`)

  return new Promise<SeedResult>(resolve => {
    let output = ''
    let settled = false

    const finish = (result: SeedResult) => {
      if (!settled) {
        settled = true
        clearTimeout(timer)
        resolve(result)
      }
    }

    const child = spawnImpl(
      backend.command,
      [script, editionDir],
      hiddenWindowsChildOptions({
        cwd: editionDir,
        env: { ...process.env, ...backend.env, HERMES_HOME: hermesHome, PYTHONIOENCODING: 'utf-8' },
        stdio: ['ignore', 'pipe', 'pipe']
      })
    )

    const timer = setTimeout(() => {
      child.kill()
      log('[edition] gieo gói quá 90 giây, dừng; lần mở sau sẽ thử lại')
      finish({ ok: false, error: 'timeout' })
    }, SEED_TIMEOUT_MS)

    child.stdout?.on('data', chunk => {
      output += String(chunk)
    })
    child.stderr?.on('data', chunk => {
      output += String(chunk)
    })
    child.on('error', error => {
      log(`[edition] không chạy được script gieo gói: ${error.message}`)
      finish({ ok: false, error: error.message })
    })
    child.on('close', code => {
      const summary = output.split(/\r?\n/).find(line => line.startsWith('AIFB_SEED '))

      if (code === 0 && summary) {
        log(`[edition] ${summary}`)
        finish({ ok: true, summary: summary.slice('AIFB_SEED '.length) })
      } else {
        log(`[edition] gieo gói hỏng (mã ${code}): ${output.trim().split(/\r?\n/).slice(-6).join(' | ')}`)
        finish({ ok: false, error: `exit ${code}` })
      }
    })
  })
}
