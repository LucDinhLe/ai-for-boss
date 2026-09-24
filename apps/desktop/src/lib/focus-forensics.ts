// Hermes Vietnamese 2026.9.5: diagnostics for "the chat input flickers and loses
// focus while I type". Records WHO moved focus away from the composer (the last
// programmatic .focus() call with a short stack), whether the editor was
// removed from the DOM (remount), became non-editable, or the whole window lost
// focus. Lines go to desktop.log via the renderer console hook (prefix
// whitelisted in electron/renderer-log.ts). No typed text is ever logged.

import { RICH_INPUT_SLOT } from '@/app/chat/composer/rich-editor'

export const FOCUS_FORENSICS_PREFIX = '[focus-forensics]'

const USER_INPUT_GRACE_MS = 400
const LOG_THROTTLE_MS = 1500

interface FocusCall {
  at: number
  stack: string
  target: string
}

export function describeElement(el: Element | null | undefined): string {
  if (!el) {
    return 'none'
  }

  if (el === document.body) {
    return 'body'
  }

  const parts = [el.tagName.toLowerCase()]
  const slot = el.getAttribute('data-slot')
  const testId = el.getAttribute('data-testid')
  const role = el.getAttribute('role')
  const aria = el.getAttribute('aria-label')

  if (el.id) {
    parts.push(`#${el.id}`)
  }

  if (slot) {
    parts.push(`[slot=${slot}]`)
  }

  if (testId) {
    parts.push(`[testid=${testId}]`)
  }

  if (role) {
    parts.push(`[role=${role}]`)
  }

  if (aria) {
    parts.push(`[aria=${aria.slice(0, 40)}]`)
  }

  const terminal = el.closest('[data-terminal]')

  if (terminal) {
    parts.push('(in terminal)')
  }

  return parts.join('')
}

function shortStack(): string {
  return (new Error().stack || '')
    .split('\n')
    .slice(3, 9)
    .map(line => line.trim().replace(/\(?(?:file|https?):\/\/[^)]*\/([^/)]+)\)?/, '$1'))
    .join(' < ')
}

function isComposerEditor(el: EventTarget | null): el is HTMLElement {
  return el instanceof HTMLElement && el.getAttribute('data-slot') === RICH_INPUT_SLOT
}

let installed = false

export function installFocusForensics(log: (line: string) => void = line => console.warn(line)): () => void {
  if (installed || typeof window === 'undefined') {
    return () => undefined
  }

  installed = true

  let lastUserInputAt = 0
  let lastLogAt = 0
  let lastFocusCall: FocusCall | null = null
  const nativeFocus = HTMLElement.prototype.focus

  const emit = (message: string) => {
    const now = Date.now()

    if (now - lastLogAt < LOG_THROTTLE_MS) {
      return
    }

    lastLogAt = now
    log(`${FOCUS_FORENSICS_PREFIX} ${message}`)
  }

  HTMLElement.prototype.focus = function patchedFocus(this: HTMLElement, options?: FocusOptions) {
    if (!isComposerEditor(this)) {
      lastFocusCall = { at: Date.now(), stack: shortStack(), target: describeElement(this) }
    }

    return nativeFocus.call(this, options)
  }

  // Only gestures that legitimately MOVE focus count as user intent: a click
  // somewhere, or Tab. Ordinary typing must not mask a focus theft mid-word.
  const markUserInput = (event: Event) => {
    if (event instanceof KeyboardEvent && event.key !== 'Tab' && event.key !== 'Escape') {
      return
    }

    lastUserInputAt = Date.now()
  }

  const onFocusOut = (event: FocusEvent) => {
    const editor = event.target

    if (!isComposerEditor(editor)) {
      return
    }

    window.setTimeout(() => {
      if (Date.now() - lastUserInputAt < USER_INPUT_GRACE_MS) {
        return
      }

      const active = document.activeElement

      if (isComposerEditor(active)) {
        return
      }

      const reasons: string[] = []

      if (!editor.isConnected) {
        reasons.push('editor removed from DOM (composer remounted)')
      }

      if (editor.isConnected && editor.getAttribute('contenteditable') === 'false') {
        reasons.push('editor became non-editable')
      }

      if (!document.hasFocus()) {
        reasons.push('window lost focus (other window / OS)')
      }

      const call =
        lastFocusCall && Date.now() - lastFocusCall.at < 1000
          ? `; last focus() -> ${lastFocusCall.target} via ${lastFocusCall.stack}`
          : ''

      emit(
        `composer lost focus without user input -> active=${describeElement(active)}` +
          (reasons.length ? `; ${reasons.join('; ')}` : '') +
          call
      )
    }, 0)
  }

  window.addEventListener('pointerdown', markUserInput, true)
  window.addEventListener('keydown', markUserInput, true)
  window.addEventListener('focusout', onFocusOut, true)

  return () => {
    HTMLElement.prototype.focus = nativeFocus
    window.removeEventListener('pointerdown', markUserInput, true)
    window.removeEventListener('keydown', markUserInput, true)
    window.removeEventListener('focusout', onFocusOut, true)
    installed = false
  }
}
