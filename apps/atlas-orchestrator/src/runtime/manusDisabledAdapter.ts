import type { ProviderAdapter, ProviderInvocation, ProviderResult } from '../../../../packages/ai-core/src/providers';

/**
 * Deliberately disabled Manus adapter.
 * A provider must never report a successful invocation until a real,
 * authorized transport, receipt validation and evidence storage exist.
 */
export class ManusDisabledAdapter implements ProviderAdapter {
  readonly providerId = 'manus';
  async invoke(_input: ProviderInvocation): Promise<ProviderResult> {
    throw new Error('ATLAS_MANUS_NOT_CONNECTED: provider dispatch is disabled until an authorized transport is configured');
  }
}
