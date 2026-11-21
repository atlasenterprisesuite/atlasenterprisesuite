# ATLAS Connection — owned-first closure ledger

## Canonical topology
ATLAS Connection (customer-facing services) → ATLAS Wireless (canonical service provider) → ATLAS-owned network control plane. The supported network modes are `atlas-owned`, `hybrid`, and `wholesale-fallback` as defined in `supabase/functions/_shared/atlas-wireless-network.ts`.

Gigs is **optional wholesale fallback**, not ATLAS's primary infrastructure, carrier identity, or automatic production provider. The adapter in `supabase/functions/_shared/gigs-gated-adapter.ts` is deliberately unconfigured and must not be registered as a live default provider.

## Source-level inventory
- `supabase/functions/_shared/atlas-wireless-network.ts`: tenant-scoped owned-network component evidence and public-service fail-closed gate.
- `supabase/functions/_shared/mvno.ts`: provider-neutral subscriber lifecycle and permissions.
- `supabase/functions/atlas-wireless-mvno/index.ts`: authenticated entrypoint; live mutations remain blocked.
- `supabase/functions/_shared/gigs-gated-adapter.ts`: optional Gigs boundary; no live requests.
- `tests/unit/atlas-wireless-owned-network.test.ts`: existing owned-network contract tests.

## Acceptance / evidence
1. **Source changes**: code reviewed on the exact branch SHA; no source-only claim of operational RF.
2. **Tests**: execute owned-network tests and Gigs negative tests; attach CI URLs and exact commit SHA.
3. **Owned 5G lab**: authenticated commissioning evidence for core, RAN, lawful spectrum/SAS where required, backhaul, subscriber profiles, device attach, data session and observability. Until then `labReady` is unverified.
4. **Public service**: separately validate interconnect, emergency-service readiness, billing/taxes, regulatory and commercial authority, current organization-scoped evidence, and E2E functionality. Until then public activation remains blocked.
5. **Wholesale fallback**: require provider authorization, credential validation, webhook signature verification, sandbox lifecycle tests, subscriber/number/eSIM evidence and verified operator capabilities. Do not enable Gigs merely because secrets exist.
6. **Release**: green CI, security review, merge policy, deployed exact-SHA verification and authenticated E2E evidence before marking production operational.

## Current verified state (2026-11-13)
A draft PR introduces a gated optional Gigs adapter and negative tests. GitHub accepted the commits and PR; no CI run or physical network commissioning evidence was confirmed in this review. This is **P0 NO-GO** for public cellular activation, not a blocker for further software development. No purchase, carrier contract, eSIM activation or production deployment is implied.
