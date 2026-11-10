# ATLAS Identity Shield — Foundation and P0 contract

Status: IMPLEMENTING (design contract only). No production readiness claim.
Date: 2026-10-15
Authority: Supabase Auth in atlas-core. Duo Mobile is out of scope and must remain unchanged.

## Architecture
- Keep existing Supabase Auth sessions and verified identities as the sole human identity authority.
- Prefer standards-based WebAuthn/passkeys using an audited provider implementation; never implement custom cryptography or store biometric templates.
- Support Supabase MFA TOTP with verified enrollment and AAL2 for privileged operations. Never trust a client-provided AAL value.
- Bind registered device credentials to an authenticated user; require server-side authorization for enrollment, revocation, and recovery.
- Apply organization-scoped RLS, RBAC, audit trails, rate limiting, replay protection and short-lived challenges.
- Preserve a secure offline recovery path; require step-up authentication and audit for sensitive factor changes.
- Fail closed when provider, tenant, assurance level, or policy checks are unavailable.

## P0 acceptance tests (must be automated and pass)
1. Anonymous requests cannot enroll, approve, revoke or list devices.
2. A user cannot read or mutate another user's or organization's credentials, challenges or sessions.
3. AAL1 sessions cannot execute privileged mutations, even when role claims indicate admin.
4. Expired, replayed, mismatched-origin or mismatched-RP WebAuthn challenges fail.
5. Missing/invalid authenticator signatures and unverifiable factor state fail.
6. Device removal invalidates future approvals and creates immutable audit evidence.
7. Recovery cannot bypass existing MFA or grant platform-admin privileges.
8. Network/provider outages deny sensitive actions without exposing secrets.
9. Existing Supabase login and Duo Mobile integrations remain unaffected.
10. Exact-SHA CI, CodeQL, integration tests, deployed runtime probes and tenant isolation checks pass before activation.

## Delivery plan
1. Inventory current auth routes, migrations, RLS, session and MFA controls.
2. Write failing tests for each P0 condition and threat-model abuse cases.
3. Implement minimal identity service and user-facing device management behind a disabled feature flag.
4. Verify with isolated tenants and physical-device/browser WebAuthn test coverage.
5. Open reviewable PR; require security review and exact-SHA green CI.
6. Merge and deploy only after all gates; verify production and record evidence.

## Release gate
Until all P0 tests and privileged administrator MFA enrollment are verified, keep Identity Shield DISABLED for privileged operations. No replacement of Supabase Auth, no downgrade of existing MFA, and no claims of production readiness.
