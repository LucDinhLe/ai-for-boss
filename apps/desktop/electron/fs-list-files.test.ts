import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { listFilesForIpc, parseGitLsFiles, walkFiles } from './fs-list-files'

let root = ''

beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'hv-list-files-'))

  const write = (rel: string) => {
    const full = path.join(root, rel)
    fs.mkdirSync(path.dirname(full), { recursive: true })
    fs.writeFileSync(full, 'x')
  }

  write('README.md')
  write('src/a/b/c/d/sau-tang.ts')
  write('Mỡ/KE-HOACH.md')
  write('node_modules/pkg/index.js')
  write('.git/HEAD')
  write('dist/bundle.js')
})

afterAll(() => fs.rmSync(root, { force: true, recursive: true }))

describe('parseGitLsFiles', () => {
  it('splits NUL output, normalizes separators, dedupes and caps', () => {
    expect(parseGitLsFiles('a.ts\0src\\b.ts\0a.ts\0')).toEqual({ files: ['a.ts', 'src/b.ts'], truncated: false })
    expect(parseGitLsFiles('a\0b\0c\0', 2)).toEqual({ files: ['a', 'b'], truncated: true })
  })
})

describe('walkFiles', () => {
  it('lists deep files (Vietnamese names included) and skips noise folders', async () => {
    const { files, truncated } = await walkFiles(root)

    expect(truncated).toBe(false)
    expect(files.sort()).toEqual(['Mỡ/KE-HOACH.md', 'README.md', 'src/a/b/c/d/sau-tang.ts'])
  })

  it('stops at the limit and reports truncation', async () => {
    const { files, truncated } = await walkFiles(root, { limit: 1 })

    expect(files).toHaveLength(1)
    expect(truncated).toBe(true)
  })
})

describe('listFilesForIpc', () => {
  it('prefers git ls-files when the folder is a repo', async () => {
    const result = await listFilesForIpc(root, { git: async () => 'tracked.ts\0' })

    expect(result).toMatchObject({ files: ['tracked.ts'], source: 'git', truncated: false })
  })

  it('falls back to a walk when git is missing or the folder is not a repo', async () => {
    const result = await listFilesForIpc(root, { git: async () => null })

    expect(result.source).toBe('walk')
    expect(result.files).toContain('src/a/b/c/d/sau-tang.ts')
  })

  it('returns an error for a missing root instead of throwing', async () => {
    const result = await listFilesForIpc(path.join(root, 'khong-ton-tai'), { git: async () => null })

    expect(result.error).toBeTruthy()
    expect(result.files).toEqual([])
  })
})
