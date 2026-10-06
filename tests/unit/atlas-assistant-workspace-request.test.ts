import { describe, expect, it } from 'vitest';
import {
  normalizeWorkspaceRequest,
  normalizeWorkspaceResult
} from '../../supabase/functions/atlas-copilot/workspace-request.mjs';

const readyCapabilities = [
  { id: 'chat', state: 'ready' },
  { id: 'work', state: 'ready' },
  { id: 'build', state: 'configuration_required' },
  { id: 'attachments', state: 'configuration_required' },
  { id: 'voice', state: 'ready' },
  { id: 'apps', state: 'gated' },
  { id: 'knowledge', state: 'gated' },
  { id: 'web-research', state: 'gated' },
  { id: 'artifacts', state: 'gated' },
  { id: 'computer', state: 'gated' }
];

describe('ATLAS Assistant normalized workspace request', () => {
  it('preserves chat provider/profile and defaults to auto execution without invented sources', () => {
    const request = normalizeWorkspaceRequest({
      experience: 'chat',
      message: 'Analyze this',
      conversation_id: 'conv-1',
      mode: 'openai',
      profile: 'deep'
    }, readyCapabilities);

    expect(request).toMatchObject({
      experience: 'chat',
      message: 'Analyze this',
      conversation_id: 'conv-1',
      mode: 'openai',
      profile: 'deep',
      execution_mode: 'auto',
      source_refs: [],
      requested_capabilities: []
    });
  });

  it('forces Work through durable background execution while preserving the conversation', () => {
    const request = normalizeWorkspaceRequest({
      experience: 'work',
      message: 'Reconcile these records end to end',
      conversation_id: 'conv-7',
      mode: 'auto',
      profile: 'balanced',
      execution_mode: 'interactive'
    }, readyCapabilities);

    expect(request.experience).toBe('work');
    expect(request.execution_mode).toBe('background');
    expect(request.conversation_id).toBe('conv-7');
  });

  it('fails closed when Build runtime capability is not ready and never downgrades to Chat', () => {
    expect(() => normalizeWorkspaceRequest({
      experience: 'build',
      message: 'Fix the repository tests',
      mode: 'codex-sovereign',
      profile: 'deep'
    }, readyCapabilities)).toThrowError(expect.objectContaining({ code: 'build_runtime_unavailable' }));
  });

  it('rejects any selected source that is not server-ready', () => {
    expect(() => normalizeWorkspaceRequest({
      experience: 'chat',
      message: 'Use this source',
      mode: 'auto',
      profile: 'balanced',
      source_refs: [{ kind: 'knowledge', id: 'kb-1', label: 'Knowledge', state: 'gated' }]
    }, readyCapabilities)).toThrowError(expect.objectContaining({ code: 'source_unavailable' }));
  });

  it('rejects attachment and project sources while Phase 1 ingestion/project persistence is gated', () => {
    expect(() => normalizeWorkspaceRequest({
      experience: 'chat',
      message: 'Read this file',
      mode: 'auto',
      profile: 'balanced',
      source_refs: [{ kind: 'attachment', id: 'file-1', label: 'File', state: 'ready' }]
    }, readyCapabilities)).toThrowError(expect.objectContaining({ code: 'attachment_pipeline_unavailable' }));

    expect(() => normalizeWorkspaceRequest({
      experience: 'chat',
      message: 'Use this project',
      mode: 'auto',
      profile: 'balanced',
      source_refs: [{ kind: 'project', id: 'project-1', label: 'Project', state: 'ready' }]
    }, readyCapabilities)).toThrowError(expect.objectContaining({ code: 'source_unavailable' }));
  });

  it('keeps explicit interactive Chat execution for voice and translator turns', () => {
    const request = normalizeWorkspaceRequest({
      experience: 'chat',
      message: 'Translate this turn',
      mode: 'auto',
      profile: 'fast',
      execution_mode: 'interactive',
      requested_capabilities: ['voice']
    }, readyCapabilities);

    expect(request.execution_mode).toBe('interactive');
    expect(request.requested_capabilities).toEqual(['voice']);
  });

  it('maps queued background work into one durable workspace result envelope', () => {
    const request = normalizeWorkspaceRequest({
      experience: 'work',
      message: 'Run the reconciliation',
      conversation_id: 'conv-22',
      mode: 'auto',
      profile: 'deep'
    }, readyCapabilities);

    const result = normalizeWorkspaceResult(request, {
      status: 'queued',
      trace_id: 'trace-22',
      conversation_id: 'conv-22',
      text: '',
      provider: 'openai',
      model: 'model-1'
    });

    expect(result).toEqual({
      ok: true,
      conversation_id: 'conv-22',
      execution_id: 'trace-22',
      trace_id: 'trace-22',
      experience: 'work',
      state: 'queued',
      text: null,
      providers: ['openai'],
      model: 'model-1',
      profile: 'deep',
      capability_ids: ['work'],
      artifact_refs: [],
      approval_refs: [],
      provenance: [],
      error: null
    });
  });

  it('maps interactive provider output to completed without inventing artifacts or approvals', () => {
    const request = normalizeWorkspaceRequest({
      experience: 'chat',
      message: 'Answer now',
      mode: 'openai',
      profile: 'balanced'
    }, readyCapabilities);

    const result = normalizeWorkspaceResult(request, {
      output: 'Completed answer',
      conversation_id: 'conv-23',
      providers: ['openai'],
      model: 'model-2',
      provenance: [{ type: 'provider' }]
    });

    expect(result).toMatchObject({
      conversation_id: 'conv-23',
      execution_id: null,
      experience: 'chat',
      state: 'completed',
      text: 'Completed answer',
      providers: ['openai'],
      model: 'model-2',
      profile: 'balanced',
      capability_ids: ['chat'],
      artifact_refs: [],
      approval_refs: [],
      error: null
    });
    expect(result.provenance).toEqual([{ type: 'provider' }]);
  });
});
