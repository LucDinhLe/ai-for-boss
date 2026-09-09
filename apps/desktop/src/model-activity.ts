import type { ChatRun } from './chat-state';
import type { SupervisionState } from './supervision-api';

type ActivitySupervision = SupervisionState & { modelActive?: boolean };
const reviewPhases = new Set(['planning', 'revising-plan', 'plan-review', 'working', 'revising-result', 'final-review', 'failure-review']);
const endedPhases = new Set(['end', 'error', 'aborted', 'cancelled', 'completed', 'needs-changes']);
const modelPhases = new Set(['start', 'started', 'running', 'thinking', 'tool', 'working', 'planning', 'starting_model']);
const nonModelPhases = new Set([...endedPhases, 'preparing_workspace', 'naming_worktree', 'creating_worktree',
  'running_setup', 'provisioning_environment', 'preparing_context']);

/** Renderer locks may include local file saving. Only current native activity is a model signal. */
export function isModelActive({ connected, activeKey, historyReady, run, supervision }: {
  connected: boolean;
  activeKey: string | null;
  historyReady: boolean;
  run: ChatRun;
  supervision: ActivitySupervision | null;
}): boolean {
  if (!connected || !activeKey || !historyReady) return false;
  if (supervision?.key === activeKey && supervision.busy && supervision.modelActive === true
    && reviewPhases.has(supervision.phase)) {
    // A worker ACK remains owned through preparation and final history. More specific
    // public progress takes precedence, while separate Advisor inference uses host truth.
    if (['working', 'revising-result'].includes(supervision.phase) && run.busy && run.runId && run.nativeActive === false
      && (nonModelPhases.has(run.state ?? '') || nonModelPhases.has(run.progress?.phase ?? ''))) return false;
    return true;
  }
  if (!run.busy || run.terminal) return false;
  // Reducers track the latest native frame; progress and chat sequence numbers are independent.
  if (typeof run.nativeActive === 'boolean') return run.nativeActive;
  if (endedPhases.has(run.state ?? '') || endedPhases.has(run.progress?.phase ?? '')) return false;
  if (run.activeRunIds?.some(id => Boolean(id) && (run.runId === null || id === run.runId))) return true;
  if (!run.runId) return false;
  return (Number.isSafeInteger(run.seq) && run.seq >= 0 && (run.state === 'delta' || modelPhases.has(run.state ?? '')))
    || (Number.isSafeInteger(run.progress?.seq) && (run.progress?.seq ?? -1) >= 0 && modelPhases.has(run.progress?.phase ?? ''));
}
