# ATLAS Identity — Security Audit Addendum

Date: 2026-09-13
Production authority: Supabase `atlas-core` (`ggmanzcgtlrvqfoccgsh`)

## Scope

This addendum refines the `SECURITY DEFINER` finding in the ATLAS end-to-end truth audit. The Supabase advisor warning was treated as a signal to inspect the actual production function definitions rather than as proof of thirteen vulnerabilities.

## Result

All thirteen functions currently flagged by the advisor are intentionally executable by `authenticated` and owned by `postgres`. Inspection of their production definitions shows that most contain explicit authentication, tenant membership, role, permission, invitation-token, confirmed-email, or MFA checks.

The advisor warning therefore does **not** mean that all thirteen functions are exploitable. The correct finding is an auditable privileged-RPC surface that requires source reconciliation and explicit guard tests.

A fresh production MFA-factor check found exactly **one enabled ATLAS platform administrator and no enrolled MFA factor for that privileged account**. This directly explains the current `privileged_mfa_incomplete` verifier result and changes the remediation order: privileged MFA enrollment must happen before making `atlas_bootstrap_owner` AAL2-only, otherwise the only current platform administrator could be locked out of that bootstrap path.

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

### 1. Privileged MFA enrollment is the first security blocker

Current production state has one enabled platform administrator and no enrolled MFA factor for that account.

Required remediation order:

1. enroll and verify a privileged MFA factor through the authoritative Supabase Auth/ATLAS Identity flow;
2. prove an AAL2 privileged session can execute the intended platform-admin path;
3. only then harden `atlas_bootstrap_owner` to require AAL2;
4. rerun the identity-security verifier.

Do **not** apply the AAL2-only bootstrap mutation before step 1. Security hardening that locks out the only current platform administrator would be an operational regression.

### 2. Privileged bootstrap MFA inconsistency

`atlas_bootstrap_owner` is a platform-administrator bootstrap path but does not enforce `auth.jwt()->>'aal' = 'aal2'`, unlike the other privileged platform/identity mutation functions.

Required remediation after successful privileged MFA enrollment: add AAL2 enforcement, add a regression contract, verify the behavior with authenticated AAL1/AAL2 paths, and record the change through the normal migration/release process.

### 3. Production-to-source drift

Current canonical `main` code search does not contain the active definitions for `atlas_bootstrap_owner`, `create_identity_invitation` or the broader identity-RPC set reviewed here. Production therefore contains security-relevant database behavior that is not currently reproducible/auditable from the canonical source tree.

Required remediation: reconcile the exact approved production definitions into canonical migrations, preserving their current guards, then apply only intentional hardening deltas through new migrations. Do not reverse-engineer by weakening production to match incomplete source control.

### 4. Leaked-password protection

Supabase Auth leaked-password protection is currently disabled according to the current security advisor.

Required remediation: enable it in the authoritative Auth configuration and rerun the advisor. This is a provider/Auth configuration action, not a SQL migration.

### 5. Privileged MFA runtime gate

ATLAS runtime verification currently reports `identity-security` as blocked with `privileged_mfa_incomplete`.

Required remediation: complete privileged-account AAL2 enrollment/policy and rerun the production identity verifier until it records current passing evidence.

## Acceptance criteria

Identity security is not considered closed until all of the following are true:

1. the privileged platform-admin account has an enrolled and verified MFA factor;
2. an AAL2 privileged session is proven against the intended administrative flow;
3. the canonical repository contains the reviewed identity RPC definitions or an equivalent reproducible migration chain;
4. `atlas_bootstrap_owner` requires AAL2 without locking out the privileged administrator;
5. privileged RPC regression tests demonstrate permission/tenant/MFA guard expectations;
6. leaked-password protection is enabled;
7. current Supabase security-advisor findings are reviewed and either resolved or documented as intentional guarded exceptions;
8. the current production identity-security verifier passes with fresh evidence.
