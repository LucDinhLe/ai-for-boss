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
  'venv',
  // Windows profile / drive noise when the workspace is a home folder or a drive.
  '$RECYCLE.BIN',
  'AppData',
  'System Volume Information'
])

// A walk of a huge folder (a whole home directory) must not hang the search.
export const WALK_BUDGET_MS = 4_000

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

export function parseGitLsFiles(
  stdout: string,
  limit = LIST_FILES_LIMIT
): { files: string[]; nestedDirs: string[]; truncated: boolean } {
  const all = stdout.split('\0').filter(Boolean)
  const unique = [...new Set(all.map(file => file.replace(/\\/g, '/')))]
  // `git ls-files --others` prints an untracked nested repository (a project
  // cloned inside the workspace) as one "dir/" entry: it is a folder to index,
  // never a file to show.
  const nestedDirs = unique.filter(file => file.endsWith('/')).map(dir => dir.replace(/\/+$/, ''))
  const files = unique.filter(file => !file.endsWith('/'))

  return { files: files.slice(0, limit), nestedDirs, truncated: files.length > limit }
}

export async function walkFiles(
  root: string,
  {
    budgetMs = WALK_BUDGET_MS,
    fsImpl = fs,
    limit = LIST_FILES_LIMIT
  }: { budgetMs?: number; fsImpl?: typeof fs; limit?: number } = {}
): Promise<{ files: string[]; truncated: boolean }> {
  const files: string[] = []
  const queue = ['']
  const deadline = Date.now() + budgetMs

  while (queue.length) {
    if (Date.now() > deadline) {
      return { files, truncated: true }
    }

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

  const git = options.git || runGitLsFiles
  const stdout = await git(resolved)

  if (stdout !== null) {
    const parsed = parseGitLsFiles(stdout, limit)
    const files = [...parsed.files]
    let truncated = parsed.truncated

    for (const dir of parsed.nestedDirs) {
      if (files.length >= limit) {
        truncated = true

        break
      }

      const nestedRoot = path.join(resolved, dir)
      const nestedOut = await git(nestedRoot)

      const nested =
        nestedOut !== null
          ? parseGitLsFiles(nestedOut, limit - files.length)
          : await walkFiles(nestedRoot, { fsImpl, limit: limit - files.length })

      files.push(...nested.files.map(file => `${dir}/${file}`))
      truncated ||= nested.truncated
    }

    return { files, root: resolved, source: 'git', truncated }
  }

  return { root: resolved, source: 'walk', ...(await walkFiles(resolved, { fsImpl, limit })) }
}
