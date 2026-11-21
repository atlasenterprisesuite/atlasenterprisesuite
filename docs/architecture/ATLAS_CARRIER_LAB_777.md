# ATLAS Carrier Lab 777 — phase 1

The Carrier Lab is a deterministic, **offline-only** simulation engine for voice, SMS, data and eSIM lifecycle scenarios.

## Implemented

- Pure TypeScript simulator in `supabase/functions/_shared/carrier-lab.ts`
- Seeded repeatability with bounded batches (1–10,000 events per run)
- Scenarios: success, provider unavailable, timeout, unauthorized
- Synthetic-only events: no allocated MSISDN, no eSIM profile, no provider evidence
- Tenant and actor identity required in the request contract
- Unit tests for determinism, failures, all channels and limits

## Not implemented / not certified

- Authenticated server endpoint, persisted run ledger, RBAC enforcement, web dashboard, distributed load tests
- Real WebRTC calling between devices, eSIM provisioning or cellular/PSTN traffic
- Carrier contract, E911, real provider validation, live number or live eSIM

## Acceptance gates for next phases

1. Add authenticated organization-scoped execution endpoint with `wireless.mvno.admin` or dedicated lab permission, bounded rate limits and server-side audit.
2. Persist a run summary and immutable evidence hash without logging PII or credentials.
3. Add dashboard to existing ATLAS MVNO Control Plane; show simulation badge on every result.
4. Implement opt-in WebRTC peer-to-peer testing over Wi-Fi with authorization, STUN/TURN readiness, secure signaling and explicit media permissions.
5. Enable real carrier adapters only after provider account, billing approval, E911 obligations, test MSISDN/eSIM and end-to-end evidence.

**No finite cellular or PSTN service is advertised as unlimited.** Offline synthetic tests are repeatable but bounded per execution for resource safety.
