import { useStore } from '@nanostores/react'
import { type KeyboardEvent, type ReactNode, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'

import { Codicon } from '@/components/ui/codicon'
import type { HermesListFilesResult } from '@/global'
import { useI18n } from '@/i18n'
import { listDesktopFiles } from '@/lib/desktop-fs'
import { type FileMatch, rankFiles } from '@/lib/fuzzy-file-match'
import { cn } from '@/lib/utils'
import { FILE_SEARCH_FOCUS_EVENT } from '@/store/layout'
import { $workspaceChangeTick } from '@/store/workspace-events'

// VS Code style Quick Open for the file panel: type part of a name, get a flat
// ranked list of every file in the project, no folder-by-folder expanding.

const INDEX_TTL_MS = 60_000
const RESULT_LIMIT = 100

interface CachedIndex {
  at: number
  result: HermesListFilesResult
}

const indexCache = new Map<string, CachedIndex>()
let indexTick = -1

export function clearFileSearchIndex() {
  indexCache.clear()
}

export function absolutePathFor(root: string, rel: string): string {
  const sep = root.includes('\\') && !root.includes('/') ? '\\' : '/'
  const base = root.replace(/[\\/]+$/, '')

  return `${base}${sep}${sep === '\\' ? rel.replace(/\//g, '\\') : rel}`
}

function useFileIndex(cwd: string, wanted: boolean) {
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

    if (cached && Date.now() - cached.at < INDEX_TTL_MS) {
      setState({ cwd, loading: false, result: cached.result })

      return
    }

    let cancelled = false
    setState(prev => ({ cwd, loading: true, result: prev.cwd === cwd ? prev.result : null }))

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
  }, [cwd, tick, wanted])

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
  const deferredQuery = useDeferredValue(query)
  const trimmed = deferredQuery.trim()
  const { loading, result } = useFileIndex(cwd, focused || Boolean(query))

  const matches: FileMatch[] = useMemo(
    () => (trimmed && result?.files.length ? rankFiles(trimmed, result.files, RESULT_LIMIT) : []),
    [result, trimmed]
  )

  useEffect(() => setActive(0), [trimmed])

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
    if (!match || !result) {
      return
    }

    const absolute = absolutePathFor(result.root || cwd, match.path)

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
      setActive(i => Math.min(i + 1, Math.max(matches.length - 1, 0)))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive(i => Math.max(i - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      choose(matches[active], event.ctrlKey || event.metaKey)
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
          onFocus={() => setFocused(true)}
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
      {query.trim() && (
        <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-2" ref={listRef} role="listbox">
          {unavailable ? (
            <p className="px-2 py-1.5 text-[0.7rem] text-muted-foreground">{r.fileSearchUnavailable}</p>
          ) : loading && !result ? (
            <p className="px-2 py-1.5 text-[0.7rem] text-muted-foreground">{r.fileSearchLoading}</p>
          ) : matches.length === 0 ? (
            <p className="px-2 py-1.5 text-[0.7rem] text-muted-foreground">{r.fileSearchNoResults}</p>
          ) : (
            <>
              {matches.map((match, index) => {
                const cut = match.path.lastIndexOf('/') + 1
                const name = match.path.slice(cut)
                const dir = match.path.slice(0, Math.max(cut - 1, 0))

                return (
                  <button
                    aria-selected={index === active}
                    className={cn(
                      'flex w-full min-w-0 items-baseline gap-2 rounded px-2 py-0.5 text-left text-[0.75rem]',
                      index === active
                        ? 'bg-(--ui-control-active-background) text-foreground'
                        : 'hover:bg-sidebar-accent'
                    )}
                    data-index={index}
                    key={match.path}
                    onClick={event => choose(match, event.ctrlKey || event.metaKey)}
                    onMouseDown={event => event.preventDefault()}
                    onMouseEnter={() => setActive(index)}
                    role="option"
                    title={match.path}
                    type="button"
                  >
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
              })}
              {result?.truncated && (
                <p className="px-2 pt-1 text-[0.65rem] text-muted-foreground">
                  {r.fileSearchTruncated(String(result.files.length))}
                </p>
              )}
              <p className="px-2 pt-1 text-[0.65rem] text-muted-foreground">{r.fileSearchHint}</p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
