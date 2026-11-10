# ATLAS Identity Shield 777 — Security architecture and acceptance gates

Status: **SPECIFICATION ONLY — NOT DEPLOYED** (2026-10-20)
Scope: central authentication for ATLAS modules, enterprise mail administration, privileged operators, and devices.
Decision: user approved concept; implementation requires TDD, review, CI, and verified production rollout.

## Reuse first
- Reuse existing Supabase Auth, MFA/AAL2 enforcement and identity tenant/member/role policies.
- Preserve `supabase/migrations/20260913_harden_atlas_bootstrap_owner_aal2.sql` and existing privileged-role safeguards.
- Follow `SECURITY.md`, `docs/security/GITHUB_IDENTITY_BASELINE.md`, identity runbooks and certificate lifecycle policies.
- Inventory existing WebAuthn/passkey libraries, notification stack, MFA enrollment UI, feature flags, RLS and audit events before changes. Avoid a parallel auth provider.

## Authentication contract
1. Prefer phishing-resistant WebAuthn/FIDO2 passkeys with local user verification (biometrics or PIN). ATLAS must never receive facial templates.
2. Password + distinct second factor as fallback; TOTP acceptable, SMS only a restricted fallback, not sole privileged protection.
3. Phone push approval must be tied to a server-side challenge, origin, authenticated device key, user/session, expiry and specific action. Show contextual request details and require explicit matching; never permit simple unsolicited one-tap approvals.
4. For sensitive actions (role elevation, payroll, bank destination, payout, API secrets, org ownership), require fresh authentication and transaction-bound authorization, independently enforced server-side.
5. Cryptographically random, single-use, short-lived challenge identifiers with replay defense, attempt ceilings and request throttling. Do not treat color/number or public 'ancestral' sequences as OTP secrets.
6. Tenant-aware RBAC and RLS, authorization checks on every sensitive request, token revocation, idle/absolute limits, cross-device logout.
7. ATLAS chromatic identity department labels and 'Ancestral Numbers' are cosmetic/contextual identifiers, not security factors. Ensure accessible text plus color; never infer authorization from UI.
8. Protect audit metadata without recording OTPs, recovery tokens, passwords, passkey private keys, or biometric information.
9. Accessible recovery with pre-enrolled independent passkey/security key, one-time offline recovery codes, and documented dual-control manual exception for privileged users. Lost phone alone cannot authorize role change or payments. Notify user on enrollment/recovery and revoke compromised factors.
10. Email aliases do not define standalone identities automatically. Each human principal gets individual scoped identity; service identities are noninteractive and minimally privileged.

## Threats to test
Credential stuffing; SIM swap; phishing/reverse proxy; MFA fatigue; OTP replay/parallel submit; brute-force and enumeration; CSRF; cross-tenant account takeover; session theft; stale AAL1 tokens; unauthorized device registration; recovery social engineering; delegated-admin escalation; audit omission; inaccessible alternatives.

## TDD / acceptance criteria
- RED: tests fail when privileged action is attempted with AAL1; passkeys/challenges use wrong origin, wrong tenant, expired/replayed nonce, missing device binding or canceled user verification; transaction mismatch is rejected.
- GREEN: valid securely bound passkey or allowed independently enrolled MFA flow succeeds; every factor enrollment/removal and recovery is auditable and notifies user.
- Recovery: one-time codes cannot replay; fallback excludes weak knowledge-based questions and public color/number schemes; lost-device scenario remains recoverable without account takeover.
- Access: screen-reader and keyboard paths and non-biometric authenticator alternatives; accessible color tags.
- Security: server enforcement under hostile clients, RLS tenant isolation, rate limits, secret handling, session revocation and step-up freshness proven by integration tests.
- CI: lint/typecheck/unit/integration/E2E and security checks recorded as artifacts.
- Release: guarded flags, rollback documented; P0 fail closed, P1 documented; production health/routes and exact deployment SHA verified before marking LIVE.
- No SMS, biometric, live password changes, migration, PR merge or deploy until concrete implementation and tests pass.

## Delivery workstream
1. Inventory canonical identity/auth code and current production auth controls.
2. Draft threat model and API contracts, select existing WebAuthn implementation if present.
3. Add unit/integration tests (RED).
4. Implement enroll/authenticate/revoke/recover flows (GREEN) with least privilege.
5. Add UI and accessibility tests, evidence and runbooks.
6. PR review, CI, controlled merge and deploy, E2E and exact-SHA verification.

This document intentionally does not assert successful implementation or verified production.
