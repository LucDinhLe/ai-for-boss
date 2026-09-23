import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { resolveDirectoryForIpc } from './hardening'
import { resolveLocalReadPath } from './wsl-path-bridge'

// Flat file index for the file panel's quick search (VS Code "Quick Open").
// Runs in the main process, never on the Hermes backend event loop: the
// backend's own `complete.path` shells out to `git ls-files` on that loop and
// can stall agent turns on large trees.

export const LIST_FILES_LIMIT = 50_000

// Same hygiene as the tree (fs-read-dir.ts) for folders without a .gitignore.
const WALK_SKIP = new Set([
  '.git',
  '.hg',
  '.svn',
  '.cache',
  '.next',
  '.turbo',
  '.venv',
  '__pycache__',
  'build',
  'dist',
  'node_modules',
  'target',
  'venv'
])

export interface ListFilesResult {
  error?: string
  /** Relative paths with '/' separators, in no particular order. */
  files: string[]
  root: string
  source: 'git' | 'none' | 'walk'
  truncated: boolean
}

type GitRunner = (cwd: string) => Promise<null | string>

const runGitLsFiles: GitRunner = cwd =>
  new Promise(resolve => {
    execFile(
      'git',
      ['-C', cwd, 'ls-files', '--cached', '--others', '--exclude-standard', '-z'],
      { maxBuffer: 64 * 1024 * 1024, timeout: 15_000, windowsHide: true },
      (error, stdout) => resolve(error ? null : String(stdout))
    )
  })

export function parseGitLsFiles(stdout: string, limit = LIST_FILES_LIMIT): { files: string[]; truncated: boolean } {
  const all = stdout.split('\0').filter(Boolean)
  const unique = [...new Set(all.map(file => file.replace(/\\/g, '/')))]

  return { files: unique.slice(0, limit), truncated: unique.length > limit }
}

export async function walkFiles(
  root: string,
  { fsImpl = fs, limit = LIST_FILES_LIMIT }: { fsImpl?: typeof fs; limit?: number } = {}
): Promise<{ files: string[]; truncated: boolean }> {
  const files: string[] = []
  const queue = ['']

  while (queue.length) {
    const rel = queue.shift() as string
    let dirents: fs.Dirent[]

    try {
      dirents = await fsImpl.promises.readdir(path.join(root, rel), { withFileTypes: true })
    } catch {
      continue
    }

    for (const dirent of dirents) {
      if (WALK_SKIP.has(dirent.name)) {
        continue
      }

      const childRel = rel ? `${rel}/${dirent.name}` : dirent.name

      if (dirent.isDirectory()) {
        queue.push(childRel)
      } else if (dirent.isFile() || dirent.isSymbolicLink()) {
        if (files.length >= limit) {
          return { files, truncated: true }
        }

        files.push(childRel)
      }
    }
  }

  return { files, truncated: false }
}

export async function listFilesForIpc(
  rootPath: unknown,
  options: { fs?: typeof fs; git?: GitRunner; limit?: number } = {}
): Promise<ListFilesResult> {
  const fsImpl = options.fs || fs
  const limit = options.limit ?? LIST_FILES_LIMIT
  let resolved: string

  try {
    ;({ resolvedPath: resolved } = await resolveDirectoryForIpc(resolveLocalReadPath(String(rootPath ?? '')), {
      fs: fsImpl,
      purpose: 'File search'
    }))
  } catch (error) {
    return {
      error: (error as { code?: string })?.code || 'read-error',
      files: [],
      root: '',
      source: 'none',
      truncated: false
    }
  }

  const stdout = await (options.git || runGitLsFiles)(resolved)

  if (stdout !== null) {
    return { root: resolved, source: 'git', ...parseGitLsFiles(stdout, limit) }
  }

  return { root: resolved, source: 'walk', ...(await walkFiles(resolved, { fsImpl, limit })) }
}
