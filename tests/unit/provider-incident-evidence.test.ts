import { describe, expect, it } from 'vitest';
import { evaluateProviderIncident } from '../../packages/core/src';

const incident = {
  provider: 'openai',
  incidentId: '01M4ADHMMBK7K92NJFJ0DXRYJM',
  title: 'Unable to create new ChatGPT Work threads in latest version of desktop app',
  status: 'identified' as const,
  impact: 'partial_outage' as const,
  affectedComponents: ['Codex in ChatGPT Desktop'],
  observedAt: '2026-10-07T05:54:00.000Z',
  source: 'https://status.openai.com/incidents/01M4ADHMMBK7K92NJFJ0DXRYJM'
};

describe('ATLAS provider incident correlation', () => {
  it('keeps an active provider incident at P1 when the dependency is non-critical', () => {
    expect(evaluateProviderIncident(incident, {
      dependencyId: 'chatgpt-work-desktop',
      criticality: 'P1',
      matchesAffectedComponent: true
    })).toMatchObject({ priority: 'P1', gate: 'warning', attributedTo: 'provider' });
  });

  it('elevates the same provider incident to P0 BLOCKED for a required dependency', () => {
    expect(evaluateProviderIncident(incident, {
      dependencyId: 'chatgpt-work-desktop',
      criticality: 'P0',
      matchesAffectedComponent: true
    })).toMatchObject({ priority: 'P0', gate: 'blocked', attributedTo: 'provider' });
  });

  it('does not contaminate ATLAS health when the affected component is unrelated', () => {
    expect(evaluateProviderIncident(incident, {
      dependencyId: 'openai-api',
      criticality: 'P0',
      matchesAffectedComponent: false
    })).toMatchObject({ priority: 'P1', gate: 'none', attributedTo: 'provider' });
  });

  it('clears the active gate when the provider marks the incident resolved', () => {
    expect(evaluateProviderIncident({ ...incident, status: 'resolved' }, {
      dependencyId: 'chatgpt-work-desktop',
      criticality: 'P0',
      matchesAffectedComponent: true
    })).toMatchObject({ priority: 'P1', gate: 'none', resolved: true });
  });
});
