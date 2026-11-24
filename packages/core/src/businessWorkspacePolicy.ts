/**
 * ATLAS first-party workspace governance reference.
 *
 * Inspired by common enterprise collaboration patterns. This is not an OpenAI
 * authorization adapter, subscription manager, or credentialed connection.
 * Existing ATLAS Identity/RBAC/RLS and server-side MFA checks remain authoritative.
 */
export const WORKSPACE_GOVERNANCE_ROLES = ['owner', 'admin', 'member', 'analytics_viewer'] as const;
export const WORKSPACE_GOVERNANCE_SEATS = ['standard', 'premium'] as const;

export type WorkspaceGovernanceRole = (typeof WORKSPACE_GOVERNANCE_ROLES)[number];
export type WorkspaceGovernanceSeat = (typeof WORKSPACE_GOVERNANCE_SEATS)[number];
export type WorkspaceGovernanceOperation =
  | 'view_members' | 'view_analytics' | 'invite_member' | 'remove_member'
  | 'change_role' | 'change_seat' | 'manage_spend_controls'
  | 'manage_workspace_settings' | 'manage_apps' | 'configure_discovery'
  | 'enable_auto_join' | 'merge_personal_workspace';

export type WorkspaceGovernanceRequest = {
  operation: WorkspaceGovernanceOperation;
  actorRole: string;
  targetRole?: WorkspaceGovernanceRole;
  targetIsFinalOwner?: boolean;
  seatType?: WorkspaceGovernanceSeat;
  wouldAutoPurchaseSeat?: boolean;
  explicitSpendApproval?: boolean;
  verifiedOrganization?: boolean;
};

export type WorkspaceGovernanceBlocker =
  | 'unknown_role' | 'permission_denied' | 'target_role_required'
  | 'privileged_invitation_requires_owner' | 'privileged_target_protected'
  | 'final_owner_protected' | 'seat_type_required'
  | 'verified_organization_required' | 'spend_approval_required'
  | 'personal_migration_requires_separate_manual_process';

export type WorkspaceGovernanceDecision = {
  eligibleForServerReview: boolean;
  blockers: WorkspaceGovernanceBlocker[];
  executed: false;
};

const permissions: Record<WorkspaceGovernanceOperation, readonly WorkspaceGovernanceRole[]> = {
  view_members: ['owner', 'admin', 'member', 'analytics_viewer'],
  view_analytics: ['owner', 'admin', 'member', 'analytics_viewer'],
  invite_member: ['owner', 'admin', 'member'],
  remove_member: ['owner', 'admin'],
  change_role: ['owner'],
  change_seat: ['owner'],
  manage_spend_controls: ['owner', 'admin'],
  manage_workspace_settings: ['owner', 'admin'],
  manage_apps: ['owner', 'admin'],
  configure_discovery: ['owner'],
  enable_auto_join: ['owner'],
  merge_personal_workspace: []
};

function isRole(value: string): value is WorkspaceGovernanceRole {
  return (WORKSPACE_GOVERNANCE_ROLES as readonly string[]).includes(value);
}

/**
 * A fail-closed planning check, NOT a grant of effective access. All mutations
 * must be reauthorized by the canonical ATLAS Identity backend and audited.
 */
export function assessWorkspaceGovernanceChange(input: WorkspaceGovernanceRequest): WorkspaceGovernanceDecision {
  const blockers: WorkspaceGovernanceBlocker[] = [];
  const { operation, actorRole, targetRole } = input;
  if (!isRole(actorRole)) blockers.push('unknown_role');
  else if (!permissions[operation].includes(actorRole)) blockers.push('permission_denied');

  if (operation === 'invite_member') {
    const newRole = targetRole ?? 'member';
    if (newRole !== 'member' && actorRole !== 'owner') blockers.push('privileged_invitation_requires_owner');
  }
  if (operation === 'remove_member') {
    if (actorRole === 'admin' && (!targetRole || targetRole === 'owner' || targetRole === 'admin')) {
      blockers.push('privileged_target_protected');
    }
    if (input.targetIsFinalOwner) blockers.push('final_owner_protected');
  }
  if (operation === 'change_role') {
    if (!targetRole) blockers.push('target_role_required');
    if (input.targetIsFinalOwner) blockers.push('final_owner_protected');
  }
  if (operation === 'change_seat' && !input.seatType) blockers.push('seat_type_required');

  if (operation === 'configure_discovery' || operation === 'enable_auto_join') {
    if (!input.verifiedOrganization) blockers.push('verified_organization_required');
  }
  if (operation === 'enable_auto_join' && input.wouldAutoPurchaseSeat && !input.explicitSpendApproval) {
    blockers.push('spend_approval_required');
  }
  if (operation === 'merge_personal_workspace') {
    blockers.push('personal_migration_requires_separate_manual_process');
  }
  return { eligibleForServerReview: blockers.length === 0, blockers, executed: false };
}

export const WORKSPACE_GOVERNANCE_REFERENCE = [
  { role: 'owner', description: 'Organization governance, privileged membership and seat decisions' },
  { role: 'admin', description: 'Routine team administration within owner-only boundaries' },
  { role: 'member', description: 'Regular collaboration and standard-member invitations' },
  { role: 'analytics_viewer', description: 'Read-only governance and analytics reference' }
] as const;
