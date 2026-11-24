import { describe, expect, it } from 'vitest';
import { assessWorkspaceGovernanceChange as assess } from '../../packages/core/src/businessWorkspacePolicy';

describe('ATLAS business workspace governance reference', () => {
  it('keeps every evaluation non-executing even when eligible', () => {
    expect(assess({ operation: 'view_members', actorRole: 'analytics_viewer' }))
      .toEqual({ eligibleForServerReview: true, blockers: [], executed: false });
  });
  it('fails closed for unknown roles and prevents viewer mutations', () => {
    expect(assess({ operation: 'invite_member', actorRole: 'superuser' }).blockers).toContain('unknown_role');
    expect(assess({ operation: 'invite_member', actorRole: 'analytics_viewer' }).blockers).toContain('permission_denied');
  });
  it('allows default member invitation for a member but not privileged invitation', () => {
    expect(assess({ operation: 'invite_member', actorRole: 'member' }).eligibleForServerReview).toBe(true);
    expect(assess({ operation: 'invite_member', actorRole: 'member', targetRole: 'owner' }).blockers)
      .toContain('privileged_invitation_requires_owner');
  });
  it('protects privileged users and the final owner', () => {
    expect(assess({ operation: 'remove_member', actorRole: 'admin', targetRole: 'admin' }).blockers)
      .toContain('privileged_target_protected');
    expect(assess({ operation: 'remove_member', actorRole: 'owner', targetRole: 'owner', targetIsFinalOwner: true }).blockers)
      .toContain('final_owner_protected');
  });
  it('keeps seat and role changes in the owner boundary', () => {
    expect(assess({ operation: 'change_role', actorRole: 'admin', targetRole: 'member' }).blockers)
      .toContain('permission_denied');
    expect(assess({ operation: 'change_seat', actorRole: 'owner' }).blockers)
      .toContain('seat_type_required');
  });
  it('requires verified scope and explicit spend approval before automatic paid joining can be reviewed', () => {
    const base = { operation: 'enable_auto_join' as const, actorRole: 'owner', wouldAutoPurchaseSeat: true };
    expect(assess(base).blockers).toEqual(expect.arrayContaining(['verified_organization_required', 'spend_approval_required']));
    expect(assess({ ...base, verifiedOrganization: true, explicitSpendApproval: true }))
      .toEqual({ eligibleForServerReview: true, blockers: [], executed: false });
  });
  it('never initiates irreversible personal workspace migration', () => {
    expect(assess({ operation: 'merge_personal_workspace', actorRole: 'owner' }).blockers)
      .toContain('personal_migration_requires_separate_manual_process');
  });
});
