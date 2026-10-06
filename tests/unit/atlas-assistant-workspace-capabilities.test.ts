import { describe, expect, it } from 'vitest';
import { buildWorkspaceCapabilities } from '../../supabase/functions/atlas-copilot/workspace-capabilities.mjs';

function stateOf(capabilities: Array<{ id: string; state: string; reason?: string | null }>, id: string) {
  return capabilities.find((capability) => capability.id === id);
}

const verifiedProvider = [{ id: 'openai', verified: true, state: 'verified' }];
const noVerifiedProvider = [{ id: 'openai', verified: false, state: 'configuration-required' }];

describe('ATLAS Assistant workspace capability manifest', () => {
  it('marks chat ready only when a provider is verified', () => {
    const ready = buildWorkspaceCapabilities({
      providers: verifiedProvider,
      backgroundReady: true,
      buildRuntimeReady: false,
      attachmentPipelineReady: false,
      voiceReady: true
    });
    const unavailable = buildWorkspaceCapabilities({
      providers: noVerifiedProvider,
      backgroundReady: true,
      buildRuntimeReady: false,
      attachmentPipelineReady: false,
      voiceReady: true
    });

    expect(stateOf(ready, 'chat')).toMatchObject({ state: 'ready', reason: null });
    expect(stateOf(unavailable, 'chat')).toMatchObject({ state: 'unavailable' });
  });

  it('requires both verified intelligence and background execution for work', () => {
    const ready = buildWorkspaceCapabilities({
      providers: verifiedProvider,
      backgroundReady: true,
      buildRuntimeReady: false,
      attachmentPipelineReady: false,
      voiceReady: true
    });
    const blocked = buildWorkspaceCapabilities({
      providers: verifiedProvider,
      backgroundReady: false,
      buildRuntimeReady: false,
      attachmentPipelineReady: false,
      voiceReady: true
    });

    expect(stateOf(ready, 'work')).toMatchObject({ state: 'ready', supports_background: true });
    expect(stateOf(blocked, 'work')).toMatchObject({ state: 'unavailable', supports_background: true });
  });

  it('fails closed for build until developer and repository runtime readiness is verified', () => {
    const gated = buildWorkspaceCapabilities({
      providers: verifiedProvider,
      backgroundReady: true,
      buildRuntimeReady: false,
      attachmentPipelineReady: false,
      voiceReady: true
    });
    const ready = buildWorkspaceCapabilities({
      providers: verifiedProvider,
      backgroundReady: true,
      buildRuntimeReady: true,
      attachmentPipelineReady: false,
      voiceReady: true
    });

    expect(stateOf(gated, 'build')).toMatchObject({
      state: 'configuration_required',
      reason: 'verified_developer_runtime_required'
    });
    expect(stateOf(ready, 'build')).toMatchObject({ state: 'ready', reason: null });
  });

  it('keeps attachment upload and future phase capabilities gated when their real backend is absent', () => {
    const capabilities = buildWorkspaceCapabilities({
      providers: verifiedProvider,
      backgroundReady: true,
      buildRuntimeReady: false,
      attachmentPipelineReady: false,
      voiceReady: true
    });

    expect(stateOf(capabilities, 'attachments')).toMatchObject({
      state: 'configuration_required',
      reason: 'secure_attachment_ingestion_required'
    });
    expect(stateOf(capabilities, 'web-research')).toMatchObject({ state: 'gated' });
    expect(stateOf(capabilities, 'artifacts')).toMatchObject({ state: 'gated' });
    expect(stateOf(capabilities, 'computer')).toMatchObject({ state: 'gated' });
  });

  it('exposes voice readiness independently from provider menu presence', () => {
    const ready = buildWorkspaceCapabilities({
      providers: verifiedProvider,
      backgroundReady: true,
      buildRuntimeReady: false,
      attachmentPipelineReady: false,
      voiceReady: true
    });
    const unavailable = buildWorkspaceCapabilities({
      providers: verifiedProvider,
      backgroundReady: true,
      buildRuntimeReady: false,
      attachmentPipelineReady: false,
      voiceReady: false
    });

    expect(stateOf(ready, 'voice')).toMatchObject({ state: 'ready' });
    expect(stateOf(unavailable, 'voice')).toMatchObject({ state: 'unavailable' });
  });
});
