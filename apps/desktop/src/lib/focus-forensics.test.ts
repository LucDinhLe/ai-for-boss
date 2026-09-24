import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { RICH_INPUT_SLOT } from '@/app/chat/composer/rich-editor'

import { describeElement, FOCUS_FORENSICS_PREFIX, installFocusForensics } from './focus-forensics'

let uninstall: () => void = () => undefined
const log = vi.fn()

function makeEditor() {
  const editor = document.createElement('div')
  editor.setAttribute('contenteditable', 'true')
  editor.setAttribute('data-slot', RICH_INPUT_SLOT)
  editor.tabIndex = 0
  document.body.append(editor)
  editor.focus()

  return editor
}

beforeEach(() => {
  vi.useFakeTimers()
  log.mockReset()
  uninstall = installFocusForensics(log)
})

afterEach(() => {
  uninstall()
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('focus forensics', () => {
  it('names the element and the call that stole focus from the composer', () => {
    makeEditor()
    const thief = document.createElement('textarea')
    thief.setAttribute('aria-label', 'Terminal input')
    document.body.append(thief)

    thief.focus()
    vi.runAllTimers()

    expect(log).toHaveBeenCalledTimes(1)
    const line = String(log.mock.calls[0]?.[0])
    expect(line.startsWith(FOCUS_FORENSICS_PREFIX)).toBe(true)
    expect(line).toContain('active=textarea[aria=Terminal input]')
    expect(line).toContain('last focus() -> textarea')
  })

  it('stays quiet when the user clicked elsewhere', () => {
    makeEditor()
    const other = document.createElement('input')
    document.body.append(other)

    window.dispatchEvent(new Event('pointerdown'))
    other.focus()
    vi.runAllTimers()

    expect(log).not.toHaveBeenCalled()
  })

  it('still reports a theft that happens while the user is typing', () => {
    const editor = makeEditor()
    const other = document.createElement('input')
    document.body.append(other)

    editor.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'a' }))
    other.focus()
    vi.runAllTimers()

    expect(log).toHaveBeenCalledTimes(1)
  })

  it('reports a composer remount (editor removed while focused)', () => {
    const editor = makeEditor()

    editor.remove()
    // jsdom does not fire focusout on removal; simulate the browser event.
    const event = new FocusEvent('focusout', { bubbles: true })
    Object.defineProperty(event, 'target', { value: editor })
    window.dispatchEvent(event)
    vi.runAllTimers()

    expect(log.mock.calls.map(call => String(call[0])).join('\n')).toContain('editor removed from DOM')
  })

  it('never logs typed text', () => {
    const editor = makeEditor()
    editor.textContent = 'mat khau bi mat'
    const other = document.createElement('input')
    document.body.append(other)

    other.focus()
    vi.runAllTimers()

    expect(String(log.mock.calls[0]?.[0])).not.toContain('bi mat')
  })

  it('describes elements compactly', () => {
    const el = document.createElement('button')
    el.setAttribute('data-testid', 'x')
    expect(describeElement(el)).toBe('button[testid=x]')
    expect(describeElement(null)).toBe('none')
  })
})
