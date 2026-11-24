import type { AtlasCapabilityDefinition } from './capability-types';

const telnyxReadBinding = {
  provider: 'telnyx',
  adapter: 'atlas-communication-telephony',
  environments: ['development', 'test', 'production'],
  priority: 10,
  healthCheck: 'communications.voice.readiness'
};

export const ATLAS_TELECOM_CAPABILITIES: readonly AtlasCapabilityDefinition[] = [
  {
    id: 'communications.voice.readiness',
    version: 1,
    domain: 'communications',
    title: 'Voice readiness',
    description: 'Read provider configuration and verified voice readiness without exposing secrets.',
    operation: 'read',
    riskTier: 'P1',
    mutatesExternalState: false,
    mayIncurCost: false,
    requiresApproval: false,
    requiresEvidence: true,
    permissions: ['communication.telephony.read'],
    allowedEnvironments: ['development', 'test', 'production'],
    inputSchemaRef: 'atlas://communications/voice/readiness/input/v1',
    outputSchemaRef: 'atlas://communications/voice/readiness/output/v1',
    providerBindings: [telnyxReadBinding],
    verificationPolicy: 'provider_readiness_fresh'
  },
  {
    id: 'communications.number.search',
    version: 1,
    domain: 'communications',
    title: 'Number search',
    description: 'Discover provider number inventory without claiming ownership or allocation.',
    operation: 'read',
    riskTier: 'P1',
    mutatesExternalState: false,
    mayIncurCost: false,
    requiresApproval: false,
    requiresEvidence: true,
    permissions: ['communication.telephony.read'],
    allowedEnvironments: ['development', 'test', 'production'],
    inputSchemaRef: 'atlas://communications/number/search/input/v1',
    outputSchemaRef: 'atlas://communications/number/search/output/v1',
    providerBindings: [{ ...telnyxReadBinding, healthCheck: 'communications.number.search' }],
    verificationPolicy: 'discovery_only_truth'
  },
  {
    id: 'communications.voice.call.create',
    version: 1,
    domain: 'communications',
    title: 'Create outbound voice call',
    description: 'Create one governed outbound call through an authorized provider adapter.',
    operation: 'execute',
    riskTier: 'P0',
    mutatesExternalState: true,
    mayIncurCost: true,
    requiresApproval: false,
    requiresEvidence: true,
    permissions: ['communication.telephony.call'],
    allowedEnvironments: ['development', 'test', 'production'],
    inputSchemaRef: 'atlas://communications/voice/call-create/input/v1',
    outputSchemaRef: 'atlas://communications/voice/call-create/output/v1',
    providerBindings: [{
      ...telnyxReadBinding,
      healthCheck: 'communications.voice.readiness',
      writePolicy: 'telephony_call_p0'
    }],
    verificationPolicy: 'call_provider_ack_and_lifecycle'
  },
  {
    id: 'communications.webhook.verify',
    version: 1,
    domain: 'communications',
    title: 'Verify communications webhook',
    description: 'Verify signed provider lifecycle events before authoritative state mutation.',
    operation: 'execute',
    riskTier: 'P0',
    mutatesExternalState: false,
    mayIncurCost: false,
    requiresApproval: false,
    requiresEvidence: true,
    permissions: [],
    allowedEnvironments: ['development', 'test', 'production'],
    inputSchemaRef: 'atlas://communications/webhook/verify/input/v1',
    outputSchemaRef: 'atlas://communications/webhook/verify/output/v1',
    providerBindings: [],
    verificationPolicy: 'signed_webhook_ed25519_replay_guard'
  },
  {
    id: 'communications.number.provision.test',
    version: 1,
    domain: 'communications',
    title: 'Provision test phone number',
    description: 'Provision at most one test number under explicit P0 write and cleanup controls.',
    operation: 'write',
    riskTier: 'P0',
    mutatesExternalState: true,
    mayIncurCost: true,
    requiresApproval: true,
    requiresEvidence: true,
    permissions: ['communication.telephony.provision'],
    allowedEnvironments: ['test'],
    inputSchemaRef: 'atlas://communications/number/provision-test/input/v1',
    outputSchemaRef: 'atlas://communications/number/provision-test/output/v1',
    providerBindings: [{
      provider: 'telnyx',
      adapter: 'atlas-communication-telephony',
      environments: ['test'],
      priority: 10,
      healthCheck: 'communications.voice.readiness',
      writePolicy: 'telnyx_test_number_p0'
    }],
    verificationPolicy: 'reuse_before_create_and_cleanup'
  }
];

export function resolveCapability(id: string): AtlasCapabilityDefinition {
  const capability = ATLAS_TELECOM_CAPABILITIES.find((item) => item.id === id);
  if (!capability) throw new Error(`capability_not_found:${id}`);
  return capability;
}

export function listCapabilities(domain?: string): readonly AtlasCapabilityDefinition[] {
  if (!domain) return ATLAS_TELECOM_CAPABILITIES;
  return ATLAS_TELECOM_CAPABILITIES.filter((item) => item.domain === domain);
}
