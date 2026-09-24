# ATLAS Insurance Verification Design

## Purpose

Build the first production slice of ATLAS Insurance from the approved six-digit verification reference. The screen is a product specification, not an asset to embed. ATLAS will implement its own branded, accessible verification experience and reuse the existing ATLAS Identity, tenant, and permission boundaries.

## Classification

- Primary module: ATLAS Insurance
- Primary capability: member/policy verification
- Security integration: ATLAS Identity
- Secondary integrations: ATLAS Health for medical coverage context; ATLAS Finance / ATLAS Pay for premiums, copays, and insurance payments

## Scope

The first slice supports both approved verification contexts:

1. General ATLAS Insurance access re-verification.
2. Verification bound to a specific member/policy operation.

The same six-digit challenge engine is reused by both contexts. No insurer, policy, member, claim, premium, or eligibility data is fabricated.

## Routes

- `/insurance` — Insurance Hub landing page behind ATLAS Identity.
- `/insurance/verify` — six-digit verification screen.
- `/insurance/verify?scope=insurance_access` — general insurance re-verification.
- `/insurance/verify?scope=member_policy&resource=<opaque-id>&returnTo=<authorized-atlas-path>` — scoped member/policy verification.

`returnTo` must be restricted to approved ATLAS Insurance destinations and must reject external, protocol-relative, backslash, or unsupported paths.

## Navigation

ATLAS Enterprise Home exposes ATLAS Insurance only after the route and tests exist. The Insurance Hub links into verification-dependent capabilities. Protected insurance routes redirect unauthenticated users through ATLAS Identity, preserving the intended insurance destination.

Flow:

`ATLAS Identity -> active organization -> insurance route -> verification challenge -> six-digit code -> verified insurance session -> authorized destination`

## UI

The verification page preserves the functional hierarchy of the reference while using ATLAS branding:

- ATLAS Insurance secure-access header.
- Clear title: `Enter your verification code`.
- Single six-digit numeric code field optimized for mobile OTP entry.
- Continue button disabled until exactly six digits are present.
- Resend Code action.
- Delivery destination shown only in masked form when available.
- Loading, disabled, rate-limited, expired, invalid-code, delivery-unavailable, success, and generic error states.
- Keyboard, screen-reader, reduced-motion, mobile, tablet, and desktop support.
- No third-party branding or copied illustration.

## Verification domain model

A challenge is tenant-bound, user-bound, scope-bound, and short-lived.

### Challenge fields

- `id: uuid`
- `org_id: uuid`
- `user_id: uuid`
- `scope: 'insurance_access' | 'member_policy'`
- `resource_id: text | null`
- `code_hash: text`
- `delivery_channel: 'email'`
- `delivery_target_masked: text`
- `expires_at: timestamptz`
- `consumed_at: timestamptz | null`
- `attempt_count: integer`
- `resend_count: integer`
- `created_at: timestamptz`
- `updated_at: timestamptz`

The plaintext code is never persisted.

## Verification session

Successful verification creates a short-lived verification grant that can be checked by subsequent insurance operations.

Grant fields:

- `id: uuid`
- `org_id: uuid`
- `user_id: uuid`
- `scope`
- `resource_id: text | null`
- `verified_at: timestamptz`
- `expires_at: timestamptz`
- `challenge_id: uuid`

A grant is not a replacement for authentication, organization membership, or RBAC. All four checks remain required where applicable: authentication, active organization, permission, and verification grant.

## Backend boundary

Implement a Supabase Edge Function `atlas-insurance-verification` with three operations:

- `issue` — create a fresh challenge and deliver a code.
- `verify` — validate a six-digit code and create a verification grant.
- `resend` — rotate the code for an existing active challenge and deliver the replacement.

All operations derive `user_id` from the authenticated request and derive/validate `org_id` through active organization membership. Client-supplied organization IDs are not trusted.

## Code handling

- Generate a cryptographically secure six-digit code on the server.
- Hash the code with a server-side secret before persistence.
- Constant-time compare derived values during verification.
- Default expiry: 10 minutes.
- Maximum verification attempts per challenge: 5.
- Default resend cooldown: 60 seconds.
- Maximum resends per challenge: 3.
- Successful verification consumes the challenge.
- Expired, consumed, or locked challenges cannot be reused.

## Delivery

Initial delivery channel is email because no repository-level SMS provider integration exists today.

The delivery adapter is explicit. If no authorized email provider/server configuration is available in the deployed Supabase environment, `issue` and `resend` return `delivery_not_configured`. The frontend must show a configuration state rather than claiming a code was sent.

No provider credentials are committed to the repository.

## Data security

- Tables use RLS.
- Users may not read `code_hash`.
- Challenge/grant rows are tenant- and user-scoped.
- Sensitive mutations occur through the Edge Function rather than direct browser inserts.
- Rate limits and attempt counters are server-controlled.
- Resource IDs are opaque identifiers; the verification screen does not expose policy/member PII.
- Audit events are written for issue, resend, success, failure, lockout, and delivery configuration failure.

## Frontend structure

Create a focused module under `apps/web/src/modules/insurance/`:

- `InsuranceRoutes.tsx` — route graph for `/insurance` and `/insurance/verify`.
- `InsuranceHome.tsx` — module landing page with real configuration/empty states.
- `InsuranceVerificationPage.tsx` — OTP UI and interaction state machine.
- `insuranceApi.ts` — typed calls to the Edge Function and grant check helpers.
- `insurance.css` — responsive module styles.

Update existing routing and identity allow-list so `/insurance` can round-trip through ATLAS Identity.

## Error contract

Backend errors are stable machine-readable codes. Frontend maps them to user-safe messages.

Required codes:

- `authentication_required`
- `no_active_organization`
- `invalid_scope`
- `invalid_resource`
- `invalid_code_format`
- `invalid_code`
- `challenge_expired`
- `challenge_consumed`
- `challenge_locked`
- `resend_cooldown`
- `resend_limit_reached`
- `delivery_not_configured`
- `delivery_failed`
- `verification_required`

## Permissions

The module reuses existing organization membership and RBAC patterns. The first slice does not invent insurer-specific roles. Access requires an authenticated user with an active ATLAS organization. Future claim, underwriting, broker, and payer roles can extend the permission model without changing the challenge engine.

## Testing

Tests must cover:

- identity target sanitization for `/insurance`.
- insurance `returnTo` sanitization.
- six-digit validation.
- disabled/ready UI states.
- issue/verify/resend API payload contracts.
- expiration, lockout, resend cooldown, and resend limit logic.
- challenge consumption after success.
- tenant/user isolation and RLS policies.
- delivery-not-configured behavior.
- route presence and protected navigation.
- production typecheck, unit/integration suite, and build.

## Production behavior

No UI state may claim a code was delivered unless the backend confirms delivery. No insurance metrics or policy/member data are shown until real sources exist. If the delivery dependency is not configured, the module remains structurally functional through the real dependency boundary and explicitly reports that configuration is required.

## Acceptance criteria

1. `/insurance` and `/insurance/verify` exist and are protected by ATLAS Identity.
2. ATLAS Identity safely accepts `/insurance` destinations.
3. Verification accepts only exactly six numeric digits.
4. Issue/resend/verify use authenticated, tenant-scoped backend operations.
5. Plaintext codes are never persisted.
6. Expiry, attempt limits, resend cooldown, and resend limits are enforced server-side.
7. Successful verification creates a short-lived scoped grant and consumes the challenge.
8. Delivery failures/configuration gaps are represented truthfully.
9. The UI is responsive and accessible and does not copy Athenahealth branding.
10. Typecheck, tests, build, and affected route verification pass before merge/deploy.
