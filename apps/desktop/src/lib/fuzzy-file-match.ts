// Quick Open ranking for the file panel search, modelled on VS Code:
// a query matches when its characters appear in order (fuzzy subsequence);
// contiguous runs, word starts and the file name weigh more than the folder.
// Accents are ignored so "mo" finds "Mỡ" and "ke hoach" finds "KẾ-HOẠCH".

export interface FileMatch {
  /** Positions in `path` that matched, for highlighting. */
  indices: number[]
  path: string
  score: number
}

export function foldText(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()
}

const SEPARATORS = new Set(['/', '\\', '-', '_', '.', ' '])

function isWordStart(original: string, index: number): boolean {
  if (index === 0) {
    return true
  }

  const prev = original[index - 1]
  const cur = original[index]

  return SEPARATORS.has(prev) || (prev === prev.toLowerCase() && cur !== cur.toLowerCase())
}

/** Best-effort greedy subsequence score of `query` inside `text[from..]`. */
function subsequence(
  query: string,
  folded: string,
  original: string,
  from: number
): null | { indices: number[]; score: number } {
  const indices: number[] = []
  let score = 0
  let cursor = from
  let prevMatch = -2

  for (const char of query) {
    if (char === ' ') {
      continue
    }

    const found = folded.indexOf(char, cursor)

    if (found < 0) {
      return null
    }

    score += 1

    if (found === prevMatch + 1) {
      score += 5
    }

    if (isWordStart(original, found)) {
      score += 8
    }

    indices.push(found)
    prevMatch = found
    cursor = found + 1
  }

  return { indices, score }
}

export function matchFile(query: string, path: string): FileMatch | null {
  const q = foldText(query.trim())

  if (!q) {
    return null
  }

  const folded = foldText(path)
  // Fold character by character so each precomposed Vietnamese letter stays one
  // position and highlight indices line up with `path`; fall back to the whole
  // folded string when lengths differ (decomposed names, astral characters).
  const aligned = [...path].map(ch => foldText(ch) || ch).join('')
  const haystack = aligned.length === path.length ? aligned : folded
  const nameStart = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')) + 1
  const queryHasSlash = /[\\/]/.test(q)

  const inName = queryHasSlash ? null : subsequence(q, haystack, path, nameStart)
  const inPath = inName ? null : subsequence(q, haystack, path, 0)
  const hit = inName ?? inPath

  if (!hit) {
    return null
  }

  let score = hit.score

  if (inName) {
    score += 20
    const name = haystack.slice(nameStart)

    if (name.startsWith(q.replace(/\s+/g, ''))) {
      score += 15
    }

    if (name.includes(q.replace(/\s+/g, ''))) {
      score += 10
    }
  }

  // Shorter paths win ties (shallower, closer to the root).
  score -= path.length / 100

  return { indices: hit.indices, path, score }
}

export function rankFiles(query: string, paths: readonly string[], limit = 100): FileMatch[] {
  const matches: FileMatch[] = []

  for (const path of paths) {
    const match = matchFile(query, path)

    if (match) {
      matches.push(match)
    }
  }

  matches.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))

  return matches.slice(0, limit)
}
