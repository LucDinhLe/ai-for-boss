import { describe, expect, it } from 'vitest'

import { foldText, matchFile, rankFiles } from './fuzzy-file-match'

const FILES = [
  'README.md',
  'apps/desktop/src/app/right-sidebar/files/use-project-tree.ts',
  'apps/desktop/src/app/right-sidebar/files/tree.tsx',
  'docs/release-engineering-rulebook.md',
  'Mỡ/KẾ-HOẠCH-SỬA-ỔN-ĐỊNH.md',
  'src/a/b/c/d/sau-tang.ts',
  'scripts/engine-sync.mjs'
]

describe('foldText', () => {
  it('drops Vietnamese accents and lowercases', () => {
    expect(foldText('KẾ-HOẠCH Mỡ Đà Lạt')).toBe('ke-hoach mo da lat')
  })
})

describe('matchFile', () => {
  it('matches characters in order, ignores accents', () => {
    expect(matchFile('kehoach', 'Mỡ/KẾ-HOẠCH-SỬA-ỔN-ĐỊNH.md')).not.toBeNull()
    expect(matchFile('mo', 'Mỡ/KẾ-HOẠCH.md')).not.toBeNull()
    expect(matchFile('zzz', 'README.md')).toBeNull()
    expect(matchFile('   ', 'README.md')).toBeNull()
  })

  it('returns highlight positions inside the original path', () => {
    const match = matchFile('tree', 'files/tree.tsx')

    expect(match?.indices).toEqual([6, 7, 8, 9])
  })

  it('finds a file five folders deep by its name alone', () => {
    expect(matchFile('sautang', 'src/a/b/c/d/sau-tang.ts')).not.toBeNull()
  })
})

describe('rankFiles', () => {
  it('puts file-name matches above folder-only matches', () => {
    const ranked = rankFiles('tree', FILES).map(m => m.path)

    expect(ranked[0]).toBe('apps/desktop/src/app/right-sidebar/files/tree.tsx')
    expect(ranked).toContain('apps/desktop/src/app/right-sidebar/files/use-project-tree.ts')
  })

  it('ranks word-start acronyms like VS Code (upt → use-project-tree)', () => {
    expect(rankFiles('upt', FILES)[0]?.path).toBe('apps/desktop/src/app/right-sidebar/files/use-project-tree.ts')
  })

  it('supports folder/file queries', () => {
    expect(rankFiles('scripts/engine', FILES)[0]?.path).toBe('scripts/engine-sync.mjs')
  })

  it('caps results and ranks 20 000 paths quickly', () => {
    const many = Array.from({ length: 20_000 }, (_, i) => `pkg${i % 50}/module-${i}/index-${i}.ts`)
    const started = performance.now()
    const ranked = rankFiles('index1999', many, 100)

    expect(ranked.length).toBeLessThanOrEqual(100)
    expect(ranked[0]?.path).toBe('pkg49/module-1999/index-1999.ts')
    expect(performance.now() - started).toBeLessThan(500)
  })

  it('does not match letters scattered across folder names (VS Code behaviour)', () => {
    const paths = ['ai-for-boss/repo/data/notes.md', 'scripts/2-DON-DEP.bat']

    expect(rankFiles('bat', paths).map(m => m.path)).toEqual(['scripts/2-DON-DEP.bat'])
  })

  it('puts an exact file name above longer names that contain it', () => {
    const ranked = rankFiles('agents', ['docs/agents-guide.md', 'x/y/AGENTS.md', 'AgentPanel.tsx']).map(m => m.path)

    expect(ranked[0]).toBe('x/y/AGENTS.md')
  })

  it('highlights the best alignment, not the first letters found', () => {
    // "tree" should light up the word "tree", not t…r…e…e spread over the name.
    const match = matchFile('tree', 'files/tab-review-tree.ts')

    expect(match?.indices).toEqual([17, 18, 19, 20])
  })

  it('requires every space-separated word to match', () => {
    const paths = ['soma/KE-HOACH-SOMA-v2.md', 'ai/KE-HOACH-AI.md']

    expect(rankFiles('ke hoach soma', paths).map(m => m.path)).toEqual(['soma/KE-HOACH-SOMA-v2.md'])
  })

  it('still finds a piece typed from the middle of a word', () => {
    expect(matchFile('hoach', 'KEHOACH.md')).not.toBeNull()
  })
})
