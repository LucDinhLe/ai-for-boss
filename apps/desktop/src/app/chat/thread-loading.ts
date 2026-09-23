import type { ChatMessage } from '@/lib/chat-messages'

export type ThreadLoadingState = 'response' | 'session'

export function lastVisibleMessageIsUser(messages: ChatMessage[]): boolean {
  // Allocation-free reverse scan — runs in a hot $messages computed.
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (!messages[i].hidden) {
      return messages[i].role === 'user'
    }
  }

  return false
}

export function threadLoadingState(
  loadingSession: boolean,
  busy: boolean,
  awaitingResponse: boolean,
  lastVisibleIsUser: boolean
): ThreadLoadingState | undefined {
  if (loadingSession) {
    return 'session'
  }

  if (busy && awaitingResponse && lastVisibleIsUser) {
    return 'response'
  }

  return undefined
}

/** Whether the chat bar stays mounted for this render.
 *
 *  The loader can flip on for a session the user is already looking at: a
 *  periodic sidebar / live-status refresh briefly drops the routed row from the
 *  session list, or a hydrate swaps the transcript through an empty frame. Both
 *  read as `loadingSession` for one render and used to unmount the composer,
 *  so the input (draft, attachments, caret, focus) vanished and reappeared
 *  every ~30s (upstream #117375; salvaged into Hermes Vietnamese 2026.9.5). Once a routed session has rendered with its composer
 *  once, a later transient loader for the SAME route keeps it mounted; only a
 *  route change (or the exhausted / watch-window states) hides it again. */
export function composerStaysMounted({
  hideComposer,
  loadingSession,
  routedSessionId,
  settledRoutedSessionId
}: {
  hideComposer: boolean
  loadingSession: boolean
  routedSessionId: null | string
  settledRoutedSessionId: null | string
}): boolean {
  if (hideComposer) {
    return false
  }

  if (!loadingSession) {
    return true
  }

  return Boolean(routedSessionId) && routedSessionId === settledRoutedSessionId
}
