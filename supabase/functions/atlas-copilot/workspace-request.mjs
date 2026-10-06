const EXPERIENCES = new Set(['chat', 'work', 'build']);
const MODES = new Set(['auto', 'atlas-local', 'openai', 'bedrock', 'gemini', 'codex-sovereign', 'council']);
const PROFILES = new Set(['fast', 'balanced', 'deep']);
const EXECUTION_MODES = new Set(['auto', 'interactive', 'background']);
const CAPABILITY_IDS = new Set([
  'chat',
  'work',
  'build',
  'web-research',
  'attachments',
  'voice',
  'apps',
  'knowledge',
  'artifacts',
  'computer'
]);
const SOURCE_KINDS = new Set(['module', 'knowledge', 'app', 'attachment', 'conversation', 'project']);

function workspaceError(code, status = 400) {
  return Object.assign(new Error(code), { code, status });
}

function capability(capabilities, id) {
  return Array.isArray(capabilities) ? capabilities.find((item) => item?.id === id) || null : null;
}

function requireExperienceReady(experience, capabilities) {
  const current = capability(capabilities, experience);
  if (current?.state === 'ready') return;
  if (experience === 'build') throw workspaceError('build_runtime_unavailable', 503);
  if (experience === 'work') throw workspaceError('work_runtime_unavailable', 503);
  throw workspaceError('capability_unavailable', 503);
}

function normalizeRequestedCapabilities(value, capabilities) {
  if (!Array.isArray(value)) return [];
  const result = [];
  for (const raw of value) {
    const id = String(raw || '').trim();
    if (!CAPABILITY_IDS.has(id) || result.includes(id)) continue;
    const current = capability(capabilities, id);
    if (current?.state !== 'ready') throw workspaceError('capability_unavailable', 503);
    result.push(id);
  }
  return result;
}

function normalizeSourceRefs(value, capabilities) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 20).map((source) => {
    const kind = String(source?.kind || '').trim();
    const id = String(source?.id || '').trim();
    const label = String(source?.label || '').trim();
    const state = String(source?.state || '').trim();
    if (!SOURCE_KINDS.has(kind) || !id || !label) throw workspaceError('source_unavailable', 400);
    if (state !== 'ready') throw workspaceError('source_unavailable', 403);

    if (kind === 'attachment' && capability(capabilities, 'attachments')?.state !== 'ready') {
      throw workspaceError('attachment_pipeline_unavailable', 503);
    }
    if (kind === 'project') throw workspaceError('source_unavailable', 503);
    if (kind === 'knowledge' && capability(capabilities, 'knowledge')?.state !== 'ready') {
      throw workspaceError('source_unavailable', 403);
    }
    if (kind === 'app' && capability(capabilities, 'apps')?.state !== 'ready') {
      throw workspaceError('source_unavailable', 403);
    }

    return {
      kind,
      id,
      label,
      state: 'ready',
      ...(source?.provenance && typeof source.provenance === 'object' ? { provenance: source.provenance } : {})
    };
  });
}

function normalizeExecutionState(result) {
  const state = String(result?.state || result?.status || '').trim().toLowerCase();
  if (state === 'queued') return 'queued';
  if (state === 'running' || state === 'in_progress' || state === 'in-progress') return 'running';
  if (state === 'failed' || state === 'error') return 'failed';
  if (state === 'approval_required' || state === 'approval-required') return 'approval_required';
  if (state === 'configuration_required' || state === 'configuration-required') return 'configuration_required';
  return 'completed';
}

function stringArray(value) {
  return Array.isArray(value) ? value.map((item) => String(item || '').trim()).filter(Boolean) : [];
}

export function normalizeWorkspaceRequest(input = {}, capabilities = []) {
  const experience = String(input?.experience || 'chat').trim();
  if (!EXPERIENCES.has(experience)) throw workspaceError('invalid_input', 400);
  requireExperienceReady(experience, capabilities);

  const message = String(input?.message || '').trim();
  if (!message) throw workspaceError('invalid_input', 400);

  const mode = String(input?.mode || 'auto').trim();
  if (!MODES.has(mode)) throw workspaceError('invalid_input', 400);
  const profile = String(input?.profile || 'balanced').trim();
  if (!PROFILES.has(profile)) throw workspaceError('invalid_input', 400);

  const requestedExecution = String(input?.execution_mode || 'auto').trim();
  if (!EXECUTION_MODES.has(requestedExecution)) throw workspaceError('invalid_input', 400);
  const executionMode = experience === 'work' || experience === 'build' ? 'background' : requestedExecution;

  return {
    experience,
    message,
    conversation_id: input?.conversation_id ? String(input.conversation_id) : null,
    mode,
    profile,
    execution_mode: executionMode,
    source_refs: normalizeSourceRefs(input?.source_refs, capabilities),
    requested_capabilities: normalizeRequestedCapabilities(input?.requested_capabilities, capabilities)
  };
}

export function normalizeWorkspaceResult(request, result = {}) {
  const providerList = stringArray(result?.providers);
  if (!providerList.length && result?.provider) providerList.push(String(result.provider));
  const capabilityIds = [...new Set([request?.experience, ...(request?.requested_capabilities || [])])]
    .filter((id) => CAPABILITY_IDS.has(id));
  const rawText = String(result?.output ?? result?.text ?? '').trim();
  const traceId = result?.trace_id ? String(result.trace_id) : null;

  return {
    ok: result?.ok === false ? false : true,
    conversation_id: result?.conversation_id ? String(result.conversation_id) : request?.conversation_id || null,
    execution_id: result?.execution_id ? String(result.execution_id) : traceId,
    trace_id: traceId,
    experience: request?.experience || 'chat',
    state: normalizeExecutionState(result),
    text: rawText || null,
    providers: providerList,
    model: result?.model ? String(result.model) : null,
    profile: request?.profile || 'balanced',
    capability_ids: capabilityIds,
    artifact_refs: stringArray(result?.artifact_refs),
    approval_refs: stringArray(result?.approval_refs),
    provenance: Array.isArray(result?.provenance) ? result.provenance : [],
    error: result?.error ? String(result.error) : null
  };
}
