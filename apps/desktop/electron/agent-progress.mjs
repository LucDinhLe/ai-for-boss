/** Public Gateway agent events have extensible data; expose presentation fields
 * only. Raw arguments/results, commands, paths and diagnostic errors stay out.
 * This does not request private reasoning or change model reasoning settings. */
const text = (value, limit) => typeof value === "string" ? value.slice(0, limit) : undefined;
const id = value => typeof value === "string" && value.length > 0 && value.length <= 512 ? value : null;
const integer = value => Number.isSafeInteger(value) && value >= 0;
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const displayName = value => typeof value === 'string' && /^[\p{L}\p{N} _().-]{1,120}$/u.test(value) ? value : undefined;

// A read of a skill definition is evidence of loading its instructions, not of
// successfully executing the skill. Never forward the parent path or task text.
function toolActivity(name, args) {
  if (!object(args)) return undefined;
  if (name === 'read') {
    const filename = typeof args.path === 'string' ? args.path : typeof args.file_path === 'string' ? args.file_path : '';
    if (filename.length > 4096) return undefined;
    const parts = filename.replaceAll('\\', '/').split('/');
    const label = parts.at(-1)?.toLowerCase() === 'skill.md' && parts.slice(0, -2).some(part => part.toLowerCase() === 'skills')
      && !['.', '..'].includes(parts.at(-2)) && displayName(parts.at(-2));
    if (label) return { kind: 'skill', label };
  }
  if (name === 'sessions_spawn' || name === 'sessions_send') {
    const agentId = typeof args.agentId === 'string' && /^[a-zA-Z0-9_-]{1,64}$/u.test(args.agentId) ? args.agentId : undefined;
    const label = displayName(args.label);
    if (label || agentId) return { kind: 'agent', ...(label ? { label } : {}), ...(agentId ? { agentId } : {}) };
  }
  return undefined;
}

export function projectAgentProgress(payload) {
  if (!object(payload) || !id(payload.sessionKey) || !id(payload.runId)
    || !integer(payload.seq) || !integer(payload.ts) || !object(payload.data)) return null;
  const { stream, data } = payload;
  let projected;
  if (stream === "thinking") {
    projected = {};
    if (typeof data.text === "string") projected.text = text(data.text, 24_000);
    else if (typeof data.delta === "string") projected.delta = text(data.delta, 24_000);
    if (data.replace === true) projected.replace = true;
    if (integer(data.progressTokens)) projected.progressTokens = data.progressTokens;
    if (!Object.hasOwn(projected, "text") && !Object.hasOwn(projected, "delta") && projected.progressTokens === undefined) return null;
  } else if (stream === "tool") {
    if (!id(data.toolCallId) || typeof data.name !== "string" || !/^[\w.:-]{1,100}$/u.test(data.name)
      || !["start", "update", "result"].includes(data.phase)) return null;
    projected = { toolCallId: data.toolCallId, name: data.name, phase: data.phase };
    if (typeof data.isError === "boolean") projected.isError = data.isError;
    const activity = toolActivity(data.name, data.args);
    if (activity) projected.activity = activity;
  } else if (stream === "lifecycle" || stream === "run_status") {
    if (!["start", "end", "error", "preparing_workspace", "naming_worktree", "creating_worktree", "running_setup",
      "provisioning_environment", "preparing_context", "starting_model"].includes(data.phase)) return null;
    projected = { phase: data.phase };
    if (data.aborted === true) projected.aborted = true;
  } else if (stream === "plan") {
    if (data.phase !== "update" || !Array.isArray(data.steps)) return null;
    const steps = data.steps.slice(0, 30).flatMap(step => object(step) && typeof step.step === "string"
      && ["pending", "in_progress", "completed"].includes(step.status)
      ? [{ step: text(step.step, 600), status: step.status }] : []);
    projected = { phase: "update", steps };
    if (typeof data.explanation === "string") projected.explanation = text(data.explanation, 2000);
  } else return null;
  return { sessionKey: payload.sessionKey, runId: payload.runId, seq: payload.seq, ts: payload.ts, stream, data: projected };
}
