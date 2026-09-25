import { useStore } from '@nanostores/react'
import { type KeyboardEvent, type ReactNode, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'

import { Codicon } from '@/components/ui/codicon'
import { FileTypeIcon } from '@/components/ui/file-type-icon'
import type { HermesListFilesResult } from '@/global'
import { useI18n } from '@/i18n'
import { listDesktopFiles } from '@/lib/desktop-fs'
import { type FileMatch, rankFiles } from '@/lib/fuzzy-file-match'
import { cn } from '@/lib/utils'
import { FILE_SEARCH_FOCUS_EVENT } from '@/store/layout'
import { $workspaceChangeTick } from '@/store/workspace-events'

// VS Code style Quick Open for the file panel: type part of a name, get a flat
// ranked list of every file in the project, no folder-by-folder expanding.
// Focusing the box with nothing typed lists recently opened files, like
// VS Code's Ctrl+P.

// The index is re-read on every focus (and when the window regains focus)
// unless it is this fresh; the previous list keeps showing meanwhile, so new
// files appear without a visible reload.
const INDEX_FRESH_MS = 3_000
const RESULT_LIMIT = 100
const RECENT_LIMIT = 12
const RECENT_STORAGE_KEY = 'hermes.desktop.fileSearchRecent.v1'
const RECENT_MAX_WORKSPACES = 40

interface CachedIndex {
  at: number
  result: HermesListFilesResult
}

const indexCache = new Map<string, CachedIndex>()
let indexTick = -1

export function clearFileSearchIndex() {
  indexCache.clear()
}

function workspaceKey(cwd: string): string {
  return cwd
    .replace(/[\\/]+$/, '')
    .replace(/\\/g, '/')
    .toLowerCase()
}

/** Path of `absolute` inside `cwd` with '/' separators, or null if outside. */
export function relativePathIn(cwd: string, absolute: string): null | string {
  const base = workspaceKey(cwd)
  const full = absolute.replace(/\\/g, '/')

  if (!base || full.toLowerCase().slice(0, base.length + 1) !== `${base}/`) {
    return null
  }

  return full.slice(base.length + 1)
}

function readRecentStore(): Record<string, string[]> {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RECENT_STORAGE_KEY) || '{}')

    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export function recentFilesFor(cwd: string): string[] {
  const list = readRecentStore()[workspaceKey(cwd)]

  return Array.isArray(list) ? list.filter(item => typeof item === 'string') : []
}

/** Remember a file the user opened (from search or the tree) for this workspace. */
export function recordRecentFile(cwd: string, absolute: string) {
  const rel = relativePathIn(cwd, absolute)

  if (!rel) {
    return
  }

  const store = readRecentStore()
  const key = workspaceKey(cwd)
  store[key] = [rel, ...(store[key] || []).filter(item => item !== rel)].slice(0, RECENT_LIMIT)

  const keys = Object.keys(store)

  for (const stale of keys.slice(0, Math.max(keys.length - RECENT_MAX_WORKSPACES, 0))) {
    if (stale !== key) {
      delete store[stale]
    }
  }

  // Move the workspace to the end so the oldest ones are trimmed first.
  const list = store[key]
  delete store[key]
  store[key] = list

  try {
    window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(store))
  } catch {
    // Storage unavailable (private window, quota): recents are a convenience.
  }
}

export function absolutePathFor(root: string, rel: string): string {
  const sep = root.includes('\\') && !root.includes('/') ? '\\' : '/'
  const base = root.replace(/[\\/]+$/, '')

  return `${base}${sep}${sep === '\\' ? rel.replace(/\//g, '\\') : rel}`
}

function useFileIndex(cwd: string, wanted: boolean, refreshNonce: number) {
  const tick = useStore($workspaceChangeTick)

  const [state, setState] = useState<{ cwd: string; loading: boolean; result: HermesListFilesResult | null }>({
    cwd: '',
    loading: false,
    result: null
  })

  useEffect(() => {
    if (!wanted || !cwd) {
      return
    }

    // The agent (or a terminal command) changed files: the index is stale.
    if (tick !== indexTick) {
      indexTick = tick
      indexCache.clear()
    }

    const cached = indexCache.get(cwd)

    if (cached && Date.now() - cached.at < INDEX_FRESH_MS) {
      setState({ cwd, loading: false, result: cached.result })

      return
    }

    let cancelled = false
    setState(prev => ({
      cwd,
      loading: true,
      result: prev.cwd === cwd ? prev.result : (cached?.result ?? null)
    }))

    void listDesktopFiles(cwd)
      .catch(error => ({
        error: error instanceof Error ? error.message : 'read-error',
        files: [],
        root: cwd,
        source: 'none' as const,
        truncated: false
      }))
      .then(result => {
        if (!result.error) {
          indexCache.set(cwd, { at: Date.now(), result })
        }

        if (!cancelled) {
          setState({ cwd, loading: false, result })
        }
      })

    return () => {
      cancelled = true
    }
  }, [cwd, refreshNonce, tick, wanted])

  return state.cwd === cwd ? state : { cwd, loading: wanted, result: null }
}

function Highlighted({ from, indices, text }: { from: number; indices: number[]; text: string }): ReactNode {
  const marks = new Set(indices.filter(i => i >= from && i < from + text.length).map(i => i - from))

  if (!marks.size) {
    return text
  }

  return [...text].map((ch, i) =>
    marks.has(i) ? (
      <span className="font-semibold text-foreground" key={i}>
        {ch}
      </span>
    ) : (
      ch
    )
  )
}

function ResultRow({
  active,
  index,
  match,
  onChoose,
  onHover
}: {
  active: boolean
  index: number
  match: FileMatch
  onChoose: (attach: boolean) => void
  onHover: () => void
}) {
  const cut = match.path.lastIndexOf('/') + 1
  const name = match.path.slice(cut)
  const dir = match.path.slice(0, Math.max(cut - 1, 0))

  // VS Code layout: icon, file name (matched letters bold), folder dimmed.
  return (
    <button
      aria-selected={active}
      className={cn(
        'flex h-[1.375rem] w-full min-w-0 items-center gap-1.5 rounded px-2 text-left text-[0.75rem]',
        active ? 'bg-(--ui-control-active-background) text-foreground' : 'hover:bg-sidebar-accent'
      )}
      data-index={index}
      onClick={event => onChoose(event.ctrlKey || event.metaKey)}
      onMouseDown={event => event.preventDefault()}
      onMouseEnter={onHover}
      role="option"
      title={match.path}
      type="button"
    >
      <FileTypeIcon className="shrink-0 text-muted-foreground" path={name} size="0.875rem" />
      <span className="shrink-0 truncate text-foreground/90">
        <Highlighted from={cut} indices={match.indices} text={name} />
      </span>
      {dir && (
        <span className="min-w-0 truncate text-[0.68rem] text-muted-foreground">
          <Highlighted from={0} indices={match.indices} text={dir} />
        </span>
      )}
    </button>
  )
}

export interface FileQuickSearchProps {
  cwd: string
  onAttachFile: (path: string) => void
  onOpenFile: (path: string) => void
  onQueryChange: (query: string) => void
  query: string
}

export function FileQuickSearch({ cwd, onAttachFile, onOpenFile, onQueryChange, query }: FileQuickSearchProps) {
  const { t } = useI18n()
  const r = t.rightSidebar
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [focused, setFocused] = useState(false)
  const [active, setActive] = useState(0)
  const [refreshNonce, setRefreshNonce] = useState(0)
  const deferredQuery = useDeferredValue(query)
  const trimmed = deferredQuery.trim()
  const { loading, result } = useFileIndex(cwd, focused || Boolean(query), refreshNonce)

  const matches: FileMatch[] = useMemo(
    () => (trimmed && result?.files.length ? rankFiles(trimmed, result.files, RESULT_LIMIT) : []),
    [result, trimmed]
  )

  // Nothing typed: recently opened files that still exist in the index.
  const recents: FileMatch[] = useMemo(() => {
    if (!focused || trimmed) {
      return []
    }

    const known = result ? new Set(result.files) : null

    return recentFilesFor(cwd)
      .filter(rel => !known || known.has(rel))
      .map(rel => ({ indices: [], path: rel, score: 0 }))
    // refreshNonce: re-read storage each time the box is focused.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cwd, focused, refreshNonce, result, trimmed])

  const rows = trimmed ? matches : recents

  useEffect(() => setActive(0), [trimmed])

  // Coming back to the window (e.g. after saving a file elsewhere) refreshes
  // the index while the search is in use.
  useEffect(() => {
    if (!focused && !query) {
      return
    }

    const onWindowFocus = () => setRefreshNonce(n => n + 1)
    window.addEventListener('focus', onWindowFocus)

    return () => window.removeEventListener('focus', onWindowFocus)
  }, [focused, query])

  useEffect(() => {
    const onFocusRequest = () => {
      inputRef.current?.focus({ preventScroll: true })
      inputRef.current?.select()
    }

    window.addEventListener(FILE_SEARCH_FOCUS_EVENT, onFocusRequest)

    return () => window.removeEventListener(FILE_SEARCH_FOCUS_EVENT, onFocusRequest)
  }, [])

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView?.({ block: 'nearest' })
  }, [active])

  const choose = (match: FileMatch | undefined, attach: boolean) => {
    if (!match) {
      return
    }

    if (!result) {
      // Recent entry picked before the index arrived.
      const absolute = absolutePathFor(cwd, match.path)
      recordRecentFile(cwd, absolute)

      if (attach) {
        onAttachFile(absolute)
      } else {
        onOpenFile(absolute)
      }

      return
    }

    const absolute = absolutePathFor(result.root || cwd, match.path)
    recordRecentFile(cwd, absolutePathFor(cwd, match.path))

    if (attach) {
      onAttachFile(absolute)

      return
    }

    onOpenFile(absolute)
    onQueryChange('')
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive(i => Math.min(i + 1, Math.max(rows.length - 1, 0)))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive(i => Math.max(i - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      choose(rows[active], event.ctrlKey || event.metaKey)
    } else if (event.key === 'Escape') {
      event.preventDefault()

      if (query) {
        onQueryChange('')
      } else {
        inputRef.current?.blur()
      }
    }
  }

  const unavailable = result?.error === 'remote-unsupported'

  return (
    <div className={cn('flex min-h-0 flex-col', query.trim() ? 'flex-1' : 'shrink-0')} data-file-quick-search="">
      <label className="mx-2 mb-1 flex h-7 items-center gap-1.5 rounded-md border border-(--ui-stroke-secondary) bg-(--ui-control-background,transparent) px-2 focus-within:border-(--ui-stroke-primary,currentColor)">
        <Codicon className="shrink-0 text-muted-foreground" name="search" />
        <input
          aria-label={r.fileSearchPlaceholder}
          className="min-w-0 flex-1 bg-transparent text-[0.75rem] text-foreground outline-none placeholder:text-muted-foreground"
          data-testid="file-quick-search"
          onBlur={() => setFocused(false)}
          onChange={event => onQueryChange(event.target.value)}
          onFocus={() => {
            setFocused(true)
            setRefreshNonce(n => n + 1)
          }}
          onKeyDown={onKeyDown}
          placeholder={r.fileSearchPlaceholder}
          ref={inputRef}
          spellCheck={false}
          type="text"
          value={query}
        />
        {query && (
          <button
            aria-label="Clear"
            className="shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => onQueryChange('')}
            type="button"
          >
            <Codicon name="close" />
          </button>
        )}
      </label>
      {query.trim() ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-2" ref={listRef} role="listbox">
          {unavailable ? (
            <p className="px-2 py-1.5 text-[0.7rem] text-muted-foreground">{r.fileSearchUnavailable}</p>
          ) : loading && !result ? (
            <p className="px-2 py-1.5 text-[0.7rem] text-muted-foreground">{r.fileSearchLoading}</p>
          ) : matches.length === 0 ? (
            <p className="px-2 py-1.5 text-[0.7rem] text-muted-foreground">{r.fileSearchNoResults}</p>
          ) : (
            <>
              {matches.map((match, index) => (
                <ResultRow
                  active={index === active}
                  index={index}
                  key={match.path}
                  match={match}
                  onChoose={attach => choose(match, attach)}
                  onHover={() => setActive(index)}
                />
              ))}
              {result?.truncated && (
                <p className="px-2 pt-1 text-[0.65rem] text-muted-foreground">
                  {r.fileSearchTruncated(String(result.files.length))}
                </p>
              )}
              <p className="px-2 pt-1 text-[0.65rem] text-muted-foreground">{r.fileSearchHint}</p>
            </>
          )}
        </div>
      ) : (
        recents.length > 0 && (
          <div className="max-h-72 shrink-0 overflow-y-auto px-1 pb-1" ref={listRef} role="listbox">
            <p className="px-2 pt-0.5 pb-0.5 text-[0.65rem] tracking-wide text-muted-foreground uppercase">
              {r.fileSearchRecent}
            </p>
            {recents.map((match, index) => (
              <ResultRow
                active={index === active}
                index={index}
                key={match.path}
                match={match}
                onChoose={attach => choose(match, attach)}
                onHover={() => setActive(index)}
              />
            ))}
          </div>
        )
      )}
    </div>
  )
}
