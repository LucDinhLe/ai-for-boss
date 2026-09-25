interface ActiveTerminalResizeOptions {
  fitOnActivate?: boolean
  onActivate: () => void
  onFit: () => void
}

/**
 * Observe one visible xterm host.
 *
 * Inactive terminals never call this helper, so their preserved DOM/PTY stays
 * mounted without paying for ResizeObserver delivery or FitAddon work. The
 * first frame owns activation and ignores the observer's initial delivery;
 * later resize bursts are coalesced to one fit per animation frame.
 */
export function observeActiveTerminalResize(
  host: HTMLElement,
  { fitOnActivate = true, onActivate, onFit }: ActiveTerminalResizeOptions
): () => void {
  let activated = false
  let frame = 0
  let initialResizeDelivered = false
  let stopped = false

  const scheduleFit = () => {
    if (!activated || stopped || frame !== 0) {
      return
    }

    frame = window.requestAnimationFrame(() => {
      frame = 0

      if (!stopped) {
        onFit()
      }
    })
  }

  const observer = new ResizeObserver(() => {
    // ResizeObserver's initial delivery is asynchronous in browsers and may
    // arrive before OR after the activation rAF. Activation already fits the
    // current box, so absorb that first delivery in either ordering.
    if (!initialResizeDelivered) {
      initialResizeDelivered = true

      return
    }

    scheduleFit()
  })

  observer.observe(host)

  frame = window.requestAnimationFrame(() => {
    frame = 0

    if (stopped) {
      return
    }

    activated = true

    if (fitOnActivate) {
      onFit()
    }

    onActivate()
  })

  return () => {
    stopped = true
    observer.disconnect()

    if (frame !== 0) {
      window.cancelAnimationFrame(frame)
      frame = 0
    }
  }
}

/** True when the user is typing in an editable field OUTSIDE this terminal
 *  (the chat composer, a search box). A terminal mounting or re-activating in
 *  the background — a new session's cwd, an agent process tab, a status flip —
 *  must not yank the caret out of that field mid-sentence (Hermes Vietnamese
 *  2026.9.5: "the chat input flickers and I lose what I was typing"). An
 *  explicit terminal open comes from a click on a button, which is not an
 *  editable field, so it still focuses the new shell. */
export function isEditingOutside(host: Element): boolean {
  const active = document.activeElement as HTMLElement | null

  if (!active || active === document.body || host.contains(active)) {
    return false
  }

  return (
    active.isContentEditable ||
    active.getAttribute('contenteditable') === 'true' ||
    active instanceof HTMLInputElement ||
    active instanceof HTMLTextAreaElement
  )
}

export function focusTerminalIfFree(term: { focus: () => void } | null | undefined, host: Element | null): void {
  if (term && host && !isEditingOutside(host)) {
    term.focus()
  }
}
