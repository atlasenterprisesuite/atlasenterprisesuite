import { describe, expect, it } from 'vitest';
import type { AtlasModuleDefinition } from '../../apps/web/src/app/modules/moduleCatalog';
import { resolveAtlasModuleAvailability } from '../../apps/web/src/app/modules/moduleAvailability';

const baseModule: AtlasModuleDefinition = {
  id: 'finance',
  displayName: 'ATLAS Finance',
  route: '/app/finance',
  category: 'finance',
  description: 'Finance',
  moduleCodes: ['finance'],
  permissions: ['accounting.read'],
  implementationState: 'implemented',
};

describe('ATLAS governed module availability', () => {
  it('fails closed when the required permission is absent', () => {
    expect(resolveAtlasModuleAvailability(baseModule, [], new Set(['finance']))).toBe('unauthorized');
  });

  it('fails closed when the organization module is explicitly not enabled', () => {
    expect(resolveAtlasModuleAvailability(baseModule, ['accounting.read'], new Set())).toBe('not_enabled');
  });

  it('does not convert blocked or configuration-required modules into available modules', () => {
    expect(resolveAtlasModuleAvailability({ ...baseModule, implementationState: 'blocked' }, ['accounting.read'], new Set(['finance']))).toBe('blocked');
    expect(resolveAtlasModuleAvailability({ ...baseModule, implementationState: 'configuration_required' }, ['accounting.read'], new Set(['finance']))).toBe('configuration_required');
  });

  it('reports available only when permission, organization and implementation gates pass', () => {
    expect(resolveAtlasModuleAvailability(baseModule, ['accounting.read'], new Set(['finance']))).toBe('available');
  });

  it('keeps partial implementations visibly partial', () => {
    expect(resolveAtlasModuleAvailability({ ...baseModule, implementationState: 'partial' }, ['accounting.read'], new Set(['finance']))).toBe('partial');
  });
});
