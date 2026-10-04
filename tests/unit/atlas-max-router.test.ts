import { describe, expect, it } from 'vitest';
import { routeIntelligenceTask } from '../../apps/web/src/services/atlas-max/router';

describe('ATLAS MAX router', () => {
  const providers = [
    { id: 'a', healthy: true, capabilities: ['text'], privacyClasses: ['standard'], cost: 2, latency: 3, quality: 5 },
    { id: 'b', healthy: true, capabilities: ['text'], privacyClasses: ['restricted'], cost: 3, latency: 2, quality: 4 },
  ];
  it('selects an eligible provider', () => expect(routeIntelligenceTask({ providers, capability: 'text', privacyClass: 'standard', maxCost: 10 }).status).toBe('routed'));
  it('fails closed when privacy constraints cannot be met', () => expect(routeIntelligenceTask({ providers, capability: 'text', privacyClass: 'secret', maxCost: 10 })).toMatchObject({ status: 'denied', reason: 'no_policy_compliant_provider' }));
});