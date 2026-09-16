# ATLAS Hospitality Hotel-Key Validation Status

Date: 2026-09-14
Branch: `feat/hospitality-us-ops-key-validation`
Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`

## Current classification

- `implementation_verified`: **YES for the current Room Access baseline**
- `external_gates_pending`: **YES**
- `provider_validation_ready`: **NO**
- `physical_key_test_passed`: **NO / NOT YET EXECUTABLE**
- `production_ready_for_property`: **NO**

## Fresh repository evidence

Hosted workflow: `Hospitality Key Validation CI`

Verified branch SHA: `5ffa3020ba20fbbb1edcb3379c093b4d48278a13`

Passed on that exact SHA:

- `npm ci`
- `npm run typecheck`
- focused Hospitality Room Access unit tests
- focused Hospitality Room Access integration/security/route/schema tests
- full unit suite
- full integration suite
- production build

The original self-hosted Hospitality job remained queued; a standard GitHub-hosted runner was used for evidence on the public repository.

## Existing Room Access capability

Current `main` contains:

- organization/property-scoped provider instances;
- room mappings;
- credential references;
- explicit Room Access permissions;
- provider readiness states;
- SALTO adapter boundary;
- Vingcard adapter boundary;
- dormakaba/Saflok adapter boundary;
- generic certified provider boundary;
- credential lifecycle API boundary;
- protected Hospitality UI and audit surface;
- secret-boundary and security regression tests.

PR #75 was merged to `main` on 2026-09-12.

## Why the physical key is not yet testable

No verified record currently identifies, for the intended Crowne Plaza Orlando reference property or another authorized pilot property:

1. the actual installed lock/access-control vendor and product/version;
2. the official provider interface/API/SDK/bridge authorized for that property;
3. provider credentials/certificates in an approved server-side secret boundary;
4. the provider's property identifier;
5. a verified ATLAS room -> provider room/lock mapping;
6. an explicitly designated test room/lock;
7. a legitimate checked-in stay or approved staff-test assignment;
8. the approved mobile-key/Wallet/provider-app transport for that installed system.

ATLAS must not infer these facts from a hotel brand, a photograph, or a mock response.

## Current normalized provider blockers

### SALTO Space Hospitality

Connectivity may be probed non-destructively when authorized configuration exists, but issuance remains blocked in current code until the exact authorized credential issuance/lifecycle contract is verified.

### SALTO KS

Site visibility may be checked, but hotel room-key issuance remains blocked until the property defines and verifies the required room/access mapping semantics.

### Vingcard

Issuance remains blocked until an official supported property interface and required credentials/certificates are supplied and verified.

### dormakaba / Saflok

Issuance remains blocked until an official supported Ambiance/PMS integration contract and required credentials/certificates are supplied and verified.

### Other / Onity DirectKey

Historical design exists for a dedicated official-provider adapter path, but no production adapter may be fabricated without the authorized contract/configuration for the actual property.

## Next executable gate

The next gate is **provider/property discovery and non-destructive readiness**, not bypass or reverse engineering.

Required input from the authorized property/integration side:

- property identity;
- lock vendor/system/version;
- official supported integration path;
- provider onboarding/credentials or certified bridge;
- designated test room/lock;
- permission to perform controlled issuance/revocation tests.

Once those facts exist, ATLAS can:

1. configure the provider instance server-side;
2. run non-destructive readiness;
3. verify property mapping;
4. verify room mapping;
5. establish an authorized test assignment;
6. issue through the official provider operation;
7. provision through the supported Wallet/provider app when applicable;
8. test the designated physical lock;
9. test replacement/room change where approved;
10. test revocation/checkout;
11. review audit evidence and secret boundaries.

Only successful completion of those controlled steps can set `physical_key_test_passed = true`.
