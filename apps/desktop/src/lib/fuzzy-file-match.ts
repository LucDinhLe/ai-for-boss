// Quick Open ranking for the file panel search, modelled on VS Code's file
// picker (Ctrl+P):
// - the file NAME is matched first; the folder path only counts when the name
//   does not match or the query contains a slash;
// - a query must start on a word boundary ("upt" → use-project-tree) unless
//   the query appears as one contiguous piece ("hoach" → KE-HOACH), so random
//   letters scattered across a long path no longer produce junk hits;
// - the best alignment wins (fzy-style dynamic programming), rewarding
//   consecutive letters and word starts, not the first letters found;
// - several words separated by spaces must all match;
// - accents are ignored so "mo" finds "Mỡ" and "ke hoach" finds "KẾ-HOẠCH".

export interface FileMatch {
  /** Positions in `path` that matched, for highlighting. */
  indices: number[]
  path: string
  score: number
}

export function foldText(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()
}

const MAX_TARGET = 512
const GAP_LEADING = -0.005
const GAP_TRAILING = -0.005
const GAP_INNER = -0.01
const MATCH_CONSECUTIVE = 1
const BONUS_SLASH = 0.9
const BONUS_WORD = 0.8
const BONUS_CAMEL = 0.7
const BONUS_DOT = 0.6

// Tier offsets keep "name matches" strictly above "path-only matches".
const TIER_NAME = 1000
const TIER_EXACT_NAME = 5000

function bonusAt(original: string, index: number, start: number): number {
  if (index === start) {
    return BONUS_SLASH
  }

  const prev = original[index - 1]
  const cur = original[index]

  if (prev === '/' || prev === '\\') {
    return BONUS_SLASH
  }

  if (prev === '-' || prev === '_' || prev === ' ') {
    return BONUS_WORD
  }

  if (prev === '.') {
    return BONUS_DOT
  }

  if (prev === prev.toLowerCase() && prev !== prev.toUpperCase() && cur !== cur.toLowerCase()) {
    return BONUS_CAMEL
  }

  return 0
}

function isSubsequence(needle: string, hay: string, from: number): boolean {
  let cursor = from

  for (const char of needle) {
    const found = hay.indexOf(char, cursor)

    if (found < 0) {
      return false
    }

    cursor = found + 1
  }

  return true
}

/**
 * Best alignment of `needle` inside `hay[start..]` (fzy algorithm). `original`
 * is the unfolded text, same length as `hay`, used for word-start bonuses.
 * When `strongStart` is set the first needle character must land on a word
 * start (VS Code's "first match can't be weak"). `strict` also forbids
 * letters that land mid-word away from the previous one.
 */
function align(
  needle: string,
  hay: string,
  original: string,
  start: number,
  strongStart: boolean,
  strict = false
): null | { indices: number[]; score: number } {
  const m = needle.length
  const n = Math.min(hay.length, start + MAX_TARGET) - start

  if (!m || n < m || !isSubsequence(needle, hay.slice(start, start + n), 0)) {
    return null
  }

  const bonus = new Float64Array(n)

  for (let j = 0; j < n; j++) {
    bonus[j] = bonusAt(original, start + j, start)
  }

  // D[i][j]: best score of needle[0..i] using hay[0..j], ending anywhere <= j.
  // M[i][j]: best score of needle[0..i] with needle[i] matched exactly at j.
  const D = Array.from({ length: m }, () => new Float64Array(n).fill(-Infinity))
  const M = Array.from({ length: m }, () => new Float64Array(n).fill(-Infinity))

  for (let i = 0; i < m; i++) {
    let prevScore = -Infinity
    const gap = i === m - 1 ? GAP_TRAILING : GAP_INNER

    for (let j = 0; j < n; j++) {
      if (hay[start + j] === needle[i]) {
        let score = -Infinity

        if (i === 0) {
          if (!strongStart || bonus[j] > 0) {
            score = j * GAP_LEADING + bonus[j]
          }
        } else if (j > 0) {
          // strict: every later letter continues a run or starts a word.
          const jump = strict && bonus[j] <= 0 ? -Infinity : D[i - 1][j - 1] + bonus[j]
          score = Math.max(M[i - 1][j - 1] + MATCH_CONSECUTIVE, jump)
        }

        M[i][j] = score
        prevScore = Math.max(score, prevScore + gap)
      } else {
        prevScore = prevScore + gap
      }

      D[i][j] = prevScore
    }
  }

  const best = D[m - 1][n - 1]

  if (!Number.isFinite(best)) {
    return null
  }

  // Trace back the positions of the best alignment.
  const indices = new Array<number>(m)
  let matchRequired = false
  let j = n - 1

  for (let i = m - 1; i >= 0; i--) {
    for (; j >= 0; j--) {
      if (M[i][j] !== -Infinity && (matchRequired || M[i][j] === D[i][j])) {
        matchRequired = i > 0 && j > 0 && M[i][j] === M[i - 1][j - 1] + MATCH_CONSECUTIVE
        indices[i] = start + j
        j--

        break
      }
    }
  }

  return { indices, score: best }
}

function alignWord(
  word: string,
  hay: string,
  original: string,
  start: number,
  strict: boolean
): null | { indices: number[]; score: number } {
  // Word-start fuzzy first; a contiguous substring may start mid-word.
  return (
    align(word, hay, original, start, true, strict) ??
    (hay.indexOf(word, start) >= 0 ? align(word, hay, original, start, false) : null)
  )
}

export function matchFile(query: string, path: string): FileMatch | null {
  const q = foldText(query.trim())

  if (!q) {
    return null
  }

  // Fold character by character so each precomposed Vietnamese letter stays one
  // position and highlight indices line up with `path`; fall back to the whole
  // folded string when lengths differ (decomposed names, astral characters).
  const aligned = [...path].map(ch => foldText(ch) || ch).join('')
  const hay = aligned.length === path.length ? aligned : foldText(path)
  const nameStart = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\')) + 1
  const name = hay.slice(nameStart)
  const words = q.split(/\s+/).filter(Boolean)
  const indices: number[] = []
  let score = 0
  let allInName = true

  for (const word of words) {
    const pathQuery = /[\\/]/.test(word)
    const inName = pathQuery ? null : alignWord(word, hay, path, nameStart, false)
    // Across the whole path only runs and word starts count: three letters
    // scattered over "ai-for-boss/repo/…" must not match everything.
    const hit = inName ?? alignWord(word.replace(/\\/g, '/'), hay.replace(/\\/g, '/'), path, 0, true)

    if (!hit) {
      return null
    }

    allInName &&= Boolean(inName)
    score += hit.score
    indices.push(...hit.indices)
  }

  if (allInName) {
    const compact = words.join('')
    const stem = name.replace(/\.[^.]+$/, '')

    score += name === compact || stem === compact ? TIER_EXACT_NAME : TIER_NAME

    if (name.startsWith(compact)) {
      score += 20
    } else if (name.includes(compact)) {
      score += 10
    }
  }

  // Shallower, shorter paths win ties (closer to the project root).
  score -= path.length / 1000 + (path.split('/').length - 1) / 100

  return { indices: [...new Set(indices)].sort((a, b) => a - b), path, score }
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
