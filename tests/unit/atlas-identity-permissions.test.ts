import { describe, expect, it } from 'vitest';
import { mergeAtlasPermissions } from '../../apps/web/src/lib/supabase/atlasIdentitySource';

describe('ATLAS identity permission resolution', () => {
  it('applies organization role overrides on top of base role permissions', () => {
    expect(
      mergeAtlasPermissions(
        [
          { permission_code: 'accounting.read' },
          { permission_code: 'modules.read' },
          { permission_code: 'telecom.mifi.read' },
        ],
        [
          { permission_code: 'modules.read', allowed: false },
          { permission_code: 'telecom.mifi.forwarding.write', allowed: true },
        ],
      ),
    ).toEqual([
      'accounting.read',
      'telecom.mifi.forwarding.write',
      'telecom.mifi.read',
    ]);
  });

  it('deduplicates base permissions and fails closed on an explicit deny override', () => {
    expect(
      mergeAtlasPermissions(
        [
          { permission_code: 'ride.read' },
          { permission_code: 'ride.read' },
        ],
        [{ permission_code: 'ride.read', allowed: false }],
      ),
    ).toEqual([]);
  });
});
