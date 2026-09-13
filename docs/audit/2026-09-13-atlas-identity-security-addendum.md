# ATLAS Identity — Security Audit Addendum

Date: 2026-09-13
Production authority: Supabase `atlas-core` (`ggmanzcgtlrvqfoccgsh`)

## Scope

This addendum refines the `SECURITY DEFINER` finding in the ATLAS end-to-end truth audit. The Supabase advisor warning was treated as a signal to inspect the actual production function definitions rather than as proof of thirteen vulnerabilities.

## Result

All thirteen functions currently flagged by the advisor are intentionally executable by `authenticated` and owned by `postgres`. Inspection of their production definitions shows that most contain explicit authentication, tenant membership, role, permission, invitation-token, confirmed-email, or MFA checks.

The advisor warning therefore does **not** mean that all thirteen functions are exploitable. The correct finding is an auditable privileged-RPC surface that requires source reconciliation and explicit guard tests.

## Guard review

- `accept_identity_invitation`: authenticated user required; invitation token is hashed and validated; invitation must be pending/unexpired; authenticated account email must be confirmed and match the invited email; organization must be active; duplicate membership is blocked; security event recorded.
- `atlas_bootstrap_owner`: authenticated account, confirmed email, enabled platform-admin record, advisory locking and audit event are required. **Gap: AAL2/MFA is not required here.**
- `atlas_list_client_organizations`: requires AAL2 and enabled platform-admin status.
- `atlas_provision_client_organization`: requires AAL2, enabled platform-admin status, confirmed email, validated modules/fields and audit event.
- `create_identity_invitation`: requires AAL2, owner/admin membership, `members.manage`, role restrictions and audit event.
- `create_organization`: requires AAL2, confirmed email and enabled platform-admin status.
- `list_identity_invitations`: requires `members.manage`.
- `list_identity_members`: requires `members.read`.
- `list_identity_security_events`: requires `security.events.read` and validates result limit.
- `revoke_identity_invitation`: requires AAL2, owner/admin membership and `members.manage`; admin cannot revoke an admin invitation.
- `set_identity_member_role`: requires AAL2, owner/admin membership and `members.manage`; protects owner/admin escalation and prevents removal of the final active owner.
- `set_identity_member_status`: requires AAL2, owner/admin membership and `members.manage`; protects owner/admin state changes and final active owner.
- `set_identity_role_permission`: requires AAL2, owner/admin membership and `identity.manage`; validates permissions and protects owner identity administration.

## P0/P1 findings

### 1. Privileged bootstrap MFA inconsistency

`atlas_bootstrap_owner` is a platform-administrator bootstrap path but does not enforce `auth.jwt()->>'aal' = 'aal2'`, unlike the other privileged platform/identity mutation functions.

Required remediation: add AAL2 enforcement, add a regression contract, verify the behavior with an authenticated AAL1/AAL2 test path, and record the change through the normal migration/release process.

### 2. Production-to-source drift

Current canonical `main` code search does not contain the active definitions for `atlas_bootstrap_owner`, `create_identity_invitation` or the broader identity-RPC set reviewed here. Production therefore contains security-relevant database behavior that is not currently reproducible/auditable from the canonical source tree.

Required remediation: reconcile the exact approved production definitions into canonical migrations, preserving their current guards, then apply only intentional hardening deltas through new migrations. Do not reverse-engineer by weakening production to match incomplete source control.

### 3. Leaked-password protection

Supabase Auth leaked-password protection is currently disabled according to the current security advisor.

Required remediation: enable it in the authoritative Auth configuration and rerun the advisor. This is a provider/Auth configuration action, not a SQL migration.

### 4. Privileged MFA runtime gate

ATLAS runtime verification currently reports `identity-security` as blocked with `privileged_mfa_incomplete`.

Required remediation: complete privileged-account AAL2 enrollment/policy and rerun the production identity verifier until it records current passing evidence.

## Acceptance criteria

Identity security is not considered closed until all of the following are true:

1. the canonical repository contains the reviewed identity RPC definitions or an equivalent reproducible migration chain;
2. `atlas_bootstrap_owner` requires AAL2;
3. privileged RPC regression tests demonstrate permission/tenant/MFA guard expectations;
4. leaked-password protection is enabled;
5. current Supabase security-advisor findings are reviewed and either resolved or documented as intentional guarded exceptions;
6. the current production identity-security verifier passes with fresh evidence.
