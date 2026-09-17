# ATLAS Device & Account Protection Design

## Purpose

ATLAS Device & Account Protection adds a server-enforced security layer for stolen-device and account-takeover scenarios without replacing ATLAS Identity. It reuses Supabase Auth, active organization membership, `has_identity_permission`, RLS, and `audit_row_change()` and adds risk evaluation, trusted-device state, passkey step-up, security delays, session/device revocation, recovery controls, and immutable security evidence.

The feature must never claim that a device, location, SIM/eSIM, passkey, network, or account is safe unless the underlying signal was actually verified. Missing provider data is represented as `unknown`, not inferred.

## Goals

- Reduce the impact of a stolen unlocked device or compromised password/session.
- Require phishing-resistant step-up for high-impact account and administrative operations.
- Add configurable security delay for critical changes attempted from untrusted/high-risk contexts.
- Give users and organization administrators truthful visibility into devices, passkeys, active sessions, risk events, holds, and recovery state.
- Preserve multi-tenant isolation, least privilege, auditability, and explicit provider/configuration states.
- Keep enforcement on the server. React visibility is UX only and never an authorization boundary.

## Non-goals

- ATLAS does not store biometric templates or raw biometric data.
- ATLAS does not claim device hardware attestation, SIM ownership, carrier verification, network reputation, or geolocation verification unless a real provider/integration supplies that signal.
- ATLAS does not silently replace Supabase Auth or create a second password database.
- ATLAS does not automatically lock accounts based solely on coarse location changes.
- ATLAS does not mark a delayed operation completed until the underlying protected action executes successfully.

## Threat model

Primary threats:

1. Stolen unlocked device with an existing ATLAS session.
2. Stolen password or refresh token used from a new browser/device.
3. Malicious attempt to disable protection, remove passkeys, change recovery routes, grant admin privileges, change payout destinations, create high-privilege API credentials, or delete the account.
4. Session replay after a device is reported lost/stolen.
5. Replay of WebAuthn challenges or step-up grants.
6. Cross-tenant access to device/risk/recovery records.

The design assumes a fully compromised client cannot be trusted to self-report risk, authorize protected actions, or declare itself trusted.

## Architecture

### Existing boundaries reused

- Supabase Auth remains the primary session/identity provider.
- Active organization membership remains required for tenant-scoped ATLAS operations.
- `public.has_identity_permission(org_id, permission_code)` remains the role/permission authority.
- RLS remains the primary tenant/data boundary.
- `public.audit_row_change()` remains the standard row-level audit trigger for privileged security state.

### New components

1. `packages/security-protection` — pure TypeScript policy/risk domain. No network calls and no secrets.
2. Postgres security tables/RLS — devices, passkeys, WebAuthn challenges, risk events, step-up grants, protected-action delays, recovery events, session revocation records.
3. Guarded RPCs — server-owned transitions for trust/revoke/delay/recovery state. Direct browser writes to privileged state are revoked.
4. `atlas-security-protection` Edge Function — authenticated API for summary, risk evaluation, WebAuthn option generation/verification, device/session actions, and protected-action authorization.
5. Identity/Security UI — `/identity/security` plus focused device/passkey/activity/recovery views.
6. Protected-action client helper — requests a server decision before sensitive actions and handles `allow`, `step_up`, `delay`, and `deny` honestly.

## Risk model

### Decisions

`RiskDecision = 'allow' | 'step_up' | 'delay' | 'deny'`

The engine returns:

- `decision`
- `score` from 0 to 100
- stable `reasons[]`
- `required_assurance`
- optional `delay_seconds`
- `signals_used[]`
- `signals_unknown[]`

The score is explanatory. Enforcement is determined by policy + signal state, not by a client-visible score alone.

### Signal contract

Signals are tri-state or explicit values, never guessed:

- device status: `trusted | untrusted | revoked | unknown`
- passkey verification: verified/not verified
- current session age
- recent password/recovery/passkey/security changes
- session/device revocation state
- known account-recovery mode
- optional geolocation consistency only when user opted in and server has real observations
- optional IP/network reputation only when a configured provider returned evidence
- optional SIM/eSIM/carrier evidence only when a configured provider returned evidence

Provider-dependent unavailable signals are `unknown` and recorded as such.

### Baseline policy

- Revoked device/session: `deny`.
- Explicit compromise/recovery hold: `deny` for destructive/admin/financial actions until resolved.
- Normal low-impact action on trusted context: `allow`.
- Sensitive action without fresh phishing-resistant verification: at least `step_up`.
- Account-critical action from an untrusted/high-risk context: `delay` after successful step-up unless an organization policy requires `deny`.
- A delay never replaces step-up; it is an additional control.

## Sensitive action catalog

Stable action codes:

- `account.password.change`
- `account.recovery.change`
- `account.passkey.remove`
- `account.protection.disable`
- `account.delete`
- `admin.role.grant`
- `admin.role.revoke`
- `payout.destination.change`
- `api_key.create_privileged`
- `api_key.revoke_privileged`
- `session.revoke_others`
- `device.trust`
- `device.revoke`

Default policy:

- all action codes above require fresh passkey step-up;
- `account.recovery.change`, `account.passkey.remove`, `account.protection.disable`, `account.delete`, `admin.role.grant`, and `payout.destination.change` receive a default 3600-second delay when the initiating device is not trusted or the risk engine marks the context high risk;
- organization policy may raise the delay up to 86400 seconds or lower it no further than 900 seconds;
- revoked/compromised context is denied instead of delayed.

## Passkeys / WebAuthn

ATLAS uses WebAuthn passkeys as phishing-resistant step-up. It does not receive or store biometric data; biometric/PIN verification occurs inside the platform authenticator/security key.

Implementation rules:

- Browser integration: `@simplewebauthn/browser` pinned to `14.0.0`.
- Server verification: `@simplewebauthn/server` pinned to `14.0.2` in the Edge Function/Deno environment.
- RP ID and expected origin are server configuration, never accepted from request bodies.
- Registration uses discoverable credentials with `residentKey: 'required'` and `userVerification: 'required'`.
- Registration and authentication verification require user verification.
- Challenges are random, single-use, server persisted, expire after 5 minutes, and are consumed on verification attempt so they cannot be replayed.
- Attestation defaults to `none`; ATLAS does not imply hardware provenance without an explicit attestation policy.
- Credential public keys, counters, transports, device type, backup state, timestamps, and opaque credential IDs may be stored; private keys never leave authenticators.
- Removing the last passkey from a protected account is itself a delayed protected action and requires a recovery-safe path.

## Device model

`security_devices` represents observed browser/device security identities, not proof of physical ownership.

States:

- `untrusted`
- `trusted`
- `revoked`
- `compromised`

A device can become trusted only through a guarded server operation after fresh passkey step-up. Trust has `trusted_at`, `trusted_by_user_id`, optional expiry, and reason/evidence metadata. Direct browser updates are prohibited.

A revoked/compromised device cannot self-unrevoke. Reinstatement requires a separate explicit admin/recovery workflow and immutable evidence.

## Step-up grants

A successful passkey authentication issues a server-side `security_step_up_grant` scoped to:

- user
- organization
- optional device
- one action code or an explicitly declared action family
- assurance method `passkey`
- expiry

Default lifetime: 10 minutes. Grants are not bearer secrets exposed as reusable long-lived tokens; protected operations validate grant records against the authenticated user/session/context.

## Security delay

`security_action_delays` stores protected operations that have passed step-up but require a waiting period.

States:

- `pending`
- `ready`
- `executed`
- `cancelled`
- `expired`
- `denied`

Requirements:

- immutable action code, organization, actor, target reference, created risk decision and policy version;
- `not_before` is calculated server-side;
- high-risk changes during the waiting period may cancel/deny the operation;
- execution requires revalidation of authenticated identity, authorization, target state, and relevant risk conditions;
- `executed` is written only after the protected downstream action succeeds.

## Persistence

### `security_devices`

Tenant/user-scoped device observations and trust/revocation state.

### `security_passkeys`

Credential ID, credential public key, counter, transports, device type, backed-up state, created/last-used/revoked timestamps. Private credential material is impossible to persist because it is never provided to ATLAS.

### `security_webauthn_challenges`

Single-use registration/authentication challenges with purpose, user/org, expected action, expiry and consumed timestamp.

### `security_risk_events`

Append-only evaluations: action, decision, score, reasons, known/unknown signals, policy version, session/device references, provider evidence references.

### `security_step_up_grants`

Short-lived successful assurance grants.

### `security_action_delays`

Delayed sensitive operations and lifecycle.

### `security_recovery_events`

Append-only recovery initiation, verification, hold, completion/cancellation evidence. No plaintext recovery secret is stored.

### `security_session_revocations`

Records session/global revocation intent/evidence. Actual Supabase session revocation must be performed through a server/admin capability; the database row alone is not represented as a completed provider revocation.

## RBAC

Permissions:

- `security.protection.view_self`
- `security.protection.manage_self`
- `security.protection.audit_self`
- `security.protection.view_org`
- `security.protection.manage_org`
- `security.protection.audit_org`
- `security.protection.policy_manage`

Owner/admin receive organization management/audit/policy permissions. Normal members receive self permissions only. Sensitive self-service transitions still require step-up/delay policy; possession of a permission does not bypass risk controls.

## RLS and mutation policy

- Every tenant-scoped table carries `org_id`.
- Self records require `user_id = auth.uid()` plus active org membership where appropriate.
- Organization-wide reads require explicit organization security permissions.
- Direct `insert/update/delete` from `authenticated` is revoked for passkeys, risk events, step-up grants, delays, recovery and revocation evidence; guarded functions own those transitions.
- Audit triggers use `public.audit_row_change()` on privileged mutable tables.
- Risk events/recovery evidence are append-only; corrections are new events, not destructive edits.

## Edge Function API

`POST /functions/v1/atlas-security-protection`

Request contains `operation` plus operation-specific fields. The function resolves the authenticated user and active organization from the bearer session; it never trusts a caller-supplied user ID or uses a caller-supplied organization as proof of membership.

Operations:

- `summary`
- `devices.list`
- `devices.revoke`
- `devices.trust`
- `sessions.revoke`
- `passkeys.registration.options`
- `passkeys.registration.verify`
- `passkeys.authentication.options`
- `passkeys.authentication.verify`
- `risk.evaluate`
- `protected_action.authorize`
- `delays.list`
- `delays.cancel`
- `recovery.status`

Errors use stable machine codes and safe user messages. Internal/provider errors are not leaked.

## UI

Routes:

- `/identity/security`
- `/identity/security/devices`
- `/identity/security/passkeys`
- `/identity/security/activity`
- `/identity/security/recovery`

The Identity target sanitizer must allow safe `/identity/security...` round-trips without allowing open redirects or recursive sign-in routing.

UI requirements:

- truthful loading/empty/error/configured states;
- show `unknown` when signals/providers are unavailable;
- no fake device/location/network values;
- accessible keyboard/focus/labels/status regions;
- minimum 44px touch targets;
- reduced-motion support;
- no copied Apple artwork/branding;
- destructive/revocation operations clearly describe scope and consequences;
- delayed operations show the server-provided `not_before`, not a client-invented timer.

## Privacy

- Location signals are opt-in and minimized to what risk evaluation requires.
- Raw precise location is not retained merely for analytics; derived risk evidence should prefer coarse/hashed/provider references when possible.
- No biometric template, authenticator PIN, passkey private key, password, plaintext recovery secret, or service-role key is stored in application tables.
- Network/SIM/provider fields are nullable/unknown when not configured.

## Failure modes

- Passkey provider/library unavailable: protected actions requiring passkey fail closed with `step_up_unavailable`; UI says protection verification is unavailable, not successful.
- Risk provider unavailable: signal becomes `unknown`; high-impact policy does not silently downgrade required assurance.
- Database/audit write failure: sensitive transition fails closed.
- Session revocation provider failure: record attempt/failure evidence and do not report the session as revoked.
- Delay executor unavailable: operation remains pending/ready and is not represented as executed.

## Testing and verification

Required automated coverage:

1. Pure risk engine unit tests covering allow/step-up/delay/deny and unknown signals.
2. Policy tests for every sensitive action code and delay boundary.
3. Migration/RLS integration tests for every new table and permission.
4. Guarded RPC contract tests for trust/revoke/delay state transitions and append-only evidence.
5. WebAuthn source/integration tests asserting RP/origin are server-controlled, challenges expire/consume, user verification is required, and counters update only after verified authentication.
6. Edge API tests for authentication, organization scoping, operation allowlist, safe errors, and no service-role/browser leakage.
7. UI tests for truthful states and safe routing.
8. Economic/privilege regression tests confirming security protection cannot bypass Accounting/Network/other domain RBAC.
9. Final `npm run typecheck`, `npm run test:unit`, `npm run test:integration`, `npm run build`, and `npm run verify:all` where the environment supports every verification dependency.

## Launch gates

The feature is not production-complete until:

- migrations are applied to the production Supabase project;
- production RP ID and expected origin are configured and verified;
- passkey registration/authentication succeeds on supported browsers/devices;
- session revocation is connected to a real Supabase/admin capability and failure is observable;
- no provider-dependent signal is shown as connected without real provider evidence;
- branch CI is green and reviewed;
- merge and production deployment are explicitly authorized.