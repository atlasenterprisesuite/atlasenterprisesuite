# ATLAS Wireless — Private Line Enrollment Pilot

Status: PRIVATE TABLE AND GUARDED SQL RPC APPLIED TO ATLAS CORE / WEB PR DRAFT / AUTHENTICATED E2E NOT VERIFIED.
The live Supabase project has 100/100 Edge Function slots; a new Edge Function was rejected
with PaymentRequiredException. No subscription upgrade, service deletion or plan change was performed.
This work reuses ATLAS Connect, the existing MVNO permission model, organization membership,
Supabase Auth and the carrier control plane. It does not activate a commercial provider.

## Explicitly different states
- **Self-attested line claim**: an authenticated organization member with `wireless.mvno.read`
  asserts authority over a North American number. The stored request is private and
  `pending_verification`, never proof of ownership.
- **Verified control of a number**: requires a carrier-approved challenge or authoritative
  verification of the account holder, identity and number. Not implemented by this pilot.
- **ATLAS assigned/active number**: requires licensed or authorized carrier allocation,
  signed provider evidence, tenant scope, E911 readiness where applicable, real service
  tests and the separate `atlas_number_resources` truth gate. Not implemented.

## Data security
- `atlas_wireless_line_claims`: RLS enabled, direct anon/authenticated table privileges
  revoked. A PostgreSQL private-schema SECURITY DEFINER implementation authenticates each caller,
  enforces current-user ownership and organization membership/RBAC. Public RPC wrappers are SECURITY INVOKER.
- Existing Supabase Auth JWT is validated by PostgREST; private SQL routines derive caller from
  `auth.uid()`, enforce live organization membership and `wireless.mvno.read`. Both RPCs use POST;
  list returns only the authenticated current user's claims.
- Uniqueness is scoped to each applicant as well as organization to avoid cross-user number-enumeration via duplicate errors.
- Only masked numbers appear in API responses. Full E.164 is stored solely in the private
  database, not in source control, issue comments, URL parameters or telemetry.
- The record carries explicit consent/assertion time. It is a registration *request*, not a
  telecom contract, port-in instruction or carrier service activation.
- No public rollout until security review, organization-isolation negative tests,
  the SQL RPC migration, guarded E2E checks and exact-SHA verification have passed.

## Operator transition: external gates
1. Identify the current carrier via authorized account evidence, not from a screenshot alone.
2. Verify the applicant controls the account and number; where service is suspended,
   use the operator's official non-SMS verification path.
3. Obtain written approval and wholesale access from the chosen MVNO/MVNE provider.
4. Complete porting, identity, E911, taxation, CPNI/security and subscriber support readiness.
5. Implement signed provider adapters, auditable lifecycle and exact-provider evidence,
   including eSIM, voice, data and SMS test inventory.
6. Port only through an authorized provider workflow. Never cancel the existing line
   prematurely. A phone showing `No SIM restrictions` is device unlock evidence only.

## P0 acceptance gates
- [ ] Integration tests exercise real authenticated/unauthenticated requests and cross-org denial
- [ ] Security validation of restricted private definer functions, invoker wrappers, RLS and PII redaction
- [x] Base SQL table migration applied to ATLAS Core with RLS enabled and anon/authenticated table access denied (verified 2026-11-13)
- [x] SQL RPC migration applied as Supabase version 20261113145248; private and public execute privileges verified 2026-11-13
- [ ] Private SQL RPCs deployed and execute privileges checked; anonymous-context negative tests passed. Real cross-tenant authenticated E2E and monitoring remain pending
- [ ] Web build, unit/integration tests, security checks and CI exact-SHA pass
- [ ] Signed-in user submits line in production, reads back masked pending record
- [ ] Provider ownership proof and live MVNO authorization before any change to verified/active
- [ ] Separate authorized porting consent and evidence prior to changing carriers

## Pilot safety note
Do not paste real telephone numbers, EIDs/IMEIs, verification codes or carrier-account
credentials in public GitHub issues or PRs.
