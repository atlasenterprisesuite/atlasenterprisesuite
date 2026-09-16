# ATLAS Hospitality Room Access — Readiness Gates

Date: 2026-09-14
Original implementation PR: #75
Current validation branch: `feat/hospitality-us-ops-key-validation`

## Implemented and merged

PR #75 was merged into `main` on 2026-09-12. Current `main` contains:

- ATLAS Hospitality protected route graph: Overview, Providers, Rooms, Credentials, Audit;
- explicit Hospitality permissions and six-state provider readiness model;
- organization/property-scoped provider instances, room mappings, and credential references migration source;
- RLS read isolation with sensitive mutations behind the governed server-side Edge Function;
- multi-provider registry with server-side runtime configuration by provider instance;
- SALTO readiness boundary for Space Hospitality and KS;
- Vingcard VConnect/Vostio/Visionline fail-closed adapter boundary;
- dormakaba/Saflok Ambiance Cloud/SOAP/REST/PMS Bridge fail-closed adapter boundary;
- generic certified provider fail-closed boundary;
- credential lifecycle orchestration that requires permission, provider readiness, capability, verified room mapping, provider success, persistence, and audit;
- browser secret boundaries that exclude provider runtime configuration and raw credential material;
- no direct remote-door-opening operation.

## Fresh repository verification gate

A standard GitHub-hosted workflow executed successfully on branch SHA:

`5ffa3020ba20fbbb1edcb3379c093b4d48278a13`

Passed on that exact SHA:

```bash
npm ci
npm run typecheck
npx vitest run tests/unit/hospitality-room-access.test.ts tests/unit/hospitality-provider-registry.test.ts tests/unit/hospitality-provider-adapters.test.ts
npx vitest run tests/integration/hospitality-schema-contract.test.ts tests/integration/hospitality-edge-contract.test.ts tests/integration/hospitality-routes.test.tsx tests/integration/hospitality-security-contract.test.ts
npm run test:unit
npm run test:integration
npm run build
```

Therefore the current Room Access code baseline is classified `implementation_verified`.

The self-hosted Hospitality workflow may still queue when no compatible runner is online, but repository verification is no longer blocked because the hosted public-repository validation path executed successfully.

## External provider gates

A green repository does not mark a real hotel provider `ready`.

### SALTO Space Hospitality

Connectivity/readiness can be checked non-destructively when authorized configuration exists. Real issue/revoke behavior remains disabled until the exact authorized vendor request/response contract for the target hotel is supplied and verified. ATLAS must not infer or invent the credential request body.

### SALTO KS

Site visibility/readiness can be checked. Hotel room credential issuance remains disabled until the authorized property defines how ATLAS rooms map to SALTO KS access entities and that mapping is verified.

### Vingcard

VConnect/Vostio/Visionline adapter boundaries exist. Real issue/revoke operations remain disabled until the target property or Vingcard provides the official supported interface definition, credentials/certificates, property identifiers, and required certified-integrator access when applicable.

### dormakaba / Saflok

Ambiance Cloud/SOAP/REST/PMS Bridge adapter boundaries exist. Real issue/revoke operations remain disabled until the target property or dormakaba provides the official supported interface definition, credentials/certificates, property/system identifiers, and required integration version.

### Other provider families

A dedicated provider adapter may be added only from an official authorized contract. ATLAS must not reverse engineer lock protocols, clone credentials, or infer mobile-key capability from a brand/photo alone.

## Property-specific key-validation gate

Before a provider instance can become `provider_validation_ready`, all applicable items must exist:

1. authorized property identity;
2. actual installed access-control vendor/system/version;
3. official supported integration interface for that property;
4. provider credentials/certificates stored server-side;
5. provider property identifier;
6. verified ATLAS-property mapping;
7. verified ATLAS-room -> provider room/lock mapping;
8. legitimate checked-in stay or approved staff-test assignment;
9. supported access transport/platform;
10. explicit permission for controlled issuance/revocation and physical lock validation.

## Controlled physical validation

A physical hotel-key pass requires all of the following evidence for an explicitly designated test lock:

1. provider readiness confirmed;
2. room mapping verified;
3. authorized test assignment established;
4. provider confirms credential issuance and returns only an opaque credential reference to ATLAS;
5. official device/Wallet/provider-app provisioning completes when applicable;
6. the credential successfully operates the designated physical lock;
7. replacement/room-change lifecycle is tested when in scope;
8. checkout/revocation is provider-confirmed;
9. ATLAS audit evidence correlates the lifecycle;
10. no raw credential material or provider secret appears in ATLAS business storage/browser responses/log evidence.

Only then may `physical_key_test_passed` become true. `production_ready_for_property` requires the complete property/provider lifecycle, not only initial door access.

See `KEY_VALIDATION_STATUS.md` for current classification and exact blockers.
