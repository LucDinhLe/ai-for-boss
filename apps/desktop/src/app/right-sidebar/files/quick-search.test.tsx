import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { $connection } from '@/store/session'

import { absolutePathFor, clearFileSearchIndex, FileQuickSearch } from './quick-search'

const listFiles = vi.fn()

beforeEach(() => {
  clearFileSearchIndex()
  $connection.set(null)
  listFiles.mockReset()
  listFiles.mockResolvedValue({
    files: ['README.md', 'src/a/b/c/d/sau-tang.ts', 'Mỡ/KẾ-HOẠCH.md', 'docs/tree-notes.md', 'src/tree.tsx'],
    root: '/p',
    source: 'git',
    truncated: false
  })
  ;(window as unknown as { hermesDesktop: unknown }).hermesDesktop = { listFiles }
})

afterEach(() => {
  cleanup()
  delete (window as unknown as { hermesDesktop?: unknown }).hermesDesktop
})

function Harness({ onAttach, onOpen }: { onAttach: (p: string) => void; onOpen: (p: string) => void }) {
  const [query, setQuery] = useState('')

  return <FileQuickSearch cwd="/p" onAttachFile={onAttach} onOpenFile={onOpen} onQueryChange={setQuery} query={query} />
}

describe('absolutePathFor', () => {
  it('joins with the root separator style', () => {
    expect(absolutePathFor('/p/', 'src/a.ts')).toBe('/p/src/a.ts')
    expect(absolutePathFor('C:\\Users\\AUS-PRO\\Mỡ', 'soma/a.ts')).toBe('C:\\Users\\AUS-PRO\\Mỡ\\soma\\a.ts')
  })
})

describe('FileQuickSearch', () => {
  it('finds a deep file by name without opening folders, Enter opens it and clears the search', async () => {
    const onOpen = vi.fn()
    render(<Harness onAttach={vi.fn()} onOpen={onOpen} />)

    const input = screen.getByTestId('file-quick-search')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'sautang' } })

    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(1))
    expect(listFiles).toHaveBeenCalledWith('/p')

    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' })
    })

    expect(onOpen).toHaveBeenCalledWith('/p/src/a/b/c/d/sau-tang.ts')
    expect((input as HTMLInputElement).value).toBe('')
  })

  it('matches Vietnamese names typed without accents', async () => {
    render(<Harness onAttach={vi.fn()} onOpen={vi.fn()} />)

    const input = screen.getByTestId('file-quick-search')
    fireEvent.change(input, { target: { value: 'ke hoach' } })

    await waitFor(() => expect(screen.getByRole('option').getAttribute('title')).toBe('Mỡ/KẾ-HOẠCH.md'))
  })

  it('arrow keys move the selection and Ctrl+Enter attaches instead of opening', async () => {
    const onAttach = vi.fn()
    const onOpen = vi.fn()
    render(<Harness onAttach={onAttach} onOpen={onOpen} />)

    const input = screen.getByTestId('file-quick-search')
    fireEvent.change(input, { target: { value: 'tree' } })
    await waitFor(() => expect(screen.getAllByRole('option').length).toBe(2))

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    const second = screen.getAllByRole('option')[1].getAttribute('title')
    fireEvent.keyDown(input, { ctrlKey: true, key: 'Enter' })

    expect(onAttach).toHaveBeenCalledWith(`/p/${second}`)
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('Escape clears the query', async () => {
    render(<Harness onAttach={vi.fn()} onOpen={vi.fn()} />)

    const input = screen.getByTestId('file-quick-search') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'readme' } })
    fireEvent.keyDown(input, { key: 'Escape' })

    expect(input.value).toBe('')
  })

  it('explains that remote backends are not indexed yet', async () => {
    $connection.set({ mode: 'remote' } as never)
    render(<Harness onAttach={vi.fn()} onOpen={vi.fn()} />)

    fireEvent.change(screen.getByTestId('file-quick-search'), { target: { value: 'x' } })

    await waitFor(() => expect(screen.getByText(/only available for folders on this computer/)).toBeTruthy())
    expect(listFiles).not.toHaveBeenCalled()
    $connection.set(null)
  })
})
