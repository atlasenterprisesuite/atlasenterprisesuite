import { describe, expect, it } from 'vitest';
import {
  createEmptyProductionSpec,
  createEmptyScene,
  createEmptyShot
} from '../../packages/creator/defaults';
import {
  creatorPermissionsForRole,
  hasCreatorPermission,
  requireCreatorPermission
} from '../../packages/creator/permissions';
import { createDirectorState, directorReducer } from '../../apps/web/src/modules/creator/director/directorState';

describe('ATLAS Director domain', () => {
  it('creates an honest empty production draft', () => {
    const spec = createEmptyProductionSpec({
      id: '00000000-0000-4000-8000-000000000001',
      organizationId: '00000000-0000-4000-8000-000000000002',
      createdByUserId: '00000000-0000-4000-8000-000000000003',
      now: '2026-09-12T12:00:00.000Z'
    });
    expect(spec.status).toBe('draft');
    expect(spec.title).toBe('');
    expect(spec.brief).toBe('');
    expect(spec.durationSeconds).toBe(0);
    expect(spec.scenes).toEqual([]);
    expect(spec.version).toBe(1);
  });

  it('creates scene and shot children without fabricated creative content', () => {
    expect(createEmptyScene({ id: '00000000-0000-4000-8000-000000000004' }).description).toBe('');
    expect(createEmptyShot({ id: '00000000-0000-4000-8000-000000000005', order: 1 }).action).toBe('');
  });

  it('adds scenes immutably and marks the draft dirty', () => {
    const initial = createDirectorState(createEmptyProductionSpec());
    const withScene = directorReducer(initial, { type: 'scene.add', scene: createEmptyScene() });
    expect(withScene.spec.scenes).toHaveLength(1);
    expect(withScene.dirty).toBe(true);
    expect(initial.spec.scenes).toHaveLength(0);
  });

  it('maps administrative roles only at the permission boundary', () => {
    const admin = creatorPermissionsForRole('admin');
    const member = creatorPermissionsForRole('member');
    expect(hasCreatorPermission(admin, 'creator.generate')).toBe(true);
    expect(hasCreatorPermission(member, 'creator.read')).toBe(true);
    expect(hasCreatorPermission(member, 'creator.write')).toBe(false);
    expect(() => requireCreatorPermission(member, 'creator.write')).toThrow('authorization_denied');
  });
});
