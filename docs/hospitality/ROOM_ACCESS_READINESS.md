# ATLAS Hospitality Room Access — Readiness Gates

Date: 2026-09-11
Branch: `feat/hospitality-room-access`
PR: #75

## Implemented in branch

- ATLAS Hospitality protected route graph: Overview, Providers, Rooms, Credentials, Audit.
- Explicit Hospitality permissions and six-state provider readiness model.
- Organization/property-scoped provider instances, room mappings, and credential references migration.
- RLS read isolation; sensitive mutations reserved for the governed server-side Edge Function.
- Multi-provider registry with server-side runtime configuration by provider instance.
- SALTO readiness boundary for Space Hospitality and KS.
- Vingcard VConnect/Vostio/Visionline fail-closed adapter boundary.
- dormakaba/Saflok Ambiance Cloud/SOAP/REST/PMS Bridge fail-closed adapter boundary.
- Generic certified provider fail-closed boundary.
- Credential lifecycle orchestration requires explicit permission, live provider readiness, required capability, verified room mapping, provider success, persistence, and audit.
- Browser never receives provider runtime configuration or raw credential material.
- Direct remote door opening is not part of this milestone.

## External provider gates

### SALTO Space Hospitality

Connectivity/readiness can be checked non-destructively. Real issue/revoke behavior remains disabled until the exact authorized vendor request/response contract for the target hotel is supplied and verified. ATLAS must not infer or invent the credential request body.

### SALTO KS

Site visibility/readiness can be checked. Hotel room credential issuance remains disabled until the authorized property defines how ATLAS rooms map to SALTO KS access entities (users/access groups/time schedules/locks) and that mapping is verified.

### Vingcard

VConnect/Vostio/Visionline adapter boundaries exist. Real issue/revoke operations remain disabled until the target property or Vingcard provides the official supported interface definition, credentials/certificates, property identifiers, and any required certified-integrator access.

### dormakaba / Saflok

Ambiance Cloud/SOAP/REST/PMS Bridge adapter boundaries exist. Real issue/revoke operations remain disabled until the target property or dormakaba provides the official supported interface definition, credentials/certificates, property/system identifiers, and required integration version.

## Repository verification gate

Do not merge or deploy this branch until all of the following execute successfully on the exact PR head:

```bash
npm ci
npm run typecheck
npx vitest run tests/unit/hospitality-room-access.test.ts tests/unit/hospitality-provider-registry.test.ts tests/unit/hospitality-provider-adapters.test.ts
npx vitest run tests/integration/hospitality-schema-contract.test.ts tests/integration/hospitality-edge-contract.test.ts tests/integration/hospitality-routes.test.tsx tests/integration/hospitality-security-contract.test.ts
npm run test:unit
npm run test:integration
npm run build
```

Current infrastructure blocker: GitHub-hosted jobs have been ending before any workflow step runs, and the Hospitality self-hosted job has no assigned runner. This is not a passing or failing code verdict; it means repository validation is unavailable.

## Production gate

The Supabase migration and Edge Function/UI deployment remain unapplied to production until repository validation is green. Each real hotel/property then requires its own provider-specific controlled validation before that provider instance can be marked `ready`.
