import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { test } from 'vitest'

import { EDITION_SEED_MARKER, pendingSeedVersion, resolveEditionDir, seedEditionIfNeeded } from './edition-seed'

const REAL_EDITION = path.resolve(__dirname, '..', 'edition')

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'afb-seed-'))
}

function fakeSpawn(code: number, stdout: string) {
  const calls: Array<{ command: string; args: string[]; env: NodeJS.ProcessEnv }> = []

  const impl = ((command: string, args: string[], options: { env: NodeJS.ProcessEnv }) => {
    calls.push({ command, args, env: options.env })
    const child: any = new EventEmitter()
    child.stdout = new EventEmitter()
    child.stderr = new EventEmitter()

    child.kill = () => {}
    setImmediate(() => {
      child.stdout.emit('data', Buffer.from(stdout))
      child.emit('close', code)
    })

    return child
  }) as any

  return { calls, impl }
}

test('gói edition thật có đủ phần vỏ cần: manifest, script, SOUL, 47 kỹ năng, plugin, 4 vai trò', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(REAL_EDITION, 'edition.json'), 'utf8'))
  assert.equal(manifest.id, 'ai-for-boss')
  assert.ok(manifest.seedVersion >= 1)
  assert.ok(fs.existsSync(path.join(REAL_EDITION, 'seed_edition.py')))
  assert.match(fs.readFileSync(path.join(REAL_EDITION, 'SOUL.md'), 'utf8'), /^<!-- ai-for-boss-soul/)

  const skills = fs
    .readdirSync(path.join(REAL_EDITION, 'skills', 'ai-for-boss'), { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)

  assert.equal(skills.length, 47)
  assert.ok(fs.existsSync(path.join(REAL_EDITION, 'skills', 'ai-for-boss', 'DESCRIPTION.md')))
  assert.ok(fs.existsSync(path.join(REAL_EDITION, 'NOTICE.md')))

  for (const skill of skills) {
    const text = fs.readFileSync(path.join(REAL_EDITION, 'skills', 'ai-for-boss', skill, 'SKILL.md'), 'utf8')
    assert.match(text, new RegExp(`^---\\nname: ${skill}\\n`))
    assert.doesNotMatch(text, /openclaw/i)
  }

  assert.ok(fs.existsSync(path.join(REAL_EDITION, 'plugins', 'aifb-harness', 'plugin.yaml')))
  assert.deepEqual(fs.readdirSync(path.join(REAL_EDITION, 'roles')).sort(), [
    'ban-hang.json',
    'dieu-hanh.json',
    'marketing-noi-dung.json',
    'quan-ly-du-an.json'
  ])
})

test('resolveEditionDir: bản đóng gói đọc từ resources, bản dev đọc cạnh app', () => {
  assert.equal(resolveEditionDir(true, '/r', '/app'), path.join('/r', 'edition'))
  assert.equal(resolveEditionDir(false, '/r', '/app'), path.join('/app', 'edition'))
})

test('pendingSeedVersion: gieo khi chưa có dấu hoặc dấu cũ hơn, bỏ qua khi đã gieo đúng bản', () => {
  const home = tmp()
  const edition = tmp()
  fs.writeFileSync(path.join(edition, 'edition.json'), JSON.stringify({ id: 'x', seedVersion: 2 }))

  assert.equal(pendingSeedVersion(home, edition), 2)
  fs.writeFileSync(path.join(home, EDITION_SEED_MARKER), JSON.stringify({ seedVersion: 1 }))
  assert.equal(pendingSeedVersion(home, edition), 2)
  fs.writeFileSync(path.join(home, EDITION_SEED_MARKER), JSON.stringify({ seedVersion: 2 }))
  assert.equal(pendingSeedVersion(home, edition), null)
  assert.equal(pendingSeedVersion(home, tmp()), null, 'không có gói edition thì không làm gì')
})

test('seedEditionIfNeeded chạy script bằng Python của backend, ghim HERMES_HOME, đọc dòng tóm tắt', async () => {
  const home = tmp()
  const { calls, impl } = fakeSpawn(0, '✓ Set ...\nAIFB_SEED {"soul":"written"}\n')
  const logs: string[] = []

  const result = await seedEditionIfNeeded({
    backend: { command: '/py', env: { PYTHONPATH: '/core' }, kind: 'python' },
    editionDir: REAL_EDITION,
    hermesHome: home,
    log: line => logs.push(line),
    spawnImpl: impl
  })

  assert.deepEqual(result, { ok: true, summary: '{"soul":"written"}' })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].command, '/py')
  assert.deepEqual(calls[0].args, [path.join(REAL_EDITION, 'seed_edition.py'), REAL_EDITION])
  assert.equal(calls[0].env.HERMES_HOME, home)
  assert.equal(calls[0].env.PYTHONPATH, '/core')
})

test('seedEditionIfNeeded: script hỏng thì báo lỗi, không ném, để lần sau thử lại', async () => {
  const { impl } = fakeSpawn(1, 'Traceback: boom\n')
  const logs: string[] = []

  const result = await seedEditionIfNeeded({
    backend: { command: '/py', kind: 'python' },
    editionDir: REAL_EDITION,
    hermesHome: tmp(),
    log: line => logs.push(line),
    spawnImpl: impl
  })

  assert.equal(result.ok, false)
  assert.ok(logs.some(line => line.includes('gieo gói hỏng')))
})

test('seedEditionIfNeeded bỏ qua khi đã gieo, không spawn gì', async () => {
  const home = tmp()
  const manifest = JSON.parse(fs.readFileSync(path.join(REAL_EDITION, 'edition.json'), 'utf8'))
  fs.writeFileSync(path.join(home, EDITION_SEED_MARKER), JSON.stringify({ seedVersion: manifest.seedVersion }))
  const { calls, impl } = fakeSpawn(0, '')

  const result = await seedEditionIfNeeded({
    backend: { command: '/py', kind: 'python' },
    editionDir: REAL_EDITION,
    hermesHome: home,
    log: () => {},
    spawnImpl: impl
  })

  assert.deepEqual(result, { ok: true, skipped: true })
  assert.equal(calls.length, 0)
})
