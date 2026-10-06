const CAPABILITY_IDS = [
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
];

function capability(id, state, reason = null, permissions = [], supportsBackground = false) {
  return {
    id,
    state,
    reason,
    permissions,
    supports_background: supportsBackground
  };
}

export function buildWorkspaceCapabilities(input = {}) {
  const providers = Array.isArray(input.providers) ? input.providers : [];
  const providerReady = providers.some((provider) => provider?.verified === true && provider?.state === 'verified');
  const backgroundReady = input.backgroundReady === true;
  const buildRuntimeReady = input.buildRuntimeReady === true;
  const attachmentPipelineReady = input.attachmentPipelineReady === true;
  const voiceReady = input.voiceReady === true;

  const capabilities = [
    capability(
      'chat',
      providerReady ? 'ready' : 'unavailable',
      providerReady ? null : 'verified_intelligence_provider_required',
      [],
      false
    ),
    capability(
      'work',
      providerReady && backgroundReady ? 'ready' : 'unavailable',
      providerReady && backgroundReady
        ? null
        : providerReady
          ? 'background_execution_unavailable'
          : 'verified_intelligence_provider_required',
      [],
      true
    ),
    capability(
      'build',
      providerReady && buildRuntimeReady ? 'ready' : 'configuration_required',
      providerReady && buildRuntimeReady ? null : 'verified_developer_runtime_required',
      ['repository:read'],
      true
    ),
    capability('web-research', 'gated', 'deep_research_engine_not_implemented', [], true),
    capability(
      'attachments',
      attachmentPipelineReady ? 'ready' : 'configuration_required',
      attachmentPipelineReady ? null : 'secure_attachment_ingestion_required'
    ),
    capability('voice', voiceReady ? 'ready' : 'unavailable', voiceReady ? null : 'voice_runtime_unavailable'),
    capability('apps', 'gated', 'verified_app_connection_required'),
    capability('knowledge', 'gated', 'authorized_knowledge_source_required'),
    capability('artifacts', 'gated', 'artifact_framework_not_implemented'),
    capability('computer', 'gated', 'computer_runtime_not_implemented', [], true)
  ];

  if (capabilities.length !== CAPABILITY_IDS.length) {
    throw new Error('workspace_capability_manifest_incomplete');
  }
  return capabilities;
}
