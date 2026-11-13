# ATLAS Wireless — Private Line Enrollment Pilot

Status: IMPLEMENTATION IN DRAFT BRANCH / NOT DEPLOYED / NOT VERIFIED IN PRODUCTION.
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
  revoked. Service-role access restricted to a server-only Edge Function.
- JWT `verify_jwt=true`, explicit active organization, live membership check, and
  `wireless.mvno.read` permission on every request. GET returns only current user's claims.
- Uniqueness is scoped to each applicant as well as organization to avoid cross-user number-enumeration via duplicate errors.
- Only masked numbers appear in API responses. Full E.164 is stored solely in the private
  database, not in source control, issue comments, URL parameters or telemetry.
- The record carries explicit consent/assertion time. It is a registration *request*, not a
  telecom contract, port-in instruction or carrier service activation.
- No public rollout until security review, organization-isolation negative tests,
  the edge deployment and exact-SHA E2E verification have passed.

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
- [ ] Security validation of service-role usage, RLS and PII redaction
- [ ] SQL migration applied through an authorized and reversible deployment process
- [ ] `atlas-wireless-line` function deployed with JWT verification and monitored
- [ ] Web build, unit/integration tests, security checks and CI exact-SHA pass
- [ ] Signed-in user submits line in production, reads back masked pending record
- [ ] Provider ownership proof and live MVNO authorization before any change to verified/active
- [ ] Separate authorized porting consent and evidence prior to changing carriers

## Pilot safety note
Do not paste real telephone numbers, EIDs/IMEIs, verification codes or carrier-account
credentials in public GitHub issues or PRs.
