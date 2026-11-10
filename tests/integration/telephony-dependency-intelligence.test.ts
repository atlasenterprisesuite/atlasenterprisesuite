import { describe, expect, it } from 'vitest';
import { ATLAS_TELEPHONY_DEPENDENCY_MANIFEST } from '../../packages/communication/src/telephony/dependency-manifest';

describe('ATLAS Telephony dependency intelligence manifest', () => {
  it('maps the canonical telephony source through Connect, RBAC, provider readiness and production route', () => {
    const manifest = ATLAS_TELEPHONY_DEPENDENCY_MANIFEST;
    const nodeIds = manifest.nodes.map((node) => node.id);

    expect(nodeIds).toEqual(expect.arrayContaining([
      'source:packages/communication/src/telephony/core.ts',
      'package:communication',
      'module:connect',
      'route:/connect/calling',
      'edge-function:atlas-communication-telephony',
      'permission:communication.telephony.call',
      'provider:telnyx',
      'provider-capability:telnyx.outbound_voice',
      'test:atlas-telephony-telnyx'
    ]));

    expect(manifest.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ from: 'source:packages/communication/src/telephony/core.ts', to: 'package:communication', kind: 'contains' }),
      expect.objectContaining({ from: 'package:communication', to: 'module:connect', kind: 'depends_on' }),
      expect.objectContaining({ from: 'module:connect', to: 'route:/connect/calling', kind: 'routes_to' }),
      expect.objectContaining({ from: 'route:/connect/calling', to: 'edge-function:atlas-communication-telephony', kind: 'calls' }),
      expect.objectContaining({ from: 'edge-function:atlas-communication-telephony', to: 'permission:communication.telephony.call', kind: 'requires_permission' }),
      expect.objectContaining({ from: 'edge-function:atlas-communication-telephony', to: 'provider:telnyx', kind: 'requires_provider' }),
      expect.objectContaining({ from: 'provider:telnyx', to: 'provider-capability:telnyx.outbound_voice', kind: 'requires_capability' }),
      expect.objectContaining({ from: 'module:connect', to: 'test:atlas-telephony-telnyx', kind: 'tested_by' })
    ]));
  });

  it('declares verification requirements without declaring provider truth', () => {
    const manifest = ATLAS_TELEPHONY_DEPENDENCY_MANIFEST;
    const provider = manifest.nodes.find((node) => node.id === 'provider:telnyx');
    const requirements = manifest.nodes
      .flatMap((node) => node.verification ?? [])
      .map((item) => item.id);

    expect(provider?.metadata).toMatchObject({ readinessAuthority: 'AtlasTelephonyProvider.readiness' });
    expect(provider?.metadata).not.toHaveProperty('state');
    expect(provider?.metadata).not.toHaveProperty('connected');
    expect(provider?.metadata).not.toHaveProperty('verified');

    expect(requirements).toEqual(expect.arrayContaining([
      'rbac:communication.telephony.call',
      'provider-readiness:telnyx',
      'e2e:telephony',
      'production-route:/connect/calling'
    ]));
  });

  it('exposes secret requirement names only, never secret values', () => {
    const secretNodes = ATLAS_TELEPHONY_DEPENDENCY_MANIFEST.nodes.filter((node) => node.kind === 'secret_requirement');
    expect(secretNodes.map((node) => node.id)).toEqual(expect.arrayContaining([
      'secret-requirement:TELNYX_API_KEY',
      'secret-requirement:TELNYX_PUBLIC_KEY'
    ]));
    for (const node of secretNodes) {
      expect(node.metadata).toEqual(expect.objectContaining({ secretName: expect.any(String) }));
      expect(node.metadata).not.toHaveProperty('value');
      expect(node.metadata).not.toHaveProperty('token');
      expect(node.metadata).not.toHaveProperty('apiKey');
    }
  });
});
